"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeFetchRangeFn = makeFetchRangeFn;
const undici_1 = require("undici");
const lru_cache_1 = require("lru-cache");
function makeFetchRangeFn(rootUrl, maxCacheSizeBytes = 1000 * 1024 * 128) {
    const pool = new undici_1.Pool(rootUrl, {
        // 10 second timeout for body
        bodyTimeout: 10 * 1000,
    });
    const cache = new lru_cache_1.LRUCache({
        maxSize: maxCacheSizeBytes,
        sizeCalculation: (value, key) => {
            return value.byteLength;
        },
    });
    const inFlightRequests = new Map();
    let cacheHits = 0;
    let cacheMisses = 0;
    const fetchRangeFn = (url, range) => {
        const cacheKey = `${url} range=${range[0]}-${range[1] ? range[1] : ""}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            cacheHits++;
            return Promise.resolve(cached);
        }
        else if (inFlightRequests.has(cacheKey)) {
            cacheHits++;
            return inFlightRequests.get(cacheKey);
        }
        else {
            cacheMisses++;
            // console.log("cache miss", cacheKey);
            return pool
                .request({
                path: url.replace("https://uploads.seasketch.org", ""),
                method: "GET",
                headers: {
                    Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
                },
            })
                .then(async (response) => {
                const buffer = await response.body.arrayBuffer();
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
                throw new Error(`${e.message}. ${url} range=${range[0]}-${range[1] ? range[1] : ""}: ${e.message}`);
            });
        }
    };
    return {
        fetchRangeFn,
        cacheHits,
        cacheMisses,
    };
}
//# sourceMappingURL=optimizedFetchRangeFn.js.map