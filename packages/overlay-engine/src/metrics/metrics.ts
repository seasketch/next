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
  | "raster_stats";

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
 * The first number is the feature __oidx, the second is the value
 */
export type IdentifiedValues = [number, number];

export type ColumnValuesMetric = OverlayMetricBase & {
  type: "column_values";
  value: {
    [groupBy: string]: IdentifiedValues[];
  };
};

export type RasterBandStats = {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  mode: number;
  modes: number[];
  range: number;
  histogram: [number, number | null][];
  // count of no-data and invalid values
  invalid: number;
  std: number;
  sum: number;
};

export type RasterStats = OverlayMetricBase & {
  type: "raster_stats";
  value: { bands: RasterBandStats[] };
};

export type Metric =
  | TotalAreaMetric
  | OverlayAreaMetric
  | CountMetric
  | PresenceMetric
  | PresenceTableMetric
  | ColumnValuesMetric
  | RasterStats;

export type MetricTypeMap = {
  total_area: TotalAreaMetric;
  overlay_area: OverlayAreaMetric;
  count: CountMetric;
  presence: PresenceMetric;
  presence_table: PresenceTableMetric;
  column_values: ColumnValuesMetric;
  raster_stats: RasterStats;
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

/**
 * Computes statistics from a list of IdentifiedValues. This function can be used
 * both server-side and client-side to calculate accurate statistics for overlapping
 * fragments and multiple sketches in a collection by de-duplicating based on __oidx.
 */
export function computeStatsFromIdentifiedValues(
  identifiedValues: IdentifiedValues[]
): {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  histogram: [number, number | null][];
  count: number;
  countDistinct: number;
  values: number[];
} {
  // De-duplicate by __oidx (first element of tuple), keeping the first occurrence
  const uniqueMap = new Map<number, number>();
  for (const [oidx, value] of identifiedValues) {
    if (!uniqueMap.has(oidx)) {
      uniqueMap.set(oidx, value);
    }
  }

  const values = Array.from(uniqueMap.values());

  if (values.length === 0) {
    return {
      min: Infinity,
      max: -Infinity,
      mean: NaN,
      median: NaN,
      stdDev: NaN,
      histogram: [],
      count: 0,
      countDistinct: 0,
      values: [],
    };
  }

  const distinctValues = Array.from(new Set(values));

  return {
    min: min(values),
    max: max(values),
    mean: mean(values),
    median: median(values),
    stdDev: standardDeviation(values),
    histogram: equalIntervalBuckets(values, 49),
    count: values.length,
    countDistinct: distinctValues.length,
    values: Array.from(distinctValues).slice(0, 100),
  };
}

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
