"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRasterStats = calculateRasterStats;
const geoblaze = require("geoblaze");
async function calculateRasterStats(sourceUrl, feature) {
    console.time("load raster");
    const raster = await geoblaze.parse(sourceUrl);
    console.timeEnd("load raster");
    console.time("calculate stats");
    const stats = await geoblaze.stats(raster, feature);
    console.timeEnd("calculate stats");
    return stats;
}
//# sourceMappingURL=rasterStats.js.map