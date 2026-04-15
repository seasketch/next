"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groundPixelDimensionsMeters = groundPixelDimensionsMeters;
exports.resolveVrm = resolveVrm;
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
/**
 * Per-axis cap for VRM to prevent geoblaze from allocating pathologically
 * large arrays (new Array(height * yVrm)).
 */
const MAX_VRM_PER_AXIS = 100;
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
 * Resolve the VRM value to apply given user options and fragment area.
 *
 * - `false`   → VRM disabled; returns null.
 * - `number`  → explicit value; expands to [n, n] (min 1).
 * - `'auto'`  → targets ~100 m virtual grid cells. Returns [1, 1] when
 *               native pixels are already finer than 100 m.
 *               Hard per-axis cap: MAX_VRM_PER_AXIS.
 */
function resolveVrm(vrmOpt, fragmentAreaSqM, groundDims) {
    if (vrmOpt === false)
        return null;
    if (typeof vrmOpt === "number") {
        const v = Math.max(1, Math.round(vrmOpt));
        return [v, v];
    }
    // 'auto': upsample until virtual pixels are ~100 m on each axis
    const targetMeters = 100;
    if (!Number.isFinite(groundDims.mX) ||
        !Number.isFinite(groundDims.mY) ||
        groundDims.mX <= 0 ||
        groundDims.mY <= 0) {
        return [1, 1];
    }
    const vx = Math.min(MAX_VRM_PER_AXIS, Math.max(1, Math.ceil(groundDims.mX / targetMeters)));
    const vy = Math.min(MAX_VRM_PER_AXIS, Math.max(1, Math.ceil(groundDims.mY / targetMeters)));
    return [vx, vy];
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
/**
 * Calculate raster statistics for a feature that has already been reprojected
 * into the raster's native CRS.
 *
 * Reprojection is the caller's responsibility so that this function — and by
 * extension overlay-engine — does not need to bundle epsg-index (6 MB).
 *
 * @param sourceUrl  URL of the COG.
 * @param feature    Feature already projected into the raster's native CRS.
 * @param options.vrm
 *   - `false`  → disable VRM (recommended for large geography subjects).
 *   - `'auto'` (default) → fragment-size-aware dynamic VRM.
 *   - `number` → explicit VRM value, applied as [n, n].
 * @param options.centerLonLat
 *   WGS84 [lon, lat] of the sketch fragment centre.  Used for accurate
 *   ground-pixel-size measurement in the auto-VRM calculation.  When omitted
 *   the VRM defaults to [1, 1] (no upsampling).
 * @param options.fragmentAreaSqM
 *   Area of the original WGS84 feature in square metres.  Used by auto-VRM
 *   to size virtual pixels relative to the fragment.  When omitted alongside
 *   centerLonLat the VRM defaults to [1, 1].
 */
async function calculateRasterStats(sourceUrl, feature, options) {
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
                        vrm: null,
                    },
                ],
            };
        }
        // Resolve VRM. centerLonLat and fragmentAreaSqM are optional; if not
        // provided the auto calculation falls back to [1, 1] (no upsampling).
        const centerLonLat = options?.centerLonLat;
        const fragmentAreaSqM = options?.fragmentAreaSqM ?? 0;
        const groundDims = centerLonLat != null
            ? groundPixelDimensionsMeters(raster, centerLonLat)
            : { mX: 0, mY: 0 };
        const vrmOpt = options?.vrm ?? "auto";
        const resolvedVrm = resolveVrm(vrmOpt, fragmentAreaSqM, groundDims);
        const statsExtra = resolvedVrm != null
            ? { vrm: resolvedVrm, rescale: true }
            : undefined;
        logRasterStatsVerbose("geoblaze.stats input summary", {
            sourceUrl,
            centerLonLat,
            fragmentAreaSqM,
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
            vrmOption: vrmOpt,
            resolvedVrm,
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
                    vrm: resolvedVrm,
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
                        vrm: null,
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