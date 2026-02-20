"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreateFragments = handleCreateFragments;
const overlay_engine_1 = require("overlay-engine");
const fgb_source_1 = require("fgb-source");
const undici_1 = require("undici");
const lru_cache_1 = require("lru-cache");
const pool = new undici_1.Pool("https://uploads.seasketch.org", {
    bodyTimeout: 10 * 1000,
});
const cache = new lru_cache_1.LRUCache({
    maxSize: 1000 * 1024 * 128, // 128 MB
    sizeCalculation: (value) => value.byteLength,
});
const inFlightRequests = new Map();
const sourceCache = new fgb_source_1.SourceCache("1GB", {
    fetchRangeFn: (url, range) => {
        const cacheKey = `${url} range=${range[0]}-${range[1] ? range[1] : ""}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log("cache hit", cacheKey);
            return Promise.resolve(cached);
        }
        else if (inFlightRequests.has(cacheKey)) {
            console.log("in-flight request hit", cacheKey);
            return inFlightRequests.get(cacheKey);
        }
        else {
            console.log("cache miss", cacheKey);
            const request = pool
                .request({
                path: "/" + url.replace("https://uploads.seasketch.org/", ""),
                method: "GET",
                headers: {
                    Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
                },
            })
                .then(async (response) => {
                const buffer = await response.body.arrayBuffer();
                return buffer;
            })
                .then((buffer) => {
                cache.set(cacheKey, buffer);
                inFlightRequests.delete(cacheKey);
                return buffer;
            })
                .catch((e) => {
                inFlightRequests.delete(cacheKey);
                throw new Error(`${e.message}. ${url} range=${range[0]}-${range[1] ? range[1] : ""}: ${e.message}`);
            });
            inFlightRequests.set(cacheKey, request);
            return request;
        }
    },
    maxCacheSize: "256MB",
});
async function handleCreateFragments(payload) {
    const preparedSketch = (0, overlay_engine_1.prepareSketch)(payload.feature);
    console.time("clip to geographies");
    const { clipped, fragments } = await (0, overlay_engine_1.clipToGeographies)(preparedSketch, payload.geographies, payload.geographiesForClipping, payload.existingOverlappingFragments, payload.existingSketchId, async (feature, objectKey, op, cql2Query) => {
        console.time("get source");
        const source = await sourceCache.get(objectKey);
        console.timeEnd("get source");
        console.time("clip sketch to polygons");
        const result = await (0, overlay_engine_1.clipSketchToPolygons)(feature, op, cql2Query, source.getFeaturesAsync(feature.envelopes));
        console.timeEnd("clip sketch to polygons");
        return result;
    });
    console.timeEnd("clip to geographies");
    return { success: true, clipped, fragments };
}
//# sourceMappingURL=handler.js.map