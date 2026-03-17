"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWarmCache = handleWarmCache;
exports.handleCreateFragments = handleCreateFragments;
exports.handleCreateCollectionFragments = handleCreateCollectionFragments;
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
async function handleWarmCache(payload) {
    const preparedSketch = (0, overlay_engine_1.prepareSketch)(payload.feature);
    const uniqueSources = new Set();
    for (const geography of payload.geographies) {
        for (const layer of geography.clippingLayers) {
            uniqueSources.add(layer.source);
        }
    }
    console.time("warm cache");
    await Promise.all(Array.from(uniqueSources).map(async (sourceKey) => {
        const source = await sourceCache.get(sourceKey);
        return source.getFeaturesAsync(preparedSketch.envelopes, {
            warmCache: true,
        });
    }));
    console.timeEnd("warm cache");
    return { success: true };
}
async function handleCreateFragments(payload) {
    const preparedSketch = (0, overlay_engine_1.prepareSketch)(payload.feature);
    console.time("clip to geographies");
    const { clipped, fragments } = await (0, overlay_engine_1.clipToGeographies)(preparedSketch, payload.geographies, payload.geographiesForClipping, payload.existingOverlappingFragments, payload.existingSketchId, async (feature, objectKey, op, cql2Query) => {
        const source = await sourceCache.get(objectKey);
        return (0, overlay_engine_1.clipSketchToPolygons)(feature, op, cql2Query, source.getFeaturesAsync(feature.envelopes));
    });
    console.timeEnd("clip to geographies");
    return { success: true, clipped, fragments };
}
async function handleCreateCollectionFragments(payload) {
    const preparedSketches = payload.sketches.map((sketch) => ({
        id: sketch.id,
        preparedSketch: (0, overlay_engine_1.prepareSketch)(sketch.feature),
    }));
    const allFragmentsBySketch = await Promise.all(preparedSketches.map(async ({ id, preparedSketch }) => {
        const fragments = await (0, overlay_engine_1.createFragments)(preparedSketch, payload.geographies, async (feature, objectKey, op, cql2Query) => {
            const source = await sourceCache.get(objectKey);
            return (0, overlay_engine_1.clipSketchToPolygons)(feature, op, cql2Query, source.getFeaturesAsync(feature.envelopes));
        });
        const clippingFragments = fragments.filter((fragment) => fragment.properties.__geographyIds.some((geographyId) => payload.geographiesForClipping.includes(geographyId)));
        return {
            id,
            fragments: clippingFragments,
        };
    }));
    const taggedFragments = allFragmentsBySketch.flatMap(({ id, fragments }) => fragments.map((fragment) => ({
        ...fragment,
        properties: {
            ...fragment.properties,
            __sketchIds: [id],
        },
    })));
    const reconciled = (0, overlay_engine_1.eliminateOverlap)(taggedFragments, []);
    const fragmentsBySketchId = {};
    for (const sketch of payload.sketches) {
        fragmentsBySketchId[sketch.id] = [];
    }
    for (const fragment of reconciled) {
        for (const sketchId of fragment.properties.__sketchIds) {
            if (!fragmentsBySketchId[sketchId]) {
                fragmentsBySketchId[sketchId] = [];
            }
            fragmentsBySketchId[sketchId].push(fragment);
        }
    }
    return {
        success: true,
        fragmentsBySketchId,
    };
}
//# sourceMappingURL=handler.js.map