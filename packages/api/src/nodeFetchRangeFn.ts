import { LRUCache } from "lru-cache";

export function makeNodeFetchRangeFn(
  rootUrl: string,
  maxCacheSizeBytes: number = 1000 * 1024 * 128
) {
  const cache = new LRUCache<string, ArrayBuffer>({
    maxSize: maxCacheSizeBytes,
    sizeCalculation: (value, key) => {
      return value.byteLength;
    },
  });

  const inFlightRequests = new Map<string, Promise<ArrayBuffer>>();

  let cacheHits = 0;
  let cacheMisses = 0;

  const fetchRangeFn = (objectKey: string, range: [number, number | null]) => {
    const url = rootUrl + objectKey;
    const cacheKey = `${url} range=${range[0]}-${range[1] ? range[1] : ""}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      cacheHits++;
      return Promise.resolve(cached);
    } else if (inFlightRequests.has(cacheKey)) {
      cacheHits++;
      return inFlightRequests.get(cacheKey) as Promise<ArrayBuffer>;
    } else {
      cacheMisses++;
      // console.log("cache miss", cacheKey);
      return fetch(url, {
        method: "GET",
        headers: {
          Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
        },
      })
        .then(async (response) => {
          const buffer = await response.arrayBuffer();
          // console.log("fetched", cacheKey, buffer.byteLength);
          return buffer;
        })
        .then((buffer) => {
          // console.timeEnd(cacheKey);
          cache.set(cacheKey, buffer);
          // console.log("response", response.headers.get("x-cache-status"));
          return buffer;
        })
        .catch((e) => {
          console.log("rethrowing error for", cacheKey);
          // rethrow error with enhanced error message consisting of url, range, and original error message
          throw new Error(
            `${e.message}. ${url} range=${range[0]}-${
              range[1] ? range[1] : ""
            }: ${e.message}`
          );
        });
    }
  };

  return {
    fetchRangeFn,
    cacheHits,
    cacheMisses,
  };
}
