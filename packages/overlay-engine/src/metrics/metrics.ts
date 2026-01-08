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
  maxEntries: number
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

export type StringOrBooleanColumnValueStats = {
  type: "string" | "boolean";
  /**
   * Distinct value ([0]) and count [1]
   */
  distinctValues: [string | boolean, number][];
  countDistinct: number;
};

export type NumberColumnValueStats = {
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
   * If the source layer is polygonal, includes the total area of overlapped
   * polygons in square meters. This is used to weight statistics when combining
   * across fragments.
   */
  totalAreaSqKm?: number;
};

export function isNumberColumnValueStats(
  stats: NumberColumnValueStats | StringOrBooleanColumnValueStats
): stats is NumberColumnValueStats {
  return stats.type === "number";
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
  subject: any | MetricSubjectFragment | MetricSubjectGeography
): subject is MetricSubjectFragment {
  return "hash" in subject;
}

export function subjectIsGeography(
  subject: any | MetricSubjectFragment | MetricSubjectGeography
): subject is MetricSubjectGeography {
  return "id" in subject;
}

export type SourceType = "FlatGeobuf" | "GeoJSON" | "GeoTIFF";

function equalIntervalBuckets(
  data: number[],
  numBuckets: number,
  max?: number,
  fraction = false
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
  fraction = false
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
 * This function correctly weights mean values by count (or equivalently, uses sum/count)
 * to produce accurate aggregate statistics when fragments have different areas.
 *
 * For example, if fragment 1 has mean=5 and count=100, and fragment 2 has mean=20 and count=25,
 * the combined mean should be (5*100 + 20*25) / (100+25) = 1000/125 = 8, not (5+20)/2 = 12.5.
 *
 * @param statsArray - Array of RasterBandStats from different fragments
 * @returns Combined RasterBandStats, or undefined if the array is empty
 */
export function combineRasterBandStats(
  statsArray: RasterBandStats[]
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

  // Merge histograms by value
  const histogramMap = new Map<number, number>();

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
  const combinedHistogram: [number, number][] = Array.from(
    histogramMap.entries()
  )
    .map(([value, count]) => [value, count] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  // Calculate combined mean using sum/count (not average of means)
  const combinedMean = totalCount > 0 ? totalSum / totalCount : NaN;

  // Calculate combined range
  const combinedMin = min(mins);
  const combinedMax = max(maxs);
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
export function combineNumberColumnValueStats(
  statsArray: NumberColumnValueStats[]
): NumberColumnValueStats | undefined {
  if (statsArray.length === 0) {
    return undefined;
  }

  if (statsArray.length === 1) {
    return statsArray[0];
  }

  // Determine whether to weight by area or by count
  const useAreaWeight = statsArray.some(
    (s) => typeof s.totalAreaSqKm === "number" && s.totalAreaSqKm > 0
  );

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
    const weight =
      useAreaWeight && typeof stats.totalAreaSqKm === "number"
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
      MAX_HISTOGRAM_ENTRIES
    );
  }

  const totalAreaSqKm = useAreaWeight
    ? statsArray.reduce(
        (acc, s) =>
          acc +
          (typeof s.totalAreaSqKm === "number" && s.totalAreaSqKm > 0
            ? s.totalAreaSqKm
            : 0),
        0
      )
    : undefined;

  return {
    type: "number",
    count: combinedCount,
    min: combinedMin,
    max: combinedMax,
    mean: combinedMean,
    stdDev: combinedStdDev,
    histogram: combinedHistogram,
    countDistinct: histogramMap.size,
    sum: combinedSum,
    totalAreaSqKm,
  };
}

export function combineStringOrBooleanColumnValueStats(
  statsArray: StringOrBooleanColumnValueStats[]
): StringOrBooleanColumnValueStats | undefined {
  if (statsArray.length === 0) {
    return undefined;
  }
  if (statsArray.length === 1) {
    return statsArray[0];
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

  return {
    type: outputType,
    distinctValues,
    countDistinct: distinctValues.length,
  };
}

export type MetricDependencySubjectType = "fragments" | "geographies";

export type MetricDependency = {
  type: MetricType;
  subjectType: MetricDependencySubjectType;
  tableOfContentsItemId?: number;
  parameters?: MetricDependencyParameters;
};

export type MetricDependencyParameters = {
  groupBy?: string;
  includedColumns?: string[];
  valueColumn?: string;
  bufferDistanceKm?: number;
  maxResults?: number;
  maxDistanceKm?: number;
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
 * @returns A unique id for the dependency
 */
export function hashMetricDependency(dependency: MetricDependency): string {
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
    .filter((key) => (value as any)[key] !== undefined && key !== "hash")
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableSerialize((value as any)[key])}`
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

export function combineMetricsForFragments(
  metrics: Pick<Metric, "type" | "value">[]
): Pick<Metric, "type" | "value"> {
  // first, ensure that all metrics have the same type
  const types = new Set(metrics.map((m) => m.type));
  if (types.size > 1) {
    throw new Error(
      `All metrics must have the same type. Found types: ${Array.from(
        types
      ).join(", ")}`
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
        (m) => (m.value as RasterStats["value"]).bands[0]
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
                  v
                ): v is
                  | StringOrBooleanColumnValueStats
                  | NumberColumnValueStats => v !== undefined
              );

            if (attrValues.length === 0) continue;

            if (isNumberColumnValueStats(attrValues[0])) {
              const combined = combineNumberColumnValueStats(
                attrValues as NumberColumnValueStats[]
              );
              if (combined) {
                stats[attr] = combined;
              }
            } else {
              const combined = combineStringOrBooleanColumnValueStats(
                attrValues as StringOrBooleanColumnValueStats[]
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
            ...value.map((v) => v.uniqueIdIndex)
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
        (m) => m.value as DistanceToShoreMetric["value"]
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
        (m) => m.value as PresenceTableMetric["value"]
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
          v.reduce((acc, v) => acc + v, 0)
        ),
      };
    }
    default:
      throw new Error(`Unsupported metric type: ${type}`);
  }
}

function combineGroupedValues<T>(
  values: { [groupBy: string]: T }[],
  combineFn: (values: T[]) => T
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

/**
 * Finds the primary geography id from a list of metrics. The primary
 * geography is the one that is in all fragments.
 * @param metrics - The metrics to find the primary geography id from
 * @returns The primary geography id
 */
export function findPrimaryGeographyId(
  metrics: Pick<Metric, "type" | "value" | "subject">[]
): number {
  const foundGeographyIds: { [geographyId: number]: number } = {};
  const fragmentMetrics = metrics.filter((m) => subjectIsFragment(m.subject));
  for (const metric of fragmentMetrics) {
    const fragmentSubject = metric.subject as MetricSubjectFragment;
    for (const geographyId of fragmentSubject.geographies) {
      if (geographyId in foundGeographyIds) {
        foundGeographyIds[geographyId]++;
      } else {
        foundGeographyIds[geographyId] = 1;
      }
    }
  }
  // find the primary geography id by determining which is in all fragments
  let primaryGeographyId: number | null = null;
  for (const geographyId in foundGeographyIds) {
    if (foundGeographyIds[geographyId] === fragmentMetrics.length) {
      if (primaryGeographyId !== null) {
        throw new Error("Multiple primary geography ids found.");
      }
      primaryGeographyId = Number(geographyId);
      break;
    }
  }
  if (primaryGeographyId === null) {
    throw new Error("No primary geography id found.");
  }
  return primaryGeographyId;
}
