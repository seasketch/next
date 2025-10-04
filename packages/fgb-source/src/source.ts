import RTreeIndex, {
  calculatePackedRTreeDetails,
  FeatureReference,
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
  VALIDATE_FEATURE_DATA,
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
  /**
   * Page size to use for internal page-cached range fetching. Defaults to 5MB.
   * Accepts a number of bytes or a string like "5MB".
   */
  pageSize?: ByteSize;
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
  private fetchRangeFn: FetchRangeFn;
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
  private pages: number[];

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
    overfetchBytes?: ByteSize,
    fileByteLength?: number,
    pageSize?: ByteSize
  ) {
    if (typeof urlOrFetchRangeFn === "string") {
      this.url = urlOrFetchRangeFn;
      this.fetchRangeFn = this.defaultFetchRange;
    } else {
      this.fetchRangeFn = urlOrFetchRangeFn;
    }

    this.header = header;
    this.index = index;

    this.featureDataOffset = featureDataOffset;
    this.fetchManager = new FetchManager(
      urlOrFetchRangeFn,
      parseByteSize(maxCacheSize),
      this.featureDataOffset,
      fileByteLength,
      parseByteSize(pageSize)
    );
    this.overfetchBytes = parseByteSize(overfetchBytes);
    const offsets = this.index.getFeatureOffsets();

    // console.log("offset length", offsets.length);
    const pages: number[] = [this.featureDataOffset];
    const pageSizeLimit = parseByteSize(pageSize || "1MB")!;
    let currentRefs = [];
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      const fileOffset = offset + this.featureDataOffset;
      let pageBytes = fileOffset - pages[pages.length - 1];
      if (
        currentRefs.length > 0 &&
        (pageBytes > pageSizeLimit || i === offsets.length - 1)
      ) {
        // console.log(`Over limit (${pageBytes} > ${pageSizeLimit})`);
        // console.log("pushing page", pages.length, fileOffset, currentRefs);
        pages.push(fileOffset);
        currentRefs = [];
      } else {
        currentRefs.push(fileOffset);
      }
    }
    this.pages = pages;
    // console.log("pages", pageSizeLimit, this.pages);
  }

  private async defaultFetchRange(
    range: [number, number | null]
  ): Promise<ArrayBuffer> {
    if (!this.url) {
      throw new Error("Misconfiguration: fetchRange called without url");
    }
    const response = await fetch(this.url, {
      headers: {
        Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
      },
    });
    return response.arrayBuffer();
  }

  /**
   * Get cache statistics
   */
  get cacheStats() {
    return this.fetchManager.cacheStats;
  }

  /**
   * Prefetch and cache all pages needed for features intersecting the envelope.
   * This uses getFeaturesAsync with warmCache:true under the hood to trigger
   * range fetches without parsing or yielding features.
   */
  async prefetch(
    bbox: Envelope | Envelope[],
    options?: QueryPlanOptions
  ): Promise<void> {
    const warmOptions = {
      ...QUERY_PLAN_DEFAULTS,
      ...options,
      overfetchBytes: this.overfetchBytes ?? options?.overfetchBytes,
      // @ts-ignore - extend with warmCache flag for internal use
      warmCache: true,
    } as QueryPlanOptions & { warmCache: true };

    // Drain the async iterator to ensure all range requests are issued
    for await (const _ of this.getFeaturesAsync(bbox, warmOptions)) {
      // no-op: warmCache prevents yielding
      // wait for next tick
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
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

  search(bbox: Envelope | Envelope[]) {
    if (!Array.isArray(bbox)) {
      bbox = [bbox];
    }
    const offsets: FeatureReference[] = [];
    const addedIds = new Set<number>();
    for (const b of bbox) {
      if (!this.index) {
        throw new Error("Spatial index not available");
      }
      const results = this.index.search(b.minX, b.minY, b.maxX, b.maxY);
      // console.log("results", results.length);
      for (const result of results) {
        if (!addedIds.has(result[0])) {
          addedIds.add(result[0]);
          offsets.push(result);
        }
      }
    }
    const pagePlan = this.getQueryPlan(offsets);
    return pagePlan;
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
    options?: {
      /**
       * If set true, the cache will be warmed by fetching all features in the
       * bounding box. These features are not parsed or yielded.
       */
      warmCache?: boolean;
      queryPlan?: QueryPlan;
    }
  ): AsyncGenerator<FeatureWithMetadata<T>> {
    const queryPlan = options?.queryPlan ?? this.search(bbox);
    // console.log(
    //   "pagePlan",
    //   pagePlan.map((p) => ({
    //     pageIndex: p.pageIndex,
    //     features: p.features.length,
    //     firstRef: p.features[0][0],
    //     lastRef: p.features[p.features.length - 1][0],
    //     range: `${p.range[0]}-${p.range[1]}`,
    //     adjustedRange: `${p.range[0] - this.featureDataOffset}-${
    //       p.range[1] ? p.range[1] - this.featureDataOffset : null
    //     }`,
    //   }))
    // );
    // throw new Error("stop");
    for await (const [data, offset, length, bbox] of executeQueryPlan2(
      queryPlan.pages,
      this.fetchRangeFn,
      this.featureDataOffset
    )) {
      if (options?.warmCache) {
        continue;
      }
      const bytes = new Uint8Array(data.buffer);
      const bytesAligned = new Uint8Array(data.byteLength);
      bytesAligned.set(
        bytes.slice(data.byteOffset, data.byteOffset + data.byteLength),
        0
      );
      const feature = parseFeatureData(offset, bytesAligned, this.header, bbox);
      yield feature as unknown as FeatureWithMetadata<T>;
    }
  }

  async countAndBytesForQuery(
    bbox: Envelope | Envelope[],
    options?: QueryPlanOptions
  ) {
    if (!this.index) {
      throw new Error("Spatial index not available");
    }
    if (!Array.isArray(bbox)) {
      bbox = [bbox];
    }
    let offsetsSet = new Set<string>();
    let offsetAndLengths: FeatureReference[] = [];
    for (const b of bbox) {
      const results = await this.index.search(b.minX, b.minY, b.maxX, b.maxY);
      for (const result of results) {
        const key = `${result[0]}-${result[1]}`;
        if (!offsetsSet.has(key)) {
          offsetsSet.add(key);
          offsetAndLengths.push(result);
        }
      }
    }
    const plan = createQueryPlan(
      offsetAndLengths,
      this.featureDataOffset,
      options ?? {}
    );
    return {
      bytes: plan.bytes,
      features: plan.features,
      requests: plan.requests.length,
    };
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
    // console.log("# scanAllFeatures");
    const data = await this.fetchRangeFn!([this.featureDataOffset, null]);
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

  /**
   * This method returns an async generator for feature properties only.
   * This is useful for performance when you only need the properties of features.
   * It avoids parsing geometry data, which can be expensive.
   */
  async *getFeatureProperties(): AsyncGenerator<{
    properties: GeoJsonProperties & {
      __byteLength: number;
      __offset: number;
    };
    getFeature: () => T & {
      properties: GeoJsonProperties & {
        __byteLength: number;
        __offset: number;
      };
    };
  }> {
    if (!this.fetchRangeFn) {
      throw new Error("fetchRangeFn not set");
    }
    // console.log("# getFeatureProperties");
    const data = await this.fetchRangeFn([this.featureDataOffset, null]);
    const view = new DataView(data);
    let offset = 0;
    while (offset < data.byteLength) {
      const size = view.getUint32(offset, true);
      const bytesAligned = new Uint8Array(data, offset, size + SIZE_PREFIX_LEN);
      const bb = new ByteBuffer(bytesAligned);
      bb.setPosition(SIZE_PREFIX_LEN);
      yield {
        properties: parseProperties(bb, this.header.columns, offset),
        getFeature: () => parseFeatureData(offset, bytesAligned, this.header),
      };
      offset += size + SIZE_PREFIX_LEN;
    }
  }

  private getQueryPlan(refs: FeatureReference[]) {
    const pageRequests: PageRequestPlan[] = [];
    // sort offsets in ascending order
    const sortedRefs = refs.sort((a, b) => a[0] - b[0]);
    let currentPageIndex = 0;
    // console.log("getPagePlanpages", this.pages);
    // console.log(
    //   "sortedRefs",
    //   sortedRefs.length,
    //   sortedRefs[0],
    //   sortedRefs[sortedRefs.length - 1]
    // );
    for (const ref of sortedRefs) {
      const fileOffset = ref[0] + this.featureDataOffset;
      // first, figure out if you are adding this offset to the current page,
      // or if you are starting a new page
      if (
        pageRequests.length === 0 ||
        fileOffset >= this.pages[currentPageIndex + 1]
      ) {
        // first, adjust the currentPageIndex if needed
        while (
          this.pages[currentPageIndex + 1] !== null &&
          this.pages[currentPageIndex + 1] <= fileOffset
        ) {
          currentPageIndex++;
        }
        pageRequests.push({
          pageIndex: currentPageIndex,
          range: [
            this.pages[currentPageIndex],
            this.pages[currentPageIndex + 1]
              ? this.pages[currentPageIndex + 1] - 1
              : null,
          ],
          features: [ref],
        });
      } else {
        const existingPage = pageRequests[pageRequests.length - 1];
        existingPage.features.push(ref);
      }
    }
    return {
      pages: pageRequests,
      requests: pageRequests.length,
      estimatedBytes: estimateBytesFromPagePlan(
        pageRequests,
        this.featureDataOffset
      ),
    };
  }
}

type PageRequestPlan = {
  pageIndex: number;
  range: [number, number | null];
  features: FeatureReference[];
};

type QueryPlan = {
  pages: PageRequestPlan[];
  requests: number;
  estimatedBytes: {
    requested: number;
    features: number;
  };
};

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
  const pageSize = parseByteSize(options?.pageSize);
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

  // console.log("fetching header");
  let headerData = await fetchRange([0, initialHeaderRequestLength]);

  const view = new DataView(headerData);

  // Verify magic bytes
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (view.getUint8(i) !== MAGIC_BYTES[i] && i < MAGIC_BYTES.length - 1) {
      throw new Error(
        "Invalid FlatGeobuf file (magic bytes mismatch). " + urlOrKey
      );
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
  // Try to determine total file size using last feature offset + size prefix
  let fileByteLength: number | undefined = undefined;
  try {
    const lastFeatureOffset = index.getLastFeatureOffset();
    const lastFeaturePrefixAbs = indexOffset + indexSize + lastFeatureOffset;
    const sizePrefixBuf = await fetchRange([
      lastFeaturePrefixAbs,
      lastFeaturePrefixAbs + SIZE_PREFIX_LEN - 1,
    ]);
    const sizeView = new DataView(sizePrefixBuf);
    const lastFeatureSize = sizeView.getUint32(0, true);
    fileByteLength = lastFeaturePrefixAbs + SIZE_PREFIX_LEN + lastFeatureSize;
  } catch (e) {
    // If this fails (e.g., server doesn't support small range), proceed without file size
  }
  // console.log("fetched header and index. creating source.");
  const source = new FlatGeobufSource<T>(
    fetchRange,
    header,
    index,
    indexOffset + indexSize,
    maxCacheSize,
    overfetchBytes,
    fileByteLength,
    pageSize
  );
  return source;
}

export async function* executeQueryPlan2(
  plan: PageRequestPlan[],
  fetchRange: FetchRangeFn,
  featureDataOffset: number
): AsyncGenerator<
  [globalThis.DataView, number, number, [number, number, number, number]]
> {
  // Start all fetch requests in parallel and map them to their respective plan index
  const fetchPromises = plan.map(async ({ range, features, pageIndex }, i) => {
    const data = await fetchRange(range);
    // console.log("fetched page", pageIndex, range, data);
    return { data, features, pageIndex, i, range };
  });

  // Use Promise.race to yield data as soon as each fetch is ready
  const pendingFetches = new Set(plan.map((_, i) => i));

  while (pendingFetches.size > 0) {
    // Wait for the next fetch to complete
    const completedFetch = await Promise.race(
      [...pendingFetches].map((i: number) => fetchPromises[i])
    );

    // Remove the completed fetch from the pending set
    pendingFetches.delete(completedFetch.i);
    delete fetchPromises[completedFetch.i];

    // Process the completed fetch
    const { data, pageIndex, features, range } = completedFetch;
    const view = new DataView(data);

    let i = 0;
    // console.log(
    //   `begining parsing of page ${pageIndex}. Ref range: ${features[0][0]}-${
    //     features[features.length - 1][0]
    //   }. Page range: ${range[0]}-${range[1]}, bytes=${
    //     data.byteLength
    //   }. Last ref = ${features[features.length - 1]}`
    // );
    for (let [offset, length, bbox] of features) {
      // console.log(`parsing feature ${offset} ${length}`);
      const adjustedOffset = offset - range[0] + featureDataOffset;
      if (length === null) {
        length = view.buffer.byteLength - adjustedOffset;
      }

      let featureView = new DataView(data, adjustedOffset, length);
      if (VALIDATE_FEATURE_DATA) {
        const size = featureView.getUint32(0, true);
        if (size !== length - SIZE_PREFIX_LEN) {
          // console.log(
          //   "create dataview",
          //   `page=${pageIndex}`,
          //   `range=${range[0]}-${range[1]}`,
          //   `expected byte-length=${
          //     range[1] ? range[1] - range[0] : "unknown"
          //   }. Got ${data.byteLength}.`,
          //   `offset=${offset}`,
          //   `adjusted offset=${adjustedOffset}`,
          //   `length=${length}`,
          //   `i=${i}`,
          //   `features=${features.length}`
          // );
          throw new Error(
            `Feature data size mismatch: expected ${length}, size prefix was ${size}`
          );
        } else {
          // console.log("Valid Feature!!", featureView);
        }
      }
      yield [featureView, offset, length, bbox];

      i++;
      // Yield control to event loop after each feature to allow other promises to resolve
      // This ensures pending fetch promises can complete their cleanup without blocking
      if (i % 1000 === 0) {
        process.nextTick(() => {});
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    // console.log(`finished parsing page ${pageIndex}`);
  }
}

function estimateBytesFromPagePlan(
  pagePlan: PageRequestPlan[],
  leafNodesStartingOffset: number
): {
  requested: number;
  features: number;
} {
  return {
    requested: pagePlan.reduce(
      (acc, page) => acc + bytesForPage(page, leafNodesStartingOffset),
      0
    ),
    features: pagePlan.reduce(
      (acc, page) =>
        acc +
        page.features.reduce((bytes, feature) => bytes + (feature[1] ?? 0), 0),
      0
    ),
  };
}

/**
 * Returns the total bytes in the range request for a page. If the page has a
 * null end point, the end position of the second to last feature is used.
 * @param page PagePlan
 */
function bytesForPage(
  page: PageRequestPlan,
  leafNodesStartingOffset: number
): number {
  const start = page.range[0];
  let end = page.range[1];
  if (end === null && page.features.length > 1) {
    const secondToLastFeature = page.features[page.features.length - 2];
    if (!secondToLastFeature[1]) {
      throw new Error("Second to last feature has no length");
    }
    const fLength = secondToLastFeature[1];
    const fEndOffset =
      secondToLastFeature[0] + fLength + leafNodesStartingOffset;
    // guess that the last feature is the same size as the second to last
    end = fEndOffset + fLength;
  } else {
    // guess that the last feature is 1200 bytes
    end = start + 1200;
  }
  return end - start;
}
