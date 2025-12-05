import { Feature, LineString } from "geojson";
export type MetricType = "total_area" | "overlay_area" | "count" | "presence" | "presence_table" | "column_values" | "raster_stats" | "distance_to_shore";
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
    };
};
export type Metric = TotalAreaMetric | OverlayAreaMetric | CountMetric | PresenceMetric | PresenceTableMetric | ColumnValuesMetric | RasterStats | DistanceToShoreMetric;
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
export declare function subjectIsFragment(subject: any | MetricSubjectFragment | MetricSubjectGeography): subject is MetricSubjectFragment;
export declare function subjectIsGeography(subject: any | MetricSubjectFragment | MetricSubjectGeography): subject is MetricSubjectGeography;
export type SourceType = "FlatGeobuf" | "GeoJSON" | "GeoTIFF";
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
export declare function combineRasterBandStats(statsArray: RasterBandStats[]): RasterBandStats | undefined;
/**
 * Combines ColumnValueStats from multiple fragments into a single ColumnValueStats.
 * If totalAreaSqKm is available, mean and stdDev are weighted by totalAreaSqKm.
 * Otherwise, they are weighted by count.
 */
export declare function combineColumnValueStats(statsArray: ColumnValueStats[]): ColumnValueStats | undefined;
export type MetricDependencySubjectType = "fragments" | "geographies";
export type MetricDependency = {
    type: MetricType;
    subjectType: MetricDependencySubjectType;
    tableOfContentsItemId?: number;
    geographies?: number[];
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
export {};
//# sourceMappingURL=metrics.d.ts.map