"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_COLLECTED_PIXELS = void 0;
exports.intersectingWindowPixelCounts = intersectingWindowPixelCounts;
exports.estimatedCollectedPixels = estimatedCollectedPixels;
exports.shouldStreamGeoblazeStats = shouldStreamGeoblazeStats;
exports.medianFromHistogram = medianFromHistogram;
exports.computeGeoblazeBandStats = computeGeoblazeBandStats;
/**
 * geoblaze.stats materializes every intersecting pixel into a JS array before
 * calc-stats. Above ~10^8 values V8 throws RangeError: Invalid array length
 * (and well before that it can OOM). Keep the stock path for typical sketch
 * fragments; stream pixels into O(unique-values) histograms for large windows.
 *
 * 32M packed doubles ≈ 256 MB — comfortable on the 10 GB overlay worker, and
 * above the Fiji EEZ bathy geography test (~8.1M pixels).
 */
exports.MAX_COLLECTED_PIXELS = 32000000;
// CJS packages already installed as geoblaze dependencies. Used only for the
// large-window streaming path so we do not add a second copy of geoblaze's
// intersect-polygon implementation to package.json.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bboxArea = require("bbox-fns/bbox-area.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const booleanIntersects = require("bbox-fns/boolean-intersects.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const calcAll = require("bbox-fns/calc-all.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const merge = require("bbox-fns/merge.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const union = require("bbox-fns/union.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const reprojectBbox = require("bbox-fns/precise/reproject.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dufourPeyton = require("dufour-peyton-intersection");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snap = require("snap-bbox");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PreciseGeotransform } = require("geoaffine");
const isValidNumber = (n) => typeof n === "number" && n === n;
/**
 * Pixel columns/rows in the overlap of a feature bbox and the raster extent.
 * Clamped so a continent-scale geography over a small COG does not report
 * billions of pixels.
 */
function intersectingWindowPixelCounts(featureBBox, raster) {
    const pw = Math.abs(raster.pixelWidth);
    const ph = Math.abs(raster.pixelHeight);
    if (!Number.isFinite(pw) || !Number.isFinite(ph) || pw === 0 || ph === 0) {
        return [1, 1];
    }
    const overlapXmin = Math.max(featureBBox[0], raster.xmin);
    const overlapYmin = Math.max(featureBBox[1], raster.ymin);
    const overlapXmax = Math.min(featureBBox[2], raster.xmax);
    const overlapYmax = Math.min(featureBBox[3], raster.ymax);
    if (overlapXmax <= overlapXmin || overlapYmax <= overlapYmin) {
        return [1, 1];
    }
    const cols = Math.max(1, Math.min(raster.width, Math.floor((overlapXmax - overlapXmin) / pw)));
    const rows = Math.max(1, Math.min(raster.height, Math.floor((overlapYmax - overlapYmin) / ph)));
    return [cols, rows];
}
function estimatedCollectedPixels(window, vrm) {
    const [vx, vy] = vrm ?? [1, 1];
    return window[0] * window[1] * vx * vy;
}
function shouldStreamGeoblazeStats(window, vrm) {
    return estimatedCollectedPixels(window, vrm) > exports.MAX_COLLECTED_PIXELS;
}
/**
 * Median from a value→count histogram. Matches calc-stats / mediana so
 * streaming results stay aligned with geoblaze.stats.
 */
function medianFromHistogram(histogram, valid) {
    if (valid <= 0)
        return NaN;
    const countArray = Object.values(histogram).sort((a, b) => a.n - b.n);
    if (countArray.length === 0)
        return NaN;
    if (countArray.length === 1)
        return countArray[0].n;
    const half = valid / 2;
    let x = 0;
    if (valid % 2 === 0) {
        for (let i = 0; i < countArray.length; i++) {
            const { n, ct } = countArray[i];
            x += ct;
            if (x > half) {
                if (x - ct === half) {
                    return (countArray[i - 1].n + n) / 2;
                }
                return n;
            }
        }
    }
    else {
        for (let i = 0; i < countArray.length; i++) {
            const { n, ct } = countArray[i];
            x += ct;
            if (x > half)
                return n;
        }
    }
    return countArray[countArray.length - 1].n;
}
function createAccumulator() {
    return {
        valid: 0,
        invalid: 0,
        min: Infinity,
        max: -Infinity,
        sum: 0,
        histogram: {},
    };
}
function addSample(acc, value, noDataValue) {
    if (isValidNumber(value) &&
        (noDataValue === undefined || value !== noDataValue)) {
        acc.valid++;
        if (value < acc.min)
            acc.min = value;
        if (value > acc.max)
            acc.max = value;
        acc.sum += value;
        const key = String(value);
        const bin = acc.histogram[key];
        if (bin)
            bin.ct++;
        else
            acc.histogram[key] = { n: value, ct: 1 };
    }
    else {
        acc.invalid++;
    }
}
function finishAccumulator(acc, vrm, rescale) {
    const useVirtualResampling = rescale && vrm != null && vrm[0] !== 1 && vrm[1] !== 1;
    const areaMultiplier = useVirtualResampling ? vrm[0] * vrm[1] : 1;
    const hasValid = acc.valid > 0;
    const min = hasValid ? acc.min : NaN;
    const max = hasValid ? acc.max : NaN;
    // Median from unscaled counts (VRM rescale must not move the median).
    const median = medianFromHistogram(acc.histogram, acc.valid);
    let scaledValid = acc.valid;
    let scaledInvalid = acc.invalid;
    let scaledSum = acc.sum;
    const histogram = acc.histogram;
    if (areaMultiplier !== 1) {
        scaledValid /= areaMultiplier;
        scaledInvalid /= areaMultiplier;
        scaledSum /= areaMultiplier;
        for (const key of Object.keys(histogram)) {
            histogram[key].ct /= areaMultiplier;
        }
    }
    return {
        count: scaledValid + scaledInvalid,
        valid: scaledValid,
        invalid: scaledInvalid,
        min,
        max,
        mean: hasValid ? acc.sum / acc.valid : NaN,
        median,
        range: hasValid ? max - min : NaN,
        sum: hasValid ? scaledSum : 0,
        histogram,
    };
}
function visitIntersections(intersections, imageBands, xvrm, yvrm, onPixel) {
    const rows = intersections.rows;
    if (!rows)
        return;
    for (let irow = 0; irow < rows.length; irow++) {
        const row = rows[irow];
        if (!row)
            continue;
        for (let irange = 0; irange < row.length; irange++) {
            const [start, end] = row[irange];
            for (let icol = start; icol <= end; icol++) {
                for (let iband = 0; iband < imageBands.length; iband++) {
                    const sampleRow = imageBands[iband][Math.floor(irow / yvrm)];
                    if (sampleRow) {
                        onPixel(sampleRow[Math.floor(icol / xvrm)], iband);
                    }
                }
            }
        }
    }
}
/**
 * Same windowing / scanline walk as geoblaze intersectPolygon, but the
 * per-pixel callback never stores the full value list.
 */
async function forEachIntersectingPixel(raster, geometry, vrm, onPixel) {
    const georasterBbox = [raster.xmin, raster.ymin, raster.xmax, raster.ymax];
    const [xvrm, yvrm] = vrm;
    let geometryBboxes = union(calcAll(geometry)).filter((bbox) => booleanIntersects(bbox, georasterBbox));
    if (geometryBboxes.length === 0)
        return false;
    if (raster.values) {
        const intersections = dufourPeyton.calculate({
            debug: false,
            raster_bbox: georasterBbox,
            raster_height: raster.height * yvrm,
            raster_width: raster.width * xvrm,
            pixel_height: raster.pixelHeight / yvrm,
            pixel_width: raster.pixelWidth / xvrm,
            geometry,
        });
        visitIntersections(intersections, raster.values, xvrm, yvrm, onPixel);
        return true;
    }
    if (!raster.getValues)
        return false;
    const precisePixelHeight = raster.pixelHeight.toString();
    const precisePixelWidth = raster.pixelWidth.toString();
    const geotransform = PreciseGeotransform([
        raster.xmin.toString(),
        precisePixelWidth,
        "0",
        raster.ymax.toString(),
        "0",
        "-" + precisePixelHeight,
    ]);
    const combinedGeometryBbox = merge(geometryBboxes);
    const usedArea = geometryBboxes.reduce((total, bbox) => total + bboxArea(bbox), 0);
    const totalArea = bboxArea(combinedGeometryBbox);
    const usedPercentage = totalArea > 0 ? usedArea / totalArea : 1;
    const sampleBboxes = usedPercentage > 0.01 ? [combinedGeometryBbox] : geometryBboxes;
    const sampleImageBboxes = sampleBboxes.map((sampleBbox) => {
        const [xmin, ymin, xmax, ymax] = sampleBbox;
        const snapResult = snap({
            bbox: [xmin.toString(), ymin.toString(), xmax.toString(), ymax.toString()],
            debug: false,
            origin: [raster.xmin.toString(), raster.ymax.toString()],
            overflow: false,
            padding: ["1", "1"],
            scale: [precisePixelWidth, "-" + precisePixelHeight],
            size: [raster.width.toString(), raster.height.toString()],
            precise: true,
        });
        return snapResult.bbox_in_grid_cells.map((n) => Number(n));
    });
    const sampleImageBboxesUnion = union(sampleImageBboxes);
    await Promise.all(sampleImageBboxesUnion.map(async (sampleImageBbox) => {
        const [left, bottom, right, top] = sampleImageBbox;
        const sampleHeight = bottom - top;
        const sampleWidth = right - left;
        if (sampleHeight <= 0 || sampleWidth <= 0)
            return;
        const getValuesPromise = raster.getValues({
            left,
            bottom,
            right,
            top,
            width: sampleWidth,
            height: sampleHeight,
            resampleMethod: "near",
        });
        const preciseSampleBbox = reprojectBbox(sampleImageBbox, geotransform.forward, { async: false, density: 0 });
        const sampleBbox = preciseSampleBbox.map((str) => Number(str));
        const intersections = dufourPeyton.calculate({
            debug: false,
            raster_bbox: sampleBbox,
            raster_height: sampleHeight * yvrm,
            raster_width: sampleWidth * xvrm,
            pixel_height: raster.pixelHeight / yvrm,
            pixel_width: raster.pixelWidth / xvrm,
            geometry,
        });
        const sample = (await getValuesPromise);
        visitIntersections(intersections, sample, xvrm, yvrm, onPixel);
    }));
    return true;
}
async function streamBandStats(raster, feature, statsExtra) {
    const vrm = statsExtra?.vrm ?? [1, 1];
    const rescale = statsExtra?.rescale === true;
    const noDataValue = raster.noDataValue;
    const bands = [];
    const visited = await forEachIntersectingPixel(raster, feature, vrm, (value, bandIndex) => {
        if (!bands[bandIndex])
            bands[bandIndex] = createAccumulator();
        addSample(bands[bandIndex], value, noDataValue);
    });
    const finished = bands
        .filter((b) => b != null && (b.valid > 0 || b.invalid > 0))
        .map((b) => finishAccumulator(b, vrm, rescale));
    if (!visited || finished.length === 0) {
        throw "No Values were found in the given geometry";
    }
    return finished;
}
function normalizeGeoblazeStat(stat) {
    const histogram = (stat.histogram ?? {});
    const count = typeof stat.count === "number" ? stat.count : 0;
    const invalid = typeof stat.invalid === "number" ? stat.invalid : 0;
    const valid = typeof stat.valid === "number"
        ? stat.valid
        : Math.max(0, count - invalid);
    return {
        count,
        valid,
        invalid,
        min: typeof stat.min === "number" ? stat.min : NaN,
        max: typeof stat.max === "number" ? stat.max : NaN,
        mean: typeof stat.mean === "number" ? stat.mean : NaN,
        median: typeof stat.median === "number" ? stat.median : NaN,
        range: typeof stat.range === "number" ? stat.range : NaN,
        sum: typeof stat.sum === "number" ? stat.sum : 0,
        histogram,
    };
}
/**
 * Run geoblaze.stats, or stream pixels when the window would exceed
 * {@link MAX_COLLECTED_PIXELS}.
 */
async function computeGeoblazeBandStats(geoblaze, raster, feature, calcStatsOptions, statsExtra, windowPixels, options) {
    const vrm = statsExtra?.vrm ?? null;
    const stream = options?.forceStream === true ||
        (options?.forceCollect !== true &&
            shouldStreamGeoblazeStats(windowPixels, vrm));
    if (stream) {
        if (options?.forceStream !== true) {
            console.log("streaming raster stats; window would exceed geoblaze value-array limit", {
                windowPixels,
                vrm,
                estimated: estimatedCollectedPixels(windowPixels, vrm),
                limit: exports.MAX_COLLECTED_PIXELS,
            });
        }
        return streamBandStats(raster, feature, statsExtra);
    }
    const stats = await geoblaze.stats(raster, feature, calcStatsOptions, undefined, statsExtra);
    return stats.map(normalizeGeoblazeStat);
}
//# sourceMappingURL=geoblazeBandStats.js.map