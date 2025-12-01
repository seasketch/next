import { LRUCache } from "lru-cache";
import { DEFAULT_CACHE_SIZE, PAGE_SIZE } from "./constants";

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
  /** Number of cache hits. Reset by clearCache() */
  cacheHits: number;
  /** Number of cache misses. Reset by clearCache() */
  cacheMisses: number;
};

/**
 * Manages fetching and caching of byte ranges from a source.
 */
export class FetchManager {
  /** Page cache keyed by page index */
  private pageCache: LRUCache<number, ArrayBuffer>;
  /** In-flight page requests keyed by page index */
  private inFlightPageRequests = new Map<number, Promise<ArrayBuffer>>();
  /** In-flight assembled range requests keyed by "start-end" */
  private inFlightRangeRequests = new Map<string, Promise<ArrayBuffer>>();
  /** Underlying range fetch function or default fetch via URL */
  private fetchRangeFn: FetchRangeFn;
  /** If provided, used by default fetch implementation */
  private url?: string;
  /** Feature data section starting byte offset (absolute in file) */
  private featureDataOffset: number;
  /** Optional total file size in bytes (absolute). If unknown, undefined */
  private fileByteLength?: number;
  /** Page size in bytes for caching and fetching */
  private pageSize: number;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    urlOrFetchRangeFn: string | FetchRangeFn,
    maxCacheSize: number = DEFAULT_CACHE_SIZE,
    featureDataOffset: number = 0,
    fileByteLength?: number,
    pageSize: number = PAGE_SIZE
  ) {
    if (typeof urlOrFetchRangeFn === "string") {
      this.url = urlOrFetchRangeFn;
      this.fetchRangeFn = this.defaultFetchRange;
    } else {
      this.fetchRangeFn = urlOrFetchRangeFn;
    }

    this.featureDataOffset = featureDataOffset;
    this.fileByteLength = fileByteLength;
    this.pageSize = pageSize;

    this.pageCache = new LRUCache({
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
      count: this.pageCache.size,
      calculatedSize: this.pageCache.calculatedSize,
      maxSize: this.pageCache.maxSize,
      inFlightRequests:
        this.inFlightPageRequests.size + this.inFlightRangeRequests.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
    };
  }

  /**
   * Clear the feature data cache
   */
  clearCache() {
    this.pageCache.clear();
    this.inFlightPageRequests.clear();
    this.inFlightRangeRequests.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
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
    const [requestedStart, requestedEndNullable] = range;
    const rangeKey = `${requestedStart}-${requestedEndNullable ?? ""}`;

    // If the exact same range request is already in flight, reuse it
    const existingRangeRequest = this.inFlightRangeRequests.get(rangeKey);
    if (existingRangeRequest) {
      this.cacheHits++;
      return existingRangeRequest;
    }

    // If end is null and we do not know the file size, fall back to direct fetch
    if (requestedEndNullable === null && this.fileByteLength === undefined) {
      this.cacheMisses++;
      const timeout = setTimeout(() => {
        throw new Error("Request timed out");
      }, 60000 * 5);
      const directPromise = this.fetchRangeFn(range).then(
        (bytes) => {
          clearTimeout(timeout);
          this.inFlightRangeRequests.delete(rangeKey);
          return bytes;
        },
        (error) => {
          this.inFlightRangeRequests.delete(rangeKey);
          throw error;
        }
      );
      this.inFlightRangeRequests.set(rangeKey, directPromise);
      return directPromise;
    }

    const requestedEnd =
      requestedEndNullable !== null
        ? requestedEndNullable
        : (this.fileByteLength as number) - 1;

    // Map requested range to page indices relative to feature data offset
    const firstPageIndex = Math.max(
      0,
      Math.floor((requestedStart - this.featureDataOffset) / this.pageSize)
    );
    const lastPageIndex = Math.max(
      firstPageIndex,
      Math.floor((requestedEnd - this.featureDataOffset) / this.pageSize)
    );

    const assemblePromise = (async () => {
      const pages: Array<{ index: number; data: ArrayBuffer }> = [];
      for (let i = firstPageIndex; i <= lastPageIndex; i++) {
        const data = await this.fetchPage(i);
        pages.push({ index: i, data });
      }

      // Assemble the requested slice from the fetched pages
      const totalLength = requestedEnd - requestedStart + 1;
      const output = new Uint8Array(totalLength);
      let writeOffset = 0;

      for (const { index, data } of pages) {
        const pageStart = this.featureDataOffset + index * this.pageSize;
        const pageEndExclusive = pageStart + this.pageSize;
        const sliceStart = Math.max(requestedStart, pageStart);
        const sliceEndExclusive = Math.min(requestedEnd + 1, pageEndExclusive);
        const offsetInPage = sliceStart - pageStart;
        const length = sliceEndExclusive - sliceStart;
        if (length <= 0) continue;
        const src = new Uint8Array(data, offsetInPage, length);
        output.set(src, writeOffset);
        writeOffset += length;
      }

      this.inFlightRangeRequests.delete(rangeKey);
      return output.buffer;
    })();

    this.inFlightRangeRequests.set(rangeKey, assemblePromise);
    return assemblePromise;
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

  /** Fetch a full page by index, using cache and in-flight deduping */
  private async fetchPage(pageIndex: number): Promise<ArrayBuffer> {
    const cached = this.pageCache.get(pageIndex);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    const inFlight = this.inFlightPageRequests.get(pageIndex);
    if (inFlight) {
      this.cacheHits++;
      return inFlight;
    }

    this.cacheMisses++;

    const pageStart = this.featureDataOffset + pageIndex * this.pageSize;
    let pageEndInclusive = pageStart + this.pageSize - 1;
    if (
      this.fileByteLength !== undefined &&
      pageEndInclusive > this.fileByteLength - 1
    ) {
      pageEndInclusive = this.fileByteLength - 1;
    }

    console.trace(
      "cache miss - fetchPage",
      pageIndex,
      this.pageSize,
      this.fileByteLength,
      `range=${pageStart}-${pageEndInclusive}`
    );

    const timeout = setTimeout(() => {
      throw new Error("Request timed out");
    }, 60000);

    const promise = this.fetchRangeFn([pageStart, pageEndInclusive]).then(
      (bytes) => {
        clearTimeout(timeout);
        console.log(
          `saving page ${pageIndex} buffer. Remaining flight requests: ${
            this.inFlightPageRequests.size - 1
          }`
        );
        this.pageCache.set(pageIndex, bytes);
        this.inFlightPageRequests.delete(pageIndex);
        return bytes;
      },
      (error) => {
        this.inFlightPageRequests.delete(pageIndex);
        throw error;
      }
    );
    this.inFlightPageRequests.set(pageIndex, promise);
    return promise;
  }
}
