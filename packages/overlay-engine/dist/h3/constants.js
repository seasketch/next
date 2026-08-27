"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_POINT_BUFFER_METERS = exports.MAX_SEARCH_METERS = exports.FINE_H3_RESOLUTION = exports.COARSE_H3_RESOLUTION = exports.EARTH_RADIUS_METERS = void 0;
exports.metersToDegrees = metersToDegrees;
/**
 * Fixed Earth radius used for rough degree <-> meter conversions.
 * Final distances are always computed geodesically by Turf.
 */
exports.EARTH_RADIUS_METERS = 6371008.8;
/** Coarse H3 resolution for long-range search (~22 km edge). */
exports.COARSE_H3_RESOLUTION = 4;
/** Fine H3 resolution for fetching land features (~1.2 km edge). */
exports.FINE_H3_RESOLUTION = 7;
/** Give up once the next cell's lower bound exceeds this (3,000 km). */
exports.MAX_SEARCH_METERS = 3000000;
/**
 * Minimum initial point buffer used for the small bbox search
 * (before falling back to H3). Combined with `minimumDistanceMeters`.
 */
exports.MIN_POINT_BUFFER_METERS = 50;
function metersToDegrees(distanceMeters) {
    const radians = distanceMeters / exports.EARTH_RADIUS_METERS;
    return (radians * 180) / Math.PI;
}
//# sourceMappingURL=constants.js.map