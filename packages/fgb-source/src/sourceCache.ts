import { LRUCache } from "lru-cache";
import { createSource, CreateSourceOptions, FlatGeobufSource } from "./source";
import bytes from "bytes";
import {
  Feature as GeoJSONFeature,
  GeoJsonProperties,
  Geometry,
} from "geojson";

/**
 * Caches FlatGeobufSource instances to avoid re-initializing sources for the same URL.
 * Uses an LRU (Least Recently Used) cache strategy to manage memory usage.
 *
 * The cache size is calculated based on the total memory used by each source:
 * - Size of the spatial index (indexSizeBytes)
 * - Size of the feature data cache (cacheStats.maxSize)
 *
 * @example
 * ```typescript
 * const sourceCache = new SourceCache('64mb', {
 *   onEvict: (key, source, reason) => {
 *     console.log(`Evicted ${key} for reason: ${reason}`);
 *   }
 * });
 * const source = await sourceCache.get('https://example.com/data.fgb');
 * ```
 */
export class SourceCache {
  private sizeLimitBytes: number;
  private cache: LRUCache<string, FlatGeobufSource<any>>;
  /**
   * Map of keys to in-flight requests. Used to avoid creating the same source
   * multiple times when there are concurrent requests for the same source.
   */
  private inFlightRequests: Map<string, Promise<FlatGeobufSource<any>>>;
  private onEvict?: (
    key: string,
    source: FlatGeobufSource<any>,
    reason: string
  ) => void;

  /**
   * Create a new SourceCache instance.
   *
   * @param sizeLimit - Maximum size of the cache, parseable by the bytes library.
   *                   Examples: '100MB', '1GB', '500KB'
   * @param options - Optional configuration object
   *   - onEvict: Callback called when a source is evicted from the cache. Receives (key, source, reason).
   * @throws Error if sizeLimit is invalid
   */
  constructor(
    sizeLimit: string,
    options?: {
      onEvict?: (
        key: string,
        source: FlatGeobufSource<any>,
        reason: string
      ) => void;
    }
  ) {
    const size = bytes(sizeLimit);
    if (size === null) {
      throw new Error(`Invalid size limit: ${sizeLimit}`);
    }
    this.sizeLimitBytes = size;
    this.inFlightRequests = new Map();
    this.onEvict = options?.onEvict;
    this.cache = new LRUCache({
      maxSize: this.sizeLimitBytes,
      sizeCalculation: (source, key) => {
        const size = source.indexSizeBytes + source.cacheStats.maxSize;
        return size;
      },
      dispose: (value, key, reason) => {
        if (this.onEvict) {
          this.onEvict(key, value, reason);
        }
      },
    });
  }

  /**
   * Get a FlatGeobufSource instance for the given key. If the source is already
   * cached, returns the cached instance. Otherwise, creates a new source and
   * caches it.
   *
   * @param key - URL or key to fetch the source from
   * @param options - Options for creating the source if it needs to be created
   * @returns Promise resolving to a FlatGeobufSource instance
   *
   * @example
   * ```typescript
   * const sourceCache = new SourceCache('64mb');
   * // Basic usage with default options
   * const source = await sourceCache.get('https://example.com/data.fgb');
   *
   * // Customize feature data cache size
   * const source = await sourceCache.get('https://example.com/data.fgb', {
   *   maxCacheSize: 1024 * 1024 // 1MB feature cache
   * });
   *
   * // Use custom fetch implementation (e.g. for R2 bucket)
   * const source = await sourceCache.get('fgb-object-key', {
   *   fetchRangeFn: async (key, range) => {
   *     const response = await fetch(`https://my-bucket.r2.dev/${key}`, {
   *       headers: { Range: `bytes=${range[0]}-${range[1] ?? ''}` }
   *     });
   *     return response.arrayBuffer();
   *   }
   * });
   *
   * // Query features within a bounding box
   * const bbox = { minX: -180, minY: -90, maxX: 180, maxY: 90 };
   * for await (const feature of source.getFeaturesAsync(bbox)) {
   *   console.log(feature);
   * }
   * ```
   */
  async get<T = GeoJSONFeature<Geometry, GeoJsonProperties>>(
    key: string,
    options?: CreateSourceOptions
  ): Promise<FlatGeobufSource<T>> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Check for in-flight request
    const inFlightRequest = this.inFlightRequests.get(key);
    if (inFlightRequest) {
      return inFlightRequest as Promise<FlatGeobufSource<T>>;
    }

    // Create new request
    const request = (async () => {
      try {
        const source = await createSource<T>(key, options);
        this.cache.set(key, source);
        return source;
      } finally {
        // Clean up in-flight request map
        this.inFlightRequests.delete(key);
      }
    })();

    // Store request in in-flight map
    this.inFlightRequests.set(key, request);
    return request;
  }
}
