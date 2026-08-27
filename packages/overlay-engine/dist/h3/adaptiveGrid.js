"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINE_H3_RESOLUTION = exports.COARSE_H3_RESOLUTION = void 0;
exports.cellLowerBoundMeters = cellLowerBoundMeters;
exports.sameResNeighbors = sameResNeighbors;
exports.refineToFine = refineToFine;
const h3_js_1 = require("h3-js");
const distance_1 = __importDefault(require("@turf/distance"));
const constants_1 = require("./constants");
Object.defineProperty(exports, "COARSE_H3_RESOLUTION", { enumerable: true, get: function () { return constants_1.COARSE_H3_RESOLUTION; } });
Object.defineProperty(exports, "FINE_H3_RESOLUTION", { enumerable: true, get: function () { return constants_1.FINE_H3_RESOLUTION; } });
/**
 * Admissible lower bound (meters) from origin sample points to any location
 * inside `cell`: geodesic to the cell center minus the hex circumradius
 * (edge length).
 */
function cellLowerBoundMeters(originSamples, cell) {
    if (originSamples.length === 0)
        return 0;
    const res = (0, h3_js_1.getResolution)(cell);
    const circumradius = (0, h3_js_1.getHexagonEdgeLengthAvg)(res, "m");
    const [lat, lng] = (0, h3_js_1.cellToLatLng)(cell);
    let best = Infinity;
    for (const sample of originSamples) {
        const meters = (0, distance_1.default)(sample, [lng, lat], {
            units: "meters",
        });
        const lb = meters - circumradius;
        if (lb < best)
            best = lb;
    }
    return best < 0 ? 0 : best;
}
function sameResNeighbors(cell) {
    return (0, h3_js_1.gridDisk)(cell, 1).filter((n) => n !== cell);
}
function refineToFine(cell) {
    const res = (0, h3_js_1.getResolution)(cell);
    if (res >= constants_1.FINE_H3_RESOLUTION)
        return [cell];
    return (0, h3_js_1.cellToChildren)(cell, constants_1.FINE_H3_RESOLUTION);
}
//# sourceMappingURL=adaptiveGrid.js.map