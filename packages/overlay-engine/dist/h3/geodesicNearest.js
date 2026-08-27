"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchGeodesicNearestLand = searchGeodesicNearestLand;
const boolean_intersects_1 = __importDefault(require("@turf/boolean-intersects"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const h3_js_1 = require("h3-js");
const bboxUtils_1 = require("../utils/bboxUtils");
const bboxForCell_1 = require("./bboxForCell");
const constants_1 = require("./constants");
const coverGeometry_1 = require("./coverGeometry");
const landOccupancy_1 = require("./landOccupancy");
const adaptiveGrid_1 = require("./adaptiveGrid");
const minHeap_1 = require("./minHeap");
const nearestShorelinePath_1 = require("./nearestShorelinePath");
function envelopeAroundPoint(point, bufferMeters) {
    const [lng, lat] = point.coordinates;
    const delta = (0, constants_1.metersToDegrees)(bufferMeters);
    const raw = [
        lng - delta,
        lat - delta,
        lng + delta,
        lat + delta,
    ];
    const cleaned = (0, bboxUtils_1.cleanBBox)(raw);
    const split = (0, bboxUtils_1.splitBBoxAntimeridian)(cleaned);
    return split.map(bboxUtils_1.bboxToEnvelope);
}
function pathLine(origin, shoreline) {
    if (!origin || !shoreline)
        return null;
    return {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: [origin, shoreline],
        },
        properties: {},
    };
}
async function exactDistanceInCell(feature, cell, land, seenOffsets, minimumDistanceMeters) {
    const cellBBox = (0, bboxForCell_1.bboxForCell)(cell);
    const cleaned = (0, bboxUtils_1.cleanBBox)(cellBBox);
    const split = (0, bboxUtils_1.splitBBoxAntimeridian)(cleaned);
    let bestMeters = Infinity;
    let bestOrigin = null;
    let bestShoreline = null;
    for (const part of split) {
        const env = (0, bboxUtils_1.bboxToEnvelope)(part);
        const queryPlan = land.createPlan(env);
        for await (const landFeature of land.getFeaturesAsync(env, {
            queryPlan,
        })) {
            const offset = landFeature.properties &&
                landFeature.properties.__offset;
            if (typeof offset === "number") {
                if (seenOffsets.has(offset))
                    continue;
                seenOffsets.add(offset);
            }
            if ((0, boolean_intersects_1.default)(feature, landFeature)) {
                return { meters: 0, origin: null, shoreline: null };
            }
            const path = (0, nearestShorelinePath_1.nearestPointsBetweenGeometryAndPolygon)(feature.geometry, landFeature);
            if (path.meters < bestMeters) {
                bestMeters = path.meters;
                bestOrigin = path.origin;
                bestShoreline = path.shoreline;
                if (bestMeters <= minimumDistanceMeters) {
                    return {
                        meters: 0,
                        origin: bestOrigin,
                        shoreline: bestShoreline,
                    };
                }
            }
        }
    }
    return { meters: bestMeters, origin: bestOrigin, shoreline: bestShoreline };
}
async function searchWithAdaptiveH3(feature, land, originSamples, minimumDistanceMeters) {
    const originCells = (0, coverGeometry_1.cellsCoveringGeometry)(feature.geometry, constants_1.COARSE_H3_RESOLUTION);
    if (originCells.length === 0) {
        return { meters: Infinity, geojsonLine: null };
    }
    const occupancy = new Map();
    const visited = new Set();
    const heap = new minHeap_1.MinHeap();
    const seenOffsets = new Set();
    const enqueue = (cell) => {
        if (visited.has(cell))
            return;
        visited.add(cell);
        const lb = (0, adaptiveGrid_1.cellLowerBoundMeters)(originSamples, cell);
        if (lb > constants_1.MAX_SEARCH_METERS)
            return;
        heap.push(lb, cell);
    };
    for (const cell of originCells) {
        enqueue(cell);
    }
    let bestMeters = Infinity;
    let bestOrigin = null;
    let bestShoreline = null;
    while (heap.size > 0) {
        const next = heap.pop();
        if (next.key >= bestMeters) {
            break;
        }
        if (next.key > constants_1.MAX_SEARCH_METERS) {
            break;
        }
        const cell = next.value;
        const res = (0, h3_js_1.getResolution)(cell);
        const hasLand = (0, landOccupancy_1.cellHasLand)(cell, land, occupancy);
        if (res < constants_1.FINE_H3_RESOLUTION) {
            if (hasLand) {
                for (const child of (0, adaptiveGrid_1.refineToFine)(cell)) {
                    enqueue(child);
                }
            }
            for (const neighbor of (0, adaptiveGrid_1.sameResNeighbors)(cell)) {
                enqueue(neighbor);
            }
            continue;
        }
        if (!hasLand) {
            continue;
        }
        const exact = await exactDistanceInCell(feature, cell, land, seenOffsets, minimumDistanceMeters);
        if (exact.meters < bestMeters) {
            bestMeters = exact.meters;
            bestOrigin = exact.origin;
            bestShoreline = exact.shoreline;
            if (bestMeters <= minimumDistanceMeters) {
                return {
                    meters: 0,
                    geojsonLine: pathLine(bestOrigin, bestShoreline),
                };
            }
        }
    }
    if (bestMeters === Infinity) {
        return { meters: Infinity, geojsonLine: null };
    }
    const finalMeters = bestMeters <= minimumDistanceMeters ? 0 : bestMeters;
    return {
        meters: finalMeters,
        geojsonLine: pathLine(bestOrigin, bestShoreline),
    };
}
async function searchImmediateBbox(feature, land, minimumDistanceMeters) {
    let envelopes;
    if (feature.geometry.type === "Point") {
        const point = feature.geometry;
        const pointBufferMeters = Math.max(constants_1.MIN_POINT_BUFFER_METERS, minimumDistanceMeters);
        envelopes = envelopeAroundPoint(point, pointBufferMeters);
    }
    else {
        const rawBBox = (0, bbox_1.default)(feature.geometry);
        const cleaned = (0, bboxUtils_1.cleanBBox)(rawBBox);
        const split = (0, bboxUtils_1.splitBBoxAntimeridian)(cleaned);
        envelopes = split.map(bboxUtils_1.bboxToEnvelope);
    }
    const estimate = land.search(envelopes.length === 1 ? envelopes[0] : envelopes);
    if (estimate.features === 0) {
        return null;
    }
    const seenOffsets = new Set();
    const queryPlan = land.createPlan(envelopes.length === 1 ? envelopes[0] : envelopes);
    let bestMeters = Infinity;
    let bestOrigin = null;
    let bestShoreline = null;
    for await (const landFeature of land.getFeaturesAsync(envelopes.length === 1 ? envelopes[0] : envelopes, { queryPlan })) {
        const offset = landFeature.properties &&
            landFeature.properties.__offset;
        if (typeof offset === "number") {
            if (seenOffsets.has(offset))
                continue;
            seenOffsets.add(offset);
        }
        if ((0, boolean_intersects_1.default)(feature, landFeature)) {
            return { meters: 0, geojsonLine: null };
        }
        const path = (0, nearestShorelinePath_1.nearestPointsBetweenGeometryAndPolygon)(feature.geometry, landFeature);
        if (path.meters < bestMeters) {
            bestMeters = path.meters;
            bestOrigin = path.origin;
            bestShoreline = path.shoreline;
            if (bestMeters <= minimumDistanceMeters) {
                return {
                    meters: 0,
                    geojsonLine: pathLine(bestOrigin, bestShoreline),
                };
            }
        }
    }
    if (bestMeters < Infinity && bestOrigin && bestShoreline) {
        return {
            meters: bestMeters,
            geojsonLine: pathLine(bestOrigin, bestShoreline),
        };
    }
    return null;
}
async function searchGeodesicNearestLand(feature, land, options) {
    if (!feature.geometry) {
        throw new Error("searchGeodesicNearestLand: feature.geometry is required");
    }
    const minimumDistanceMeters = options?.minimumDistanceMeters ?? 0;
    const immediate = await searchImmediateBbox(feature, land, minimumDistanceMeters);
    if (immediate) {
        return immediate;
    }
    const originSamples = (0, coverGeometry_1.densifiedPositionsFromGeometry)(feature.geometry, (0, h3_js_1.getHexagonEdgeLengthAvg)(constants_1.FINE_H3_RESOLUTION, "m") / 2);
    return searchWithAdaptiveH3(feature, land, originSamples, minimumDistanceMeters);
}
//# sourceMappingURL=geodesicNearest.js.map