"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectIsFragment = subjectIsFragment;
exports.subjectIsGeography = subjectIsGeography;
exports.combineRasterBandStats = combineRasterBandStats;
const simple_statistics_1 = require("simple-statistics");
function subjectIsFragment(subject) {
    return "hash" in subject;
}
function subjectIsGeography(subject) {
    return "id" in subject;
}
function equalIntervalBuckets(data, numBuckets, max, fraction = false) {
    const breaks = (0, simple_statistics_1.equalIntervalBreaks)(data, numBuckets);
    breaks.pop();
    max = max !== undefined ? max : Math.max(...data);
    return breaksToBuckets(max, breaks, data, fraction);
}
function breaksToBuckets(max, breaks, values, fraction = false) {
    const buckets = [];
    for (const b of breaks) {
        const nextBreak = breaks[breaks.indexOf(b) + 1];
        const isLastBreak = nextBreak === undefined;
        let valuesInRange = 0;
        for (const value of values) {
            if (value >= b && (isLastBreak || value < nextBreak)) {
                valuesInRange++;
            }
        }
        buckets.push([b, fraction ? valuesInRange / values.length : valuesInRange]);
    }
    buckets.push([max, null]);
    return buckets;
}
/**
 * Combines RasterBandStats from multiple fragments into a single RasterBandStats.
 * This function correctly weights mean values by count (or equivalently, uses sum/count)
 * to produce accurate aggregate statistics when fragments have different areas.
 *
 * For example, if fragment 1 has mean=5 and count=100, and fragment 2 has mean=20 and count=25,
 * the combined mean should be (5*100 + 20*25) / (100+25) = 1000/125 = 8, not (5+20)/2 = 12.5.
 *
 * @param statsArray - Array of RasterBandStats from different fragments
 * @returns Combined RasterBandStats, or undefined if the array is empty
 */
function combineRasterBandStats(statsArray) {
    if (statsArray.length === 0) {
        return undefined;
    }
    if (statsArray.length === 1) {
        return statsArray[0];
    }
    // Combine counts and sums
    let totalCount = 0;
    let totalSum = 0;
    let totalInvalid = 0;
    const mins = [];
    const maxs = [];
    // Merge histograms by value
    const histogramMap = new Map();
    for (const stats of statsArray) {
        totalCount += stats.count;
        totalSum += stats.sum;
        totalInvalid += stats.invalid;
        mins.push(stats.min);
        maxs.push(stats.max);
        // Merge histogram entries
        for (const [value, count] of stats.histogram) {
            histogramMap.set(value, (histogramMap.get(value) || 0) + count);
        }
    }
    // Convert histogram map back to array and sort by value
    const combinedHistogram = Array.from(histogramMap.entries())
        .map(([value, count]) => [value, count])
        .sort((a, b) => a[0] - b[0]);
    // Calculate combined mean using sum/count (not average of means)
    const combinedMean = totalCount > 0 ? totalSum / totalCount : NaN;
    // Calculate combined range
    const combinedMin = (0, simple_statistics_1.min)(mins);
    const combinedMax = (0, simple_statistics_1.max)(maxs);
    const combinedRange = combinedMax - combinedMin;
    // For median, we can't easily combine without the full dataset, so we'll use NaN
    // or could potentially estimate from the combined histogram, but that's complex
    const combinedMedian = NaN;
    return {
        count: totalCount,
        min: combinedMin,
        max: combinedMax,
        mean: combinedMean,
        median: combinedMedian,
        range: combinedRange,
        histogram: combinedHistogram,
        invalid: totalInvalid,
        sum: totalSum,
    };
}
//# sourceMappingURL=metrics.js.map