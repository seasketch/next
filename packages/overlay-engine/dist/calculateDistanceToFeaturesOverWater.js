"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistanceToFeaturesOverWater = calculateDistanceToFeaturesOverWater;
const waterPathNearest_1 = require("./h3/waterPathNearest");
/**
 * Water-path distance from a sketch to the nearest point features.
 * Land blocks the route. A point on the shoreline is reached from the
 * adjacent water cell plus a short hop.
 */
async function calculateDistanceToFeaturesOverWater(feature, points, land, options) {
    return (0, waterPathNearest_1.searchWaterPathNearest)(feature, points, land, options);
}
//# sourceMappingURL=calculateDistanceToFeaturesOverWater.js.map