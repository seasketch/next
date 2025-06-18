import RTreeIndex, {
  calculatePackedRTreeDetails,
  OffsetAndLength,
} from "./rtree";
import { ByteBuffer } from "flatbuffers";
import { GeometryType } from "flatgeobuf/lib/mjs/generic.js";
import {
  Feature as GeoJSONFeature,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import { HeaderMeta } from "flatgeobuf";
import { fromByteBuffer } from "flatgeobuf/lib/mjs/header-meta.js";
import { FetchManager, FetchRangeFn } from "./fetch-manager";
import {
  createQueryPlan,
  executeQueryPlan,
  QueryPlanOptions,
  QueryPlanRequest,
} from "./query-plan";
import {
  parseFeatureData,
  validateFeatureData,
  FeatureWithMetadata,
  parseProperties,
} from "./feature-parser";
import {
  QUERY_PLAN_DEFAULTS,
  HEADER_FETCH_SIZE,
  SIZE_PREFIX_LEN,
  DEFAULT_CACHE_SIZE,
  MAGIC_BYTES,
} from "./constants";
import bytes from "bytes";

/**
 * Represents a byte size that can be specified as either a number of bytes
 * or a string that will be parsed using the bytes module (e.g. "5MB", "1GB").
 */
export type ByteSize = number | string;

/**
 * Represents a bounding box with minimum and maximum coordinates.
 * Used for spatial queries to specify the area to search for features.
 *
 * @example
 * ```typescript
 * const bbox: Envelope = {
 *   minX: -180, // westernmost coordinate
 *   minY: -90,  // southernmost coordinate
 *   maxX: 180,  // easternmost coordinate
 *   maxY: 90    // northernmost coordinate
 * };
 * ```
 */
export type Envelope = {
  /** Westernmost coordinate (minimum X) */
  minX: number;
  /** Southernmost coordinate (minimum Y) */
  minY: number;
  /** Easternmost coordinate (maximum X) */
  maxX: number;
  /** Northernmost coordinate (maximum Y) */
  maxY: number;
};

/**
 * Use to implement custom fetching logic, such as from an R2 bucket. Accepts
 * a byte range and returns a promise that resolves to an ArrayBuffer.
 */
export type FetchRangeByKeyFn = (
  key: string,
  range: [number, number | null]
) => Promise<ArrayBuffer>;

/**
 * Configuration options for creating a new FlatGeobufSource instance.
 */
export type CreateSourceOptions = {
  /**
   * Custom function for fetching byte ranges from the source.
   * If not provided, the source will use the default fetch implementation.
   */
  fetchRangeFn?: FetchRangeByKeyFn;
  /**
   * Maximum size of the feature data cache in bytes.
   * Can be specified as a number of bytes or a string (e.g. "5MB", "1GB").
   * Defaults to 5MB.
   */
  maxCacheSize?: ByteSize;
  /**
   * Initial size of the header request in bytes.
   * Can be specified as a number of bytes or a string (e.g. "5MB", "1GB").
   * If not provided, defaults to HEADER_FETCH_SIZE.
   * Use this when you know your dataset has a large spatial index.
   */
  initialHeaderRequestLength?: ByteSize;
  /**
   * Amount of space allowed between features before splitting requests.
   * Can be specified as a number of bytes or a string (e.g. "5MB", "1GB").
   * If not provided, defaults to QUERY_PLAN_DEFAULTS.overfetchBytes.
   * Use this to control how aggressively ranges are merged.
   */
  overfetchBytes?: ByteSize;
};

/**
 * Parse a byte size that can be either a number or a string.
 * @param size - The size to parse, either as a number of bytes or a string (e.g. "5MB")
 * @returns The size in bytes as a number, or undefined if size is undefined or null
 */
function parseByteSize(size?: ByteSize | null): number | undefined {
  if (size === undefined || size === null) return undefined;
  if (typeof size === "number") return size;
  return bytes(size) ?? undefined;
}

/**
 * FlatGeobuf data source class. Provides methods to query features from a
 * flatgeobuf file. Features are streamed to minimize memory usage, and an
 * LRU cache is used to minimize network requests.
 *
 * You probably do not want to use this class directly. Instead, use the
 * `createSource` function to create a source instance.
 *
 * @example
 * ```typescript
 * const source = await createSource('https://example.com/data.fgb');
 * for await (const feature of source.getFeaturesAsync(bbox)) {
 *   console.log(feature);
 * }
 * ```
 */
export class FlatGeobufSource<T = GeoJSONFeature> {
  /** Url for fgb, unless fetchRangeFn is specified  */
  private url?: string;
  /** Custom method provided to createSource used to fetch fgb byte ranges */
  private fetchRangeFn?: FetchRangeFn;
  /** fgb header metadata */
  header: HeaderMeta;
  /** Spatial index for bounding box queries */
  private index: RTreeIndex;
  /** offset from the start of the fgb to the first feature data byte */
  private featureDataOffset: number;
  /** Manages fetching and caching of byte ranges */
  private fetchManager: FetchManager;
  /** Amount of space allowed between features before splitting requests */
  private overfetchBytes?: number;

  /**
   * Should not be called directly. Instead initialize using createSource(),
   * which will generate the necessary metadata and spatial index.
   */
  constructor(
    urlOrFetchRangeFn: string | FetchRangeFn,
    header: HeaderMeta,
    index: RTreeIndex,
    featureDataOffset: number,
    maxCacheSize: ByteSize = DEFAULT_CACHE_SIZE,
    overfetchBytes?: ByteSize
  ) {
    if (typeof urlOrFetchRangeFn === "string") {
      this.url = urlOrFetchRangeFn;
    } else {
      this.fetchRangeFn = urlOrFetchRangeFn;
    }
    this.header = header;
    this.index = index;
    this.featureDataOffset = featureDataOffset;
    this.fetchManager = new FetchManager(
      urlOrFetchRangeFn,
      parseByteSize(maxCacheSize)
    );
    this.overfetchBytes = parseByteSize(overfetchBytes);
  }

  /**
   * Get cache statistics
   */
  get cacheStats() {
    return this.fetchManager.cacheStats;
  }

  /**
   * Clear the feature data cache
   */
  clearCache() {
    this.fetchManager.clearCache();
  }

  /**
   * Bounds of the source, as determined from the spatial index.
   */
  get bounds() {
    return {
      minX: this.index.minX,
      minY: this.index.minY,
      maxX: this.index.maxX,
      maxY: this.index.maxY,
    };
  }

  /**
   * Size of the index in bytes, which approximates the size this data source
   * occupies in memory.
   */
  get indexSizeBytes() {
    return this.index.byteLength;
  }

  /**
   * Geometry type of the source.
   */
  get geometryType(): keyof typeof GeometryType {
    return GeometryType[this.header.geometryType] as keyof typeof GeometryType;
  }

  /**
   * Get features within a bounding box. Features are streamed to minimize
   * memory usage. Each feature is deserialized to GeoJSON before being yielded.
   *
   * Memory usage is minimized by deserializing features to GeoJSON individually
   * before yielding them. If you need to minimize memory usage in an
   * environment like cloudflare workers, you need only concern yourself with
   * the memory usage of the binary bytes fetched + the GeoJSON size of only
   * the single largest feature being processed at any given time.
   *
   * @param bbox - Single bounding box or array of bounding boxes to query
   * @param options - Query options
   * @returns AsyncGenerator yielding GeoJSON features with metadata
   *
   * @example
   * ```typescript
   * const bbox = { minX: -180, minY: -90, maxX: 180, maxY: 90 };
   * for await (const feature of source.getFeaturesAsync(bbox)) {
   *   console.log(feature);
   * }
   * ```
   */
  async *getFeaturesAsync(
    bbox: Envelope | Envelope[],
    options?: QueryPlanOptions & {
      /**
       * If set true, the cache will be warmed by fetching all features in the
       * bounding box. These features are not parsed or yielded.
       */
      warmCache?: boolean;
    }
  ): AsyncGenerator<FeatureWithMetadata<T>> {
    // extract queryplanoptions and QueryExecutionOptions into separate objects
    options = {
      ...QUERY_PLAN_DEFAULTS,
      ...options,
      overfetchBytes: this.overfetchBytes ?? options?.overfetchBytes,
    };
    let queryPlan: QueryPlanRequest[] = [];
    if (!Array.isArray(bbox)) {
      bbox = [bbox];
    }
    for (const b of bbox) {
      if (!this.index) {
        throw new Error("Spatial index not available");
      }
      const results = await this.index.search(b.minX, b.minY, b.maxX, b.maxY);
      const plan = createQueryPlan(results, this.featureDataOffset, options);
      for (const part of plan) {
        // check if the range is already in the query plan
        const existing = queryPlan.find(
          (p) => p.range[0] === part.range[0] && p.range[1] === part.range[1]
        );
        if (!existing) {
          // if not, add it to the query plan
          queryPlan.push(part);
        }
      }
    }
    // calculate total bytes needed
    let bytes = 0;
    for (const { range } of queryPlan) {
      bytes += range[1] ? range[1] - range[0] : 0;
    }
    for await (const [data, offset] of executeQueryPlan(
      queryPlan,
      this.fetchManager.fetchRange.bind(this.fetchManager),
      options
    )) {
      if (options.warmCache) {
        continue;
      }
      const bytes = new Uint8Array(data.buffer);
      const bytesAligned = new Uint8Array(data.byteLength);
      bytesAligned.set(
        bytes.slice(data.byteOffset, data.byteOffset + data.byteLength),
        0
      );
      const feature = parseFeatureData(offset, bytesAligned, this.header);
      yield feature as unknown as FeatureWithMetadata<T>;
    }
  }

  /**
   * Scan all features in the source. Does not use the spatial index, but
   * rather fetches the entire feature data section and iterates through it.
   *
   * Features are not deserialized to GeoJSON until they are yielded, reducing
   * memory usage.
   *
   * @returns AsyncGenerator yielding GeoJSON features with metadata
   *
   * @example
   * ```typescript
   * for await (const feature of source.scanAllFeatures()) {
   *   console.log(feature);
   * }
   * ```
   */
  async *scanAllFeatures(): AsyncGenerator<
    T & {
      properties: GeoJsonProperties & {
        __byteLength: number;
        __offset: number;
      };
    }
  > {
    const data = await this.fetchManager.fetchRange([
      this.featureDataOffset,
      null,
    ]);
    // iterate through the data, checking the size prefix to determine the
    // length of each feature, parsing and yielding each feature
    const view = new DataView(data);
    let offset = 0;
    while (offset < data.byteLength) {
      const size = view.getUint32(offset, true);
      const bytesAligned = new Uint8Array(data, offset, size + SIZE_PREFIX_LEN);
      validateFeatureData(view, size + SIZE_PREFIX_LEN);
      const feature = parseFeatureData(offset, bytesAligned, this.header);
      yield feature as unknown as T & {
        properties: GeoJsonProperties & {
          __byteLength: number;
          __offset: number;
        };
      };
      offset += size + SIZE_PREFIX_LEN;
    }
  }

  async *getFeatureProperties(): AsyncGenerator<{
    properties: GeoJsonProperties & {
      __byteLength: number;
      __offset: number;
    };
  }> {
    /**
     * This method returns an async generator for feature properties only.
     * This is useful for performance when you only need the properties of features.
     * It avoids parsing geometry data, which can be expensive.
     */
    const data = await this.fetchManager.fetchRange([
      this.featureDataOffset,
      null,
    ]);
    const view = new DataView(data);
    let offset = 0;
    while (offset < data.byteLength) {
      const size = view.getUint32(offset, true);
      const bytesAligned = new Uint8Array(data, offset, size + SIZE_PREFIX_LEN);
      const bb = new ByteBuffer(bytesAligned);
      bb.setPosition(SIZE_PREFIX_LEN);
      yield {
        properties: parseProperties(bb, this.header.columns, offset),
      };
      offset += size + SIZE_PREFIX_LEN;
    }
  }
}

/**
 * Create a FlatGeobufSource from a URL or a custom fetchRange function. The
 * Promise will not be resolved until the source is fully initialized, loading
 * the header and spatial index data.
 *
 * @param urlOrKey - URL or key to fetch the source from. If a key is provided,
 * the fetchRangeFn will be used to fetch the source.
 * @param options - Options for creating the source.
 * @returns Promise<FlatGeobufSource<T>>
 */
export async function createSource<
  T = GeoJSONFeature<Geometry, GeoJsonProperties>
>(
  urlOrKey: string,
  options?: CreateSourceOptions
): Promise<FlatGeobufSource<T>> {
  const fetchRangeFnOption = options?.fetchRangeFn;
  const maxCacheSize = parseByteSize(options?.maxCacheSize);
  const initialHeaderRequestLength =
    parseByteSize(options?.initialHeaderRequestLength) ?? HEADER_FETCH_SIZE;
  const overfetchBytes = parseByteSize(options?.overfetchBytes);
  const fetchRange =
    fetchRangeFnOption && typeof fetchRangeFnOption === "function"
      ? (range: [number, number | null]) => {
          return fetchRangeFnOption(urlOrKey, range);
        }
      : (range: [number, number | null]) => {
          return fetch(urlOrKey, {
            headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
          }).then((response) => response.arrayBuffer());
        };

  let headerData = await fetchRange([0, initialHeaderRequestLength]);

  const view = new DataView(headerData);

  // Verify magic bytes
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (view.getUint8(i) !== MAGIC_BYTES[i] && i < MAGIC_BYTES.length - 1) {
      throw new Error("Invalid FlatGeobuf file (magic bytes mismatch)");
    }
  }

  // Create ByteBuffer from data after magic bytes
  // Offset is magic bytes length + 4 bytes for the prefixed header size
  const offset = MAGIC_BYTES.length + 4;
  const bb = new ByteBuffer(new Uint8Array(headerData, offset));
  // get header size. It should be an 32-bit unsigned integer directly following
  // the magic bytes
  const headerSize = view.getUint32(MAGIC_BYTES.length, true);
  // @ts-ignore
  const header = fromByteBuffer(bb);
  const featuresCount = header.featuresCount;
  const indexNodeSize = header.indexNodeSize;
  if (!indexNodeSize) {
    throw new Error("FlatGeobuf file does not contain a spatial index");
  }

  const rtreeDetails = calculatePackedRTreeDetails(
    featuresCount,
    indexNodeSize
  );
  const indexSize = rtreeDetails.nodesByteSize;
  const indexOffset = headerSize + MAGIC_BYTES.length + 4;

  if (headerData.byteLength < indexOffset + indexSize) {
    headerData = await fetchRange([0, indexOffset + indexSize]);
  }
  const indexData = headerData.slice(indexOffset, indexOffset + indexSize);
  const index = new RTreeIndex(indexData, rtreeDetails);
  const source = new FlatGeobufSource<T>(
    fetchRange,
    header,
    index,
    indexOffset + indexSize,
    maxCacheSize,
    overfetchBytes
  );
  return source;
}
