import { LRUCache } from "lru-cache";
import { DEFAULT_CACHE_SIZE } from "./constants";

export type FetchRangeFn = (
  range: [number, number | null]
) => Promise<ArrayBuffer>;

/**
 * Statistics about the LRU cache and in-flight requests.
 * Used to monitor cache performance and memory usage.
 */
export type CacheStats = {
  /** Current number of items in the cache */
  count: number;
  /** Total size of cached items in bytes */
  calculatedSize: number;
  /** Maximum size of the cache which stores feature data in bytes */
  maxSize: number;
  /** Number of requests currently in flight */
  inFlightRequests: number;
};

/**
 * Manages fetching and caching of byte ranges from a source.
 */
export class FetchManager {
  private cache: LRUCache<string, ArrayBuffer>;
  private inFlightRequests = new Map<string, Promise<ArrayBuffer>>();
  private fetchRangeFn: FetchRangeFn;
  private url?: string;

  constructor(
    urlOrFetchRangeFn: string | FetchRangeFn,
    maxCacheSize: number = DEFAULT_CACHE_SIZE
  ) {
    if (typeof urlOrFetchRangeFn === "string") {
      this.url = urlOrFetchRangeFn;
      this.fetchRangeFn = this.defaultFetchRange;
    } else {
      this.fetchRangeFn = urlOrFetchRangeFn;
    }

    this.cache = new LRUCache({
      maxSize: maxCacheSize,
      sizeCalculation: (value) => value.byteLength,
      updateAgeOnGet: true,
    });
  }

  /**
   * Get cache statistics
   */
  get cacheStats(): CacheStats {
    return {
      count: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      maxSize: this.cache.maxSize,
      inFlightRequests: this.inFlightRequests.size,
    };
  }

  /**
   * Clear the feature data cache
   */
  clearCache() {
    this.cache.clear();
    this.inFlightRequests.clear();
  }

  /**
   * Fetch a byte range from the source.
   *
   * The result is cached using an LRU cache to minimize network requests.
   *
   * @param range - [start (number), end (number | null)] byte range to fetch.
   *                End may be null to indicate the end of the file.
   * @returns Promise resolving to the fetched data as ArrayBuffer
   * @throws Error if source is misconfigured
   */
  async fetchRange(range: [number, number | null]): Promise<ArrayBuffer> {
    // Generate cache key from range
    const cacheKey = `${range[0]}-${range[1] ?? ""}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Check for in-flight request
    const inFlightRequest = this.inFlightRequests.get(cacheKey);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    // Create new request
    const request = (async () => {
      try {
        const bytes = await this.fetchRangeFn(range);
        // Store in cache
        this.cache.set(cacheKey, bytes);
        return bytes;
      } finally {
        // Clean up in-flight request map
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    // Store request in in-flight map
    this.inFlightRequests.set(cacheKey, request);
    return request;
  }

  /**
   * Default fetch implementation using the fetch API.
   */
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
}
