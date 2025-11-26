import { Feature, LineString } from "geojson";
import {
  min,
  max,
  mean,
  median,
  standardDeviation,
  equalIntervalBreaks,
} from "simple-statistics";

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

export type ColumnValueStats = {
  count: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  histogram: [number, number | null][];
  countDistinct: number;
  sum: number;
  /**
   * If the source layer is polygonal, includes the total area of overlapped
   * polygons in square meters. This is used to weight statistics when combining
   * across fragments.
   */
  totalAreaSqKm?: number;
};

export type ColumnValuesMetric = OverlayMetricBase & {
  type: "column_values";
  value: {
    [groupBy: string]: ColumnValueStats;
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
): RasterBandStats | undefined {
  if (statsArray.length === 0) {
    return undefined;
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
