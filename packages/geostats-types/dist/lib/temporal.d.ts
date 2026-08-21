/**
 * Temporal metadata types for SeaSketch layers and Data Tables, per
 * design-docs/temporal-data/temporal-data.md. The same TemporalInfo document
 * describes vector sources (layer- or feature-level time), rasters
 * (layer- or band-level time), remotes (GFW), and Data Tables (row-level
 * time). This module is the shared system of record for the API
 * (validation in the TemporalInfo GraphQL scalar), the client (timeslider,
 * report widgets), and ingest.
 *
 * Rules encoded here:
 * - Instants and intervals are both first-class, with an explicit precision
 *   field (never inferred from string width).
 * - Bounds are half-open: inclusive start, exclusive end.
 * - Calendar values are UTC.
 * - Matching = expanded-interval intersection:
 *   `value.start < clock.end && clock.start < value.end`.
 */
export type TemporalPrecision = "year" | "month" | "day" | "hour" | "minute" | "second";
/**
 * Reduced-precision ISO 8601 (`2018`, `2018-06`, `2018-06-15`,
 * `2018-06-15T14:30:00Z`). Precision is *not* inferred from this string; the
 * accompanying `precision` field governs semantics. Values are UTC.
 */
export type TemporalIso = string;
export type TemporalInstant = {
    kind: "instant";
    at: TemporalIso;
    precision: TemporalPrecision;
};
export type TemporalInterval = {
    kind: "interval";
    /** Inclusive. */
    start: TemporalIso;
    /** Exclusive. `null` means open-ended (through present / latest available). */
    end: TemporalIso | null;
    precision: TemporalPrecision;
};
export type TemporalValue = TemporalInstant | TemporalInterval;
export type TemporalGranularity = "layer" | "feature" | "band" | "row" | "remote";
export type TemporalStep = {
    count: number;
    unit: TemporalPrecision;
};
/**
 * Slider coverage. `grid` is a complete regular series (every step occupied).
 * `histogram` is sparse bins — occupancy (0/1 implied by presence) or a
 * count. Irregular band times live in `mapping.bands`; this structure is
 * derived from them.
 */
export type TemporalAvailability = {
    type: "grid";
    start: TemporalIso;
    /** Exclusive. `null` means open-ended; do not materialize bins. */
    end: TemporalIso | null;
    step: TemporalStep;
} | {
    type: "histogram";
    /** Bin width. Should be `nativeResolution`, or `day` if that is finer. */
    resolution: TemporalPrecision;
    start: TemporalIso;
    end: TemporalIso | null;
    /** Sparse. Skip empty bins. */
    bins: Array<{
        start: TemporalIso;
        count: number;
    }>;
};
export type TemporalMapping = {
    type: "feature" | "row";
    startColumn: "_when_start";
    endColumn: "_when_end";
    /** Original columns the wizard / ingest used. */
    sourceColumns?: {
        instant?: string;
        start?: string;
        end?: string;
    };
} | {
    type: "band";
    /** Tileset band id (MRT / raster-array) or 1-based GDAL band index. */
    bands: Array<{
        id: string;
        index: number;
        when: TemporalValue;
    }>;
} | {
    type: "remote";
    driver: "gfw-4wings";
};
export type TemporalInfo = {
    version: 1;
    granularity: TemporalGranularity;
    /**
     * Union of the source in time. Always an interval (instants are expanded).
     * Timeslider *domain* (how wide the axis is).
     */
    coverage: TemporalInterval;
    /**
     * Native spacing of samples (annual bands, hourly fixes). Default slider
     * step is the coarsest native resolution among visible sources.
     */
    nativeResolution: TemporalPrecision;
    /**
     * Default *view* resolution. May be coarser than native — survey events
     * recorded to the day but compared by year.
     */
    defaultViewResolution: TemporalPrecision;
    /**
     * Present only if this source can re-aggregate the same data (GFW 4Wings,
     * Data Tables). Do not list values the renderer cannot honor.
     */
    supportedViewResolutions?: TemporalPrecision[];
    /** How samples are addressed. Omitted when granularity is `layer`. */
    mapping?: TemporalMapping;
    /**
     * Where on the axis this source has data, and how much. Timeslider *paint*
     * (ticks, gap fill, optional bars).
     */
    availability?: TemporalAvailability;
    /**
     * `availability` counts are meaningful as a series (Data Tables, tracks),
     * not just occupancy. Draw bars, not only ticks.
     */
    providesSliderStats?: boolean;
    /** Who last wrote this record. Provenance only; not a write lock. */
    authoredBy?: "ingest" | "admin" | "heuristic" | "library";
};
/**
 * The map clock — client session state, not stored on the source. Included
 * here so the timeslider, manager bridge, and widgets share one shape.
 */
export type TemporalClock = {
    /** Derived from visible sources; user can override (range vs instant). */
    mode: "instant" | "window" | "cumulative";
    start: TemporalIso;
    end: TemporalIso;
    viewResolution: TemporalPrecision;
};
type IsoComponents = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};
/**
 * Parses a reduced-precision UTC ISO 8601 string into calendar components.
 * Returns null for anything that is not valid (including non-UTC offsets).
 */
export declare function parseTemporalIso(iso: unknown): IsoComponents | null;
export declare function isTemporalIso(value: unknown): value is TemporalIso;
/** Half-open interval in ms since the UNIX epoch, UTC. */
export type ExpandedInterval = {
    /** Inclusive, ms since epoch. */
    start: number;
    /** Exclusive, ms since epoch. */
    end: number;
};
/**
 * Expands one reduced-precision ISO value to the half-open interval covering
 * one unit at `precision` (e.g. `"2018"` @ year → [2018-01-01, 2019-01-01)).
 * Strings more specific than `precision` are truncated first.
 */
export declare function expandTemporalIso(iso: TemporalIso, precision: TemporalPrecision): ExpandedInterval | null;
/**
 * Expands a TemporalValue to its half-open UTC interval — the only matching
 * rule. Instants cover one unit at their precision. Interval ends are
 * exclusive and expand to the *start* of their unit; a `null` end resolves
 * to `now`. Returns null if the value fails to parse.
 */
export declare function expandTemporalValue(value: TemporalValue, now?: number): ExpandedInterval | null;
/** The intersection rule: `a.start < b.end && b.start < a.end`. */
export declare function intervalsIntersect(a: ExpandedInterval, b: ExpandedInterval): boolean;
/**
 * True when a temporal value intersects the clock's half-open interval —
 * how the timeslider decides source/feature/band visibility.
 */
export declare function temporalValueIntersects(value: TemporalValue, clock: ExpandedInterval, now?: number): boolean;
/** Expands a TemporalClock's [start, end) to ms. Null on parse failure. */
export declare function expandTemporalClock(clock: TemporalClock): ExpandedInterval | null;
/** The finer (higher-resolution) of two precisions. */
export declare function finerPrecision(a: TemporalPrecision, b: TemporalPrecision): TemporalPrecision;
/** The coarser (lower-resolution) of two precisions — slider step rule. */
export declare function coarserPrecision(a: TemporalPrecision, b: TemporalPrecision): TemporalPrecision;
/**
 * Union of coverage intervals — the timeslider domain for the currently
 * visible temporal sources. Start/end keep the contributing sources' ISO
 * strings (no re-serialization); an open-ended member makes the union
 * open-ended. Precision is the finest among members. Returns null for an
 * empty or entirely unparseable list.
 */
export declare function unionTemporalCoverage(coverages: TemporalInterval[], now?: number): TemporalInterval | null;
export declare function isTemporalPrecision(value: unknown): value is TemporalPrecision;
export declare function isTemporalGranularity(value: unknown): value is TemporalGranularity;
export declare function isTemporalInstant(value: unknown): value is TemporalInstant;
export declare function isTemporalInterval(value: unknown): value is TemporalInterval;
export declare function isTemporalValue(value: unknown): value is TemporalValue;
export declare function isTemporalStep(value: unknown): value is TemporalStep;
export declare function isTemporalAvailability(value: unknown): value is TemporalAvailability;
export declare function isTemporalMapping(value: unknown): value is TemporalMapping;
/**
 * Validates a complete TemporalInfo document — used by the GraphQL scalar
 * on the API, admin mutations, and anywhere the jsonb column is read.
 */
export declare function isTemporalInfo(value: unknown): value is TemporalInfo;
export declare function isTemporalClock(value: unknown): value is TemporalClock;
/**
 * The admin-editor v1 document: a layer-granularity year interval, per the
 * worked example in the design doc ("Mangroves 2018").
 */
export declare function createLayerYearTemporalInfo(year: number): TemporalInfo;
export {};
//# sourceMappingURL=temporal.d.ts.map