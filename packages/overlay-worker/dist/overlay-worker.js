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
const OverlappingAreaBatchedClippingProcessor_1 = require("overlay-engine/src/OverlappingAreaBatchedClippingProcessor");
const simplify_1 = __importDefault(require("@turf/simplify"));
const helpers_1 = require("overlay-engine/src/utils/helpers");
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
const workerPool = (0, OverlappingAreaBatchedClippingProcessor_1.createClippingWorkerPool)(process.env.PISCINA_WORKER_PATH || "worker.js");
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
                const processor = new OverlappingAreaBatchedClippingProcessor_1.OverlappingAreaBatchedClippingProcessor("overlay_area", 1024 * 1024 * 1, // 5MB
                (0, simplify_1.default)(intersectionFeature, {
                    tolerance: 0.002,
                }), source, differenceSources, helpers, payload.groupBy, workerPool);
                const area = await processor.calculate();
                await (0, messaging_1.flushMessages)();
                await (0, messaging_1.sendResultMessage)(payload.jobKey, area, payload.queueUrl, Date.now() - startTime);
                return;
            }
            case "count":
            case "presence": {
                if (!payload.sourceUrl) {
                    throw new Error("sourceUrl is required for count");
                }
                const { intersectionFeature, differenceSources } = await subjectsForAnalysis(payload.subject, helpers);
                const source = await sourceCache.get(payload.sourceUrl, {
                    pageSize: "5MB",
                });
                helpers.log("running count operation");
                const processor = new OverlappingAreaBatchedClippingProcessor_1.OverlappingAreaBatchedClippingProcessor(payload.type, 1024 * 1024 * 1, // 5MB
                (0, simplify_1.default)(intersectionFeature, {
                    tolerance: 0.002,
                }), source, differenceSources, helpers, payload.groupBy, workerPool);
                const count = await processor.calculate();
                await (0, messaging_1.flushMessages)();
                await (0, messaging_1.sendResultMessage)(payload.jobKey, count, payload.queueUrl, Date.now() - startTime);
                return;
            }
            default:
                throw new Error(`Unknown payload type: ${payload.type}`);
        }
    }
    catch (e) {
        console.log("caught error in overlay worker", e);
        console.error(e);
        await (0, messaging_1.sendErrorMessage)(payload.jobKey, e instanceof Error ? e.message : "Unknown error", payload.queueUrl);
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
//# sourceMappingURL=overlay-worker.js.map