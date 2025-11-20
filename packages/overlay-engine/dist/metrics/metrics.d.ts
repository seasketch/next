export type MetricType = "total_area" | "overlay_area" | "count" | "presence" | "presence_table" | "column_values" | "raster_stats";
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
    invalid: number;
    std: number;
    sum: number;
};
export type RasterStats = OverlayMetricBase & {
    type: "raster_stats";
    value: {
        bands: RasterBandStats[];
    };
};
export type Metric = TotalAreaMetric | OverlayAreaMetric | CountMetric | PresenceMetric | PresenceTableMetric | ColumnValuesMetric | RasterStats;
export type MetricTypeMap = {
    total_area: TotalAreaMetric;
    overlay_area: OverlayAreaMetric;
    count: CountMetric;
    presence: PresenceMetric;
    presence_table: PresenceTableMetric;
    column_values: ColumnValuesMetric;
    raster_stats: RasterStats;
};
export declare function subjectIsFragment(subject: any | MetricSubjectFragment | MetricSubjectGeography): subject is MetricSubjectFragment;
export declare function subjectIsGeography(subject: any | MetricSubjectFragment | MetricSubjectGeography): subject is MetricSubjectGeography;
export type SourceType = "FlatGeobuf" | "GeoJSON" | "GeoTIFF";
/**
 * Computes statistics from a list of IdentifiedValues. This function can be used
 * both server-side and client-side to calculate accurate statistics for overlapping
 * fragments and multiple sketches in a collection by de-duplicating based on __oidx.
 */
export declare function computeStatsFromIdentifiedValues(identifiedValues: IdentifiedValues[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    histogram: [number, number | null][];
    count: number;
    countDistinct: number;
    values: number[];
};
export {};
//# sourceMappingURL=metrics.d.ts.map