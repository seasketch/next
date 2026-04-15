"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
exports.validatePayload = validatePayload;
exports.subjectIsFragment = subjectIsFragment;
exports.subjectIsGeography = subjectIsGeography;
const overlay_engine_1 = require("overlay-engine");
const fgb_source_1 = require("fgb-source");
const messaging_1 = require("./messaging");
const ProgressNotifier_1 = require("./ProgressNotifier");
const geobuf = __importStar(require("geobuf"));
const pbf_1 = __importDefault(require("pbf"));
const undici_1 = require("undici");
const lru_cache_1 = require("lru-cache");
const OverlayEngineBatchProcessor_1 = require("overlay-engine/src/OverlayEngineBatchProcessor");
const simplify_1 = __importDefault(require("@turf/simplify"));
const buffer_1 = __importDefault(require("@turf/buffer"));
const helpers_1 = require("overlay-engine/src/utils/helpers");
const containerIndex_1 = require("overlay-engine/src/utils/containerIndex");
const cql2_1 = require("overlay-engine/src/cql2");
const polygonClipping_1 = require("overlay-engine/src/utils/polygonClipping");
const clipping = __importStar(require("polyclip-ts"));
const reproject_1 = require("./utils/reproject");
const bbox_1 = __importDefault(require("@turf/bbox"));
const area_1 = __importDefault(require("@turf/area"));
const SIMPLIFICATION_TOLERANCE = 0.000018;
const pool = new undici_1.Pool(`https://uploads.seasketch.org`, {
    // 10 second timeout for body
    bodyTimeout: 10 * 1000,
});
const cache = new lru_cache_1.LRUCache({
    maxSize: 1000 * 1024 * 128, // 128 MB
    sizeCalculation: (value, key) => {
        return value.byteLength;
    },
});
const inFlightRequests = new Map();
const sourceCache = new fgb_source_1.SourceCache("1GB", {
    fetchRangeFn: (url, range) => {
        // console.log("fetching", url, range);
        const cacheKey = `${url} range=${range[0]}-${range[1] ? range[1] : ""}`;
        // console.time(cacheKey);
        const cached = cache.get(cacheKey);
        if (cached) {
            // console.timeEnd(cacheKey);
            // console.log("cache hit", cacheKey);
            return Promise.resolve(cached);
        }
        else if (inFlightRequests.has(cacheKey)) {
            // console.log("in-flight request hit", cacheKey);
            return inFlightRequests.get(cacheKey);
        }
        else {
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
            // .finally(() => {
            //   inFlightRequests.delete(cacheKey);
            // });
            // inFlightRequests.set(cacheKey, request);
            // return request;
        }
    },
    maxCacheSize: "256MB",
});
const workerPool = (0, OverlayEngineBatchProcessor_1.createClippingWorkerPool)(process.env.PISCINA_WORKER_PATH || "worker.js");
async function handler(payload) {
    console.log("Overlay worker (v2) received payload", payload);
    const startTime = Date.now();
    const progressNotifier = new ProgressNotifier_1.ProgressNotifier(payload.jobKey, 1000, payload.queueUrl);
    await (0, messaging_1.sendBeginMessage)(payload.jobKey, "/test", new Date().toISOString(), payload.queueUrl);
    const helpers = (0, helpers_1.guaranteeHelpers)({
        progress: async (progress, message) => {
            await progressNotifier.notify(progress, message);
            return;
        },
        log: (message) => {
            console.log(message);
        },
        time: (message) => {
            console.time(message);
        },
        timeEnd: (message) => {
            console.timeEnd(message);
        },
    });
    try {
        // Example of how to use the discriminated union with switch statements
        switch (payload.type) {
            case "total_area": {
                if (subjectIsGeography(payload.subject)) {
                    progressNotifier.notify(0, "Beginning area calculation");
                    const area = await (0, overlay_engine_1.calculateArea)(payload.subject.clippingLayers, sourceCache, helpers);
                    await (0, messaging_1.flushMessages)();
                    await (0, messaging_1.sendResultMessage)(payload.jobKey, area, payload.queueUrl, Date.now() - startTime);
                    return;
                }
                else if (subjectIsFragment(payload.subject)) {
                    throw new Error("Total area for fragments not implemented in worker.");
                }
                else {
                    throw new Error("Unknown subject type. Must be geography or fragment.");
                }
            }
            case "overlay_area": {
                if (!payload.sourceUrl) {
                    throw new Error("sourceUrl is required for overlay_area");
                }
                const { intersectionFeature, differenceSources } = await subjectsForAnalysis(payload.subject, helpers);
                const source = await sourceCache.get(payload.sourceUrl, {
                    pageSize: "5MB",
                });
                const bufferedIntersectionFeature = applySubjectBuffer(intersectionFeature, payload.bufferDistanceKm);
                const processor = new OverlayEngineBatchProcessor_1.OverlayEngineBatchProcessor("overlay_area", 1024 * 1024 * 1, // 5MB
                (0, simplify_1.default)(bufferedIntersectionFeature, {
                    tolerance: SIMPLIFICATION_TOLERANCE,
                }), source, differenceSources, helpers, payload.groupBy, workerPool, undefined, undefined, undefined, payload.sourceHasOverlappingFeatures);
                const area = await processor.calculate();
                await (0, messaging_1.flushMessages)();
                await (0, messaging_1.sendResultMessage)(payload.jobKey, area, payload.queueUrl, Date.now() - startTime);
                return;
            }
            case "presence_table":
            case "count":
            case "presence":
            case "column_values": {
                if (!payload.sourceUrl) {
                    throw new Error(`sourceUrl is required for ${payload.type}`);
                }
                const { intersectionFeature, differenceSources } = await subjectsForAnalysis(payload.subject, helpers);
                const source = await sourceCache.get(payload.sourceUrl, {
                    pageSize: "5MB",
                });
                // Extract valueColumn from parameters for column_values
                const columnValuesProperty = payload.type === "column_values" ? payload.valueColumn : undefined;
                const bufferedIntersectionFeature = applySubjectBuffer(intersectionFeature, payload.bufferDistanceKm);
                const processor = new OverlayEngineBatchProcessor_1.OverlayEngineBatchProcessor(payload.type, 1024 * 1024 * 1, // 5MB
                (0, simplify_1.default)(bufferedIntersectionFeature, {
                    tolerance: SIMPLIFICATION_TOLERANCE,
                }), source, differenceSources, helpers, payload.groupBy, workerPool, payload.includedColumns, payload.maxResults, columnValuesProperty);
                const result = await processor.calculate();
                await (0, messaging_1.flushMessages)();
                await (0, messaging_1.sendResultMessage)(payload.jobKey, result, payload.queueUrl, Date.now() - startTime);
                return;
            }
            case "raster_stats": {
                if (!payload.sourceUrl) {
                    throw new Error("sourceUrl is required for raster_stats");
                }
                if (!payload.epsg || typeof payload.epsg !== "number") {
                    throw new Error("epsg is required for raster_stats");
                }
                let { intersectionFeature, differenceSources } = await subjectsForAnalysis(payload.subject, helpers);
                const originalLength = JSON.stringify(intersectionFeature, null, 2).length;
                if (subjectIsGeography(payload.subject)) {
                    // attempt to build complete multipolygon representing the geography
                    // by subtracting difference source features from the intersection
                    // feature.
                    intersectionFeature = await buildCompleteGeographyMultiPolygon(intersectionFeature, differenceSources);
                    console.log("built complete geography multipolygon", originalLength, JSON.stringify(intersectionFeature, null, 2).length);
                }
                // Resolve effective VRM: use payload.vrm if explicitly set; otherwise
                // default to false for geography subjects (to avoid array-size errors)
                // and 'auto' for fragment subjects.
                const resolvedVrm = payload.vrm !== undefined
                    ? payload.vrm
                    : subjectIsGeography(payload.subject)
                        ? false
                        : "auto";
                // Capture WGS84-derived hints for VRM before reprojecting.
                const wgs84BBox = (0, bbox_1.default)(intersectionFeature, { recompute: true });
                const centerLonLat = [
                    (wgs84BBox[0] + wgs84BBox[2]) / 2,
                    (wgs84BBox[1] + wgs84BBox[3]) / 2,
                ];
                const fragmentAreaSqM = (0, area_1.default)(intersectionFeature);
                // Reproject the feature into the raster's native CRS before passing
                // to calculateRasterStats (which no longer owns reprojection, keeping
                // epsg-index out of the overlay-engine bundle).
                const projectedFeature = (0, reproject_1.reproject)(intersectionFeature, payload.epsg);
                const result = await (0, overlay_engine_1.calculateRasterStats)(payload.sourceUrl, projectedFeature, { vrm: resolvedVrm, centerLonLat, fragmentAreaSqM });
                await (0, messaging_1.flushMessages)();
                await (0, messaging_1.sendResultMessage)(payload.jobKey, result, payload.queueUrl, Date.now() - startTime);
                return;
                // }
            }
            case "distance_to_shore": {
                console.log("distance_to_shore", payload);
                if (!payload.sourceUrl) {
                    throw new Error("sourceUrl is required for distance_to_shore");
                }
                if (subjectIsGeography(payload.subject)) {
                    throw new Error("distance_to_shore for geographies not implemented.");
                }
                const { intersectionFeature, differenceSources } = await subjectsForAnalysis(payload.subject, helpers);
                const source = await sourceCache.get(payload.sourceUrl, {
                    pageSize: "5MB",
                });
                const result = await (0, overlay_engine_1.calculateDistanceToShore)(intersectionFeature, source);
                await (0, messaging_1.flushMessages)();
                await (0, messaging_1.sendResultMessage)(payload.jobKey, result, payload.queueUrl, Date.now() - startTime);
                return;
            }
            default:
                throw new Error(`Unknown payload type: ${payload.type}`);
        }
    }
    catch (e) {
        console.log("caught error in overlay worker", e);
        console.error(e);
        await (0, messaging_1.sendErrorMessage)(payload.jobKey, e instanceof Error
            ? e.message
            : typeof e === "string"
                ? e
                : "Unknown error", payload.queueUrl);
        // throw e;
    }
    finally {
        // Ensure any debounced progress sends and pending SQS sends are flushed
        try {
            progressNotifier.flush();
        }
        catch (_a) { }
        await (0, messaging_1.flushMessages)();
    }
}
function validatePayload(data) {
    // Validate required base properties
    if (!data || typeof data !== "object") {
        throw new Error("Payload must be an object");
    }
    if (!data.jobKey || typeof data.jobKey !== "string") {
        throw new Error("Payload must have a valid jobKey property");
    }
    if (!data.type || typeof data.type !== "string") {
        throw new Error("Payload must have a valid type property");
    }
    if (!data.subject || typeof data.subject !== "object") {
        throw new Error("Payload must have a valid subject property");
    }
    // Validate subject structure
    if ("type" in data.subject) {
        if (data.subject.type !== "geography" ||
            typeof data.subject.id !== "number") {
            throw new Error('Geography subject must have type "geography" and numeric id');
        }
    }
    else {
        if (typeof data.subject.hash !== "string") {
            throw new Error("Fragment subject must have hash id.");
        }
    }
    // Validate overlay-specific properties for metrics that need them
    if (data.type !== "total_area") {
        if (!data.sourceUrl || typeof data.sourceUrl !== "string") {
            throw new Error(`Payload type "${data.type}" must have sourceUrl property`);
        }
        if (!data.sourceType || typeof data.sourceType !== "string") {
            throw new Error(`Payload type "${data.type}" must have sourceType property`);
        }
        if (data.groupBy && typeof data.groupBy !== "string") {
            throw new Error(`Payload type "${data.type}" must have groupBy property`);
        }
    }
    // Ensure no value or count properties exist
    if ("value" in data) {
        throw new Error("Payload must not contain value property");
    }
    if ("count" in data) {
        throw new Error("Payload must not contain count property");
    }
    return data;
}
// Type guard for enhanced fragment subjects
function subjectIsFragment(subject) {
    return "hash" in subject && "fragmentHash" in subject;
}
// Type guard for enhanced geography subjects
function subjectIsGeography(subject) {
    return ("type" in subject &&
        subject.type === "geography" &&
        "clippingLayers" in subject);
}
function polygonFromFragment(subject) {
    if (!subject.geobuf) {
        throw new Error("geobuf is required for fragment subjects");
    }
    // payload.subject.geobuf is a base64 encoded string
    const buffer = Buffer.from(subject.geobuf, "base64");
    let feature = geobuf.decode(new pbf_1.default(buffer));
    if (feature.type === "FeatureCollection") {
        feature = feature.features[0];
    }
    if (feature.geometry.type !== "Polygon") {
        throw new Error("geobuf is not a GeoJSON Polygon.");
    }
    return feature;
}
async function subjectsForAnalysis(subject, helpers) {
    if (subjectIsGeography(subject)) {
        const { intersectionFeature, differenceLayers, differenceSources } = await (0, overlay_engine_1.initializeGeographySources)(subject.clippingLayers, sourceCache, helpers, {
            pageSize: "5MB",
        });
        return {
            intersectionFeature,
            differenceSources,
        };
    }
    else if ("geobuf" in subject) {
        const feature = polygonFromFragment(subject);
        return {
            intersectionFeature: feature,
            differenceSources: [],
        };
    }
    else {
        throw new Error("Unknown subject type. Must be geography or fragment.");
    }
}
function applySubjectBuffer(feature, bufferDistanceKm) {
    if (typeof bufferDistanceKm !== "number" ||
        !isFinite(bufferDistanceKm) ||
        bufferDistanceKm <= 0) {
        return feature;
    }
    try {
        const buffered = (0, buffer_1.default)(feature, bufferDistanceKm, { units: "kilometers" });
        if (buffered &&
            buffered.geometry &&
            (buffered.geometry.type === "Polygon" ||
                buffered.geometry.type === "MultiPolygon")) {
            return buffered;
        }
    }
    catch (err) {
        console.warn("Failed to buffer subject feature", err);
    }
    return feature;
}
/**
 * Builds a complete MultiPolygon representing the true geography area by
 * subtracting all difference-source features from the intersection feature.
 *
 * Used for raster_stats analysis where the actual geometry (not just an area
 * value) is needed to spatially query a raster dataset.
 *
 * Strategy for efficiency:
 *  1. Compute one bounding envelope from the intersection feature for spatial search.
 *  2. Build a ContainerIndex on a simplified copy of the intersection feature so
 *     features that fall entirely outside can be skipped cheaply.
 *  3. Stream candidate features from each differenceSource, apply any CQL2 filter,
 *     skip "outside" candidates, and collect the remainder.
 *  4. Union all collected difference geometries into a single geometry, then
 *     apply one clipping.difference call — avoiding repeated incremental clips.
 */
async function buildCompleteGeographyMultiPolygon(intersectionFeature, differenceSources) {
    if (differenceSources.length === 0) {
        return intersectionFeature;
    }
    // Compute a single bounding envelope from the geometry coordinates directly.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const polys = intersectionFeature.geometry.type === "Polygon"
        ? [intersectionFeature.geometry.coordinates]
        : intersectionFeature.geometry.coordinates;
    for (const poly of polys) {
        for (const ring of poly) {
            for (const [x, y] of ring) {
                if (x < minX)
                    minX = x;
                if (y < minY)
                    minY = y;
                if (x > maxX)
                    maxX = x;
                if (y > maxY)
                    maxY = y;
            }
        }
    }
    const envelope = { minX, minY, maxX, maxY };
    // Simplified intersection feature for ContainerIndex — fast classify without
    // touching the high-resolution source geometry.
    const simplified = (0, simplify_1.default)(intersectionFeature, { tolerance: 0.002 });
    const containerIndex = new containerIndex_1.ContainerIndex(simplified);
    // Collect difference polygon coordinates, skipping features with no overlap.
    const differenceGeoms = [];
    for (const { source, cql2Query } of differenceSources) {
        for await (const f of source.getFeaturesAsync([envelope])) {
            if (cql2Query && !(0, cql2_1.evaluateCql2JSONQuery)(cql2Query, f.properties)) {
                continue;
            }
            if (containerIndex.classify(f) === "outside") {
                continue;
            }
            differenceGeoms.push(f.geometry.coordinates);
        }
    }
    if (differenceGeoms.length === 0) {
        return intersectionFeature;
    }
    // Union all difference geometries first, then apply a single difference
    // operation. This is faster than iterative clipping.
    const unionedDifference = differenceGeoms.length === 1 ? differenceGeoms[0] : (0, polygonClipping_1.union)(differenceGeoms);
    const result = clipping.difference(intersectionFeature.geometry.coordinates, unionedDifference);
    if (result.length === 0) {
        return intersectionFeature;
    }
    return {
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: result },
        properties: intersectionFeature.properties,
    };
}
//# sourceMappingURL=overlay-worker.js.map