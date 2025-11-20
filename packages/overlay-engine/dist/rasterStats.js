"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRasterStats = calculateRasterStats;
const geoblaze = require("geoblaze");
async function calculateRasterStats(sourceUrl, feature) {
    const raster = await geoblaze.parse(sourceUrl);
    const stats = await geoblaze.stats(raster, feature);
    return {
        bands: stats.map((stat) => ({
            count: stat.count,
            min: stat.min,
            max: stat.max,
            mean: stat.mean,
            median: stat.median,
            mode: stat.mode,
            modes: stat.modes,
            range: stat.range,
            histogram: [],
            invalid: stat.invalid,
            std: stat.std,
            sum: stat.sum,
        })),
    };
}
//# sourceMappingURL=rasterStats.js.map