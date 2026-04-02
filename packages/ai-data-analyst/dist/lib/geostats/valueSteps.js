"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveValueSteps = deriveValueSteps;
const TARGET_CLASS_COUNT = 8;
const CONTINUOUS_HISTOGRAM_CV_THRESHOLD = 0.45;
function availableClassCounts(buckets) {
    if (!buckets)
        return [];
    return Object.keys(buckets)
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);
}
function closestCountToTarget(counts, target) {
    if (counts.length === 0)
        return undefined;
    return counts.reduce((best, c) => Math.abs(c - target) < Math.abs(best - target) ? c : best);
}
function histogramCv(histogram) {
    if (!histogram || histogram.length < 4)
        return null;
    const counts = histogram
        .map((b) => b[1])
        .filter((c) => typeof c === "number" && Number.isFinite(c));
    if (counts.length < 4)
        return null;
    const mean = counts.reduce((acc, v) => acc + v, 0) / counts.length;
    if (mean <= 0)
        return null;
    const variance = counts.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / counts.length;
    return Math.sqrt(variance) / mean;
}
function findStatsForContinuous(geostats, preferredColumn) {
    var _a;
    const raster = geostats;
    if (Array.isArray(raster === null || raster === void 0 ? void 0 : raster.bands) && ((_a = raster.bands[0]) === null || _a === void 0 ? void 0 : _a.stats)) {
        return raster.bands[0].stats;
    }
    const layer = geostats;
    if (!Array.isArray(layer === null || layer === void 0 ? void 0 : layer.attributes))
        return undefined;
    if (preferredColumn) {
        const match = layer.attributes.find((a) => a.attribute === preferredColumn && a.stats);
        if (match === null || match === void 0 ? void 0 : match.stats)
            return match.stats;
    }
    const firstNumeric = layer.attributes.find((a) => a.type === "number" && a.stats);
    return firstNumeric === null || firstNumeric === void 0 ? void 0 : firstNumeric.stats;
}
function deriveValueSteps(geostats, preferredColumn) {
    const stats = findStatsForContinuous(geostats, preferredColumn);
    if (!stats)
        return { value_steps: "CONTINUOUS" };
    const naturalCounts = availableClassCounts(stats.naturalBreaks);
    const quantileCounts = availableClassCounts(stats.quantiles);
    const equalCounts = availableClassCounts(stats.equalInterval);
    const cv = histogramCv(stats.histogram);
    if (cv !== null && cv <= CONTINUOUS_HISTOGRAM_CV_THRESHOLD) {
        return { value_steps: "CONTINUOUS" };
    }
    if (naturalCounts.includes(TARGET_CLASS_COUNT)) {
        return {
            value_steps: "NATURAL_BREAKS",
            value_steps_n: TARGET_CLASS_COUNT,
        };
    }
    const preferredMethod = cv === null
        ? "naturalBreaks"
        : cv > 1.1
            ? "naturalBreaks"
            : cv > 0.6
                ? "quantiles"
                : "equalInterval";
    const methods = {
        naturalBreaks: naturalCounts,
        quantiles: quantileCounts,
        equalInterval: equalCounts,
    };
    const toRasterValueSteps = (m) => m === "naturalBreaks"
        ? "NATURAL_BREAKS"
        : m === "quantiles"
            ? "QUANTILES"
            : "EQUAL_INTERVALS";
    for (const method of [
        preferredMethod,
        "naturalBreaks",
        "quantiles",
        "equalInterval",
    ]) {
        const n = closestCountToTarget(methods[method], TARGET_CLASS_COUNT);
        if (n !== undefined) {
            return { value_steps: toRasterValueSteps(method), value_steps_n: n };
        }
    }
    return { value_steps: "CONTINUOUS" };
}
//# sourceMappingURL=valueSteps.js.map