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
export declare const MAX_COLUMN_VALUE_ENTRIES = 300;
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
export declare function isNumberColumnValueStats(stats: NumberColumnValueStats | StringOrBooleanColumnValueStats): stats is NumberColumnValueStats;
/**
 * Type guard for {@link ColumnValuesEntry}. Accepts untrusted input (e.g.
 * metric values deserialized from the database).
 */
export declare function isColumnValuesEntry(value: unknown): value is ColumnValuesEntry;
/**
 * Returns true if the given column stats carry a complete (untruncated) set
 * of per-feature entries which can be used to exactly combine statistics
 * across fragments.
 */
export declare function hasReliableColumnValueEntries(stats: unknown): stats is ColumnValueStatsBase & {
    entries: ColumnValuesEntry[];
};
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
 * Sums `count`, `sum`, and `invalid` across fragments; combined mean is `sum / count`.
 * Min/max are the extrema across fragments; histograms are merged and downsampled.
 *
 * @param statsArray - Array of RasterBandStats from different fragments
 * @returns Combined RasterBandStats, or undefined if the array is empty
 */
export declare function combineRasterBandStats(statsArray: RasterBandStats[]): RasterBandStats;
/**
 * Applies the {@link MAX_COLUMN_VALUE_ENTRIES} cap to a set of entries.
 * When the cap is exceeded, entries are dropped entirely rather than
 * partially retained: a truncated list can never be used for exact merging
 * (see {@link hasReliableColumnValueEntries}), so storing part of it would
 * only add payload weight without any benefit.
 */
export declare function capColumnValueEntries(entries: ColumnValuesEntry[]): {
    entries: ColumnValuesEntry[] | undefined;
    entriesTruncated: boolean;
};
/**
 * Computes NumberColumnValueStats from per-feature entries. Each entry
 * represents a single original (pre-subdivision) feature, so counts, sums,
 * and distinct values are exact. Mean and stdDev are weighted by each
 * feature's overlap weight (area/length) when available.
 */
export declare function numberColumnStatsFromEntries(entries: ColumnValuesEntry[]): NumberColumnValueStats;
/**
 * Computes StringOrBooleanColumnValueStats from per-feature entries.
 */
export declare function stringOrBooleanColumnStatsFromEntries(entries: ColumnValuesEntry[]): StringOrBooleanColumnValueStats;
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
export declare function combineNumberColumnValueStats(statsArray: NumberColumnValueStats[]): NumberColumnValueStats | undefined;
export declare function combineStringOrBooleanColumnValueStats(statsArray: StringOrBooleanColumnValueStats[]): StringOrBooleanColumnValueStats | undefined;
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
export declare function hashMetricDependency(dependency: MetricDependency, overlaySourceUrls: {
    [stableId: string]: string;
}): string;
/**
 * Combines a list of metrics for fragments into a single metric. All metrics
 * must have the same type (e.g. total_area, count, etc.)
 * @param metrics - The metrics to combine.
 * @returns The combined metric.
 */
export declare function combineMetricsForFragments<T extends Metric>(metrics: Pick<Metric, "type" | "value">[], expectedMetricType?: Metric["type"]): Pick<T, "type" | "value">;
type ProsemirrorNode = {
    type: string;
    attrs?: Record<string, any>;
    content?: ProsemirrorNode[];
};
export declare function extractMetricDependenciesFromReportBody(node: ProsemirrorNode, dependencies?: MetricDependency[]): MetricDependency[];
export {};
//# sourceMappingURL=metrics.d.ts.map