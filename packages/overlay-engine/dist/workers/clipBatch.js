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
exports.clipBatch = clipBatch;
exports.performClipping = performClipping;
exports.countFeatures = countFeatures;
const clipping = __importStar(require("polyclip-ts"));
const area_1 = __importDefault(require("@turf/area"));
const node_worker_threads_1 = require("node:worker_threads");
const point_in_polygon_hao_1 = __importDefault(require("point-in-polygon-hao"));
const boolean_intersects_1 = __importDefault(require("@turf/boolean-intersects"));
async function clipBatch({ features, differenceMultiPolygon, subjectFeature, groupBy, }) {
    var _a;
    const results = { "*": 0 };
    if (groupBy) {
        const classKeys = ["*"];
        for (const f of features) {
            const classKey = (_a = f.feature.properties) === null || _a === void 0 ? void 0 : _a[groupBy];
            if (classKey && !classKeys.includes(classKey)) {
                classKeys.push(classKey);
                results[classKey] = 0;
            }
        }
        for (const classKey of classKeys) {
            if (classKey === "*") {
                continue;
            }
            const area = await performClipping(features.filter((f) => { var _a; return ((_a = f.feature.properties) === null || _a === void 0 ? void 0 : _a[groupBy]) === classKey; }), differenceMultiPolygon, subjectFeature);
            results[classKey] += area;
            results["*"] += area;
        }
    }
    else {
        const area = await performClipping(features, differenceMultiPolygon, subjectFeature);
        results["*"] += area;
    }
    return results;
}
async function performClipping(features, differenceGeoms, subjectFeature) {
    let product = [];
    let forClipping = [];
    for (const f of features) {
        const target = f.requiresIntersection ? forClipping : product;
        if (f.feature.geometry.type === "Polygon") {
            // @ts-ignore
            target.push(f.feature.geometry.coordinates);
        }
        else {
            for (const poly of f.feature.geometry.coordinates) {
                // @ts-ignore
                target.push(poly);
            }
        }
    }
    if (forClipping.length > 0) {
        const result = clipping.intersection(forClipping, subjectFeature.geometry.coordinates);
        if (result.length > 0) {
            // @ts-ignore
            product.push(...result);
        }
    }
    const difference = clipping.difference(product, ...differenceGeoms);
    const sqKm = (0, area_1.default)({
        type: "Feature",
        geometry: {
            type: "MultiPolygon",
            coordinates: difference,
        },
        properties: {},
    }) * 1e-6;
    return sqKm;
}
async function countFeatures({ features, differenceMultiPolygon, subjectFeature, groupBy, }) {
    var _a;
    const results = { "*": new Set() };
    for (const f of features) {
        if (f.requiresIntersection) {
            throw new Error("Not implemented. If just counting features, they should never be added to the batch if unsure if they lie within the subject feature.");
        }
        if (f.requiresDifference) {
            if (f.feature.geometry.type === "Point" ||
                f.feature.geometry.type === "MultiPoint") {
                const coords = f.feature.geometry.type === "Point"
                    ? [f.feature.geometry.coordinates]
                    : f.feature.geometry.coordinates;
                for (const coord of coords) {
                    let anyMisses = false;
                    for (const poly of differenceMultiPolygon) {
                        const r = (0, point_in_polygon_hao_1.default)(coord, poly);
                        if (r === false) {
                            anyMisses = true;
                            break;
                        }
                    }
                    if (!anyMisses) {
                        continue;
                    }
                }
            }
            else {
                // for any other geometry type, we'll use booleanIntersects to check if
                // the feature intersects the difference feature
                if ((0, boolean_intersects_1.default)(f.feature, {
                    type: "Feature",
                    geometry: {
                        type: "MultiPolygon",
                        coordinates: differenceMultiPolygon,
                    },
                    properties: {},
                })) {
                    continue;
                }
            }
        }
        if (!("__oidx" in f.feature.properties || {})) {
            throw new Error("Feature properties must contain __oidx");
        }
        if (groupBy) {
            const classKey = (_a = f.feature.properties) === null || _a === void 0 ? void 0 : _a[groupBy];
            if (classKey) {
                if (!(classKey in results)) {
                    results[classKey] = new Set();
                }
                results[classKey].add(f.feature.properties.__oidx);
            }
        }
        results["*"].add(f.feature.properties.__oidx);
    }
    return Object.fromEntries(Object.entries(results).map(([key, value]) => [key, Array.from(value)]));
}
node_worker_threads_1.parentPort === null || node_worker_threads_1.parentPort === void 0 ? void 0 : node_worker_threads_1.parentPort.on("message", async (job) => {
    try {
        const operation = job.operation || "overlay_area"; // Default to overlay_area for backward compatibility
        let result;
        if (operation === "overlay_area") {
            result = await clipBatch({
                features: job.features,
                differenceMultiPolygon: job.differenceMultiPolygon,
                subjectFeature: job.subjectFeature,
                groupBy: job.groupBy,
            });
        }
        else if (operation === "count") {
            console.log("running countFeatures");
            result = await countFeatures({
                features: job.features,
                differenceMultiPolygon: job.differenceMultiPolygon,
                subjectFeature: job.subjectFeature,
                groupBy: job.groupBy,
            });
        }
        else {
            throw new Error(`Unknown operation type: ${operation}`);
        }
        node_worker_threads_1.parentPort === null || node_worker_threads_1.parentPort === void 0 ? void 0 : node_worker_threads_1.parentPort.postMessage({ ok: true, result });
    }
    catch (err) {
        node_worker_threads_1.parentPort === null || node_worker_threads_1.parentPort === void 0 ? void 0 : node_worker_threads_1.parentPort.postMessage({
            ok: false,
            error: { message: err.message, stack: err.stack },
        });
    }
});
//# sourceMappingURL=clipBatch.js.map