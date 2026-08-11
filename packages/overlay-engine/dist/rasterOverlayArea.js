"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pixelCountsToAreaKm2 = pixelCountsToAreaKm2;
exports.histogramToClassCounts = histogramToClassCounts;
exports.calculateRasterOverlayArea = calculateRasterOverlayArea;
const bbox_1 = __importDefault(require("@turf/bbox"));
const area_1 = __importDefault(require("@turf/area"));
const metrics_1 = require("./metrics/metrics");
const rasterStats_1 = require("./rasterStats");
// geoblaze is CommonJS; keep the same lazy require pattern as rasterStats.ts
let _geoblaze = null;
function getGeoblaze() {
    if (!_geoblaze) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        _geoblaze = require("geoblaze");
    }
    return _geoblaze;
}
function intersects(bbox1, bbox2) {
    return (bbox1[0] <= bbox2[2] &&
        bbox1[2] >= bbox2[0] &&
        bbox1[1] <= bbox2[3] &&
        bbox1[3] >= bbox2[1]);
}
/**
 * Convert per-value (or total) pixel counts to km² using geodesic ground
 * pixel size.
 *
 * Counts must already be in native-pixel units. With geoblaze
 * `{ vrm, rescale: true }`, `valid` / histogram totals are fractional native
 * pixels — do **not** divide by VRM again (that would shrink area as VRM grows).
 *
 * areaKm2 = count × mX × mY / 1e6
 */
function pixelCountsToAreaKm2(counts, groundDims) {
    const pixelAreaM2 = groundDims.mX * groundDims.mY;
    if (!Number.isFinite(pixelAreaM2) || pixelAreaM2 <= 0) {
        const zero = {};
        for (const key of Object.keys(counts)) {
            zero[key] = 0;
        }
        return zero;
    }
    const scale = pixelAreaM2 / 1000000;
    const areas = {};
    for (const [key, count] of Object.entries(counts)) {
        areas[key] =
            typeof count === "number" && Number.isFinite(count)
                ? count * scale
                : 0;
    }
    return areas;
}
/**
 * Parse geoblaze histogram (array or object form) into rounded class-key counts.
 * Does **not** downsample — class keys must stay exact.
 */
function histogramToClassCounts(histogram, groupByValue, validCount) {
    const counts = { "*": validCount };
    if (!groupByValue) {
        return counts;
    }
    const entries = [];
    if (Array.isArray(histogram)) {
        for (const entry of histogram) {
            if (Array.isArray(entry) &&
                entry.length >= 2 &&
                typeof entry[0] === "number" &&
                typeof entry[1] === "number") {
                entries.push([entry[0], entry[1]]);
            }
        }
    }
    else if (histogram && typeof histogram === "object") {
        for (const row of Object.values(histogram)) {
            if (typeof row === "number") {
                // keyed by value string
                continue;
            }
            if (row &&
                typeof row === "object" &&
                typeof row.n === "number" &&
                typeof row.ct === "number") {
                entries.push([row.n, row.ct]);
            }
        }
        // Also handle { "1": count, "2": count } style
        if (entries.length === 0) {
            for (const [k, v] of Object.entries(histogram)) {
                const n = Number(k);
                if (Number.isFinite(n) && typeof v === "number" && Number.isFinite(v)) {
                    entries.push([n, v]);
                }
            }
        }
    }
    for (const [value, count] of entries) {
        if (!Number.isFinite(value) || !Number.isFinite(count)) {
            continue;
        }
        const key = String(Math.round(value));
        counts[key] = (counts[key] ?? 0) + count;
    }
    const classKeyCount = Object.keys(counts).filter((k) => k !== "*").length;
    if (classKeyCount > metrics_1.MAX_RASTER_OVERLAY_AREA_CLASSES) {
        throw new Error(`raster_overlay_area groupBy "value" produced ${classKeyCount} distinct classes (max ${metrics_1.MAX_RASTER_OVERLAY_AREA_CLASSES}). Grouping a continuous raster by value is not supported.`);
    }
    return counts;
}
function subtractAreas(areas, collar) {
    const keys = new Set([...Object.keys(areas), ...Object.keys(collar)]);
    const inner = {};
    for (const k of keys) {
        inner[k] = Math.max(0, (areas[k] ?? 0) - (collar[k] ?? 0));
    }
    return inner;
}
/**
 * Calculate raster overlay area (km²) for a feature already reprojected into
 * the raster's native CRS.
 *
 * Per-value pixel counts come from geoblaze's histogram stat (exact, not the
 * condensed 200-entry display histogram used by raster_stats). Counts are
 * converted to km² and discarded — the metric stores only `areas`.
 *
 * When `collar` is provided, both the subject and collar passes share one
 * resolved VRM (from the buffered subject options).
 */
async function calculateRasterOverlayArea(sourceUrl, feature, options) {
    const geoblaze = getGeoblaze();
    const groupByValue = options?.groupByValue === true;
    try {
        const raster = await geoblaze.parse(sourceUrl);
        const featureBBox = (0, bbox_1.default)(feature, { recompute: true });
        const rasterBBox = [raster.xmin, raster.ymin, raster.xmax, raster.ymax];
        const rasterEpsg = typeof raster.projection === "number" &&
            Number.isFinite(raster.projection)
            ? raster.projection
            : undefined;
        if (raster.numberOfRasters != null && raster.numberOfRasters > 1) {
            // geoblaze may expose bands differently; also check maxs length
        }
        if (Array.isArray(raster.maxs) && raster.maxs.length > 1) {
            throw new Error("raster_overlay_area supports single-band rasters only");
        }
        if (!intersects(featureBBox, rasterBBox)) {
            return {
                areas: { "*": 0 },
                vrm: null,
                ...(rasterEpsg != null ? { epsg: rasterEpsg } : {}),
            };
        }
        const centerLonLat = options?.centerLonLat;
        const fragmentAreaSqM = options?.fragmentAreaSqM ?? 0;
        // Geodesic ground-pixel size at the sketch centre. Used for both VRM
        // sizing and area conversion (correct for geographic CRS and Web
        // Mercator; for equal-area meter CRSs the product ≈ pw×ph).
        const groundDims = centerLonLat != null
            ? (0, rasterStats_1.groundPixelDimensionsMeters)(raster, centerLonLat)
            : {
                mX: Math.abs(raster.pixelWidth),
                mY: Math.abs(raster.pixelHeight),
            };
        const intersectingPixelCounts = [
            Math.max(1, Math.floor(Math.abs(featureBBox[2] - featureBBox[0]) /
                Math.abs(raster.pixelWidth))),
            Math.max(1, Math.floor(Math.abs(featureBBox[3] - featureBBox[1]) /
                Math.abs(raster.pixelHeight))),
        ];
        const vrmOpt = options?.vrm ?? "auto";
        const resolvedVrm = (0, rasterStats_1.resolveVrm)(vrmOpt, fragmentAreaSqM, groundDims, intersectingPixelCounts);
        const statsExtra = resolvedVrm != null
            ? { vrm: resolvedVrm, rescale: true }
            : undefined;
        const subjectAreas = await statsPassToAreas(geoblaze, raster, feature, groupByValue, groundDims, statsExtra);
        const result = {
            areas: subjectAreas,
            vrm: resolvedVrm,
            ...(rasterEpsg != null ? { epsg: rasterEpsg } : {}),
        };
        if (options?.collar) {
            const collarAreas = await statsPassToAreas(geoblaze, raster, options.collar.feature, groupByValue, groundDims, statsExtra);
            const innerAreas = subtractAreas(subjectAreas, collarAreas);
            const bboxAreaKm2 = (0, area_1.default)({
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Polygon",
                    coordinates: [
                        [
                            [options.collar.bbox[0], options.collar.bbox[1]],
                            [options.collar.bbox[2], options.collar.bbox[1]],
                            [options.collar.bbox[2], options.collar.bbox[3]],
                            [options.collar.bbox[0], options.collar.bbox[3]],
                            [options.collar.bbox[0], options.collar.bbox[1]],
                        ],
                    ],
                },
            }) / 1000000;
            const overlap = {
                bufferKm: options.collar.bufferKm,
                bbox: options.collar.bbox,
                bboxAreaKm2,
                collarAreas,
                innerAreas,
            };
            result.overlap = overlap;
        }
        return result;
    }
    catch (e) {
        if (typeof e === "string" && e.includes("No Values")) {
            return {
                areas: { "*": 0 },
                vrm: null,
            };
        }
        if (e instanceof Error &&
            e.message.includes("No Values were found in the given geometry")) {
            return {
                areas: { "*": 0 },
                vrm: null,
            };
        }
        throw e;
    }
}
async function statsPassToAreas(geoblaze, raster, feature, groupByValue, groundDims, statsExtra) {
    const featureBBox = (0, bbox_1.default)(feature, { recompute: true });
    const rasterBBox = [raster.xmin, raster.ymin, raster.xmax, raster.ymax];
    if (!intersects(featureBBox, rasterBBox)) {
        return { "*": 0 };
    }
    try {
        // Prefer `valid` (non-nodata) over `count` (includes nodata). Same as
        // geoprocessing's area = valid * pw * ph.
        const stats = await geoblaze.stats(raster, feature, {
            stats: groupByValue
                ? ["valid", "count", "histogram"]
                : ["valid", "count"],
        }, undefined, statsExtra);
        const band0 = stats[0] ?? {};
        const validCount = typeof band0.valid === "number" && Number.isFinite(band0.valid)
            ? band0.valid
            : typeof band0.count === "number" && Number.isFinite(band0.count)
                ? band0.count
                : 0;
        const counts = histogramToClassCounts(band0.histogram, groupByValue, validCount);
        // Counts are already native-pixel equivalents when statsExtra uses
        // rescale:true (or when VRM is off). VRM only improves partial-pixel
        // inclusion — it must not change the m²-per-count scale.
        return pixelCountsToAreaKm2(counts, groundDims);
    }
    catch (e) {
        if ((typeof e === "string" && e.includes("No Values")) ||
            (e instanceof Error &&
                e.message.includes("No Values were found in the given geometry"))) {
            return { "*": 0 };
        }
        throw e;
    }
}
//# sourceMappingURL=rasterOverlayArea.js.map