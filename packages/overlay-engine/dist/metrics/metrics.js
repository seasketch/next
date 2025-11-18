"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectIsFragment = subjectIsFragment;
exports.subjectIsGeography = subjectIsGeography;
exports.computeStatsFromIdentifiedValues = computeStatsFromIdentifiedValues;
const simple_statistics_1 = require("simple-statistics");
function subjectIsFragment(subject) {
    return "hash" in subject;
}
function subjectIsGeography(subject) {
    return "id" in subject;
}
/**
 * Computes statistics from a list of IdentifiedValues. This function can be used
 * both server-side and client-side to calculate accurate statistics for overlapping
 * fragments and multiple sketches in a collection by de-duplicating based on __oidx.
 */
function computeStatsFromIdentifiedValues(identifiedValues) {
    // De-duplicate by __oidx (first element of tuple), keeping the first occurrence
    const uniqueMap = new Map();
    for (const [oidx, value] of identifiedValues) {
        if (!uniqueMap.has(oidx)) {
            uniqueMap.set(oidx, value);
        }
    }
    const values = Array.from(uniqueMap.values());
    if (values.length === 0) {
        return {
            min: Infinity,
            max: -Infinity,
            mean: NaN,
            median: NaN,
            stdDev: NaN,
            histogram: [],
            count: 0,
            countDistinct: 0,
            values: [],
        };
    }
    const distinctValues = Array.from(new Set(values));
    return {
        min: (0, simple_statistics_1.min)(values),
        max: (0, simple_statistics_1.max)(values),
        mean: (0, simple_statistics_1.mean)(values),
        median: (0, simple_statistics_1.median)(values),
        stdDev: (0, simple_statistics_1.standardDeviation)(values),
        histogram: equalIntervalBuckets(values, 49),
        count: values.length,
        countDistinct: distinctValues.length,
        values: Array.from(distinctValues).slice(0, 100),
    };
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
//# sourceMappingURL=metrics.js.map