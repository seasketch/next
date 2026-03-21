"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groundPixelDimensionsMeters = groundPixelDimensionsMeters;
exports.needsVirtualResamplingForGroundResolution = needsVirtualResamplingForGroundResolution;
exports.vrmFromGroundPixelDimensions = vrmFromGroundPixelDimensions;
exports.vrmForTargetGroundResolution = vrmForTargetGroundResolution;
exports.downsampleHistogram = downsampleHistogram;
exports.calculateRasterStats = calculateRasterStats;
const distance_1 = __importDefault(require("@turf/distance"));
const helpers_1 = require("@turf/helpers");
const proj4_1 = __importDefault(require("proj4"));
const bbox_1 = __importDefault(require("@turf/bbox"));
/**
 * Verbose `console.log` for raster stats / VRM (set `RASTER_STATS_VERBOSE=0` to disable).
 */
const RASTER_STATS_VERBOSE = true;
function logRasterStatsVerbose(message, data) {
    if (!RASTER_STATS_VERBOSE)
        return;
    if (data !== undefined) {
        console.log(`[rasterStats] ${message}`, data);
    }
    else {
        console.log(`[rasterStats] ${message}`);
    }
}
/** Target sub-cell size for virtual resampling (~10 m on the ground). */
const TARGET_GROUND_SAMPLE_METERS = 50;
/**
 * Upper bound per axis to avoid pathological work when rasters are extremely coarse.
 * At the cap, effective ground resolution may be coarser than TARGET_GROUND_SAMPLE_METERS.
 */
const MAX_VRM_PER_AXIS = 20;
/**
 * Geodesic length in meters of one raster pixel in X and Y at `centerLonLat`, using
 * COG/georaster metadata (pixelWidth/Height in CRS units + EPSG from GeoKeys).
 */
function groundPixelDimensionsMeters(raster, centerLonLat) {
    const pw = raster.pixelWidth;
    const ph = raster.pixelHeight;
    const epsg = raster.projection;
    if (epsg == null || typeof epsg !== "number") {
        return { mX: Math.abs(pw), mY: Math.abs(ph) };
    }
    const rasterCrs = `EPSG:${epsg}`;
    let toRaster;
    let toWgs84;
    try {
        toRaster = (0, proj4_1.default)("EPSG:4326", rasterCrs).forward;
        toWgs84 = (0, proj4_1.default)(rasterCrs, "EPSG:4326").forward;
    }
    catch {
        return { mX: Math.abs(pw), mY: Math.abs(ph) };
    }
    const [cx, cy] = toRaster(centerLonLat);
    const origin = toWgs84([cx, cy]);
    const east = toWgs84([cx + pw, cy]);
    const north = toWgs84([cx, cy + ph]);
    const mX = (0, distance_1.default)((0, helpers_1.point)(origin), (0, helpers_1.point)(east), { units: "meters" });
    const mY = (0, distance_1.default)((0, helpers_1.point)(origin), (0, helpers_1.point)(north), { units: "meters" });
    // Bad transforms (e.g. pole/antimeridian) or invalid coords can yield NaN distances.
    // geoblaze does `new Array(sample_height * yvrm)` — NaN there throws "Invalid array length".
    if (!Number.isFinite(mX) || !Number.isFinite(mY) || mX <= 0 || mY <= 0) {
        return { mX: Math.abs(pw), mY: Math.abs(ph) };
    }
    return { mX, mY };
}
/**
 * True when native pixels are **coarser** than {@link TARGET_GROUND_SAMPLE_METERS} on the ground
 * on either axis (so virtual resampling is needed).
 */
function needsVirtualResamplingForGroundResolution(dims) {
    if (!Number.isFinite(dims.mX) ||
        !Number.isFinite(dims.mY) ||
        dims.mX <= 0 ||
        dims.mY <= 0) {
        return false;
    }
    return (dims.mX > TARGET_GROUND_SAMPLE_METERS ||
        dims.mY > TARGET_GROUND_SAMPLE_METERS);
}
/**
 * VRM so that virtually subdivided cells are about {@link TARGET_GROUND_SAMPLE_METERS}
 * on a side. See [geoblaze stats / vrm](https://docs.geoblaze.io/#stats).
 */
function vrmFromGroundPixelDimensions(dims) {
    if (!Number.isFinite(dims.mX) ||
        !Number.isFinite(dims.mY) ||
        dims.mX <= 0 ||
        dims.mY <= 0) {
        return [1, 1];
    }
    const vx = Math.min(MAX_VRM_PER_AXIS, Math.max(1, Math.ceil(dims.mX / TARGET_GROUND_SAMPLE_METERS)));
    const vy = Math.min(MAX_VRM_PER_AXIS, Math.max(1, Math.ceil(dims.mY / TARGET_GROUND_SAMPLE_METERS)));
    return [vx, vy];
}
function isSafeVrmForGeoblaze(vrm) {
    const [a, b] = vrm;
    return (Number.isInteger(a) &&
        Number.isInteger(b) &&
        a >= 1 &&
        b >= 1 &&
        a <= MAX_VRM_PER_AXIS &&
        b <= MAX_VRM_PER_AXIS);
}
/** Convenience: ground size → VRM (use when you always pass `vrm` to geoblaze). */
function vrmForTargetGroundResolution(raster, centerLonLat) {
    return vrmFromGroundPixelDimensions(groundPixelDimensionsMeters(raster, centerLonLat));
}
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
let _geoblaze;
function getGeoblaze() {
    if (!_geoblaze) {
        _geoblaze = require("geoblaze");
    }
    return _geoblaze;
}
async function calculateRasterStats(sourceUrl, feature) {
    const geoblaze = getGeoblaze();
    try {
        const raster = await geoblaze.parse(sourceUrl);
        const featureBBox = (0, bbox_1.default)(feature, { recompute: true });
        const rasterBBox = [raster.xmin, raster.ymin, raster.xmax, raster.ymax];
        if (!intersects(featureBBox, rasterBBox)) {
            logRasterStatsVerbose("no intersection between feature bbox and raster extent", {
                sourceUrl,
                featureBBox,
                rasterBBox,
                rasterSize: { width: raster.width, height: raster.height },
            });
            // Without this check we just get errors like this:
            // Cannot read properties of undefined (reading 'vrm')
            return {
                bands: [
                    {
                        count: 0,
                        min: NaN,
                        max: NaN,
                        mean: NaN,
                        median: NaN,
                        range: NaN,
                        histogram: [],
                        invalid: 0,
                        sum: 0,
                    },
                ],
            };
        }
        // GeoJSON bbox is WGS84; rasterBBox is in the raster CRS — do not mix them.
        // Representative location for ground-distance → VRM: center of the sketch fragment.
        const centerLonLat = [
            (featureBBox[0] + featureBBox[2]) / 2,
            (featureBBox[1] + featureBBox[3]) / 2,
        ];
        const groundDims = groundPixelDimensionsMeters(raster, centerLonLat);
        const wantVrm = needsVirtualResamplingForGroundResolution(groundDims);
        const vrmCandidate = wantVrm
            ? vrmFromGroundPixelDimensions(groundDims)
            : null;
        const statsExtra = wantVrm && vrmCandidate && isSafeVrmForGeoblaze(vrmCandidate)
            ? { vrm: vrmCandidate, rescale: true }
            : undefined;
        logRasterStatsVerbose("geoblaze.stats input summary", {
            sourceUrl,
            centerLonLat,
            featureBBox,
            raster: {
                width: raster.width,
                height: raster.height,
                pixelWidth: raster.pixelWidth,
                pixelHeight: raster.pixelHeight,
                projection: raster.projection,
                xmin: raster.xmin,
                ymin: raster.ymin,
                xmax: raster.xmax,
                ymax: raster.ymax,
            },
            groundDimsMeters: groundDims,
            targetGroundSampleMeters: TARGET_GROUND_SAMPLE_METERS,
            maxVrmPerAxis: MAX_VRM_PER_AXIS,
            wantVrm,
            vrmCandidate,
            vrmPassesSafetyCheck: vrmCandidate != null && isSafeVrmForGeoblaze(vrmCandidate),
            statsExtra: statsExtra ?? null,
        });
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
        }, undefined, statsExtra);
        logRasterStatsVerbose("geoblaze.stats completed", {
            sourceUrl,
            bandCount: stats.length,
            perBand: stats.map((s, i) => ({
                bandIndex: i,
                count: s.count,
                sum: s.sum,
                min: s.min,
                max: s.max,
            })),
        });
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
        console.log(sourceUrl);
        console.log(feature);
        console.log(feature.geometry.coordinates);
        if (typeof e === "string" && e.includes("No Values")) {
            return {
                bands: [
                    {
                        count: 0,
                        min: NaN,
                        max: NaN,
                        mean: NaN,
                        median: NaN,
                        range: NaN,
                        histogram: [],
                        invalid: 0,
                        sum: 0,
                    },
                ],
            };
        }
        else {
            throw e;
        }
    }
}
function intersects(bbox1, bbox2) {
    return (bbox1[0] <= bbox2[2] &&
        bbox1[2] >= bbox2[0] &&
        bbox1[1] <= bbox2[3] &&
        bbox1[3] >= bbox2[1]);
}
//# sourceMappingURL=rasterStats.js.map