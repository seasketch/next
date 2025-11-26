"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downsampleHistogram = downsampleHistogram;
exports.calculateRasterStats = calculateRasterStats;
const geoblaze = require("geoblaze");
function downsampleHistogram(histogram, maxEntries) {
    if (histogram.length === 0 || histogram.length <= maxEntries) {
        return histogram;
    }
    // Ensure sorted by value (x)
    const sorted = [...histogram].sort((a, b) => a[0] - b[0]);
    const minValue = sorted[0][0];
    const maxValue = sorted[sorted.length - 1][0];
    if (!isFinite(minValue) || !isFinite(maxValue) || minValue === maxValue) {
        const totalCount = sorted.reduce((acc, [, count]) => acc + count, 0);
        return [[minValue, totalCount]];
    }
    const numBins = maxEntries;
    const binCounts = new Array(numBins).fill(0);
    const span = maxValue - minValue;
    for (const [value, count] of sorted) {
        const normalized = (value - minValue) / span;
        let binIndex = Math.round(normalized * (numBins - 1));
        if (binIndex < 0)
            binIndex = 0;
        if (binIndex >= numBins)
            binIndex = numBins - 1;
        binCounts[binIndex] += count;
    }
    const result = [];
    for (let i = 0; i < numBins; i++) {
        const count = binCounts[i];
        if (count === 0)
            continue;
        const value = minValue + (span * i) / (numBins - 1);
        result.push([value, count]);
    }
    return result;
}
async function calculateRasterStats(sourceUrl, feature) {
    console.time("parse raster");
    try {
        const raster = await geoblaze.parse(sourceUrl);
        console.timeEnd("parse raster");
        console.time("calculate stats");
        const stats = await geoblaze.stats(raster, feature, {
            stats: [
                "count",
                "min",
                "max",
                "mean",
                "median",
                "range",
                "histogram",
                "invalid",
                "sum",
            ],
        });
        console.timeEnd("calculate stats");
        return {
            bands: stats.map((stat) => {
                const rawHistogram = Array.isArray(stat.histogram)
                    ? stat.histogram
                    : Object.values(stat.histogram).map((r) => [r.n, r.ct]);
                const histogram = downsampleHistogram(rawHistogram, 200);
                return {
                    count: stat.count,
                    min: stat.min,
                    max: stat.max,
                    mean: stat.mean,
                    median: stat.median,
                    range: stat.range,
                    histogram,
                    invalid: stat.invalid,
                    sum: stat.sum,
                };
            }),
        };
    }
    catch (e) {
        console.error("Error calculating raster stats", e);
        if (typeof e === "string" && e.includes("No Values")) {
            return {
                bands: [],
            };
        }
        else {
            throw e;
        }
    }
    finally {
        console.timeEnd("calculate raster stats");
    }
}
//# sourceMappingURL=rasterStats.js.map