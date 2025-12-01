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
exports.calculatedClippedOverlapSize = calculatedClippedOverlapSize;
exports.countFeatures = countFeatures;
exports.testForPresenceInSubject = testForPresenceInSubject;
exports.createPresenceTable = createPresenceTable;
exports.collectColumnValues = collectColumnValues;
exports.pick = pick;
const clipping = __importStar(require("polyclip-ts"));
const area_1 = __importDefault(require("@turf/area"));
const node_worker_threads_1 = require("node:worker_threads");
const point_in_polygon_hao_1 = __importDefault(require("point-in-polygon-hao"));
const boolean_intersects_1 = __importDefault(require("@turf/boolean-intersects"));
const length_1 = __importDefault(require("@turf/length"));
const boolean_within_1 = __importDefault(require("@turf/boolean-within"));
const boolean_disjoint_1 = __importDefault(require("@turf/boolean-disjoint"));
const line_split_1 = __importDefault(require("@turf/line-split"));
const along_1 = __importDefault(require("@turf/along"));
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
            const size = calculatedClippedOverlapSize(features.filter((f) => { var _a; return ((_a = f.feature.properties) === null || _a === void 0 ? void 0 : _a[groupBy]) === classKey; }), differenceMultiPolygon, subjectFeature);
            results[classKey] += size;
            results["*"] += size;
        }
    }
    else {
        const size = calculatedClippedOverlapSize(features, differenceMultiPolygon, subjectFeature);
        results["*"] += size;
    }
    return results;
}
function calcSize(feature) {
    if (feature.geometry.type === "Polygon" ||
        feature.geometry.type === "MultiPolygon") {
        return (0, area_1.default)(feature) * 1e-6;
    }
    else if (feature.geometry.type === "LineString" ||
        feature.geometry.type === "MultiLineString") {
        return (0, length_1.default)(feature, { units: "kilometers" });
    }
    return 0;
}
function calculatedClippedOverlapSize(features, differenceGeoms, subjectFeature) {
    if (features[0].feature.geometry.type === "Polygon" ||
        features[0].feature.geometry.type === "MultiPolygon") {
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
        return calcSize({
            type: "Feature",
            geometry: {
                type: "MultiPolygon",
                coordinates: difference,
            },
            properties: {},
        });
    }
    else if (features[0].feature.geometry.type === "LineString" ||
        features[0].feature.geometry.type === "MultiLineString") {
        let totalLength = 0;
        for (const f of features) {
            const processed = performOperationsOnFeature(f.feature, f.requiresIntersection, f.requiresDifference, differenceGeoms, subjectFeature);
            if (processed.geometry.type === "LineString" ||
                processed.geometry.type === "MultiLineString") {
                totalLength += calcSize(processed);
            }
        }
        return totalLength;
    }
    return 0;
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
async function testForPresenceInSubject({ features, differenceMultiPolygon, subjectFeature, }) {
    // Tests whether any features in the feature array are present in the subject
    // feature. If any of those features are in the subject but also in the
    // difference feature, they don't count as a match. This function will return
    // tru as soon as it finds any match.
    for (const f of features) {
        if (f.requiresIntersection) {
            if (!(0, boolean_intersects_1.default)(f.feature, subjectFeature)) {
                continue;
            }
        }
        if (f.requiresDifference) {
            if ((0, boolean_intersects_1.default)(f.feature, {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "MultiPolygon",
                    coordinates: differenceMultiPolygon,
                },
            })) {
                continue;
            }
        }
        return true;
    }
    return false;
}
async function createPresenceTable({ features, differenceMultiPolygon, subjectFeature, limit = 50, includedProperties, }) {
    const results = {
        exceededLimit: false,
        values: [],
    };
    for (const f of features) {
        if (results.exceededLimit) {
            break;
        }
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
        let result = {
            __id: f.feature.properties.__oidx,
            ...f.feature.properties,
        };
        result = pick(result, includedProperties);
        results.values.push(result);
        if (results.values.length >= limit) {
            results.exceededLimit = true;
        }
    }
    return results;
}
async function collectColumnValues({ features, differenceMultiPolygon, subjectFeature, property, groupBy, }) {
    var _a, _b;
    const results = { "*": [] };
    for (const f of features) {
        if (f.feature.geometry.type === "Point" ||
            f.feature.geometry.type === "MultiPoint") {
            if (f.requiresIntersection) {
                throw new Error("Not implemented. If just collecting column values for points. They should never be added to the batch if unsure if they lie within the subject feature.");
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
            }
        }
        else if (f.feature.geometry.type === "Polygon" ||
            f.feature.geometry.type === "MultiPolygon" ||
            f.feature.geometry.type === "LineString" ||
            f.feature.geometry.type === "MultiLineString") {
            f.feature = performOperationsOnFeature(f.feature, f.requiresIntersection, f.requiresDifference, differenceMultiPolygon, subjectFeature);
        }
        const value = (_a = f.feature.properties) === null || _a === void 0 ? void 0 : _a[property];
        const columnValue = [value];
        if (f.feature.geometry.type === "Polygon" ||
            f.feature.geometry.type === "MultiPolygon") {
            const sqKm = (0, area_1.default)(f.feature) * 1e-6;
            if (isNaN(sqKm) || sqKm === 0) {
                continue;
            }
            columnValue.push(sqKm);
        }
        else if (f.feature.geometry.type === "LineString" ||
            f.feature.geometry.type === "MultiLineString") {
            const length = (0, length_1.default)(f.feature);
            if (isNaN(length) || length === 0) {
                continue;
            }
            columnValue.push(length);
        }
        if (typeof value === "number") {
            results["*"].push(columnValue);
            if (groupBy) {
                const classKey = (_b = f.feature.properties) === null || _b === void 0 ? void 0 : _b[groupBy];
                if (classKey) {
                    if (!(classKey in results)) {
                        results[classKey] = [];
                    }
                    results[classKey].push(columnValue);
                }
            }
        }
    }
    return results;
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
            result = await countFeatures({
                features: job.features,
                differenceMultiPolygon: job.differenceMultiPolygon,
                subjectFeature: job.subjectFeature,
                groupBy: job.groupBy,
            });
        }
        else if (operation === "presence") {
            result = await testForPresenceInSubject({
                features: job.features,
                differenceMultiPolygon: job.differenceMultiPolygon,
                subjectFeature: job.subjectFeature,
            });
        }
        else if (operation === "presence_table") {
            result = await createPresenceTable({
                features: job.features,
                differenceMultiPolygon: job.differenceMultiPolygon,
                subjectFeature: job.subjectFeature,
                limit: job.limit,
                includedProperties: job.includedProperties,
            });
        }
        else if (operation === "column_values") {
            if (!job.property) {
                throw new Error("property is required for column_values operation");
            }
            result = await collectColumnValues({
                features: job.features,
                differenceMultiPolygon: job.differenceMultiPolygon,
                subjectFeature: job.subjectFeature,
                property: job.property,
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
function pick(object, keys) {
    keys = keys || Object.keys(object);
    keys = keys.filter((key) => key !== "__oidx" &&
        key !== "__byteLength" &&
        key !== "__area" &&
        key !== "__offset");
    return keys.reduce((acc, key) => {
        acc[key] = object[key];
        return acc;
    }, {});
}
function performOperationsOnFeature(feature, requiresIntersection, requiresDifference, differenceMultiPolygon, subjectFeature) {
    // Clone the feature to avoid modifying the original
    let result = JSON.parse(JSON.stringify(feature));
    if (result.geometry.type === "Polygon" ||
        result.geometry.type === "MultiPolygon") {
        let geom = result.geometry.type === "Polygon"
            ? [result.geometry.coordinates]
            : result.geometry.coordinates;
        if (requiresIntersection) {
            geom = clipping.intersection(geom, subjectFeature.geometry.coordinates);
        }
        if (requiresDifference) {
            geom = clipping.difference(geom, ...differenceMultiPolygon);
        }
        result.geometry = {
            type: "MultiPolygon",
            coordinates: geom,
        };
    }
    else if (result.geometry.type === "LineString" ||
        result.geometry.type === "MultiLineString") {
        let multiLine = toMultiLineCoordinates(result.geometry);
        if (requiresIntersection) {
            multiLine = clipLinesWithPolygon(multiLine, subjectFeature, "intersect");
        }
        if (requiresDifference && differenceMultiPolygon.length > 0) {
            for (const geom of differenceMultiPolygon) {
                if (multiLine.length === 0) {
                    break;
                }
                if (!geom || geom.length === 0) {
                    continue;
                }
                const differenceFeature = geomToMultiPolygonFeature(geom);
                multiLine = clipLinesWithPolygon(multiLine, differenceFeature, "difference");
            }
        }
        result.geometry = {
            type: "MultiLineString",
            coordinates: multiLine,
        };
    }
    else {
        throw new Error(`Unsupported geometry type: ${feature.geometry.type}`);
    }
    return result;
}
function toMultiLineCoordinates(geometry) {
    if (geometry.type === "LineString") {
        return [cloneLineCoordinates(geometry.coordinates)];
    }
    return geometry.coordinates.map((line) => cloneLineCoordinates(line));
}
function clipLinesWithPolygon(lines, polygon, mode) {
    if (lines.length === 0) {
        return [];
    }
    const keepInside = mode === "intersect";
    const result = [];
    for (const coords of lines) {
        const filtered = filterLineStringAgainstPolygon(coords, polygon, keepInside);
        if (filtered.length > 0) {
            result.push(...filtered);
        }
    }
    return result;
}
function filterLineStringAgainstPolygon(coords, polygon, keepInside) {
    if (coords.length < 2) {
        return [];
    }
    const line = {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: coords,
        },
        properties: {},
    };
    // Line fully within polygon
    if ((0, boolean_within_1.default)(line, polygon)) {
        return keepInside ? [cloneLineCoordinates(coords)] : [];
    }
    // Line fully outside polygon
    if ((0, boolean_disjoint_1.default)(polygon, line)) {
        return keepInside ? [] : [cloneLineCoordinates(coords)];
    }
    // Line intersects polygon - split and check each segment
    const split = (0, line_split_1.default)(line, polygon);
    const segments = [];
    for (const segment of split.features) {
        if (segment.geometry.type !== "LineString") {
            continue;
        }
        if (segment.geometry.coordinates.length < 2) {
            continue;
        }
        const segmentFeature = segment;
        // Filter out very small segments (< 0.2 meters) to avoid precision issues
        const segmentLengthKm = (0, length_1.default)(segmentFeature, {
            units: "kilometers",
        });
        const segmentLengthMeters = segmentLengthKm * 1000;
        if (segmentLengthMeters <= 0.2) {
            continue;
        }
        const samplePoint = samplePointOnSegment(segmentFeature, segmentLengthKm);
        const inside = samplePoint
            ? (0, boolean_within_1.default)(samplePoint, polygon)
            : (0, boolean_within_1.default)(segmentFeature, polygon);
        if ((keepInside && inside) || (!keepInside && !inside)) {
            segments.push(cloneLineCoordinates(segment.geometry.coordinates));
        }
    }
    return segments;
}
function cloneLineCoordinates(coords) {
    return coords.map((pt) => pt.slice());
}
function samplePointOnSegment(segment, segmentLengthKm) {
    var _a;
    const distanceKm = Math.max(segmentLengthKm / 2, 1e-6);
    try {
        const sampled = (0, along_1.default)(segment, distanceKm, { units: "kilometers" });
        if (((_a = sampled === null || sampled === void 0 ? void 0 : sampled.geometry) === null || _a === void 0 ? void 0 : _a.type) === "Point") {
            return sampled;
        }
    }
    catch (err) {
        // Fall through to manual midpoint fallback
    }
    const coords = segment.geometry.coordinates;
    if (!coords || coords.length === 0) {
        return null;
    }
    const midIdx = Math.floor(coords.length / 2);
    const midpoint = coords[midIdx];
    if (!midpoint) {
        return null;
    }
    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: midpoint,
        },
        properties: {},
    };
}
function geomToMultiPolygonFeature(geom) {
    return {
        type: "Feature",
        geometry: {
            type: "MultiPolygon",
            coordinates: geomToMultiPolygonCoordinates(geom),
        },
        properties: {},
    };
}
function geomToMultiPolygonCoordinates(geom) {
    var _a, _b;
    if (!geom || geom.length === 0) {
        return [];
    }
    const indicator = (_b = (_a = geom === null || geom === void 0 ? void 0 : geom[0]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b[0];
    if (Array.isArray(indicator)) {
        return geom;
    }
    return [geom];
}
// export function lineOverlap(
//   poly: Feature<Polygon | MultiPolygon>,
//   line: FeatureWithMetadata<Feature<LineString | MultiLineString>>
// ): FeatureWithMetadata<Feature<LineString | MultiLineString>> | null {
//   // Line fully within polygon
//   if (booleanWithin(line, poly)) {
//     return line;
//   }
//   // Line fully outside polygon
//   if (booleanDisjoint(poly, line)) {
//     return null;
//   }
//   // Line intersects polygon
//   const splitLines = lineSplit(line, poly);
//   for (const segment of splitLines.features) {
//     if (
//       segment.geometry.type === "LineString" &&
//       turfLength(segment, { units: "meters" }) > 0.2 &&
//       booleanWithin(
//         lineSliceAlong(segment, 0.1, 0.1, { units: "meters" }),
//         poly
//       )
//     ) {
//       results.push(segment);
//     }
//   }
// }
//# sourceMappingURL=clipBatch.js.map