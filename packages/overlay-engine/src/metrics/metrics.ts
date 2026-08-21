import { Feature, LineString, Polygon } from "geojson";
import turfArea from "@turf/area";
import {
  min,
  max,
  mean,
  median,
  standardDeviation,
  equalIntervalBreaks,
} from "simple-statistics";
import { countUniqueIds, mergeUniqueIdIndexes } from "../utils/uniqueIdIndex";
type ColumnHistogramEntry = [number, number];

/**
 * Downsamples a histogram of [value, count] pairs to a maximum number of
 * entries, preserving the overall distribution across the full value range.
 * This mirrors the approach used in rasterStats downsampling.
 */
function downsampleColumnHistogram(
  histogram: ColumnHistogramEntry[],
  maxEntries: number,
): ColumnHistogramEntry[] {
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
  const binCounts = new Array<number>(numBins).fill(0);
  const span = maxValue - minValue;

  for (const [value, count] of sorted) {
    const normalized = (value - minValue) / span;
    let binIndex = Math.round(normalized * (numBins - 1));
    if (binIndex < 0) binIndex = 0;
    if (binIndex >= numBins) binIndex = numBins - 1;
    binCounts[binIndex] += count;
  }

  const result: ColumnHistogramEntry[] = [];
  for (let i = 0; i < numBins; i++) {
    const count = binCounts[i];
    if (count === 0) continue;
    const value = minValue + (span * i) / (numBins - 1);
    result.push([value, count]);
  }

  return result;
}

export type MetricType =
  | "total_area"
  | "overlay_area"
  | "count"
  | "presence"
  | "presence_table"
  | "column_values"
  | "raster_stats"
  | "distance_to_shore"
  | "raster_overlay_area"
  | "ous_demographics";

/**
 * Max distinct class keys allowed when `groupBy: "value"` for
 * {@link RasterOverlayAreaMetric}. Exceeding this throws at calculation time —
 * grouping a continuous raster by value is a misconfiguration.
 */
export const MAX_RASTER_OVERLAY_AREA_CLASSES = 32;

type MetricBase = {
  type: MetricType;
  subject: MetricSubjectFragment | MetricSubjectGeography;
};

type OverlayMetricBase = MetricBase & {
  stableId: string;
  groupBy: string;
};

export type MetricSubjectFragment = {
  hash: string;
  geographies: number[];
  sketches: number[];
};

export type MetricSubjectGeography = {
  type: "geography";
  id: number;
};

export type TotalAreaMetric = MetricBase & {
  type: "total_area";
  value: number;
};

/**
 * Maximum number of per-feature collar entries retained on a buffered
 * {@link OverlayAreaMetric} fragment row, shared across all classes.
 * Largest-area entries are kept when truncating; residual overcount falls
 * back to the collar-area bound. Sized generously because the canonical
 * ocean-sketch case puts nearly all contributing features in the collar.
 */
export const MAX_OVERLAY_AREA_OVERLAP_ENTRIES = 2000;

/**
 * Per-feature / per-class metadata attached to a buffered `overlay_area`
 * fragment metric under the reserved value key `__overlap`.
 *
 * ## When this is produced (and when it is not)
 *
 * Collected **only** for `overlay_area` on **fragment** subjects with
 * `bufferDistanceKm > 0`. The worker skips collar computation,
 * per-feature entry collection, and `__overlap` attachment otherwise —
 * unbuffered `overlay_area`, geography subjects, and other metric types
 * take the pre-existing code paths with **no extra overhead** from this
 * machinery.
 *
 * ## Why this exists
 *
 * Fragment subjects are pairwise disjoint, so unbuffered `overlay_area`
 * metrics combine by simple summation with no double counting. Buffering
 * each fragment independently (`bufferDistanceKm`) expands those subjects
 * so adjacent fragments' buffers overlap. Naively summing per-class areas
 * then double-counts source features that fall in the overlap zone.
 * Canonical case: an ocean sketch (MPA) buffered inland against a land-use
 * layer — the sketch interior contributes nothing, and *all* class area
 * lives in the buffer band.
 *
 * Metric rows are cached by dependency hash and shared across sketches and
 * collections, so each fragment must compute enough metadata **in isolation**
 * for a later combine step to detect and bound overcount without re-reading
 * geometry.
 *
 * ## Collar containment
 *
 * For disjoint fragments A and B, `buffer(A,d) ∩ buffer(B,d)` is always
 * contained in A's **collar** `buffer(A,d) − erode(A,d)` (the band within
 * distance d of A's boundary). Therefore only features intersecting the
 * collar can participate in double counting, and `collarArea` is a hard
 * upper bound on that fragment's contribution to overcount for a class.
 *
 * When the fragment interior is empty of the source class (ocean sketch vs
 * land features), `collarArea ≈ total` and the collar bound alone is weak
 * (~"up to 100%"). Per-feature entries are then the primary mechanism.
 *
 * ## Field roles
 *
 * - `bufferKm` — buffer distance that produced this subject (must match
 *   across fragments being combined).
 * - `bbox` — buffered-subject bounding box. Pairwise non-intersection is a
 *   cheap proof that the naive sum is exact (silence guarantee gate 1).
 * - `classes[key].collarArea` — class area inside the collar; fallback bound
 *   when entries are missing or truncated.
 * - `classes[key].oidx` / `area` / `featureArea` — parallel arrays of
 *   collar-intersecting features. `featureArea[i] === 0` (or absent) means
 *   the feature is fully covered by this buffer (`featureArea === area`),
 *   which is common for small land parcels and collapses the per-feature
 *   bound to an exact correction.
 * - `classes[key].entriesTruncated` — entry budget exceeded; largest-area
 *   entries were kept and residual overcount uses the collar bound.
 *
 * ## How consumers interpret this
 *
 * For a feature f with clipped areas a₁..aₖ across k fragments and total
 * feature area A_f, the true contribution is in
 * `[max(aᵢ), min(Σaᵢ, A_f)]`. Naive sum uses Σaᵢ, so overcount is in
 * `[max(0, Σaᵢ − A_f), Σaᵢ − max(aᵢ)]`.
 *
 * Displayed value policy: `naiveSum − overcountMin` (tightest defensible
 * upper estimate). When `overcountMin === overcountMax` the correction is
 * exact and UIs stay silent. Warnings appear only for residual uncertainty
 * above a small threshold.
 *
 * Silence guarantee: no shared `__oidx` across fragments (complete entries)
 * ⇒ overcount is zero even if buffered bboxes intersect. Adjacent buffers
 * overlapping each other is irrelevant; only reaching the same features
 * matters.
 *
 * Stale-metric fallback: fragment rows lacking `__overlap` (pre-upgrade
 * worker output; cache has no shape version) contribute no overlap
 * information. Pairs involving them degrade to today's naive sum with no
 * flag — never throw.
 *
 * @see combineOverlayAreaMetrics
 * @see classifyOverlayAreaOverlapScope
 */
export type OverlayAreaOverlapInfo = {
  bufferKm: number;
  bbox: [number, number, number, number];
  classes: {
    [classKey: string]: {
      /** Class area (km²) or length (km) inside the collar. */
      collarArea: number;
      oidx?: number[];
      area?: number[];
      /**
       * Parallel to `area`. `0` means fully covered by this buffer
       * (`featureArea === area`); omit/zero to save space in the common case.
       */
      featureArea?: number[];
      entriesTruncated?: boolean;
    };
  };
};

/**
 * Combine-time overlap result attached under `__overlap` on a combined
 * `overlay_area` metric value (after {@link combineOverlayAreaMetrics}).
 *
 * Class totals on the same value object are already corrected to
 * `naiveSum − overcountMin`. Residual uncertainty (`overcountMax > overcountMin`)
 * is what UIs warn about; exact corrections stay silent.
 *
 * @see OverlayAreaOverlapInfo
 */
export type OverlayAreaOverlapCombineResult = {
  flagged: boolean;
  /**
   * Present when callers supply fragment subjects via
   * {@link classifyOverlayAreaOverlapScope}.
   */
  scope?: "within-sketch" | "between-sketches" | "both";
  /** Sketch ids involved in between-sketch buffer overlap, when known. */
  partnerSketchIds?: number[];
  fragmentsInvolved?: string[];
  perClass: {
    [classKey: string]: {
      overcountMin: number;
      overcountMax: number;
      naiveSum: number;
    };
  };
};

/**
 * `overlay_area` metric value: per-class numeric totals plus an optional
 * reserved `__overlap` metadata object.
 *
 * **Contract:** when iterating class keys / summing class values, skip any
 * key that starts with `__`. The reserved key `__overlap` holds either
 * {@link OverlayAreaOverlapInfo} (fragment rows) or
 * {@link OverlayAreaOverlapCombineResult} (combined rows).
 *
 * @see OverlayAreaOverlapInfo
 */
export type OverlayAreaMetricValue = {
  [key: string]:
    | number
    | OverlayAreaOverlapInfo
    | OverlayAreaOverlapCombineResult;
};

export type OverlayAreaMetric = OverlayMetricBase & {
  type: "overlay_area";
  /**
   * Per-class area (km²) or length (km). May include reserved `__overlap`
   * metadata — see {@link OverlayAreaMetricValue}.
   */
  value: OverlayAreaMetricValue;
};

/** True for class-total keys; false for reserved `__`-prefixed metadata keys. */
export function isOverlayAreaClassKey(key: string): boolean {
  return !key.startsWith("__");
}

export function isOverlayAreaOverlapInfo(
  value: unknown,
): value is OverlayAreaOverlapInfo {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.bufferKm === "number" &&
    Array.isArray(v.bbox) &&
    v.bbox.length === 4 &&
    typeof v.classes === "object" &&
    v.classes !== null &&
    !Array.isArray(v.classes)
  );
}

export function isOverlayAreaOverlapCombineResult(
  value: unknown,
): value is OverlayAreaOverlapCombineResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.flagged === "boolean" &&
    typeof v.perClass === "object" &&
    v.perClass !== null &&
    !Array.isArray(v.perClass)
  );
}

/**
 * Reads fragment-level {@link OverlayAreaOverlapInfo} from a metric value, if present.
 */
export function getOverlayAreaOverlapInfo(
  value: OverlayAreaMetricValue | null | undefined,
): OverlayAreaOverlapInfo | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value.__overlap;
  return isOverlayAreaOverlapInfo(raw) ? raw : null;
}

/**
 * Reads combine-time {@link OverlayAreaOverlapCombineResult} from a metric value, if present.
 */
export function getOverlayAreaOverlapCombineResult(
  value: OverlayAreaMetricValue | null | undefined,
): OverlayAreaOverlapCombineResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value.__overlap;
  return isOverlayAreaOverlapCombineResult(raw) ? raw : null;
}

/** Numeric class totals only (strips reserved `__` keys). */
export function getOverlayAreaClassTotals(
  value: OverlayAreaMetricValue | null | undefined,
): { [classKey: string]: number } {
  const result: { [classKey: string]: number } = {};
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
export function getOverlayAreaDisplayedClassValue(
  value: OverlayAreaMetricValue | null | undefined,
  classKey: string,
): number {
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
export function getOverlayAreaClassValueRange(
  value: OverlayAreaMetricValue | null | undefined,
  classKey: string,
): { low: number; high: number; naiveSum: number } | null {
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

function bboxesIntersect(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function featureAreaAt(
  classInfo: OverlayAreaOverlapInfo["classes"][string],
  index: number,
  clippedArea: number,
): number {
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
export function combineOverlayAreaMetrics(
  values: OverlayAreaMetricValue[],
): OverlayAreaMetricValue {
  const numericValues = values.map((v) => getOverlayAreaClassTotals(v));
  const naiveCombined = combineGroupedValues(numericValues, (group) =>
    group.reduce((acc, n) => acc + n, 0),
  );

  if (values.length <= 1) {
    return naiveCombined;
  }

  const overlapInfos = values.map((v) => getOverlayAreaOverlapInfo(v));
  const usableIndexes: number[] = [];
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
  const intersectingPairs: [number, number][] = [];
  for (let a = 0; a < usableIndexes.length; a++) {
    for (let b = a + 1; b < usableIndexes.length; b++) {
      const ia = usableIndexes[a];
      const ib = usableIndexes[b];
      const infoA = overlapInfos[ia]!;
      const infoB = overlapInfos[ib]!;
      if (bboxesIntersect(infoA.bbox, infoB.bbox)) {
        anyBboxIntersect = true;
        intersectingPairs.push([ia, ib]);
      }
    }
  }
  if (!anyBboxIntersect) {
    return naiveCombined;
  }

  const classKeys = new Set<string>(Object.keys(naiveCombined));
  for (const idx of usableIndexes) {
    for (const key of Object.keys(overlapInfos[idx]!.classes)) {
      classKeys.add(key);
    }
  }

  const perClass: OverlayAreaOverlapCombineResult["perClass"] = {};
  const corrected: OverlayAreaMetricValue = { ...naiveCombined };

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
    const byOidx = new Map<
      number,
      { areas: number[]; featureArea: number; allFullyCovered: boolean }
    >();

    for (const idx of usableIndexes) {
      const classInfo = overlapInfos[idx]!.classes[classKey];
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
        } else {
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
      } else if (Af > maxA) {
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
      const ca = overlapInfos[ia]!.classes[classKey];
      const cb = overlapInfos[ib]!.classes[classKey];
      if (!ca || !cb) {
        continue;
      }
      if (!ca.entriesTruncated && !cb.entriesTruncated) {
        continue;
      }
      const residualA = Math.max(
        0,
        (ca.collarArea || 0) -
          (ca.area || []).reduce((acc, n) => acc + (n || 0), 0),
      );
      const residualB = Math.max(
        0,
        (cb.collarArea || 0) -
          (cb.area || []).reduce((acc, n) => acc + (n || 0), 0),
      );
      truncationResidual = Math.max(
        truncationResidual,
        Math.min(residualA, residualB),
      );
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
      } else {
        const n = naiveCombined[k];
        if (typeof n === "number" && Number.isFinite(n)) {
          starNaiveFromClasses += n;
        }
      }
    }
    const storedStar = naiveCombined["*"];
    const starNaive =
      typeof storedStar === "number" && Number.isFinite(storedStar)
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

  const flagged = Object.values(perClass).some(
    (p) => p.overcountMax > p.overcountMin,
  );

  corrected.__overlap = {
    flagged,
    perClass,
  } satisfies OverlayAreaOverlapCombineResult;

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
export function classifyOverlayAreaOverlapScope(
  metrics: Pick<Metric, "subject">[],
): {
  scope: "within-sketch" | "between-sketches" | "both";
  partnerSketchIds: number[];
  fragmentsInvolved: string[];
} {
  const fragmentHashes: string[] = [];
  const sketchIdsByFragment: number[][] = [];

  for (const m of metrics) {
    if (!subjectIsFragment(m.subject)) {
      continue;
    }
    fragmentHashes.push(m.subject.hash);
    sketchIdsByFragment.push([...m.subject.sketches]);
  }

  let within = false;
  let between = false;
  const partnerSketchIds = new Set<number>();

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
      } else {
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

  const scope: "within-sketch" | "between-sketches" | "both" =
    within && between ? "both" : between ? "between-sketches" : "within-sketch";

  return {
    scope,
    partnerSketchIds: Array.from(partnerSketchIds).sort((a, b) => a - b),
    fragmentsInvolved: fragmentHashes,
  };
}

/**
 * For CountMetrics, it's important to know the unique IDs of matches, since you
 * may need to join results from multiple fragments. You must check the index
 * in this scenario to avoid double-counting features.
 */
export type UniqueIdIndex = {
  /**
   * [start, end] Ranges of IDs that are consecutive. Always sorted.
   */
  ranges: [number, number][];
  /**
   * IDs that don't fit in ranges. Always sorted.
   */
  individuals: number[];
};

export type CountMetric = OverlayMetricBase & {
  type: "count";
  value: {
    [groupBy: string]: {
      count: number;
      uniqueIdIndex: UniqueIdIndex;
    };
  };
};

export type PresenceMetric = OverlayMetricBase & {
  type: "presence";
  value: boolean;
};

export type PresenceTableValue = {
  __id: number;
  [attribute: string]: any;
};

export type PresenceTableMetric = OverlayMetricBase & {
  type: "presence_table";
  value: {
    values: PresenceTableValue[];
    exceededLimit: boolean;
  };
};

/**
 * A per-original-feature record retained alongside column statistics.
 *
 * Sources used for overlay analysis are subdivided at upload time, so a
 * single original feature may be represented by many parts in the FlatGeobuf
 * file, and those parts may be spread across multiple fragments. Entries are
 * keyed by the original feature id so that statistics can be combined across
 * fragments without double-counting features.
 */
export type ColumnValuesEntry = {
  /** `__oidx` of the original (pre-subdivision) feature. */
  id: number;
  /** The column's value for this feature. */
  value: number | string | boolean;
  /**
   * Overlap weight. Area of overlap in square kilometers for polygonal
   * features, or length of overlap in kilometers for linear features, summed
   * across all subdivided parts of the feature seen within the subject.
   * Zero for unweighted (e.g. point) features.
   */
  weight: number;
  /**
   * FlatGeobuf byte offsets (`__offset`) of the subdivided parts that
   * contributed to this entry. When combining metrics whose subjects may
   * overlap (e.g. buffered fragments), shared offsets across fragments
   * indicate that summed weights may overstate the true overlap. Empty for
   * metrics calculated with an unbuffered subject, where fragments are
   * disjoint and overlap detection is unnecessary.
   */
  offsets: number[];
};

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
export const MAX_COLUMN_VALUE_ENTRIES = 300;

type ColumnValueStatsBase = {
  /**
   * Per-feature records used to exactly combine statistics across fragments
   * without double-counting features that span fragment boundaries or were
   * subdivided into multiple parts at upload time. Only present when the
   * metric was calculated with includedColumns set (scoped column list) and
   * the feature count was within {@link MAX_COLUMN_VALUE_ENTRIES}.
   */
  entries?: ColumnValuesEntry[];
  /**
   * True if entries were dropped because the feature count exceeded
   * {@link MAX_COLUMN_VALUE_ENTRIES}. When set, no entries are stored at all.
   */
  entriesTruncated?: boolean;
  /**
   * Set only when stats from *multiple* fragments had to be combined
   * approximately because per-feature entries were truncated on at least one
   * input. In that case statistics may double-count features that span
   * fragment boundaries. Not set when a single fragment's stats are returned
   * as-is (exact even if its entries were truncated), when an exact merge
   * merely capped its output entries, or when inputs simply lack entries
   * (legacy metrics not scoped via includedColumns). This is the flag report
   * widgets should use to surface accuracy warnings.
   */
  truncationAffectedMerge?: boolean;
};

export type StringOrBooleanColumnValueStats = ColumnValueStatsBase & {
  type: "string" | "boolean";
  /**
   * Distinct value ([0]) and count [1]
   */
  distinctValues: [string | boolean, number][];
  countDistinct: number;
};

export type NumberColumnValueStats = ColumnValueStatsBase & {
  type: "number";
  count: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  histogram: [number, number][];
  countDistinct: number;
  sum: number;
  /**
   * Total overlap weight of the features contributing to these stats: summed
   * area of overlap in square kilometers for polygonal sources, or summed
   * length of overlap in kilometers for linear sources. Undefined for
   * unweighted (e.g. point) sources.
   *
   * When per-feature entries are present this is derived from their weights.
   * Its main purpose is to weight mean/stdDev when combining stats across
   * fragments *without* entries (the approximate fallback path).
   */
  totalWeight?: number;
  /**
   * @deprecated Legacy name for {@link totalWeight}, misleading since the
   * value is a length (km) for linear sources. Still present on metric values
   * calculated before totalWeight was introduced, and read as a fallback when
   * combining them. New calculations only set totalWeight.
   */
  totalAreaSqKm?: number;
  /**
   * Set when stats were combined from fragments that saw the same subdivided
   * part (shared `__offset`). This can happen when subjects overlap (e.g.
   * buffered fragments), in which case summed weights (and weighted
   * mean/stdDev) may slightly overstate the true overlap. Whole-value
   * statistics (count, sum, min, max, countDistinct) remain exact.
   */
  weightsMayOverlap?: boolean;
};

export function isNumberColumnValueStats(
  stats: NumberColumnValueStats | StringOrBooleanColumnValueStats,
): stats is NumberColumnValueStats {
  return stats.type === "number";
}

/**
 * Type guard for {@link ColumnValuesEntry}. Accepts untrusted input (e.g.
 * metric values deserialized from the database).
 */
export function isColumnValuesEntry(
  value: unknown,
): value is ColumnValuesEntry {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as { [key: string]: unknown };
  if (typeof candidate.id !== "number") {
    return false;
  }
  if (
    typeof candidate.value !== "number" &&
    typeof candidate.value !== "string" &&
    typeof candidate.value !== "boolean"
  ) {
    return false;
  }
  if (typeof candidate.weight !== "number") {
    return false;
  }
  if (
    !Array.isArray(candidate.offsets) ||
    candidate.offsets.some((o) => typeof o !== "number")
  ) {
    return false;
  }
  return true;
}

/**
 * Returns true if the given column stats carry a complete (untruncated) set
 * of per-feature entries which can be used to exactly combine statistics
 * across fragments.
 */
export function hasReliableColumnValueEntries(
  stats: unknown,
): stats is ColumnValueStatsBase & { entries: ColumnValuesEntry[] } {
  if (stats === null || typeof stats !== "object") {
    return false;
  }
  const candidate = stats as { [key: string]: unknown };
  if (candidate.entriesTruncated === true) {
    return false;
  }
  if (!Array.isArray(candidate.entries)) {
    return false;
  }
  return candidate.entries.every(isColumnValuesEntry);
}

export type ValuesForColumns = {
  [attr: string]: StringOrBooleanColumnValueStats | NumberColumnValueStats;
};

export type ColumnValuesMetric = OverlayMetricBase & {
  type: "column_values";
  value: {
    [groupBy: string]: ValuesForColumns;
  };
};

export type RasterBandStats = {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  range: number;
  /**
   * [value, count]. Note that histogram length will be restricted to a maximum
   * number of entries, so not every value will be represented, though the
   * overall distribution will be preserved.
   */
  histogram: [number, number][];
  // count of no-data and invalid values
  invalid: number;
  sum: number;
  /** The [xVrm, yVrm] virtual-resampling factor applied during this calculation,
   *  or null when VRM was disabled. Stored for diagnostic/audit purposes. */
  vrm?: [number, number] | null;
  /** The EPSG code of the source raster. Stored for diagnostic/audit purposes. */
  epsg?: number;
};

/**
 * It is important to note that results could be spread across multiple
 * fragments, and multiple sketches in a collection. Clients will need to
 * combine these statistics in a thoughtful way, such as weighing mean values by
 * count.
 */
export type RasterStats = OverlayMetricBase & {
  type: "raster_stats";
  value: {
    /**
     * Note that if there is no overlap with raster pixels, bands will be empty.
     */
    bands: RasterBandStats[];
  };
};

export type DistanceToShoreMetric = OverlayMetricBase & {
  type: "distance_to_shore";
  value: {
    meters: number;
    geojsonLine: Feature<LineString>;
    // rings: string[][];
  };
};

/**
 * Per-class area totals in km² for {@link RasterOverlayAreaMetric}.
 * - `"*"` = all valid pixels in the subject (nodata already excluded by geoblaze).
 * - When `dependency.parameters.groupBy === "value"`, additional keys are
 *   `String(Math.round(pixelValue))` for each distinct value present.
 */
export type RasterOverlayAreaAreas = {
  [classKey: string]: number;
};

/**
 * Fragment-only metadata when `bufferDistanceKm > 0` on a fragment subject.
 * Aggregate-only (no oidx): rasters have no feature identity.
 *
 * Geometry fact (same as overlay_area): for disjoint fragments A,B,
 * `buffer(A,d) ∩ buffer(B,d) ⊆ collar(A)`. Buffered interiors are pairwise
 * disjoint; only collar pixels can double-count.
 *
 * Identity: `areas[k] === innerAreas[k] + collarAreas[k]` (within float error).
 */
export type RasterOverlayAreaOverlapInfo = {
  bufferKm: number;
  /** Bounding box of the buffered subject (WGS84). */
  bbox: [number, number, number, number];
  /** Geodesic area of `bbox` as a polygon (km²). Used for overlap intensity. */
  bboxAreaKm2: number;
  /** Per-class area (km²) inside the collar. */
  collarAreas: RasterOverlayAreaAreas;
  /** Per-class area (km²) inside the eroded interior (= areas − collar). */
  innerAreas: RasterOverlayAreaAreas;
};

/**
 * One source-positive buffered pair that contributes to uncertainty.
 * "Source-positive" = both collars have habitat for at least one class
 * (bbox-only overlap with empty collars is ignored).
 */
export type RasterOverlayAreaOverlapPair = {
  /**
   * Fragment identity / sketch ids are OPTIONAL because
   * combineMetricsForFragments only receives `Pick<Metric, "type" | "value">`.
   * The engine combine fills pair indexes + numbers; a separate helper
   * ({@link attachRasterOverlayAreaOverlapScope}) is called client-side with
   * full metrics (subjects) to fill hashes/sketch ids for tooltips.
   */
  fragmentHashA?: string;
  fragmentHashB?: string;
  /** Sketch ids from each fragment subject (for collection tooltips). */
  sketchIdsA?: number[];
  sketchIdsB?: number[];
  /** Indexes into the combined fragment array (stable across combine). */
  indexA: number;
  indexB: number;
  /** Geodesic area (km²) of bboxA ∩ bboxB. */
  bboxOverlapKm2: number;
  /**
   * λ = bboxOverlapKm2 / min(bboxAreaA, bboxAreaB), clamped to [0, 1].
   * Fraction of the smaller buffered bbox that overlaps the other.
   */
  overlapIntensity: number;
  perClass: {
    [classKey: string]: {
      collarA: number;
      collarB: number;
      /** U = min(collarA, collarB) — hard geometric ceiling for this pair. */
      hardMax: number;
      /**
       * Ê = min(U, I × √(ρA·ρB)) where I = bboxOverlapKm2 and
       * ρX = collarX / bboxAreaKm2_X — uniform collar-habitat density
       * estimate of habitat inside the bbox intersection, capped at U.
       */
      estimate: number;
    };
  };
};

/**
 * Combine-time result. Omitted entirely when there are no source-positive
 * intersecting pairs (exact sum — user must not see warnings).
 *
 * Display: shown value = naiveSum − overcountMin (= naive; min is 0).
 * Error bar: [naiveSum − overcountMax, naiveSum − overcountMin].
 * Central explainable estimate: overcountEstimate (tooltip copy).
 *
 * Warning gate (widget): show BufferedOverlapWarning-style UI only when
 * `overcountEstimate / naiveSum ≥ 10%` for that class (not merely hardMax).
 */
export type RasterOverlayAreaOverlapCombineResult = {
  flagged: boolean;
  scope?: "within-sketch" | "between-sketches" | "both";
  /** Sketches that participate in ≥1 source-positive overlapping pair. */
  partnerSketchIds?: number[];
  fragmentsInvolved?: string[];
  /** Per-pair detail for sketch-level explanatory tooltips. */
  pairs: RasterOverlayAreaOverlapPair[];
  perClass: {
    [classKey: string]: {
      /** Always 0 without pixel identity. */
      overcountMin: number;
      /** Aggregated hard ceiling (max over pairs of U, capped). */
      overcountMax: number;
      /** Aggregated proportional estimate (max over pairs of Ê, capped). */
      overcountEstimate: number;
      naiveSum: number;
      /** Σ collarAreas across fragments. */
      collarSum: number;
      /** Σ innerAreas across fragments. */
      innerSum: number;
    };
  };
};

export type RasterOverlayAreaMetricValue = {
  areas: RasterOverlayAreaAreas;
  /** Resolved VRM for this calculation, or null when disabled. Audit only. */
  vrm?: [number, number] | null;
  /** Source raster EPSG. Audit only. */
  epsg?: number;
  /**
   * Fragment rows: {@link RasterOverlayAreaOverlapInfo} when buffered.
   * Combined rows: {@link RasterOverlayAreaOverlapCombineResult} when residual
   * overcount bounds were computed. Omitted for unbuffered exact sums.
   */
  overlap?:
    | RasterOverlayAreaOverlapInfo
    | RasterOverlayAreaOverlapCombineResult;
};

export type RasterOverlayAreaMetric = OverlayMetricBase & {
  type: "raster_overlay_area";
  value: RasterOverlayAreaMetricValue;
};

export function isRasterOverlayAreaOverlapInfo(
  value: unknown,
): value is RasterOverlayAreaOverlapInfo {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.bufferKm === "number" &&
    Array.isArray(v.bbox) &&
    v.bbox.length === 4 &&
    typeof v.bboxAreaKm2 === "number" &&
    typeof v.collarAreas === "object" &&
    v.collarAreas !== null &&
    !Array.isArray(v.collarAreas) &&
    typeof v.innerAreas === "object" &&
    v.innerAreas !== null &&
    !Array.isArray(v.innerAreas)
  );
}

export function isRasterOverlayAreaOverlapCombineResult(
  value: unknown,
): value is RasterOverlayAreaOverlapCombineResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.flagged === "boolean" &&
    Array.isArray(v.pairs) &&
    typeof v.perClass === "object" &&
    v.perClass !== null &&
    !Array.isArray(v.perClass)
  );
}

export function getRasterOverlayAreaOverlapInfo(
  value: RasterOverlayAreaMetricValue | null | undefined,
): RasterOverlayAreaOverlapInfo | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return isRasterOverlayAreaOverlapInfo(value.overlap) ? value.overlap : null;
}

export function getRasterOverlayAreaOverlapCombineResult(
  value: RasterOverlayAreaMetricValue | null | undefined,
): RasterOverlayAreaOverlapCombineResult | null {
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
export function getRasterOverlayAreaDisplayedClassValue(
  value: RasterOverlayAreaMetricValue | null | undefined,
  classKey: string,
): number {
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
export function getRasterOverlayAreaClassValueRange(
  value: RasterOverlayAreaMetricValue | null | undefined,
  classKey: string,
): { low: number; high: number; naiveSum: number } | null {
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

function bboxAsPolygon(b: [number, number, number, number]): Feature<Polygon> {
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

function bboxIntersectionAreaKm2(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const minX = Math.max(a[0], b[0]);
  const minY = Math.max(a[1], b[1]);
  const maxX = Math.min(a[2], b[2]);
  const maxY = Math.min(a[3], b[3]);
  if (minX >= maxX || minY >= maxY) {
    return 0;
  }
  // Callers pass WGS84 bboxes; @turf/area is geodesic.
  return turfArea(bboxAsPolygon([minX, minY, maxX, maxY])) / 1_000_000;
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
export function combineRasterOverlayAreaMetrics(
  values: RasterOverlayAreaMetricValue[],
): RasterOverlayAreaMetricValue {
  const empty: RasterOverlayAreaMetricValue = { areas: { "*": 0 } };
  if (values.length === 0) {
    return empty;
  }

  const areas: RasterOverlayAreaAreas = {};
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

  const result: RasterOverlayAreaMetricValue = { areas };

  if (values.length <= 1) {
    return result;
  }

  const overlapInfos = values.map((v) => getRasterOverlayAreaOverlapInfo(v));
  const usableIndexes: number[] = [];
  for (let i = 0; i < overlapInfos.length; i++) {
    if (overlapInfos[i]) {
      usableIndexes.push(i);
    }
  }
  if (usableIndexes.length < 2) {
    return result;
  }

  type PairWork = {
    indexA: number;
    indexB: number;
    bboxOverlapKm2: number;
    overlapIntensity: number;
    perClass: RasterOverlayAreaOverlapPair["perClass"];
  };
  const sourcePositivePairs: PairWork[] = [];

  for (let a = 0; a < usableIndexes.length; a++) {
    for (let b = a + 1; b < usableIndexes.length; b++) {
      const ia = usableIndexes[a];
      const ib = usableIndexes[b];
      const infoA = overlapInfos[ia]!;
      const infoB = overlapInfos[ib]!;
      if (!bboxesIntersect(infoA.bbox, infoB.bbox)) {
        continue;
      }
      const bboxOverlapKm2 = bboxIntersectionAreaKm2(infoA.bbox, infoB.bbox);
      if (bboxOverlapKm2 <= 0) {
        continue;
      }
      const denom = Math.min(infoA.bboxAreaKm2, infoB.bboxAreaKm2);
      const lambda =
        denom > 0 ? Math.max(0, Math.min(1, bboxOverlapKm2 / denom)) : 0;
      const bboxAreaA = infoA.bboxAreaKm2;
      const bboxAreaB = infoB.bboxAreaKm2;

      const classKeys = new Set([
        ...Object.keys(infoA.collarAreas),
        ...Object.keys(infoB.collarAreas),
      ]);
      const perClass: RasterOverlayAreaOverlapPair["perClass"] = {};
      let sourcePositive = false;
      for (const k of classKeys) {
        const collarA = infoA.collarAreas[k] ?? 0;
        const collarB = infoB.collarAreas[k] ?? 0;
        if (
          collarA <= RASTER_OVERLAY_AREA_COLLAR_EPS_KM2 ||
          collarB <= RASTER_OVERLAY_AREA_COLLAR_EPS_KM2
        ) {
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
        const estimate =
          bboxAreaA > 0 && bboxAreaB > 0
            ? Math.min(
                hardMax,
                bboxOverlapKm2 *
                  Math.sqrt((collarA / bboxAreaA) * (collarB / bboxAreaB)),
              )
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

  const allClassKeys = new Set<string>(Object.keys(areas));
  for (const idx of usableIndexes) {
    for (const k of Object.keys(overlapInfos[idx]!.collarAreas)) {
      allClassKeys.add(k);
    }
    for (const k of Object.keys(overlapInfos[idx]!.innerAreas)) {
      allClassKeys.add(k);
    }
  }

  const perClass: RasterOverlayAreaOverlapCombineResult["perClass"] = {};
  let flagged = false;

  for (const classKey of allClassKeys) {
    const naiveSum = areas[classKey] ?? 0;
    let collarSum = 0;
    let innerSum = 0;
    for (const idx of usableIndexes) {
      collarSum += overlapInfos[idx]!.collarAreas[classKey] ?? 0;
      innerSum += overlapInfos[idx]!.innerAreas[classKey] ?? 0;
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
export function attachRasterOverlayAreaOverlapScope(
  combined: Pick<RasterOverlayAreaMetric, "type" | "value">,
  fragmentMetrics: { type?: string | null; subject?: unknown }[],
): Pick<RasterOverlayAreaMetric, "type" | "value"> {
  if (combined.type !== "raster_overlay_area") {
    return combined;
  }
  const combine = getRasterOverlayAreaOverlapCombineResult(combined.value);
  if (!combine) {
    return combined;
  }

  const subjects = fragmentMetrics.map((m) =>
    subjectIsFragment(m.subject) ? m.subject : null,
  );

  const pairs: RasterOverlayAreaOverlapPair[] = combine.pairs.map((p) => {
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

  const partnerSketchIds = new Set<number>();
  const fragmentsInvolved = new Set<string>();
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

  let scope: RasterOverlayAreaOverlapCombineResult["scope"];
  if (within && between) {
    scope = "both";
  } else if (within) {
    scope = "within-sketch";
  } else if (between) {
    scope = "between-sketches";
  }

  const enriched: RasterOverlayAreaOverlapCombineResult = {
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
export const OUS_DEMOGRAPHICS_REQUIRED_COLUMNS = [
  "response_id",
  "participants",
  "represented_in_sector",
  "sector",
] as const;

/** Default `groupBy` column for new `ous_demographics` dependencies. */
export const OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY = "sector";

/**
 * Group key under which respondent-level rollups are stored on
 * {@link OusDemographicsMetricValue}. A respondent's rollup value is the
 * clamped max of `represented_in_sector` across all of their shapes in any
 * group — i.e. "people represented by this response, in any sector".
 */
export const OUS_DEMOGRAPHICS_ROLLUP_KEY = "*";

/**
 * Per-respondent contribution retained on `ous_demographics` metric values.
 * Keeping respondent-level detail (rather than pre-summed group totals) lets
 * fragment metrics be combined without double counting: a survey shape that
 * straddles a fragment boundary appears in both fragments' metrics under the
 * same `responseId`, and combining takes the max rather than the sum.
 */
export type OusDemographicsRespondentValue = {
  /**
   * People represented in this group by this respondent, already clamped to
   * `min(max(represented_in_sector across shapes in group), participants)`.
   */
  representedInSector: number;
  /** Response-level participant count (constant across a response's shapes). */
  participants: number;
};

export type OusDemographicsGroupRespondents = {
  [responseId: string]: OusDemographicsRespondentValue;
};

/**
 * Dataset-wide totals for one group, computed from every feature in the
 * source (not just those intersecting the subject). Identical on every
 * fragment metric calculated for the same source + groupBy, and used by
 * report widgets as the "Total People Represented In Survey" column and
 * percentage denominators — geographies play no role in this metric.
 */
export type OusDemographicsGroupTotals = {
  /** Sum of clamped `representedInSector` over all respondents in the group. */
  representedInSector: number;
  /** Sum of `participants`, counted once per respondent in the group. */
  participants: number;
  /** Number of distinct respondents with at least one shape in the group. */
  respondents: number;
};

export type OusDemographicsMetricValue = {
  /**
   * Respondents with at least one shape intersecting the subject, per group
   * key (e.g. "Fishing", "Trolling", "Lausake"), plus the
   * {@link OUS_DEMOGRAPHICS_ROLLUP_KEY} rollup across all groups.
   */
  groups: {
    [groupKey: string]: OusDemographicsGroupRespondents;
  };
  /** Dataset-level totals per group key (plus the rollup key). */
  totals: {
    [groupKey: string]: OusDemographicsGroupTotals;
  };
};

/**
 * Ocean Use Survey demographics metric. Answers "how many people does this
 * plan affect, per sector / gear type / village?" for survey datasets that
 * carry {@link OUS_DEMOGRAPHICS_REQUIRED_COLUMNS}. Calculated for fragment
 * subjects only.
 */
export type OusDemographicsMetric = OverlayMetricBase & {
  type: "ous_demographics";
  value: OusDemographicsMetricValue;
};

/**
 * Within-plan summary for one group, derived from combined fragment metrics
 * via {@link summarizeOusDemographicsValue}.
 */
export type OusDemographicsGroupSummary = {
  /** "People Using Ocean Within Plan": sum of clamped per-respondent values. */
  representedInSector: number;
  /** Sum of `participants` (once per respondent) for within-plan respondents. */
  participants: number;
  /** Distinct respondents with at least one shape intersecting the subject. */
  respondents: number;
};

/**
 * Sums per-respondent contributions into within-plan group summaries.
 * Row keys should come from `value.totals` (so groups with zero within-plan
 * respondents still render); this helper only summarizes `value.groups`.
 */
export function summarizeOusDemographicsValue(
  value: OusDemographicsMetricValue | null | undefined,
): { [groupKey: string]: OusDemographicsGroupSummary } {
  const result: { [groupKey: string]: OusDemographicsGroupSummary } = {};
  if (!value || typeof value !== "object" || !value.groups) {
    return result;
  }
  for (const groupKey of Object.keys(value.groups)) {
    const respondents = value.groups[groupKey];
    const summary: OusDemographicsGroupSummary = {
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
export function combineOusDemographicsMetrics(
  values: OusDemographicsMetricValue[],
): OusDemographicsMetricValue {
  const combined: OusDemographicsMetricValue = { groups: {}, totals: {} };
  for (const value of values) {
    if (!value || typeof value !== "object") {
      continue;
    }
    if (
      Object.keys(combined.totals).length === 0 &&
      value.totals &&
      typeof value.totals === "object"
    ) {
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
        if (
          !entry ||
          typeof entry !== "object" ||
          !Number.isFinite(entry.representedInSector) ||
          !Number.isFinite(entry.participants)
        ) {
          continue;
        }
        const existing = target[responseId];
        if (!existing) {
          target[responseId] = {
            representedInSector: entry.representedInSector,
            participants: entry.participants,
          };
        } else {
          existing.representedInSector = Math.max(
            existing.representedInSector,
            entry.representedInSector,
          );
          existing.participants = Math.max(
            existing.participants,
            entry.participants,
          );
        }
      }
    }
  }
  return combined;
}

export type Metric =
  | TotalAreaMetric
  | OverlayAreaMetric
  | CountMetric
  | PresenceMetric
  | PresenceTableMetric
  | ColumnValuesMetric
  | RasterStats
  | DistanceToShoreMetric
  | RasterOverlayAreaMetric
  | OusDemographicsMetric;

export type MetricTypeMap = {
  total_area: TotalAreaMetric;
  overlay_area: OverlayAreaMetric;
  count: CountMetric;
  presence: PresenceMetric;
  presence_table: PresenceTableMetric;
  column_values: ColumnValuesMetric;
  raster_stats: RasterStats;
  distance_to_shore: DistanceToShoreMetric;
  raster_overlay_area: RasterOverlayAreaMetric;
  ous_demographics: OusDemographicsMetric;
};

export function subjectIsFragment(
  subject: any | MetricSubjectFragment | MetricSubjectGeography,
): subject is MetricSubjectFragment {
  return subject != null && typeof subject === "object" && "hash" in subject;
}

export function subjectIsGeography(
  subject: any | MetricSubjectFragment | MetricSubjectGeography,
): subject is MetricSubjectGeography {
  return subject != null && typeof subject === "object" && "id" in subject;
}

export type SourceType = "FlatGeobuf" | "GeoJSON" | "GeoTIFF";

function equalIntervalBuckets(
  data: number[],
  numBuckets: number,
  max?: number,
  fraction = false,
): [number, number | null][] {
  const breaks = equalIntervalBreaks(data, numBuckets);
  breaks.pop();

  max = max !== undefined ? max : Math.max(...data);

  return breaksToBuckets(max, breaks, data, fraction);
}

function breaksToBuckets(
  max: number,
  breaks: number[],
  values: number[],
  fraction = false,
): [number, number | null][] {
  const buckets: [number, number | null][] = [];
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
export function combineRasterBandStats(
  statsArray: RasterBandStats[],
): RasterBandStats {
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
  const mins: number[] = [];
  const maxs: number[] = [];
  // All fragments of the same raster_stats metric share an epsg; pick the
  // first non-null value we encounter so it is preserved through combination.
  let combinedEpsg: number | undefined = undefined;

  // Merge histograms by value
  const histogramMap = new Map<number, number>();

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
  const rawCombinedHistogram: [number, number][] = Array.from(
    histogramMap.entries(),
  )
    .map(([value, count]) => [value, count] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const combinedHistogram = downsampleColumnHistogram(
    rawCombinedHistogram,
    200,
  );

  // Calculate combined mean using sum / valid-pixel count (not average of
  // means). Note `count` includes invalid (nodata) pixels — per-band means
  // are sum / (count - invalid), so the combined mean must use the same
  // denominator or fragments containing nodata pixels will dilute it,
  // potentially below the combined min.
  const totalValid = Math.max(0, totalCount - totalInvalid);
  const combinedMean = totalValid > 0 ? totalSum / totalValid : NaN;

  // Calculate combined range
  const combinedMin = mins.length > 0 ? min(mins) : NaN;
  const combinedMax = maxs.length > 0 ? max(maxs) : NaN;
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
export function capColumnValueEntries(entries: ColumnValuesEntry[]): {
  entries: ColumnValuesEntry[] | undefined;
  entriesTruncated: boolean;
} {
  if (entries.length <= MAX_COLUMN_VALUE_ENTRIES) {
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
export function numberColumnStatsFromEntries(
  entries: ColumnValuesEntry[],
): NumberColumnValueStats {
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

  const histogramMap = new Map<number, number>();
  const distinctValues = new Set<number>();

  for (const entry of entries) {
    const value = entry.value;
    if (typeof value !== "number") {
      continue;
    }
    distinctValues.add(value);
    const weight = entry.weight;

    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;

    sum += value;
    if (isFinite(weight) && weight > 0 && isFinite(value)) {
      weightedSum += value * weight;
      totalWeight += weight;
    }

    const histogramContribution = isFinite(weight) && weight > 0 ? weight : 1;
    histogramMap.set(
      value,
      (histogramMap.get(value) || 0) + histogramContribution,
    );
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
  } else {
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

  let histogram: [number, number][] = Array.from(histogramMap.entries()).sort(
    (a, b) => a[0] - b[0],
  );
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
function statsTotalWeight(stats: NumberColumnValueStats): number | undefined {
  return typeof stats.totalWeight === "number"
    ? stats.totalWeight
    : stats.totalAreaSqKm;
}

/**
 * Computes StringOrBooleanColumnValueStats from per-feature entries.
 */
export function stringOrBooleanColumnStatsFromEntries(
  entries: ColumnValuesEntry[],
): StringOrBooleanColumnValueStats {
  const distinctMap = new Map<string | boolean, number>();
  let sawBoolean = false;
  let sawString = false;
  for (const entry of entries) {
    const value = entry.value;
    if (typeof value !== "string" && typeof value !== "boolean") {
      continue;
    }
    if (typeof value === "boolean") {
      sawBoolean = true;
    } else {
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
function mergeColumnValueEntries(
  statsArray: { entries?: ColumnValuesEntry[] }[],
): { entries: ColumnValuesEntry[]; sharedOffsets: boolean } {
  const byId = new Map<number, ColumnValuesEntry>();
  const seenOffsets = new Set<number>();
  let sharedOffsets = false;

  for (const stats of statsArray) {
    const offsetsInThisFragment = new Set<number>();
    for (const entry of stats.entries ?? []) {
      const existing = byId.get(entry.id);
      if (existing) {
        existing.weight += entry.weight;
        for (const offset of entry.offsets) {
          if (!existing.offsets.includes(offset)) {
            existing.offsets.push(offset);
          }
        }
      } else {
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
export function combineNumberColumnValueStats(
  statsArray: NumberColumnValueStats[],
): NumberColumnValueStats | undefined {
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
  const mins: number[] = [];
  const maxs: number[] = [];

  // For variance/stdDev combination we use:
  // E[x^2] = variance + mean^2, aggregated with the same weights as for the mean
  let weightedMeanNumerator = 0;
  let weightedSecondMoment = 0;

  // Merge histograms by value
  const histogramMap = new Map<number | string | boolean, number>();

  for (const stats of statsArray) {
    const statsWeight = statsTotalWeight(stats);
    const weight =
      useOverlapWeight && typeof statsWeight === "number"
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

  const combinedMin = mins.length > 0 ? min(mins) : NaN;
  const combinedMax = maxs.length > 0 ? max(maxs) : NaN;

  let combinedMean = NaN;
  let combinedStdDev = NaN;

  if (totalWeight > 0 && weightedMeanNumerator !== 0) {
    combinedMean = weightedMeanNumerator / totalWeight;
    if (weightedSecondMoment !== 0) {
      const meanSquare = weightedSecondMoment / totalWeight;
      const variance = meanSquare - combinedMean * combinedMean;
      combinedStdDev = Math.sqrt(Math.max(variance, 0));
    }
  } else if (combinedCount > 0) {
    combinedMean = combinedSum / combinedCount;
    // stdDev cannot be reliably combined without additional information; leave as NaN
  }

  // Convert histogram map back to array and sort by value
  let combinedHistogram: [number, number][] = Array.from(histogramMap.entries())
    .map(([value, count]) => [value, count] as [number, number])
    .sort((a, b) => {
      if (typeof a[0] === "number" && typeof b[0] === "number") {
        return a[0] - b[0];
      } else {
        return 0;
      }
    });

  // Limit histogram size similarly to raster stats by downsampling
  const MAX_HISTOGRAM_ENTRIES = 200;
  if (combinedHistogram.length > MAX_HISTOGRAM_ENTRIES) {
    combinedHistogram = downsampleColumnHistogram(
      combinedHistogram as [number, number][],
      MAX_HISTOGRAM_ENTRIES,
    );
  }

  const combinedTotalWeight = useOverlapWeight
    ? statsArray.reduce((acc, s) => {
        const weight = statsTotalWeight(s);
        return acc + (typeof weight === "number" && weight > 0 ? weight : 0);
      }, 0)
    : undefined;

  const result: NumberColumnValueStats = {
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

export function combineStringOrBooleanColumnValueStats(
  statsArray: StringOrBooleanColumnValueStats[],
): StringOrBooleanColumnValueStats | undefined {
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

  const distinctValues: [string | boolean, number][] = [];
  for (const stats of statsArray) {
    for (const record of stats.distinctValues) {
      const value = record[0];
      const count = record[1];
      const existing = distinctValues.find(([v]) => v === value);
      if (existing) {
        existing[1] += count;
      } else {
        distinctValues.push([value, count]);
      }
    }
  }

  const outputType = statsArray[0]?.type === "boolean" ? "boolean" : "string";

  const result: StringOrBooleanColumnValueStats = {
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

export type MetricDependencySubjectType = "fragments" | "geographies";

export type MetricDependency = {
  type: MetricType;
  subjectType: MetricDependencySubjectType;
  stableId?: string;
  parameters?: MetricDependencyParameters;
};

export type MetricDependencyParameters = {
  /**
   * Vector metrics: attribute name to group by (e.g. "class" for overlay_area).
   *
   * `raster_overlay_area`: set to `"value"` to group by rounded pixel value;
   * omit for a single `"*"` total only. Slash commands only offer grouping when
   * `RasterInfo.presentation` is categorical.
   */
  groupBy?: string;
  /**
   * Columns to include in the metric results.
   *
   * For `column_values`, when set to a non-empty list only those columns are
   * collected (in a single spatial pass), and per-feature records (`entries`)
   * are retained on each so statistics can be combined exactly across
   * fragments. When unset, all columns are collected without entries (legacy /
   * unscoped behavior).
   *
   * Also used by `presence_table` to limit which feature properties are
   * returned in the table.
   */
  includedColumns?: string[];
  /**
   * @deprecated Use {@link includedColumns}. Unused by current report widgets;
   * kept for wire/schema compatibility with older clients.
   */
  valueColumn?: string;
  /**
   * Buffer distance (km) around the subject. Used by `overlay_area`,
   * `column_values`, `count`, `presence*`, and `raster_overlay_area`.
   *
   * For `raster_overlay_area` on fragment subjects, enables collar overlap
   * metadata ({@link RasterOverlayAreaOverlapInfo}). Geography subjects never
   * attach overlap metadata (same gate as `overlay_area`).
   *
   * @default undefined
   */
  bufferDistanceKm?: number;
  /**
   * The maxResults parameter is used to specify the maximum number of results to return.
   * This is used to limit the number of results returned by the metric.
   *
   * @default undefined
   */
  maxResults?: number;
  maxDistanceKm?: number;
  /**
   * If all polygon features in a source are orthogonal (e.g. habitat
   * classification), the overlay-engine can use optimizations to speed up
   * clipping dramatically. However, if the source has overlapping features,
   * this would produce inaccurate results.
   *
   * @default false
   */
  sourceHasOverlappingFeatures?: boolean;
  /**
   * Virtual resampling for `raster_stats` and `raster_overlay_area`.
   * If "auto", determined from ground sample distance of the raster.
   * If false, disabled (effective factor 1 / null).
   * If a number, applied as `[n, n]`.
   *
   * @default "auto" for fragment subjects, false for geography subjects
   */
  vrm?: false | "auto" | number;
  /**
   * If provided, and metrics are being calculated for a Collection, limit
   * metrics to fragments that belong to the specified sketch classes. If not
   * provided, all fragments will be included.
   *
   * @default undefined
   */
  sketchClasses?: number[];
};

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
export function hashMetricDependency(
  dependency: MetricDependency,
  overlaySourceUrls: { [stableId: string]: string },
): string {
  if (dependency.stableId && overlaySourceUrls[dependency.stableId]) {
    if (!overlaySourceUrls[dependency.stableId]) {
      throw new Error(
        `Hashing Error. Overlay source URL not found for stable id: ${dependency.stableId}`,
      );
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
function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const isStringArray = value.every((item) => typeof item === "string");
    const normalized = isStringArray ? [...value].sort() : value;
    return `[${normalized.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const entries = Object.keys(value)
    .filter(
      (key) =>
        (value as any)[key] !== undefined &&
        key !== "hash" &&
        key !== "__typename",
    )
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableSerialize((value as any)[key])}`,
    );

  return `{${entries.join(",")}}`;
}

/**
 * Fast, cross-environment 32-bit FNV-1a hash. Returns an 8-char hex string.
 */
function fnv1a(input: string): string {
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
export function combineMetricsForFragments<T extends Metric>(
  metrics: Pick<Metric, "type" | "value">[],
  expectedMetricType?: Metric["type"],
): Pick<T, "type" | "value"> {
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
    } else {
      throw new Error("Cannot combine empty array of metrics");
    }
  }
  // first, ensure that all metrics have the same type
  const types = new Set(metrics.map((m) => m.type));
  if (types.size > 1) {
    throw new Error(
      `All metrics must have the same type. Found types: ${Array.from(
        types,
      ).join(", ")}`,
    );
  }
  const type = Array.from(types)[0];
  // then, combine the values
  switch (type) {
    case "raster_stats": {
      for (const metric of metrics as RasterStats[]) {
        if (metric.value.bands.length > 1) {
          throw new Error("Multiple bands are not supported for raster_stats");
        }
      }
      const values = metrics.map(
        (m) => (m.value as RasterStats["value"]).bands[0],
      );
      return {
        type: "raster_stats",
        value: {
          bands: [combineRasterBandStats(values)],
        },
      };
    }
    case "column_values": {
      const values = metrics.map((m) => m.value as ColumnValuesMetric["value"]);
      return {
        type: "column_values",
        value: combineGroupedValues(values, (groupedValues) => {
          const stats: ValuesForColumns = {};
          const attrNames = new Set<string>();

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
              .filter(
                (
                  v,
                ): v is
                  | StringOrBooleanColumnValueStats
                  | NumberColumnValueStats => v !== undefined,
              );

            if (attrValues.length === 0) continue;

            if (isNumberColumnValueStats(attrValues[0])) {
              const combined = combineNumberColumnValueStats(
                attrValues as NumberColumnValueStats[],
              );
              if (combined) {
                stats[attr] = combined;
              }
            } else {
              const combined = combineStringOrBooleanColumnValueStats(
                attrValues as StringOrBooleanColumnValueStats[],
              );
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
      const values = metrics.map((m) => m.value as TotalAreaMetric["value"]);
      return {
        type: "total_area",
        value: values.reduce((acc, v) => acc + v, 0),
      };
    }
    case "count": {
      const values = metrics.map((m) => m.value as CountMetric["value"]);
      return {
        type: "count",
        value: combineGroupedValues(values, (value) => {
          const mergedIndexes = mergeUniqueIdIndexes(
            ...value.map((v) => v.uniqueIdIndex),
          );
          const count = countUniqueIds(mergedIndexes);
          return {
            count,
            uniqueIdIndex: mergedIndexes,
          };
        }),
      };
    }
    case "distance_to_shore": {
      const values = metrics.map(
        (m) => m.value as DistanceToShoreMetric["value"],
      );
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
      const values = metrics.map((m) => m.value as PresenceMetric["value"]);
      return {
        type: "presence",
        value: values.some((v) => v),
      };
    }
    case "presence_table": {
      const values = metrics.map(
        (m) => m.value as PresenceTableMetric["value"],
      );
      const exceededLimit = values.some((v) => v.exceededLimit);
      const features: PresenceTableValue[] = [];
      const ids = new Set<number>();
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
      const values = metrics.map((m) => m.value as OverlayAreaMetricValue);
      return {
        type: "overlay_area",
        value: combineOverlayAreaMetrics(values),
      };
    }
    case "raster_overlay_area": {
      const values = metrics.map(
        (m) => m.value as RasterOverlayAreaMetricValue,
      );
      return {
        type: "raster_overlay_area",
        value: combineRasterOverlayAreaMetrics(values),
      };
    }
    case "ous_demographics": {
      const values = metrics.map(
        (m) => m.value as OusDemographicsMetricValue,
      );
      return {
        type: "ous_demographics",
        value: combineOusDemographicsMetrics(values),
      };
    }
    default:
      throw new Error(`Unsupported metric type: ${type}`);
  }
}

function combineGroupedValues<T>(
  values: { [groupBy: string]: T }[],
  combineFn: (values: T[]) => T,
): { [groupBy: string]: T } {
  const result: { [groupBy: string]: T } = {};
  const keys = new Set<string>();
  for (const value of values) {
    if (typeof value === "object" && value !== null) {
      for (const key in value) {
        // Skip reserved metadata keys (e.g. overlay_area `__overlap`).
        if (typeof key === "string" && !key.startsWith("__")) {
          keys.add(key);
        }
      }
    } else {
      throw new Error("Value is not a grouped object");
    }
  }
  for (const key of keys) {
    const groupValues = values
      .map((v: any) => v[key])
      .filter((v): v is T => v !== undefined);
    if (groupValues.length > 0) {
      result[key] = combineFn(groupValues);
    }
  }
  return result;
}

// /**
//  * Finds the primary geography id from a list of metrics. The primary
//  * geography is the one that is in all fragments.
//  * @param metrics - The metrics to find the primary geography id from
//  * @returns The primary geography id
//  */
// export function findPrimaryGeographyId(
//   metrics: Pick<Metric, "type" | "value" | "subject">[],
// ): number {
//   console.log("findPrimaryGeographyId", metrics);
//   const foundGeographyIds: { [geographyId: number]: number } = {};
//   const fragmentMetrics = metrics.filter((m) => subjectIsFragment(m.subject));
//   for (const metric of fragmentMetrics) {
//     const fragmentSubject = metric.subject as MetricSubjectFragment;
//     for (const geographyId of fragmentSubject.geographies) {
//       if (geographyId in foundGeographyIds) {
//         foundGeographyIds[geographyId]++;
//       } else {
//         foundGeographyIds[geographyId] = 1;
//       }
//     }
//   }
//   // find the primary geography id by determining which is in all fragments
//   let primaryGeographyId: number | null = null;
//   for (const geographyId in foundGeographyIds) {
//     if (foundGeographyIds[geographyId] === fragmentMetrics.length) {
//       if (primaryGeographyId !== null) {
//         throw new Error("Multiple primary geography ids found.");
//       }
//       primaryGeographyId = Number(geographyId);
//       break;
//     }
//   }
//   if (primaryGeographyId === null) {
//     throw new Error("No primary geography id found.");
//   }
//   return primaryGeographyId;
// }

type ProsemirrorNode = {
  type: string;
  attrs?: Record<string, any>;
  content?: ProsemirrorNode[];
};

export function extractMetricDependenciesFromReportBody(
  node: ProsemirrorNode,
  dependencies: MetricDependency[] = [],
) {
  if (typeof node !== "object" || node === null || !node.type) {
    throw new Error("Invalid node");
  }
  if (
    (node.type === "metric" || node.type === "blockMetric") &&
    node.attrs?.metrics
  ) {
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
