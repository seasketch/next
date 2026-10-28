import { LRUCache } from "lru-cache";
import { Pool } from "undici";

const originPools = new Map<string, Pool>();

function poolFor(origin: string): Pool {
  let pool = originPools.get(origin);
  if (!pool) {
    pool = new Pool(origin, {
      // Queue extra range reads instead of opening a socket for each one.
      connections: 8,
      bodyTimeout: 10 * 1000,
    });
    originPools.set(origin, pool);
  }
  return pool;
}

function rangeEnd(range: [number, number | null]): string {
  return range[1] != null ? String(range[1]) : "";
}

function requestUrlRange(
  url: URL,
  range: [number, number | null]
): Promise<ArrayBuffer> {
  return poolFor(url.origin)
    .request({
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        Range: `bytes=${range[0]}-${rangeEnd(range)}`,
      },
    })
    .then(async (response) => {
      const buffer = await response.body.arrayBuffer();
      if (response.statusCode >= 400) {
        throw new Error(
          `HTTP ${response.statusCode} fetching ${url.href} range=${range[0]}-${rangeEnd(range)}`
        );
      }
      return buffer;
    });
}

/**
 * Cached byte-range fetch for a complete URL. One LRU and in-flight map per
 * caller, so two caches do not share entries. Connection pools are per origin.
 */
export function makeUrlFetchRangeFn(
  maxCacheSizeBytes: number = 1000 * 1024 * 128
) {
  const cache = new LRUCache<string, ArrayBuffer>({
    maxSize: maxCacheSizeBytes,
    sizeCalculation: (value) => value.byteLength,
  });
  const inFlightRequests = new Map<string, Promise<ArrayBuffer>>();
  const stats = {
    cacheHits: 0,
    cacheMisses: 0,
    fetchRangeFn: (_target: string, _range: [number, number | null]) =>
      Promise.resolve(new ArrayBuffer(0)),
  };

  stats.fetchRangeFn = (target: string, range: [number, number | null]) => {
    const url = new URL(target);
    const cacheKey = `${url.href} range=${range[0]}-${rangeEnd(range)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      stats.cacheHits++;
      return Promise.resolve(cached);
    }
    const pending = inFlightRequests.get(cacheKey);
    if (pending) {
      stats.cacheHits++;
      return pending;
    }
    stats.cacheMisses++;
    const request = requestUrlRange(url, range)
      .then((buffer) => {
        cache.set(cacheKey, buffer);
        return buffer;
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log("rethrowing error for", cacheKey);
        throw new Error(
          `${message}. ${url.href} range=${range[0]}-${rangeEnd(range)}: ${message}`
        );
      })
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });
    inFlightRequests.set(cacheKey, request);
    return request;
  };

  return stats;
}

/** Same fetch as makeUrlFetchRangeFn, after joining a root URL and a bare key. */
export function makeNodeFetchRangeFn(
  rootUrl: string,
  maxCacheSizeBytes: number = 1000 * 1024 * 128
) {
  const inner = makeUrlFetchRangeFn(maxCacheSizeBytes);
  const fetchFullUrl = inner.fetchRangeFn;
  inner.fetchRangeFn = (objectKey, range) =>
    fetchFullUrl(rootUrl + objectKey, range);
  return inner;
}
