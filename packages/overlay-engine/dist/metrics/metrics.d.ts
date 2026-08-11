import { Feature, LineString } from "geojson";
export type MetricType = "total_area" | "overlay_area" | "count" | "presence" | "presence_table" | "column_values" | "raster_stats" | "distance_to_shore" | "raster_overlay_area";
/**
 * Max distinct class keys allowed when `groupBy: "value"` for
 * {@link RasterOverlayAreaMetric}. Exceeding this throws at calculation time —
 * grouping a continuous raster by value is a misconfiguration.
 */
export declare const MAX_RASTER_OVERLAY_AREA_CLASSES = 32;
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
export declare const MAX_OVERLAY_AREA_OVERLAP_ENTRIES = 2000;
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
    [key: string]: number | OverlayAreaOverlapInfo | OverlayAreaOverlapCombineResult;
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
export declare function isOverlayAreaClassKey(key: string): boolean;
export declare function isOverlayAreaOverlapInfo(value: unknown): value is OverlayAreaOverlapInfo;
export declare function isOverlayAreaOverlapCombineResult(value: unknown): value is OverlayAreaOverlapCombineResult;
/**
 * Reads fragment-level {@link OverlayAreaOverlapInfo} from a metric value, if present.
 */
export declare function getOverlayAreaOverlapInfo(value: OverlayAreaMetricValue | null | undefined): OverlayAreaOverlapInfo | null;
/**
 * Reads combine-time {@link OverlayAreaOverlapCombineResult} from a metric value, if present.
 */
export declare function getOverlayAreaOverlapCombineResult(value: OverlayAreaMetricValue | null | undefined): OverlayAreaOverlapCombineResult | null;
/** Numeric class totals only (strips reserved `__` keys). */
export declare function getOverlayAreaClassTotals(value: OverlayAreaMetricValue | null | undefined): {
    [classKey: string]: number;
};
/**
 * Displayed / export upper estimate for a class after combine:
 * `naiveSum − overcountMin`, falling back to the stored class total.
 */
export declare function getOverlayAreaDisplayedClassValue(value: OverlayAreaMetricValue | null | undefined, classKey: string): number;
/**
 * Class value range after combine: `[naive − overcountMax, naive − overcountMin]`.
 * Equal bounds mean an exact correction (or no overcount).
 */
export declare function getOverlayAreaClassValueRange(value: OverlayAreaMetricValue | null | undefined, classKey: string): {
    low: number;
    high: number;
    naiveSum: number;
} | null;
/**
 * Combines `overlay_area` fragment values, correcting double-counted class
 * totals when buffered `__overlap` metadata is available. Fragments without
 * `__overlap` (unbuffered, or stale pre-upgrade rows) contribute only their
 * numeric class totals — no collar/entry work runs at combine time for them.
 *
 * @see OverlayAreaOverlapInfo for the full double-counting model and the
 * producer gate (buffered fragment subjects only).
 */
export declare function combineOverlayAreaMetrics(values: OverlayAreaMetricValue[]): OverlayAreaMetricValue;
/**
 * Classifies whether overlap among buffered fragment metrics is within a
 * single sketch (fragment splitting) or between different sketches in a
 * collection. Callers with subject info should attach the result onto the
 * combined `__overlap` metadata.
 *
 * @see OverlayAreaOverlapInfo
 */
export declare function classifyOverlayAreaOverlapScope(metrics: Pick<Metric, "subject">[]): {
    scope: "within-sketch" | "between-sketches" | "both";
    partnerSketchIds: number[];
    fragmentsInvolved: string[];
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
    overlap?: RasterOverlayAreaOverlapInfo | RasterOverlayAreaOverlapCombineResult;
};
export type RasterOverlayAreaMetric = OverlayMetricBase & {
    type: "raster_overlay_area";
    value: RasterOverlayAreaMetricValue;
};
export declare function isRasterOverlayAreaOverlapInfo(value: unknown): value is RasterOverlayAreaOverlapInfo;
export declare function isRasterOverlayAreaOverlapCombineResult(value: unknown): value is RasterOverlayAreaOverlapCombineResult;
export declare function getRasterOverlayAreaOverlapInfo(value: RasterOverlayAreaMetricValue | null | undefined): RasterOverlayAreaOverlapInfo | null;
export declare function getRasterOverlayAreaOverlapCombineResult(value: RasterOverlayAreaMetricValue | null | undefined): RasterOverlayAreaOverlapCombineResult | null;
/**
 * Displayed class value after combine: `naiveSum − overcountMin` (= naive),
 * falling back to the stored area total.
 */
export declare function getRasterOverlayAreaDisplayedClassValue(value: RasterOverlayAreaMetricValue | null | undefined, classKey: string): number;
/**
 * Class value range after combine:
 * `[naive − overcountMax, naive − overcountMin]`.
 */
export declare function getRasterOverlayAreaClassValueRange(value: RasterOverlayAreaMetricValue | null | undefined, classKey: string): {
    low: number;
    high: number;
    naiveSum: number;
} | null;
/**
 * Combines `raster_overlay_area` fragment values. Unbuffered (or single)
 * fragments combine by exact per-key summation. Buffered fragments with
 * intersecting, source-positive collars attach a proportional overcount
 * estimate — see {@link RasterOverlayAreaOverlapCombineResult}.
 *
 * Pair aggregation uses **max** over pairs (not sum) so 3-way bbox clusters
 * do not invent impossible stacked overcount.
 */
export declare function combineRasterOverlayAreaMetrics(values: RasterOverlayAreaMetricValue[]): RasterOverlayAreaMetricValue;
/**
 * Client-side enrichment: fill fragment hashes / sketch ids / scope on a
 * combine-time {@link RasterOverlayAreaOverlapCombineResult} using full
 * metrics that still carry subjects. Mirrors
 * {@link classifyOverlayAreaOverlapScope} for vector overlay_area.
 */
export declare function attachRasterOverlayAreaOverlapScope(combined: Pick<RasterOverlayAreaMetric, "type" | "value">, fragmentMetrics: {
    type?: string | null;
    subject?: unknown;
}[]): Pick<RasterOverlayAreaMetric, "type" | "value">;
export type Metric = TotalAreaMetric | OverlayAreaMetric | CountMetric | PresenceMetric | PresenceTableMetric | ColumnValuesMetric | RasterStats | DistanceToShoreMetric | RasterOverlayAreaMetric;
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
export declare function hashMetricDependency(dependency: MetricDependency, overlaySourceUrls: {
    [stableId: string]: string;
}): string;
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
export declare function combineMetricsForFragments<T extends Metric>(metrics: Pick<Metric, "type" | "value">[], expectedMetricType?: Metric["type"]): Pick<T, "type" | "value">;
type ProsemirrorNode = {
    type: string;
    attrs?: Record<string, any>;
    content?: ProsemirrorNode[];
};
export declare function extractMetricDependenciesFromReportBody(node: ProsemirrorNode, dependencies?: MetricDependency[]): MetricDependency[];
export {};
//# sourceMappingURL=metrics.d.ts.map