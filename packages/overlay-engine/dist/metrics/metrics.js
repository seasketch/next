"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUS_DEMOGRAPHICS_ROLLUP_KEY = exports.OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY = exports.OUS_DEMOGRAPHICS_REQUIRED_COLUMNS = exports.MAX_COLUMN_VALUE_ENTRIES = exports.MAX_OVERLAY_AREA_OVERLAP_ENTRIES = exports.MAX_RASTER_OVERLAY_AREA_CLASSES = void 0;
exports.isOverlayAreaClassKey = isOverlayAreaClassKey;
exports.isOverlayAreaOverlapInfo = isOverlayAreaOverlapInfo;
exports.isOverlayAreaOverlapCombineResult = isOverlayAreaOverlapCombineResult;
exports.getOverlayAreaOverlapInfo = getOverlayAreaOverlapInfo;
exports.getOverlayAreaOverlapCombineResult = getOverlayAreaOverlapCombineResult;
exports.getOverlayAreaClassTotals = getOverlayAreaClassTotals;
exports.getOverlayAreaDisplayedClassValue = getOverlayAreaDisplayedClassValue;
exports.getOverlayAreaClassValueRange = getOverlayAreaClassValueRange;
exports.combineOverlayAreaMetrics = combineOverlayAreaMetrics;
exports.classifyOverlayAreaOverlapScope = classifyOverlayAreaOverlapScope;
exports.isNumberColumnValueStats = isNumberColumnValueStats;
exports.isColumnValuesEntry = isColumnValuesEntry;
exports.hasReliableColumnValueEntries = hasReliableColumnValueEntries;
exports.isRasterOverlayAreaOverlapInfo = isRasterOverlayAreaOverlapInfo;
exports.isRasterOverlayAreaOverlapCombineResult = isRasterOverlayAreaOverlapCombineResult;
exports.getRasterOverlayAreaOverlapInfo = getRasterOverlayAreaOverlapInfo;
exports.getRasterOverlayAreaOverlapCombineResult = getRasterOverlayAreaOverlapCombineResult;
exports.getRasterOverlayAreaDisplayedClassValue = getRasterOverlayAreaDisplayedClassValue;
exports.getRasterOverlayAreaClassValueRange = getRasterOverlayAreaClassValueRange;
exports.combineRasterOverlayAreaMetrics = combineRasterOverlayAreaMetrics;
exports.attachRasterOverlayAreaOverlapScope = attachRasterOverlayAreaOverlapScope;
exports.summarizeOusDemographicsValue = summarizeOusDemographicsValue;
exports.combineOusDemographicsMetrics = combineOusDemographicsMetrics;
exports.subjectIsFragment = subjectIsFragment;
exports.subjectIsGeography = subjectIsGeography;
exports.combineRasterBandStats = combineRasterBandStats;
exports.capColumnValueEntries = capColumnValueEntries;
exports.numberColumnStatsFromEntries = numberColumnStatsFromEntries;
exports.stringOrBooleanColumnStatsFromEntries = stringOrBooleanColumnStatsFromEntries;
exports.combineNumberColumnValueStats = combineNumberColumnValueStats;
exports.combineStringOrBooleanColumnValueStats = combineStringOrBooleanColumnValueStats;
exports.hashMetricDependency = hashMetricDependency;
exports.combineMetricsForFragments = combineMetricsForFragments;
exports.extractMetricDependenciesFromReportBody = extractMetricDependenciesFromReportBody;
const area_1 = __importDefault(require("@turf/area"));
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
/**
 * Max distinct class keys allowed when `groupBy: "value"` for
 * {@link RasterOverlayAreaMetric}. Exceeding this throws at calculation time —
 * grouping a continuous raster by value is a misconfiguration.
 */
exports.MAX_RASTER_OVERLAY_AREA_CLASSES = 32;
/**
 * Maximum number of per-feature collar entries retained on a buffered
 * {@link OverlayAreaMetric} fragment row, shared across all classes.
 * Largest-area entries are kept when truncating; residual overcount falls
 * back to the collar-area bound. Sized generously because the canonical
 * ocean-sketch case puts nearly all contributing features in the collar.
 */
exports.MAX_OVERLAY_AREA_OVERLAP_ENTRIES = 2000;
/** True for class-total keys; false for reserved `__`-prefixed metadata keys. */
function isOverlayAreaClassKey(key) {
    return !key.startsWith("__");
}
function isOverlayAreaOverlapInfo(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const v = value;
    return (typeof v.bufferKm === "number" &&
        Array.isArray(v.bbox) &&
        v.bbox.length === 4 &&
        typeof v.classes === "object" &&
        v.classes !== null &&
        !Array.isArray(v.classes));
}
function isOverlayAreaOverlapCombineResult(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const v = value;
    return (typeof v.flagged === "boolean" &&
        typeof v.perClass === "object" &&
        v.perClass !== null &&
        !Array.isArray(v.perClass));
}
/**
 * Reads fragment-level {@link OverlayAreaOverlapInfo} from a metric value, if present.
 */
function getOverlayAreaOverlapInfo(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const raw = value.__overlap;
    return isOverlayAreaOverlapInfo(raw) ? raw : null;
}
/**
 * Reads combine-time {@link OverlayAreaOverlapCombineResult} from a metric value, if present.
 */
function getOverlayAreaOverlapCombineResult(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const raw = value.__overlap;
    return isOverlayAreaOverlapCombineResult(raw) ? raw : null;
}
/** Numeric class totals only (strips reserved `__` keys). */
function getOverlayAreaClassTotals(value) {
    const result = {};
    if (!value || typeof value !== "object") {
        return result;
    }
    for (const key of Object.keys(value)) {
        if (!isOverlayAreaClassKey(key)) {
            continue;
        }
        const v = value[key];
        if (typeof v === "number" && Number.isFinite(v)) {
            result[key] = v;
        }
    }
    return result;
}
/**
 * Displayed / export upper estimate for a class after combine:
 * `naiveSum − overcountMin`, falling back to the stored class total.
 */
function getOverlayAreaDisplayedClassValue(value, classKey) {
    const combine = getOverlayAreaOverlapCombineResult(value);
    const stored = getOverlayAreaClassTotals(value)[classKey] ?? 0;
    if (!combine?.perClass?.[classKey]) {
        return stored;
    }
    const { naiveSum, overcountMin } = combine.perClass[classKey];
    return naiveSum - overcountMin;
}
/**
 * Class value range after combine: `[naive − overcountMax, naive − overcountMin]`.
 * Equal bounds mean an exact correction (or no overcount).
 */
function getOverlayAreaClassValueRange(value, classKey) {
    const combine = getOverlayAreaOverlapCombineResult(value);
    if (!combine?.perClass?.[classKey]) {
        return null;
    }
    const { naiveSum, overcountMin, overcountMax } = combine.perClass[classKey];
    return {
        naiveSum,
        low: naiveSum - overcountMax,
        high: naiveSum - overcountMin,
    };
}
function bboxesIntersect(a, b) {
    return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
function featureAreaAt(classInfo, index, clippedArea) {
    const fa = classInfo.featureArea?.[index];
    if (fa === undefined || fa === 0) {
        return clippedArea;
    }
    return fa;
}
/**
 * Combines `overlay_area` fragment values, correcting double-counted class
 * totals when buffered `__overlap` metadata is available. Fragments without
 * `__overlap` (unbuffered, or stale pre-upgrade rows) contribute only their
 * numeric class totals — no collar/entry work runs at combine time for them.
 *
 * @see OverlayAreaOverlapInfo for the full double-counting model and the
 * producer gate (buffered fragment subjects only).
 */
function combineOverlayAreaMetrics(values) {
    const numericValues = values.map((v) => getOverlayAreaClassTotals(v));
    const naiveCombined = combineGroupedValues(numericValues, (group) => group.reduce((acc, n) => acc + n, 0));
    if (values.length <= 1) {
        return naiveCombined;
    }
    const overlapInfos = values.map((v) => getOverlayAreaOverlapInfo(v));
    const usableIndexes = [];
    for (let i = 0; i < overlapInfos.length; i++) {
        if (overlapInfos[i]) {
            usableIndexes.push(i);
        }
    }
    // Need at least two fragments with overlap metadata to detect anything.
    if (usableIndexes.length < 2) {
        return naiveCombined;
    }
    // Gate 1: if no pair of buffered bboxes intersects, the sum is exact.
    let anyBboxIntersect = false;
    const intersectingPairs = [];
    for (let a = 0; a < usableIndexes.length; a++) {
        for (let b = a + 1; b < usableIndexes.length; b++) {
            const ia = usableIndexes[a];
            const ib = usableIndexes[b];
            const infoA = overlapInfos[ia];
            const infoB = overlapInfos[ib];
            if (bboxesIntersect(infoA.bbox, infoB.bbox)) {
                anyBboxIntersect = true;
                intersectingPairs.push([ia, ib]);
            }
        }
    }
    if (!anyBboxIntersect) {
        return naiveCombined;
    }
    const classKeys = new Set(Object.keys(naiveCombined));
    for (const idx of usableIndexes) {
        for (const key of Object.keys(overlapInfos[idx].classes)) {
            classKeys.add(key);
        }
    }
    const perClass = {};
    const corrected = { ...naiveCombined };
    // With groupBy, derive corrected "*" from named classes only (after the
    // loop). Intentionally omit uncategorized features that landed under "*"
    // (missing/falsy groupBy) — "*" here means "sum of reported classes".
    const namedClassKeys = [...classKeys].filter((k) => k !== "*");
    const hasNamedClasses = namedClassKeys.length > 0;
    for (const classKey of classKeys) {
        if (classKey === "*" && hasNamedClasses) {
            continue;
        }
        const naiveSum = naiveCombined[classKey] ?? 0;
        // oidx → areas across fragments + resolved feature area
        const byOidx = new Map();
        for (const idx of usableIndexes) {
            const classInfo = overlapInfos[idx].classes[classKey];
            if (!classInfo?.oidx?.length || !classInfo.area?.length) {
                continue;
            }
            const n = Math.min(classInfo.oidx.length, classInfo.area.length);
            for (let i = 0; i < n; i++) {
                const oidx = classInfo.oidx[i];
                const area = classInfo.area[i];
                if (!Number.isFinite(oidx) || !Number.isFinite(area)) {
                    continue;
                }
                // featureArea 0/absent ⇒ fully covered by this buffer.
                const encodedFa = classInfo.featureArea?.[i];
                const fullyCovered = encodedFa === undefined || encodedFa === 0;
                const Af = featureAreaAt(classInfo, i, area);
                const existing = byOidx.get(oidx);
                if (!existing) {
                    byOidx.set(oidx, {
                        areas: [area],
                        featureArea: Af,
                        allFullyCovered: fullyCovered,
                    });
                }
                else {
                    existing.areas.push(area);
                    existing.allFullyCovered = existing.allFullyCovered && fullyCovered;
                    // Prefer a larger explicit featureArea from partial coverage.
                    if (Af > existing.featureArea) {
                        existing.featureArea = Af;
                    }
                }
            }
        }
        let overcountMin = 0;
        let overcountMax = 0;
        for (const { areas, featureArea: Af, allFullyCovered } of byOidx.values()) {
            if (areas.length < 2) {
                continue;
            }
            const sum = areas.reduce((acc, a) => acc + a, 0);
            const maxA = Math.max(...areas);
            // true ∈ [maxA, min(sum, Af)] ⇒ overcount ∈ [sum - min(sum,Af), sum - maxA]
            // Only apply the Af clamp to overcountMin when every fragment reports
            // full coverage — otherwise Af may be underestimated (e.g. subdivided
            // parts) and the displayed upper estimate could fall below the truth.
            if (allFullyCovered) {
                overcountMin += Math.max(0, sum - Af);
            }
            else if (Af > maxA) {
                // Partial coverage with an explicit feature area: still a valid
                // lower bound on overcount when Af is trusted (non-subdivided).
                overcountMin += Math.max(0, sum - Af);
            }
            overcountMax += Math.max(0, sum - maxA);
        }
        // Truncation residual: collar bound on features not represented in
        // entries. Added to overcountMax only (cannot prove a minimum overcount).
        // Take the largest pairwise min(residual) once — summing every pair would
        // overstate uncertainty when 3+ truncated fragments' bboxes intersect.
        let truncationResidual = 0;
        for (const [ia, ib] of intersectingPairs) {
            const ca = overlapInfos[ia].classes[classKey];
            const cb = overlapInfos[ib].classes[classKey];
            if (!ca || !cb) {
                continue;
            }
            if (!ca.entriesTruncated && !cb.entriesTruncated) {
                continue;
            }
            const residualA = Math.max(0, (ca.collarArea || 0) -
                (ca.area || []).reduce((acc, n) => acc + (n || 0), 0));
            const residualB = Math.max(0, (cb.collarArea || 0) -
                (cb.area || []).reduce((acc, n) => acc + (n || 0), 0));
            truncationResidual = Math.max(truncationResidual, Math.min(residualA, residualB));
        }
        overcountMax += truncationResidual;
        // Keep overcountMax ≥ overcountMin after residual additions.
        if (overcountMax < overcountMin) {
            overcountMax = overcountMin;
        }
        if (overcountMin === 0 && overcountMax === 0) {
            continue;
        }
        perClass[classKey] = { overcountMin, overcountMax, naiveSum };
        corrected[classKey] = naiveSum - overcountMin;
    }
    if (Object.keys(perClass).length === 0) {
        return naiveCombined;
    }
    if (hasNamedClasses) {
        let starCorrected = 0;
        let starOverMin = 0;
        let starOverMax = 0;
        let starNaiveFromClasses = 0;
        for (const k of namedClassKeys) {
            const cv = corrected[k];
            if (typeof cv === "number" && Number.isFinite(cv)) {
                starCorrected += cv;
            }
            const pc = perClass[k];
            if (pc) {
                starNaiveFromClasses += pc.naiveSum;
                starOverMin += pc.overcountMin;
                starOverMax += pc.overcountMax;
            }
            else {
                const n = naiveCombined[k];
                if (typeof n === "number" && Number.isFinite(n)) {
                    starNaiveFromClasses += n;
                }
            }
        }
        const storedStar = naiveCombined["*"];
        const starNaive = typeof storedStar === "number" && Number.isFinite(storedStar)
            ? storedStar
            : starNaiveFromClasses;
        // Keep identity: displayed "*" = naiveSum − overcountMin = sum of classes.
        if (starOverMin > 0 || starOverMax > 0 || typeof storedStar === "number") {
            corrected["*"] = starCorrected;
            if (starOverMin > 0 || starOverMax > 0) {
                if (starOverMax < starOverMin) {
                    starOverMax = starOverMin;
                }
                perClass["*"] = {
                    overcountMin: starOverMin,
                    overcountMax: starOverMax,
                    naiveSum: starNaive,
                };
            }
        }
    }
    const flagged = Object.values(perClass).some((p) => p.overcountMax > p.overcountMin);
    corrected.__overlap = {
        flagged,
        perClass,
    };
    return corrected;
}
/**
 * Classifies whether overlap among buffered fragment metrics is within a
 * single sketch (fragment splitting) or between different sketches in a
 * collection. Callers with subject info should attach the result onto the
 * combined `__overlap` metadata.
 *
 * @see OverlayAreaOverlapInfo
 */
function classifyOverlayAreaOverlapScope(metrics) {
    const fragmentHashes = [];
    const sketchIdsByFragment = [];
    for (const m of metrics) {
        if (!subjectIsFragment(m.subject)) {
            continue;
        }
        fragmentHashes.push(m.subject.hash);
        sketchIdsByFragment.push([...m.subject.sketches]);
    }
    let within = false;
    let between = false;
    const partnerSketchIds = new Set();
    for (let i = 0; i < sketchIdsByFragment.length; i++) {
        for (let j = i + 1; j < sketchIdsByFragment.length; j++) {
            const a = new Set(sketchIdsByFragment[i]);
            const b = sketchIdsByFragment[j];
            let shared = false;
            for (const id of b) {
                if (a.has(id)) {
                    shared = true;
                    break;
                }
            }
            if (shared) {
                within = true;
            }
            else {
                between = true;
                for (const id of sketchIdsByFragment[i]) {
                    partnerSketchIds.add(id);
                }
                for (const id of b) {
                    partnerSketchIds.add(id);
                }
            }
        }
    }
    const scope = within && between ? "both" : between ? "between-sketches" : "within-sketch";
    return {
        scope,
        partnerSketchIds: Array.from(partnerSketchIds).sort((a, b) => a - b),
        fragmentsInvolved: fragmentHashes,
    };
}
/**
 * Maximum number of per-feature entries retained on a single column's stats.
 * When a fragment sees more features than this, entries are dropped entirely
 * (a partial list is useless for exact merging) and `entriesTruncated` is
 * set; combining across fragments then falls back to approximate stat
 * merging. Exactness matters most when feature counts are small (e.g.
 * summing populations of a handful of districts); at large counts the
 * relative error from double-counting boundary-spanning features shrinks,
 * while the byte cost of entries grows, so a low cap is the right trade.
 */
exports.MAX_COLUMN_VALUE_ENTRIES = 300;
function isNumberColumnValueStats(stats) {
    return stats.type === "number";
}
/**
 * Type guard for {@link ColumnValuesEntry}. Accepts untrusted input (e.g.
 * metric values deserialized from the database).
 */
function isColumnValuesEntry(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    if (typeof candidate.id !== "number") {
        return false;
    }
    if (typeof candidate.value !== "number" &&
        typeof candidate.value !== "string" &&
        typeof candidate.value !== "boolean") {
        return false;
    }
    if (typeof candidate.weight !== "number") {
        return false;
    }
    if (!Array.isArray(candidate.offsets) ||
        candidate.offsets.some((o) => typeof o !== "number")) {
        return false;
    }
    return true;
}
/**
 * Returns true if the given column stats carry a complete (untruncated) set
 * of per-feature entries which can be used to exactly combine statistics
 * across fragments.
 */
function hasReliableColumnValueEntries(stats) {
    if (stats === null || typeof stats !== "object") {
        return false;
    }
    const candidate = stats;
    if (candidate.entriesTruncated === true) {
        return false;
    }
    if (!Array.isArray(candidate.entries)) {
        return false;
    }
    return candidate.entries.every(isColumnValuesEntry);
}
function isRasterOverlayAreaOverlapInfo(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const v = value;
    return (typeof v.bufferKm === "number" &&
        Array.isArray(v.bbox) &&
        v.bbox.length === 4 &&
        typeof v.bboxAreaKm2 === "number" &&
        typeof v.collarAreas === "object" &&
        v.collarAreas !== null &&
        !Array.isArray(v.collarAreas) &&
        typeof v.innerAreas === "object" &&
        v.innerAreas !== null &&
        !Array.isArray(v.innerAreas));
}
function isRasterOverlayAreaOverlapCombineResult(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const v = value;
    return (typeof v.flagged === "boolean" &&
        Array.isArray(v.pairs) &&
        typeof v.perClass === "object" &&
        v.perClass !== null &&
        !Array.isArray(v.perClass));
}
function getRasterOverlayAreaOverlapInfo(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    return isRasterOverlayAreaOverlapInfo(value.overlap) ? value.overlap : null;
}
function getRasterOverlayAreaOverlapCombineResult(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    return isRasterOverlayAreaOverlapCombineResult(value.overlap)
        ? value.overlap
        : null;
}
/**
 * Displayed class value after combine: `naiveSum − overcountMin` (= naive),
 * falling back to the stored area total.
 */
function getRasterOverlayAreaDisplayedClassValue(value, classKey) {
    const combine = getRasterOverlayAreaOverlapCombineResult(value);
    const stored = value?.areas?.[classKey] ?? 0;
    if (!combine?.perClass?.[classKey]) {
        return stored;
    }
    const { naiveSum, overcountMin } = combine.perClass[classKey];
    return naiveSum - overcountMin;
}
/**
 * Class value range after combine:
 * `[naive − overcountMax, naive − overcountMin]`.
 */
function getRasterOverlayAreaClassValueRange(value, classKey) {
    const combine = getRasterOverlayAreaOverlapCombineResult(value);
    if (!combine?.perClass?.[classKey]) {
        return null;
    }
    const { naiveSum, overcountMin, overcountMax } = combine.perClass[classKey];
    return {
        naiveSum,
        low: naiveSum - overcountMax,
        high: naiveSum - overcountMin,
    };
}
/** Tiny km² floor below which collar habitat is treated as empty. */
const RASTER_OVERLAY_AREA_COLLAR_EPS_KM2 = 1e-12;
function bboxAsPolygon(b) {
    const [minX, minY, maxX, maxY] = b;
    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [
                [
                    [minX, minY],
                    [maxX, minY],
                    [maxX, maxY],
                    [minX, maxY],
                    [minX, minY],
                ],
            ],
        },
    };
}
function bboxIntersectionAreaKm2(a, b) {
    const minX = Math.max(a[0], b[0]);
    const minY = Math.max(a[1], b[1]);
    const maxX = Math.min(a[2], b[2]);
    const maxY = Math.min(a[3], b[3]);
    if (minX >= maxX || minY >= maxY) {
        return 0;
    }
    // Callers pass WGS84 bboxes; @turf/area is geodesic.
    return (0, area_1.default)(bboxAsPolygon([minX, minY, maxX, maxY])) / 1000000;
}
/**
 * Combines `raster_overlay_area` fragment values. Unbuffered (or single)
 * fragments combine by exact per-key summation. Buffered fragments with
 * intersecting, source-positive collars attach a proportional overcount
 * estimate — see {@link RasterOverlayAreaOverlapCombineResult}.
 *
 * Pair aggregation uses **max** over pairs (not sum) so 3-way bbox clusters
 * do not invent impossible stacked overcount.
 */
function combineRasterOverlayAreaMetrics(values) {
    const empty = { areas: { "*": 0 } };
    if (values.length === 0) {
        return empty;
    }
    const areas = {};
    for (const v of values) {
        if (!v?.areas || typeof v.areas !== "object") {
            continue;
        }
        for (const [key, n] of Object.entries(v.areas)) {
            if (typeof n === "number" && Number.isFinite(n)) {
                areas[key] = (areas[key] ?? 0) + n;
            }
        }
    }
    if (Object.keys(areas).length === 0) {
        areas["*"] = 0;
    }
    const result = { areas };
    if (values.length <= 1) {
        return result;
    }
    const overlapInfos = values.map((v) => getRasterOverlayAreaOverlapInfo(v));
    const usableIndexes = [];
    for (let i = 0; i < overlapInfos.length; i++) {
        if (overlapInfos[i]) {
            usableIndexes.push(i);
        }
    }
    if (usableIndexes.length < 2) {
        return result;
    }
    const sourcePositivePairs = [];
    for (let a = 0; a < usableIndexes.length; a++) {
        for (let b = a + 1; b < usableIndexes.length; b++) {
            const ia = usableIndexes[a];
            const ib = usableIndexes[b];
            const infoA = overlapInfos[ia];
            const infoB = overlapInfos[ib];
            if (!bboxesIntersect(infoA.bbox, infoB.bbox)) {
                continue;
            }
            const bboxOverlapKm2 = bboxIntersectionAreaKm2(infoA.bbox, infoB.bbox);
            if (bboxOverlapKm2 <= 0) {
                continue;
            }
            const denom = Math.min(infoA.bboxAreaKm2, infoB.bboxAreaKm2);
            const lambda = denom > 0 ? Math.max(0, Math.min(1, bboxOverlapKm2 / denom)) : 0;
            const bboxAreaA = infoA.bboxAreaKm2;
            const bboxAreaB = infoB.bboxAreaKm2;
            const classKeys = new Set([
                ...Object.keys(infoA.collarAreas),
                ...Object.keys(infoB.collarAreas),
            ]);
            const perClass = {};
            let sourcePositive = false;
            for (const k of classKeys) {
                const collarA = infoA.collarAreas[k] ?? 0;
                const collarB = infoB.collarAreas[k] ?? 0;
                if (collarA <= RASTER_OVERLAY_AREA_COLLAR_EPS_KM2 ||
                    collarB <= RASTER_OVERLAY_AREA_COLLAR_EPS_KM2) {
                    continue;
                }
                sourcePositive = true;
                const hardMax = Math.min(collarA, collarB);
                // Uniform-density co-occurrence estimate. Treating each fragment's
                // collar habitat as uniformly spread over its buffered bbox gives two
                // predictions for habitat inside the bbox intersection I:
                // ρA×I and ρB×I (ρ = collar habitat / bbox area). Take their
                // geometric mean, Ê = I × √(ρA·ρB), capped at the hard ceiling U.
                //
                // Identical to the previous Ê = U × λ when the pair is symmetric
                // (equal bboxes and collars), but does NOT degenerate to U when one
                // buffered bbox is contained in the other (λ clamps to 1 there, which
                // grossly overstated the overlap — the small fragment's whole collar
                // habitat was flagged as double-counted even though the true buffer
                // intersection near the fragments' closest approach is much smaller).
                const estimate = bboxAreaA > 0 && bboxAreaB > 0
                    ? Math.min(hardMax, bboxOverlapKm2 *
                        Math.sqrt((collarA / bboxAreaA) * (collarB / bboxAreaB)))
                    : hardMax * lambda;
                perClass[k] = {
                    collarA,
                    collarB,
                    hardMax,
                    estimate,
                };
            }
            if (!sourcePositive) {
                continue;
            }
            sourcePositivePairs.push({
                indexA: ia,
                indexB: ib,
                bboxOverlapKm2,
                overlapIntensity: lambda,
                perClass,
            });
        }
    }
    if (sourcePositivePairs.length === 0) {
        return result;
    }
    const allClassKeys = new Set(Object.keys(areas));
    for (const idx of usableIndexes) {
        for (const k of Object.keys(overlapInfos[idx].collarAreas)) {
            allClassKeys.add(k);
        }
        for (const k of Object.keys(overlapInfos[idx].innerAreas)) {
            allClassKeys.add(k);
        }
    }
    const perClass = {};
    let flagged = false;
    for (const classKey of allClassKeys) {
        const naiveSum = areas[classKey] ?? 0;
        let collarSum = 0;
        let innerSum = 0;
        for (const idx of usableIndexes) {
            collarSum += overlapInfos[idx].collarAreas[classKey] ?? 0;
            innerSum += overlapInfos[idx].innerAreas[classKey] ?? 0;
        }
        let overcountMax = 0;
        let overcountEstimate = 0;
        for (const pair of sourcePositivePairs) {
            const pc = pair.perClass[classKey];
            if (!pc) {
                continue;
            }
            overcountMax = Math.max(overcountMax, pc.hardMax);
            overcountEstimate = Math.max(overcountEstimate, pc.estimate);
        }
        const cap = Math.min(naiveSum, collarSum);
        overcountMax = Math.min(overcountMax, cap);
        overcountEstimate = Math.min(overcountEstimate, cap);
        if (overcountMax === 0 && overcountEstimate === 0) {
            continue;
        }
        perClass[classKey] = {
            overcountMin: 0,
            overcountMax,
            overcountEstimate,
            naiveSum,
            collarSum,
            innerSum,
        };
        if (naiveSum > 0 && overcountEstimate / naiveSum >= 0.1) {
            flagged = true;
        }
    }
    if (Object.keys(perClass).length === 0) {
        return result;
    }
    result.overlap = {
        flagged,
        pairs: sourcePositivePairs.map((p) => ({
            indexA: p.indexA,
            indexB: p.indexB,
            bboxOverlapKm2: p.bboxOverlapKm2,
            overlapIntensity: p.overlapIntensity,
            perClass: p.perClass,
        })),
        perClass,
    };
    return result;
}
/**
 * Client-side enrichment: fill fragment hashes / sketch ids / scope on a
 * combine-time {@link RasterOverlayAreaOverlapCombineResult} using full
 * metrics that still carry subjects. Mirrors
 * {@link classifyOverlayAreaOverlapScope} for vector overlay_area.
 */
function attachRasterOverlayAreaOverlapScope(combined, fragmentMetrics) {
    if (combined.type !== "raster_overlay_area") {
        return combined;
    }
    const combine = getRasterOverlayAreaOverlapCombineResult(combined.value);
    if (!combine) {
        return combined;
    }
    const subjects = fragmentMetrics.map((m) => subjectIsFragment(m.subject) ? m.subject : null);
    const pairs = combine.pairs.map((p) => {
        const subA = subjects[p.indexA];
        const subB = subjects[p.indexB];
        return {
            ...p,
            fragmentHashA: subA?.hash,
            fragmentHashB: subB?.hash,
            sketchIdsA: subA?.sketches ? [...subA.sketches] : undefined,
            sketchIdsB: subB?.sketches ? [...subB.sketches] : undefined,
        };
    });
    const partnerSketchIds = new Set();
    const fragmentsInvolved = new Set();
    let within = false;
    let between = false;
    for (const p of pairs) {
        if (p.fragmentHashA) {
            fragmentsInvolved.add(p.fragmentHashA);
        }
        if (p.fragmentHashB) {
            fragmentsInvolved.add(p.fragmentHashB);
        }
        const a = new Set(p.sketchIdsA ?? []);
        const b = new Set(p.sketchIdsB ?? []);
        for (const id of a) {
            partnerSketchIds.add(id);
        }
        for (const id of b) {
            partnerSketchIds.add(id);
        }
        const shared = [...a].some((id) => b.has(id));
        const onlyA = [...a].some((id) => !b.has(id));
        const onlyB = [...b].some((id) => !a.has(id));
        if (shared) {
            within = true;
        }
        if (onlyA || onlyB) {
            between = true;
        }
    }
    let scope;
    if (within && between) {
        scope = "both";
    }
    else if (within) {
        scope = "within-sketch";
    }
    else if (between) {
        scope = "between-sketches";
    }
    const enriched = {
        ...combine,
        pairs,
        scope,
        partnerSketchIds: [...partnerSketchIds],
        fragmentsInvolved: [...fragmentsInvolved],
    };
    return {
        ...combined,
        value: {
            ...combined.value,
            overlap: enriched,
        },
    };
}
/**
 * Columns an Ocean Use Survey dataset must provide for the
 * `ous_demographics` metric. The chosen `groupBy` column (e.g. `village`,
 * `gear_type`) must also be present when it differs from `sector`.
 *
 * - `response_id` — identifies a single survey response. A response may
 *   include many shapes (one or more per sector).
 * - `participants` — how many people the whole response represents
 *   (e.g. "my answers represent the 20 people in my family").
 * - `represented_in_sector` — how many of those people each shape's sector
 *   represents. Summing shape values can exceed `participants`, so
 *   per-respondent values are clamped:
 *   `min(max(represented_in_sector across shapes), participants)`.
 * - `sector` — the default grouping column.
 */
exports.OUS_DEMOGRAPHICS_REQUIRED_COLUMNS = [
    "response_id",
    "participants",
    "represented_in_sector",
    "sector",
];
/** Default `groupBy` column for new `ous_demographics` dependencies. */
exports.OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY = "sector";
/**
 * Group key under which respondent-level rollups are stored on
 * {@link OusDemographicsMetricValue}. A respondent's rollup value is the
 * clamped max of `represented_in_sector` across all of their shapes in any
 * group — i.e. "people represented by this response, in any sector".
 */
exports.OUS_DEMOGRAPHICS_ROLLUP_KEY = "*";
/**
 * Sums per-respondent contributions into within-plan group summaries.
 * Row keys should come from `value.totals` (so groups with zero within-plan
 * respondents still render); this helper only summarizes `value.groups`.
 */
function summarizeOusDemographicsValue(value) {
    const result = {};
    if (!value || typeof value !== "object" || !value.groups) {
        return result;
    }
    for (const groupKey of Object.keys(value.groups)) {
        const respondents = value.groups[groupKey];
        const summary = {
            representedInSector: 0,
            participants: 0,
            respondents: 0,
        };
        for (const responseId of Object.keys(respondents)) {
            const entry = respondents[responseId];
            if (!entry || typeof entry !== "object") {
                continue;
            }
            if (Number.isFinite(entry.representedInSector)) {
                summary.representedInSector += entry.representedInSector;
            }
            if (Number.isFinite(entry.participants)) {
                summary.participants += entry.participants;
            }
            summary.respondents += 1;
        }
        result[groupKey] = summary;
    }
    return result;
}
/**
 * Combines `ous_demographics` fragment values. Per-group respondent maps are
 * merged by `responseId`, taking the max `representedInSector` — so a survey
 * shape split across fragment boundaries contributes its people count exactly
 * once, with no overlap-collar machinery. `totals` are dataset-wide and
 * identical across fragments; the first non-empty totals object wins.
 */
function combineOusDemographicsMetrics(values) {
    const combined = { groups: {}, totals: {} };
    for (const value of values) {
        if (!value || typeof value !== "object") {
            continue;
        }
        if (Object.keys(combined.totals).length === 0 &&
            value.totals &&
            typeof value.totals === "object") {
            combined.totals = value.totals;
        }
        if (!value.groups || typeof value.groups !== "object") {
            continue;
        }
        for (const groupKey of Object.keys(value.groups)) {
            const respondents = value.groups[groupKey];
            if (!respondents || typeof respondents !== "object") {
                continue;
            }
            const target = (combined.groups[groupKey] =
                combined.groups[groupKey] || {});
            for (const responseId of Object.keys(respondents)) {
                const entry = respondents[responseId];
                if (!entry ||
                    typeof entry !== "object" ||
                    !Number.isFinite(entry.representedInSector) ||
                    !Number.isFinite(entry.participants)) {
                    continue;
                }
                const existing = target[responseId];
                if (!existing) {
                    target[responseId] = {
                        representedInSector: entry.representedInSector,
                        participants: entry.participants,
                    };
                }
                else {
                    existing.representedInSector = Math.max(existing.representedInSector, entry.representedInSector);
                    existing.participants = Math.max(existing.participants, entry.participants);
                }
            }
        }
    }
    return combined;
}
function subjectIsFragment(subject) {
    return subject != null && typeof subject === "object" && "hash" in subject;
}
function subjectIsGeography(subject) {
    return subject != null && typeof subject === "object" && "id" in subject;
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
 * Sums `count`, `sum`, and `invalid` across fragments; combined mean is `sum / count`.
 * Min/max are the extrema across fragments; histograms are merged and downsampled.
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
    // All fragments of the same raster_stats metric share an epsg; pick the
    // first non-null value we encounter so it is preserved through combination.
    let combinedEpsg = undefined;
    // Merge histograms by value
    const histogramMap = new Map();
    for (const stats of statsArray) {
        if (isFinite(stats.count)) {
            totalCount += stats.count;
        }
        if (isFinite(stats.sum)) {
            totalSum += stats.sum;
        }
        if (isFinite(stats.invalid)) {
            totalInvalid += stats.invalid;
        }
        if (isFinite(stats.min) && stats.min !== null) {
            mins.push(stats.min);
        }
        if (isFinite(stats.max) && stats.max !== null) {
            maxs.push(stats.max);
        }
        if (combinedEpsg == null && stats.epsg != null) {
            combinedEpsg = stats.epsg;
        }
        // Merge histogram entries
        for (const [value, count] of stats.histogram) {
            histogramMap.set(value, (histogramMap.get(value) || 0) + count);
        }
    }
    // Convert histogram map back to array, sort by value, then downsample.
    // Each per-fragment histogram is capped at 200 entries, but combining them
    // via concatenation can produce 400+ entries. Downsample to keep the same
    // contract as the per-fragment histograms.
    const rawCombinedHistogram = Array.from(histogramMap.entries())
        .map(([value, count]) => [value, count])
        .sort((a, b) => a[0] - b[0]);
    const combinedHistogram = downsampleColumnHistogram(rawCombinedHistogram, 200);
    // Calculate combined mean using sum / valid-pixel count (not average of
    // means). Note `count` includes invalid (nodata) pixels — per-band means
    // are sum / (count - invalid), so the combined mean must use the same
    // denominator or fragments containing nodata pixels will dilute it,
    // potentially below the combined min.
    const totalValid = Math.max(0, totalCount - totalInvalid);
    const combinedMean = totalValid > 0 ? totalSum / totalValid : NaN;
    // Calculate combined range
    const combinedMin = mins.length > 0 ? (0, simple_statistics_1.min)(mins) : NaN;
    const combinedMax = maxs.length > 0 ? (0, simple_statistics_1.max)(maxs) : NaN;
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
        ...(combinedEpsg != null ? { epsg: combinedEpsg } : {}),
    };
}
/**
 * Applies the {@link MAX_COLUMN_VALUE_ENTRIES} cap to a set of entries.
 * When the cap is exceeded, entries are dropped entirely rather than
 * partially retained: a truncated list can never be used for exact merging
 * (see {@link hasReliableColumnValueEntries}), so storing part of it would
 * only add payload weight without any benefit.
 */
function capColumnValueEntries(entries) {
    if (entries.length <= exports.MAX_COLUMN_VALUE_ENTRIES) {
        return { entries, entriesTruncated: false };
    }
    return {
        entries: undefined,
        entriesTruncated: true,
    };
}
/**
 * Computes NumberColumnValueStats from per-feature entries. Each entry
 * represents a single original (pre-subdivision) feature, so counts, sums,
 * and distinct values are exact. Mean and stdDev are weighted by each
 * feature's overlap weight (area/length) when available.
 */
function numberColumnStatsFromEntries(entries) {
    const count = entries.length;
    if (count === 0) {
        return {
            type: "number",
            count: 0,
            min: NaN,
            max: NaN,
            mean: NaN,
            stdDev: NaN,
            histogram: [],
            countDistinct: 0,
            sum: 0,
        };
    }
    let minValue = Infinity;
    let maxValue = -Infinity;
    let sum = 0;
    let weightedSum = 0;
    let totalWeight = 0;
    const histogramMap = new Map();
    const distinctValues = new Set();
    for (const entry of entries) {
        const value = entry.value;
        if (typeof value !== "number") {
            continue;
        }
        distinctValues.add(value);
        const weight = entry.weight;
        if (value < minValue)
            minValue = value;
        if (value > maxValue)
            maxValue = value;
        sum += value;
        if (isFinite(weight) && weight > 0 && isFinite(value)) {
            weightedSum += value * weight;
            totalWeight += weight;
        }
        const histogramContribution = isFinite(weight) && weight > 0 ? weight : 1;
        histogramMap.set(value, (histogramMap.get(value) || 0) + histogramContribution);
    }
    const meanValue = totalWeight > 0 ? weightedSum / totalWeight : sum / count;
    let varianceNumerator = 0;
    if (totalWeight > 0) {
        for (const entry of entries) {
            const value = entry.value;
            const weight = entry.weight;
            if (typeof value !== "number" || !isFinite(weight) || weight <= 0) {
                continue;
            }
            const diff = value - meanValue;
            varianceNumerator += weight * diff * diff;
        }
        varianceNumerator = varianceNumerator / totalWeight;
    }
    else {
        for (const entry of entries) {
            const value = entry.value;
            if (typeof value !== "number") {
                continue;
            }
            const diff = value - meanValue;
            varianceNumerator += diff * diff;
        }
        varianceNumerator = varianceNumerator / count;
    }
    const stdDev = Math.sqrt(varianceNumerator);
    let histogram = Array.from(histogramMap.entries()).sort((a, b) => a[0] - b[0]);
    const MAX_HISTOGRAM_ENTRIES = 200;
    if (histogram.length > MAX_HISTOGRAM_ENTRIES) {
        histogram = downsampleColumnHistogram(histogram, MAX_HISTOGRAM_ENTRIES);
    }
    return {
        type: "number",
        count,
        min: minValue,
        max: maxValue,
        mean: meanValue,
        stdDev,
        histogram,
        countDistinct: distinctValues.size,
        sum,
        totalWeight: totalWeight > 0 ? totalWeight : undefined,
    };
}
/**
 * Reads a stats object's total overlap weight, falling back to the legacy
 * totalAreaSqKm field for metric values stored before the rename.
 */
function statsTotalWeight(stats) {
    return typeof stats.totalWeight === "number"
        ? stats.totalWeight
        : stats.totalAreaSqKm;
}
/**
 * Computes StringOrBooleanColumnValueStats from per-feature entries.
 */
function stringOrBooleanColumnStatsFromEntries(entries) {
    const distinctMap = new Map();
    let sawBoolean = false;
    let sawString = false;
    for (const entry of entries) {
        const value = entry.value;
        if (typeof value !== "string" && typeof value !== "boolean") {
            continue;
        }
        if (typeof value === "boolean") {
            sawBoolean = true;
        }
        else {
            sawString = true;
        }
        distinctMap.set(value, (distinctMap.get(value) ?? 0) + 1);
    }
    return {
        type: sawBoolean && !sawString ? "boolean" : "string",
        distinctValues: Array.from(distinctMap.entries()),
        countDistinct: distinctMap.size,
    };
}
/**
 * Merges per-feature entries from multiple fragments, deduplicating by
 * original feature id. Weights of the same feature are summed across
 * fragments (fragments are disjoint, so each fragment's clipped weight is a
 * distinct portion of the feature). Returns `sharedOffsets: true` when the
 * same subdivided part contributed to more than one fragment's stats, which
 * indicates the subjects overlapped (e.g. buffered fragments) and summed
 * weights may be overstated.
 */
function mergeColumnValueEntries(statsArray) {
    const byId = new Map();
    const seenOffsets = new Set();
    let sharedOffsets = false;
    for (const stats of statsArray) {
        const offsetsInThisFragment = new Set();
        for (const entry of stats.entries ?? []) {
            const existing = byId.get(entry.id);
            if (existing) {
                existing.weight += entry.weight;
                for (const offset of entry.offsets) {
                    if (!existing.offsets.includes(offset)) {
                        existing.offsets.push(offset);
                    }
                }
            }
            else {
                byId.set(entry.id, {
                    id: entry.id,
                    value: entry.value,
                    weight: entry.weight,
                    offsets: [...entry.offsets],
                });
            }
            for (const offset of entry.offsets) {
                offsetsInThisFragment.add(offset);
            }
        }
        for (const offset of offsetsInThisFragment) {
            if (seenOffsets.has(offset)) {
                sharedOffsets = true;
            }
            seenOffsets.add(offset);
        }
    }
    return { entries: Array.from(byId.values()), sharedOffsets };
}
/**
 * Combines ColumnValueStats from multiple fragments into a single ColumnValueStats.
 *
 * When every input carries a complete set of per-feature entries, statistics
 * are recomputed exactly from the merged entries, deduplicating features that
 * span multiple fragments (or were subdivided into multiple parts at upload
 * time) so values like `sum` are never double-counted.
 *
 * Otherwise falls back to approximate merging: if a total overlap weight is
 * available (totalWeight, or the legacy totalAreaSqKm field), mean and stdDev
 * are weighted by it; otherwise they are weighted by count.
 */
function combineNumberColumnValueStats(statsArray) {
    if (statsArray.length === 0) {
        return undefined;
    }
    if (statsArray.length === 1) {
        return statsArray[0];
    }
    if (statsArray.every(hasReliableColumnValueEntries)) {
        const { entries, sharedOffsets } = mergeColumnValueEntries(statsArray);
        // Stats are computed from the full merged entry set (exact); the cap
        // only limits what is retained for any further combination.
        const combined = numberColumnStatsFromEntries(entries);
        const capped = capColumnValueEntries(entries);
        if (capped.entries) {
            combined.entries = capped.entries;
        }
        if (capped.entriesTruncated) {
            combined.entriesTruncated = true;
        }
        if (sharedOffsets) {
            combined.weightsMayOverlap = true;
        }
        return combined;
    }
    // Determine whether to weight by overlap size (area/length) or by count
    const useOverlapWeight = statsArray.some((s) => {
        const weight = statsTotalWeight(s);
        return typeof weight === "number" && weight > 0;
    });
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
        const statsWeight = statsTotalWeight(stats);
        const weight = useOverlapWeight && typeof statsWeight === "number"
            ? Math.max(statsWeight, 0)
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
        .sort((a, b) => {
        if (typeof a[0] === "number" && typeof b[0] === "number") {
            return a[0] - b[0];
        }
        else {
            return 0;
        }
    });
    // Limit histogram size similarly to raster stats by downsampling
    const MAX_HISTOGRAM_ENTRIES = 200;
    if (combinedHistogram.length > MAX_HISTOGRAM_ENTRIES) {
        combinedHistogram = downsampleColumnHistogram(combinedHistogram, MAX_HISTOGRAM_ENTRIES);
    }
    const combinedTotalWeight = useOverlapWeight
        ? statsArray.reduce((acc, s) => {
            const weight = statsTotalWeight(s);
            return acc + (typeof weight === "number" && weight > 0 ? weight : 0);
        }, 0)
        : undefined;
    const result = {
        type: "number",
        count: combinedCount,
        min: combinedMin,
        max: combinedMax,
        mean: combinedMean,
        stdDev: combinedStdDev,
        histogram: combinedHistogram,
        countDistinct: histogramMap.size,
        sum: combinedSum,
        totalWeight: combinedTotalWeight,
    };
    // If exact merging wasn't possible because an input exceeded the entry
    // cap, surface that on the combined result so consumers (e.g. report
    // widgets) can warn that features spanning fragments may be
    // double-counted. Inputs that merely lack entries (legacy metrics, or
    // metrics not scoped via includedColumns) do not set these flags.
    if (statsArray.some((s) => s.entriesTruncated === true)) {
        result.entriesTruncated = true;
        result.truncationAffectedMerge = true;
    }
    return result;
}
function combineStringOrBooleanColumnValueStats(statsArray) {
    if (statsArray.length === 0) {
        return undefined;
    }
    if (statsArray.length === 1) {
        return statsArray[0];
    }
    if (statsArray.every(hasReliableColumnValueEntries)) {
        const { entries } = mergeColumnValueEntries(statsArray);
        const combined = stringOrBooleanColumnStatsFromEntries(entries);
        // Preserve the declared type when entries alone are ambiguous (e.g. all
        // fragments empty).
        if (entries.length === 0) {
            combined.type = statsArray[0].type;
        }
        const capped = capColumnValueEntries(entries);
        if (capped.entries) {
            combined.entries = capped.entries;
        }
        if (capped.entriesTruncated) {
            combined.entriesTruncated = true;
        }
        return combined;
    }
    const distinctValues = [];
    for (const stats of statsArray) {
        for (const record of stats.distinctValues) {
            const value = record[0];
            const count = record[1];
            const existing = distinctValues.find(([v]) => v === value);
            if (existing) {
                existing[1] += count;
            }
            else {
                distinctValues.push([value, count]);
            }
        }
    }
    const outputType = statsArray[0]?.type === "boolean" ? "boolean" : "string";
    const result = {
        type: outputType,
        distinctValues,
        countDistinct: distinctValues.length,
    };
    // See combineNumberColumnValueStats: propagate truncation so consumers
    // can warn that the approximate merge may double-count features.
    if (statsArray.some((s) => s.entriesTruncated === true)) {
        result.entriesTruncated = true;
        result.truncationAffectedMerge = true;
    }
    return result;
}
/**
 * Creates a unique id for a given metric dependency. Any difference in
 * MetricDependency properties, or parameters within MetricDependencyParameters
 * will result in a different hash.
 *
 * This hash is set on CompatibleSpatialMetric objects in the GraphQL API so
 * that clients can quickly determine which metrics are relevant to a given
 * report card widget.
 *
 * @param dependency The dependency to hash
 * @param overlaySourceUrls A map of table of contents item stable ids to overlay source urls. The hash will be based on the overlay source url, rather than the stable id. This way, updates to the underlying source will trigger a cache miss and trigger recalculation of the metric.
 * @returns A unique id for the dependency
 */
function hashMetricDependency(dependency, overlaySourceUrls) {
    if (dependency.stableId && overlaySourceUrls[dependency.stableId]) {
        if (!overlaySourceUrls[dependency.stableId]) {
            throw new Error(`Hashing Error. Overlay source URL not found for stable id: ${dependency.stableId}`);
        }
        dependency = {
            ...dependency,
            stableId: overlaySourceUrls[dependency.stableId],
        };
    }
    const canonical = stableSerialize(dependency);
    return fnv1a(canonical);
}
/**
 * Produces a stable, order-independent string representation of a dependency.
 * Object keys are sorted; arrays retain their order so that reordering values
 * still produces a different hash.
 */
function stableSerialize(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        const isStringArray = value.every((item) => typeof item === "string");
        const normalized = isStringArray ? [...value].sort() : value;
        return `[${normalized.map((item) => stableSerialize(item)).join(",")}]`;
    }
    const entries = Object.keys(value)
        .filter((key) => value[key] !== undefined &&
        key !== "hash" &&
        key !== "__typename")
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
    return `{${entries.join(",")}}`;
}
/**
 * Fast, cross-environment 32-bit FNV-1a hash. Returns an 8-char hex string.
 */
function fnv1a(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
/**
 * Combines a list of metrics for fragments into a single metric. All metrics
 * must have the same type (e.g. total_area, count, etc.)
 *
 * For buffered fragment `overlay_area` values that carry `__overlap`, see
 * {@link OverlayAreaOverlapInfo} and {@link combineOverlayAreaMetrics}: class
 * totals may be corrected and a combine-time `__overlap` result attached when
 * residual uncertainty remains. Unbuffered rows (no `__overlap`) combine by
 * ordinary summation with no overlap machinery cost.
 *
 * @param metrics - The metrics to combine.
 * @returns The combined metric.
 */
function combineMetricsForFragments(metrics, expectedMetricType) {
    if (metrics.length === 0) {
        if (expectedMetricType) {
            switch (expectedMetricType) {
                case "overlay_area":
                    return {
                        type: "overlay_area",
                        value: {
                            "*": 0,
                        },
                    };
                case "count":
                    return {
                        type: "count",
                        value: {
                            "*": { count: 0, uniqueIdIndex: { ranges: [], individuals: [] } },
                        },
                    };
                case "raster_stats":
                    return {
                        type: "raster_stats",
                        value: {
                            bands: [
                                {
                                    count: 0,
                                    min: 0,
                                    max: 0,
                                    mean: 0,
                                    median: 0,
                                    range: 0,
                                    histogram: [],
                                    invalid: 0,
                                    sum: 0,
                                    vrm: null,
                                    epsg: undefined,
                                },
                            ],
                        },
                    };
                case "raster_overlay_area":
                    return {
                        type: "raster_overlay_area",
                        value: {
                            areas: { "*": 0 },
                        },
                    };
                case "column_values":
                    return {
                        type: "column_values",
                        value: {},
                    };
                case "total_area":
                    return {
                        type: "total_area",
                        value: 0,
                    };
                case "distance_to_shore":
                    return {
                        type: "distance_to_shore",
                        value: {
                            meters: 0,
                        },
                    };
                case "presence":
                    return {
                        type: "presence",
                        value: false,
                    };
                case "presence_table":
                    return {
                        type: "presence_table",
                        value: { values: [], exceededLimit: false },
                    };
                case "ous_demographics":
                    return {
                        type: "ous_demographics",
                        value: { groups: {}, totals: {} },
                    };
                default:
                    throw new Error(`Unsupported metric type: ${expectedMetricType}`);
            }
        }
        else {
            throw new Error("Cannot combine empty array of metrics");
        }
    }
    // first, ensure that all metrics have the same type
    const types = new Set(metrics.map((m) => m.type));
    if (types.size > 1) {
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
                value: combineGroupedValues(values, (groupedValues) => {
                    const stats = {};
                    const attrNames = new Set();
                    // Collect all attribute names across fragments for this class key
                    for (const entry of groupedValues) {
                        if (entry && typeof entry === "object") {
                            for (const attr in entry) {
                                attrNames.add(attr);
                            }
                        }
                    }
                    for (const attr of attrNames) {
                        const attrValues = groupedValues
                            .map((entry) => entry?.[attr])
                            .filter((v) => v !== undefined);
                        if (attrValues.length === 0)
                            continue;
                        if (isNumberColumnValueStats(attrValues[0])) {
                            const combined = combineNumberColumnValueStats(attrValues);
                            if (combined) {
                                stats[attr] = combined;
                            }
                        }
                        else {
                            const combined = combineStringOrBooleanColumnValueStats(attrValues);
                            if (combined) {
                                stats[attr] = combined;
                            }
                        }
                    }
                    return stats;
                }),
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
            const values = metrics
                .map((m) => m.value)
                .filter((v) => v != null && typeof v.meters === "number");
            if (values.length === 0) {
                return {
                    type: "distance_to_shore",
                    value: {
                        meters: Infinity,
                    },
                };
            }
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
            /**
             * Combines fragment `overlay_area` values with optional buffered-overlap
             * correction. See {@link OverlayAreaOverlapInfo} and
             * {@link combineOverlayAreaMetrics}.
             */
            const values = metrics.map((m) => m.value);
            return {
                type: "overlay_area",
                value: combineOverlayAreaMetrics(values),
            };
        }
        case "raster_overlay_area": {
            const values = metrics.map((m) => m.value);
            return {
                type: "raster_overlay_area",
                value: combineRasterOverlayAreaMetrics(values),
            };
        }
        case "ous_demographics": {
            const values = metrics.map((m) => m.value);
            return {
                type: "ous_demographics",
                value: combineOusDemographicsMetrics(values),
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
                // Skip reserved metadata keys (e.g. overlay_area `__overlap`).
                if (typeof key === "string" && !key.startsWith("__")) {
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
function extractMetricDependenciesFromReportBody(node, dependencies = []) {
    if (typeof node !== "object" || node === null || !node.type) {
        throw new Error("Invalid node");
    }
    if ((node.type === "metric" || node.type === "blockMetric") &&
        node.attrs?.metrics) {
        const metrics = node.attrs.metrics;
        if (!Array.isArray(metrics)) {
            throw new Error("Invalid metrics");
        }
        if (metrics.length > 0) {
            if (typeof metrics[0] !== "object") {
                throw new Error("Invalid metric");
            }
            dependencies.push(...metrics);
        }
    }
    if (Array.isArray(node.content)) {
        for (const child of node.content) {
            extractMetricDependenciesFromReportBody(child, dependencies);
        }
    }
    return dependencies;
}
//# sourceMappingURL=metrics.js.map