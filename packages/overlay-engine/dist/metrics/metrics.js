"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectIsFragment = subjectIsFragment;
exports.subjectIsGeography = subjectIsGeography;
exports.combineRasterBandStats = combineRasterBandStats;
exports.combineColumnValueStats = combineColumnValueStats;
exports.combineMetricsForFragments = combineMetricsForFragments;
const simple_statistics_1 = require("simple-statistics");
const uniqueIdIndex_1 = require("../utils/uniqueIdIndex");
/**
 * Downsamples a histogram of [value, count] pairs to a maximum number of
 * entries, preserving the overall distribution across the full value range.
 * This mirrors the approach used in rasterStats downsampling.
 */
function downsampleColumnHistogram(histogram, maxEntries) {
    if (histogram.length === 0 || histogram.length <= maxEntries) {
        return histogram;
    }
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
        throw new Error("Cannot combine empty array of RasterBandStats");
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
/**
 * Combines ColumnValueStats from multiple fragments into a single ColumnValueStats.
 * If totalAreaSqKm is available, mean and stdDev are weighted by totalAreaSqKm.
 * Otherwise, they are weighted by count.
 */
function combineColumnValueStats(statsArray) {
    if (statsArray.length === 0) {
        return undefined;
    }
    if (statsArray.length === 1) {
        return statsArray[0];
    }
    // Determine whether to weight by area or by count
    const useAreaWeight = statsArray.some((s) => typeof s.totalAreaSqKm === "number" && s.totalAreaSqKm > 0);
    let totalCount = 0;
    let totalSum = 0;
    let totalWeight = 0;
    const mins = [];
    const maxs = [];
    // For variance/stdDev combination we use:
    // E[x^2] = variance + mean^2, aggregated with the same weights as for the mean
    let weightedMeanNumerator = 0;
    let weightedSecondMoment = 0;
    // Merge histograms by value
    const histogramMap = new Map();
    for (const stats of statsArray) {
        const weight = useAreaWeight && typeof stats.totalAreaSqKm === "number"
            ? Math.max(stats.totalAreaSqKm, 0)
            : stats.count;
        if (!isFinite(weight) || weight <= 0) {
            continue;
        }
        totalCount += stats.count;
        totalSum += stats.sum;
        mins.push(stats.min);
        maxs.push(stats.max);
        if (isFinite(stats.mean)) {
            // Only include fragments with a finite mean in the weighted
            // mean/stdDev calculation. Fragments with NaN mean still
            // contribute to count/sum but are ignored for weighting.
            weightedMeanNumerator += stats.mean * weight;
            totalWeight += weight;
            if (isFinite(stats.stdDev)) {
                const variance = stats.stdDev * stats.stdDev;
                weightedSecondMoment += (variance + stats.mean * stats.mean) * weight;
            }
        }
        // Merge histogram entries
        for (const [value, count] of stats.histogram) {
            histogramMap.set(value, (histogramMap.get(value) || 0) + count);
        }
    }
    // If all weights were zero, fall back to simple stats if possible
    const combinedCount = totalCount;
    const combinedSum = totalSum;
    const combinedMin = mins.length > 0 ? (0, simple_statistics_1.min)(mins) : NaN;
    const combinedMax = maxs.length > 0 ? (0, simple_statistics_1.max)(maxs) : NaN;
    let combinedMean = NaN;
    let combinedStdDev = NaN;
    if (totalWeight > 0 && weightedMeanNumerator !== 0) {
        combinedMean = weightedMeanNumerator / totalWeight;
        if (weightedSecondMoment !== 0) {
            const meanSquare = weightedSecondMoment / totalWeight;
            const variance = meanSquare - combinedMean * combinedMean;
            combinedStdDev = Math.sqrt(Math.max(variance, 0));
        }
    }
    else if (combinedCount > 0) {
        combinedMean = combinedSum / combinedCount;
        // stdDev cannot be reliably combined without additional information; leave as NaN
    }
    // Convert histogram map back to array and sort by value
    let combinedHistogram = Array.from(histogramMap.entries())
        .map(([value, count]) => [value, count])
        .sort((a, b) => a[0] - b[0]);
    // Limit histogram size similarly to raster stats by downsampling
    const MAX_HISTOGRAM_ENTRIES = 200;
    if (combinedHistogram.length > MAX_HISTOGRAM_ENTRIES) {
        combinedHistogram = downsampleColumnHistogram(combinedHistogram, MAX_HISTOGRAM_ENTRIES);
    }
    const countDistinct = histogramMap.size;
    const totalAreaSqKm = useAreaWeight
        ? statsArray.reduce((acc, s) => acc +
            (typeof s.totalAreaSqKm === "number" && s.totalAreaSqKm > 0
                ? s.totalAreaSqKm
                : 0), 0)
        : undefined;
    return {
        count: combinedCount,
        min: combinedMin,
        max: combinedMax,
        mean: combinedMean,
        stdDev: combinedStdDev,
        histogram: combinedHistogram,
        countDistinct,
        sum: combinedSum,
        totalAreaSqKm,
    };
}
function combineMetricsForFragments(metrics) {
    // first, ensure that all metrics have the same type
    const types = new Set(metrics.map((m) => m.type));
    if (types.size !== 1) {
        throw new Error(`All metrics must have the same type. Found types: ${Array.from(types).join(", ")}`);
    }
    const type = Array.from(types)[0];
    // then, combine the values
    switch (type) {
        case "raster_stats": {
            for (const metric of metrics) {
                if (metric.value.bands.length > 1) {
                    throw new Error("Multiple bands are not supported for raster_stats");
                }
            }
            const values = metrics.map((m) => m.value.bands[0]);
            return {
                type: "raster_stats",
                value: {
                    bands: [combineRasterBandStats(values)],
                },
            };
        }
        case "column_values": {
            const values = metrics.map((m) => m.value);
            return {
                type: "column_values",
                value: combineGroupedValues(values, (v) => combineColumnValueStats(v)),
            };
        }
        case "total_area": {
            const values = metrics.map((m) => m.value);
            return {
                type: "total_area",
                value: values.reduce((acc, v) => acc + v, 0),
            };
        }
        case "count": {
            const values = metrics.map((m) => m.value);
            return {
                type: "count",
                value: combineGroupedValues(values, (value) => {
                    const mergedIndexes = (0, uniqueIdIndex_1.mergeUniqueIdIndexes)(...value.map((v) => v.uniqueIdIndex));
                    const count = (0, uniqueIdIndex_1.countUniqueIds)(mergedIndexes);
                    return {
                        count,
                        uniqueIdIndex: mergedIndexes,
                    };
                }),
            };
        }
        case "distance_to_shore": {
            const values = metrics.map((m) => m.value);
            // return the closest
            const closest = values.reduce((acc, v) => {
                if (v.meters < acc.meters) {
                    return v;
                }
                return acc;
            }, values[0]);
            return {
                type: "distance_to_shore",
                value: closest,
            };
        }
        case "presence": {
            const values = metrics.map((m) => m.value);
            return {
                type: "presence",
                value: values.some((v) => v),
            };
        }
        case "presence_table": {
            const values = metrics.map((m) => m.value);
            const exceededLimit = values.some((v) => v.exceededLimit);
            const features = [];
            const ids = new Set();
            for (const value of values) {
                for (const feature of value.values) {
                    if (!ids.has(feature.__id)) {
                        ids.add(feature.__id);
                        features.push(feature);
                    }
                }
            }
            return {
                type: "presence_table",
                value: {
                    values: features,
                    exceededLimit,
                },
            };
        }
        case "overlay_area": {
            const values = metrics.map((m) => m.value);
            return {
                type: "overlay_area",
                value: combineGroupedValues(values, (v) => v.reduce((acc, v) => acc + v, 0)),
            };
        }
        default:
            throw new Error(`Unsupported metric type: ${type}`);
    }
}
function combineGroupedValues(values, combineFn) {
    const result = {};
    const keys = new Set();
    for (const value of values) {
        if (typeof value === "object" && value !== null) {
            for (const key in value) {
                if (typeof key === "string") {
                    keys.add(key);
                }
            }
        }
        else {
            throw new Error("Value is not a grouped object");
        }
    }
    for (const key of keys) {
        const groupValues = values
            .map((v) => v[key])
            .filter((v) => v !== undefined);
        if (groupValues.length > 0) {
            result[key] = combineFn(groupValues);
        }
    }
    return result;
}
//# sourceMappingURL=metrics.js.map