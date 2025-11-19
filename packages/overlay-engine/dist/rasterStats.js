"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRasterStats = calculateRasterStats;
const geoblaze = require("geoblaze");
async function calculateRasterStats(sourceUrl, feature) {
    const raster = await geoblaze.parse(sourceUrl);
    const stats = await geoblaze.stats(raster, feature);
    return stats;
}
//# sourceMappingURL=rasterStats.js.map