"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistanceToShore = calculateDistanceToShore;
const helpers_1 = require("./utils/helpers");
const geodesicNearest_1 = require("./h3/geodesicNearest");
/**
 * Distance from a sketch in the ocean to the nearest shoreline.
 *
 * Cases:
 *   1. On land or touching land → 0
 *   2. Within `minimumDistanceMeters` of shore → 0
 *   3. Otherwise geodesic distance from the closest point on the subject
 *      to the closest shoreline point
 *
 * Land features should be subdivided; H3 search uses variable resolution
 * (coarse open-ocean cells, fine cells when fetching shoreline).
 */
async function calculateDistanceToShore(feature, land, options) {
    const helpers = (0, helpers_1.guaranteeHelpers)(options?.helpers);
    if (!feature.geometry) {
        throw new Error("calculateDistanceToShore: feature.geometry is required");
    }
    const minimumDistanceMeters = options?.minimumDistanceMeters ?? options?.miminumDistanceMeters ?? 0;
    const result = await (0, geodesicNearest_1.searchGeodesicNearestLand)(feature, land, {
        minimumDistanceMeters,
    });
    if (result.meters === Infinity) {
        helpers.log("calculateDistanceToShore: no land found within H3 search radius");
    }
    return result;
}
//# sourceMappingURL=calculateDistanceToShore.js.map