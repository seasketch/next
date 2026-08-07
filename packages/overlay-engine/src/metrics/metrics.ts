import { Feature, LineString } from "geojson";
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
  | "distance_to_shore";

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

export type OverlayAreaMetric = OverlayMetricBase & {
  type: "overlay_area";
  value: {
    [groupBy: string]: number;
  };
};

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

export type Metric =
  | TotalAreaMetric
  | OverlayAreaMetric
  | CountMetric
  | PresenceMetric
  | PresenceTableMetric
  | ColumnValuesMetric
  | RasterStats
  | DistanceToShoreMetric;

export type MetricTypeMap = {
  total_area: TotalAreaMetric;
  overlay_area: OverlayAreaMetric;
  count: CountMetric;
  presence: PresenceMetric;
  presence_table: PresenceTableMetric;
  column_values: ColumnValuesMetric;
  raster_stats: RasterStats;
  distance_to_shore: DistanceToShoreMetric;
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
    totalCount += stats.count;
    if (isFinite(stats.sum)) {
      totalSum += stats.sum;
    }
    totalInvalid += stats.invalid;
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

  // Calculate combined mean using sum/count (not average of means)
  const combinedMean = totalCount > 0 ? totalSum / totalCount : NaN;

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
      if (
        typeof value !== "number" ||
        !isFinite(weight) ||
        weight <= 0
      ) {
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
   * The groupBy parameter is used to group the results of the metric by a
   * specific attribute. For example, if the metric is "overlay_area", the
   * results can be grouped by the "class" attribute.
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
   * The bufferDistanceKm parameter is used to specify the buffer distance in kilometers around the subject.
   * This is used to exclude features that are outside the buffer distance from the subject.
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
   * The vrm parameter is used to specify the virtual resampling factor to use for raster_stats metrics.
   * If "auto", the virtual resampling factor will be determined automatically based on the ground sample distance of the raster.
   * If false, the virtual resampling factor will be set to 1.
   * If a number, the virtual resampling factor will be set to the number.
   *
   * @default "auto" for fragment stats, false for geography stats
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
      const values = metrics.map((m) => m.value as OverlayAreaMetric["value"]);
      return {
        type: "overlay_area",
        value: combineGroupedValues(values, (v) =>
          v.reduce((acc, v) => acc + v, 0),
        ),
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
        if (typeof key === "string") {
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
