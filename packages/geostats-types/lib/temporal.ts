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

export type TemporalPrecision =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second";

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

export type TemporalGranularity =
  | "layer" // whole source is one instant or interval ("Mangroves 2018")
  | "feature" // per-vector-feature time (tracks, KML placemarks)
  | "band" // per-raster-band / raster-array field (GMW, CRW)
  | "row" // Data Table observations
  | "remote"; // GFW and similar; SeaSketch does not store the time series

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
export type TemporalAvailability =
  | {
      type: "grid";
      start: TemporalIso;
      /** Exclusive. `null` means open-ended; do not materialize bins. */
      end: TemporalIso | null;
      step: TemporalStep;
    }
  | {
      type: "histogram";
      /** Bin width. Should be `nativeResolution`, or `day` if that is finer. */
      resolution: TemporalPrecision;
      start: TemporalIso;
      end: TemporalIso | null;
      /** Sparse. Skip empty bins. */
      bins: Array<{ start: TemporalIso; count: number }>;
    };

/** Physical columns written onto parquet / MVT features. */
export const WHEN_START_COLUMN = "_when_start";
export const WHEN_END_COLUMN = "_when_end";

/**
 * How a single date/time cell is parsed. `iso` is reduced-precision ISO 8601
 * (same as TemporalIso). `mdy` / `dmy` are slash dates (`8/31/2024`,
 * `31/08/2024`). `year` is a 4-digit calendar year (number or string).
 */
export type TemporalDateFormat = "iso" | "mdy" | "dmy" | "year";

/**
 * Wizard / reprocess argument: how to derive `_when_*` from source columns.
 * Discriminated by `kind`. This is the ephemeral job config — not persisted
 * on the table until reprocess succeeds (then copied onto mapping.sourceColumns).
 */
export type DataTableTemporalSourceColumns =
  | { kind: "instant"; column: string; format: TemporalDateFormat }
  | { kind: "components"; year: string; month?: string; day?: string }
  | { kind: "span"; start: string; end: string; format: TemporalDateFormat };

/**
 * Legacy sourceColumns shape from the design-doc v1 examples
 * (`{ instant: "DATE" }`). Still accepted on stored TemporalInfo.
 */
export type LegacyTemporalSourceColumns = {
  instant?: string;
  start?: string;
  end?: string;
};

export type TemporalSourceColumns =
  | DataTableTemporalSourceColumns
  | LegacyTemporalSourceColumns;

/**
 * Admin wizard + reprocess job argument. Shared by the client, the
 * pmtiles-server temporal-preview endpoint, and the data-tables-handler
 * Lambda so all three interpret the same document.
 */
export type DataTableTemporalConfig = {
  sourceColumns: DataTableTemporalSourceColumns;
  /**
   * Default *view* resolution after reprocess. May be coarser than the
   * native precision implied by the mapping (day-recorded surveys compared
   * by year).
   */
  defaultViewResolution?: TemporalPrecision;
  supportedViewResolutions?: TemporalPrecision[];
};

export type TemporalMapping =
  | {
      type: "feature" | "row";
      startColumn: "_when_start";
      endColumn: "_when_end";
      /** Original columns the wizard / ingest used. */
      sourceColumns?: TemporalSourceColumns;
    }
  | {
      type: "band";
      /** Tileset band id (MRT / raster-array) or 1-based GDAL band index. */
      bands: Array<{ id: string; index: number; when: TemporalValue }>;
    }
  | { type: "remote"; driver: "gfw-4wings" };

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
  start: TemporalIso; // inclusive
  end: TemporalIso; // exclusive; equals start+step in `instant` mode
  viewResolution: TemporalPrecision;
};

// ---------------------------------------------------------------------------
// Parsing and expansion
// ---------------------------------------------------------------------------

const PRECISIONS: TemporalPrecision[] = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
];

/**
 * Reduced-precision ISO 8601, UTC only (optional trailing `Z`; non-UTC
 * offsets are rejected — values are converted to UTC on ingest).
 */
const ISO_RE =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[T ](\d{2})(?::(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?)?Z?)?)?)?$/;

type IsoComponents = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
};

/**
 * Parses a reduced-precision UTC ISO 8601 string into calendar components.
 * Returns null for anything that is not valid (including non-UTC offsets).
 */
export function parseTemporalIso(iso: unknown): IsoComponents | null {
  if (typeof iso !== "string") return null;
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = m[2] !== undefined ? parseInt(m[2], 10) : 1;
  const day = m[3] !== undefined ? parseInt(m[3], 10) : 1;
  const hour = m[4] !== undefined ? parseInt(m[4], 10) : 0;
  const minute = m[5] !== undefined ? parseInt(m[5], 10) : 0;
  const second = m[6] !== undefined ? parseInt(m[6], 10) : 0;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  // Reject invalid calendar dates like Feb 30 (Date.UTC rolls them over).
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const d = new Date(ms);
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day, hour, minute, second };
}

export function isTemporalIso(value: unknown): value is TemporalIso {
  return parseTemporalIso(value) !== null;
}

function truncate(c: IsoComponents, precision: TemporalPrecision): number {
  switch (precision) {
    case "year":
      return Date.UTC(c.year, 0, 1);
    case "month":
      return Date.UTC(c.year, c.month - 1, 1);
    case "day":
      return Date.UTC(c.year, c.month - 1, c.day);
    case "hour":
      return Date.UTC(c.year, c.month - 1, c.day, c.hour);
    case "minute":
      return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute);
    case "second":
      return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
  }
}

/** Start of the *next* unit after truncation — Date.UTC handles rollover. */
function advance(
  c: IsoComponents,
  precision: TemporalPrecision,
  count = 1
): number {
  switch (precision) {
    case "year":
      return Date.UTC(c.year + count, 0, 1);
    case "month":
      return Date.UTC(c.year, c.month - 1 + count, 1);
    case "day":
      return Date.UTC(c.year, c.month - 1, c.day + count);
    case "hour":
      return Date.UTC(c.year, c.month - 1, c.day, c.hour + count);
    case "minute":
      return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute + count);
    case "second":
      return Date.UTC(
        c.year,
        c.month - 1,
        c.day,
        c.hour,
        c.minute,
        c.second + count
      );
  }
}

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
export function expandTemporalIso(
  iso: TemporalIso,
  precision: TemporalPrecision
): ExpandedInterval | null {
  const c = parseTemporalIso(iso);
  if (!c) return null;
  return { start: truncate(c, precision), end: advance(c, precision) };
}

/**
 * Expands a TemporalValue to its half-open UTC interval — the only matching
 * rule. Instants cover one unit at their precision. Interval ends are
 * exclusive and expand to the *start* of their unit; a `null` end resolves
 * to `now`. Returns null if the value fails to parse.
 */
export function expandTemporalValue(
  value: TemporalValue,
  now: number = Date.now()
): ExpandedInterval | null {
  if (value.kind === "instant") {
    return expandTemporalIso(value.at, value.precision);
  }
  const startC = parseTemporalIso(value.start);
  if (!startC) return null;
  const start = truncate(startC, value.precision);
  let end: number;
  if (value.end === null) {
    end = now;
  } else {
    const endC = parseTemporalIso(value.end);
    if (!endC) return null;
    end = truncate(endC, value.precision);
  }
  return { start, end };
}

// ---------------------------------------------------------------------------
// Intersection and union
// ---------------------------------------------------------------------------

/** The intersection rule: `a.start < b.end && b.start < a.end`. */
export function intervalsIntersect(
  a: ExpandedInterval,
  b: ExpandedInterval
): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * True when a temporal value intersects the clock's half-open interval —
 * how the timeslider decides source/feature/band visibility.
 */
export function temporalValueIntersects(
  value: TemporalValue,
  clock: ExpandedInterval,
  now: number = Date.now()
): boolean {
  const expanded = expandTemporalValue(value, now);
  if (!expanded) return false;
  return intervalsIntersect(expanded, clock);
}

/** Expands a TemporalClock's [start, end) to ms. Null on parse failure. */
export function expandTemporalClock(
  clock: TemporalClock
): ExpandedInterval | null {
  const startC = parseTemporalIso(clock.start);
  const endC = parseTemporalIso(clock.end);
  if (!startC || !endC) return null;
  return {
    start: truncate(startC, clock.viewResolution),
    end: truncate(endC, clock.viewResolution),
  };
}

/** Index into the precision order — larger is finer. */
function precisionRank(p: TemporalPrecision): number {
  return PRECISIONS.indexOf(p);
}

/** The finer (higher-resolution) of two precisions. */
export function finerPrecision(
  a: TemporalPrecision,
  b: TemporalPrecision
): TemporalPrecision {
  return precisionRank(a) >= precisionRank(b) ? a : b;
}

/** The coarser (lower-resolution) of two precisions — slider step rule. */
export function coarserPrecision(
  a: TemporalPrecision,
  b: TemporalPrecision
): TemporalPrecision {
  return precisionRank(a) <= precisionRank(b) ? a : b;
}

/**
 * Union of coverage intervals — the timeslider domain for the currently
 * visible temporal sources. Start/end keep the contributing sources' ISO
 * strings (no re-serialization); an open-ended member makes the union
 * open-ended. Precision is the finest among members. Returns null for an
 * empty or entirely unparseable list.
 */
export function unionTemporalCoverage(
  coverages: TemporalInterval[],
  now: number = Date.now()
): TemporalInterval | null {
  let result: TemporalInterval | null = null;
  let resultExpanded: ExpandedInterval | null = null;
  for (const coverage of coverages) {
    const expanded = expandTemporalValue(coverage, now);
    if (!expanded) continue;
    if (!result || !resultExpanded) {
      result = { ...coverage };
      resultExpanded = expanded;
      continue;
    }
    if (expanded.start < resultExpanded.start) {
      result.start = coverage.start;
      resultExpanded.start = expanded.start;
    }
    if (result.end !== null) {
      if (coverage.end === null) {
        result.end = null;
        resultExpanded.end = expanded.end;
      } else if (expanded.end > resultExpanded.end) {
        result.end = coverage.end;
        resultExpanded.end = expanded.end;
      }
    }
    result.precision = finerPrecision(result.precision, coverage.precision);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Type guards (all take unknown; defensive per workspace conventions)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTemporalPrecision(
  value: unknown
): value is TemporalPrecision {
  return (
    typeof value === "string" &&
    (PRECISIONS as string[]).indexOf(value) !== -1
  );
}

export function isTemporalGranularity(
  value: unknown
): value is TemporalGranularity {
  return (
    typeof value === "string" &&
    ["layer", "feature", "band", "row", "remote"].indexOf(value) !== -1
  );
}

export function isTemporalInstant(value: unknown): value is TemporalInstant {
  if (!isRecord(value)) return false;
  return (
    value.kind === "instant" &&
    isTemporalIso(value.at) &&
    isTemporalPrecision(value.precision)
  );
}

export function isTemporalInterval(value: unknown): value is TemporalInterval {
  if (!isRecord(value)) return false;
  if (value.kind !== "interval") return false;
  if (!isTemporalIso(value.start)) return false;
  if (value.end !== null && !isTemporalIso(value.end)) return false;
  if (!isTemporalPrecision(value.precision)) return false;
  if (value.end === null) return true;
  const expanded = expandTemporalValue({
    kind: "interval",
    start: value.start,
    end: value.end,
    precision: value.precision,
  });
  return expanded !== null && expanded.start < expanded.end;
}

export function isTemporalValue(value: unknown): value is TemporalValue {
  return isTemporalInstant(value) || isTemporalInterval(value);
}

export function isTemporalStep(value: unknown): value is TemporalStep {
  if (!isRecord(value)) return false;
  return (
    typeof value.count === "number" &&
    Number.isFinite(value.count) &&
    value.count > 0 &&
    isTemporalPrecision(value.unit)
  );
}

export function isTemporalAvailability(
  value: unknown
): value is TemporalAvailability {
  if (!isRecord(value)) return false;
  if (value.type === "grid") {
    if (!isTemporalIso(value.start)) return false;
    if (value.end !== null && !isTemporalIso(value.end)) return false;
    return isTemporalStep(value.step);
  }
  if (value.type === "histogram") {
    if (!isTemporalPrecision(value.resolution)) return false;
    if (!isTemporalIso(value.start)) return false;
    if (value.end !== null && !isTemporalIso(value.end)) return false;
    if (!Array.isArray(value.bins)) return false;
    return value.bins.every(
      (bin: unknown) =>
        isRecord(bin) &&
        isTemporalIso(bin.start) &&
        typeof bin.count === "number" &&
        Number.isFinite(bin.count) &&
        bin.count >= 0
    );
  }
  return false;
}

export function isTemporalDateFormat(
  value: unknown
): value is TemporalDateFormat {
  return (
    value === "iso" || value === "mdy" || value === "dmy" || value === "year"
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isDataTableTemporalSourceColumns(
  value: unknown
): value is DataTableTemporalSourceColumns {
  if (!isRecord(value)) return false;
  if (value.kind === "instant") {
    return isNonEmptyString(value.column) && isTemporalDateFormat(value.format);
  }
  if (value.kind === "components") {
    if (!isNonEmptyString(value.year)) return false;
    if (value.month !== undefined && !isNonEmptyString(value.month)) {
      return false;
    }
    if (value.day !== undefined && !isNonEmptyString(value.day)) {
      return false;
    }
    // day without month is not a valid calendar mapping
    if (value.day !== undefined && value.month === undefined) return false;
    return true;
  }
  if (value.kind === "span") {
    return (
      isNonEmptyString(value.start) &&
      isNonEmptyString(value.end) &&
      isTemporalDateFormat(value.format)
    );
  }
  return false;
}

export function isLegacyTemporalSourceColumns(
  value: unknown
): value is LegacyTemporalSourceColumns {
  if (!isRecord(value)) return false;
  if ("kind" in value) return false;
  const allowed = ["instant", "start", "end"];
  let any = false;
  for (const key of Object.keys(value)) {
    if (allowed.indexOf(key) === -1) return false;
    const v = value[key];
    if (v !== undefined && typeof v !== "string") return false;
    if (typeof v === "string" && v.length > 0) any = true;
  }
  return any;
}

export function isTemporalSourceColumns(
  value: unknown
): value is TemporalSourceColumns {
  return (
    isDataTableTemporalSourceColumns(value) ||
    isLegacyTemporalSourceColumns(value)
  );
}

export function isDataTableTemporalConfig(
  value: unknown
): value is DataTableTemporalConfig {
  if (!isRecord(value)) return false;
  if (!isDataTableTemporalSourceColumns(value.sourceColumns)) return false;
  if (
    value.defaultViewResolution !== undefined &&
    !isTemporalPrecision(value.defaultViewResolution)
  ) {
    return false;
  }
  if (value.supportedViewResolutions !== undefined) {
    if (!Array.isArray(value.supportedViewResolutions)) return false;
    if (!value.supportedViewResolutions.every(isTemporalPrecision)) {
      return false;
    }
  }
  return true;
}

export function isTemporalMapping(value: unknown): value is TemporalMapping {
  if (!isRecord(value)) return false;
  if (value.type === "feature" || value.type === "row") {
    if (value.startColumn !== "_when_start") return false;
    if (value.endColumn !== "_when_end") return false;
    if (value.sourceColumns !== undefined) {
      return isTemporalSourceColumns(value.sourceColumns);
    }
    return true;
  }
  if (value.type === "band") {
    if (!Array.isArray(value.bands)) return false;
    return value.bands.every(
      (band: unknown) =>
        isRecord(band) &&
        typeof band.id === "string" &&
        typeof band.index === "number" &&
        Number.isInteger(band.index) &&
        band.index >= 1 &&
        isTemporalValue(band.when)
    );
  }
  if (value.type === "remote") {
    return value.driver === "gfw-4wings";
  }
  return false;
}

/**
 * Validates a complete TemporalInfo document — used by the GraphQL scalar
 * on the API, admin mutations, and anywhere the jsonb column is read.
 */
export function isTemporalInfo(value: unknown): value is TemporalInfo {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isTemporalGranularity(value.granularity)) return false;
  if (!isTemporalInterval(value.coverage)) return false;
  if (!isTemporalPrecision(value.nativeResolution)) return false;
  if (!isTemporalPrecision(value.defaultViewResolution)) return false;
  if (value.supportedViewResolutions !== undefined) {
    if (!Array.isArray(value.supportedViewResolutions)) return false;
    if (!value.supportedViewResolutions.every(isTemporalPrecision)) {
      return false;
    }
  }
  if (value.granularity === "layer") {
    if (value.mapping !== undefined) return false;
  } else {
    if (!isTemporalMapping(value.mapping)) return false;
    if (value.mapping.type !== value.granularity) return false;
  }
  if (
    value.availability !== undefined &&
    !isTemporalAvailability(value.availability)
  ) {
    return false;
  }
  if (
    value.providesSliderStats !== undefined &&
    typeof value.providesSliderStats !== "boolean"
  ) {
    return false;
  }
  if (
    value.authoredBy !== undefined &&
    (typeof value.authoredBy !== "string" ||
      ["ingest", "admin", "heuristic", "library"].indexOf(value.authoredBy) ===
        -1)
  ) {
    return false;
  }
  return true;
}

export function isTemporalClock(value: unknown): value is TemporalClock {
  if (!isRecord(value)) return false;
  return (
    (value.mode === "instant" ||
      value.mode === "window" ||
      value.mode === "cumulative") &&
    isTemporalIso(value.start) &&
    isTemporalIso(value.end) &&
    isTemporalPrecision(value.viewResolution)
  );
}

// ---------------------------------------------------------------------------
// Convenience builders
// ---------------------------------------------------------------------------

/**
 * The admin-editor v1 document: a layer-granularity year interval, per the
 * worked example in the design doc ("Mangroves 2018").
 */
export function createLayerYearTemporalInfo(year: number): TemporalInfo {
  const start = String(year);
  const end = String(year + 1);
  return {
    version: 1,
    granularity: "layer",
    coverage: { kind: "interval", start, end, precision: "year" },
    nativeResolution: "year",
    defaultViewResolution: "year",
    authoredBy: "admin",
  };
}

// ---------------------------------------------------------------------------
// Data Table row derivation (wizard preview + reprocess)
// ---------------------------------------------------------------------------

/** Half-open interval in UTC epoch *seconds*, plus the reduced-precision ISO. */
export type DerivedWhenInterval = {
  startSec: number;
  endSec: number;
  startIso: TemporalIso;
  endIso: TemporalIso;
  precision: TemporalPrecision;
};

/**
 * Native precision implied by the mapping itself (before looking at values).
 * ISO cells may be finer or coarser per-row; callers should take the finest
 * successful parse when computing TemporalInfo.nativeResolution.
 */
export function nativePrecisionFromSourceColumns(
  source: DataTableTemporalSourceColumns
): TemporalPrecision {
  if (source.kind === "components") {
    if (source.day) return "day";
    if (source.month) return "month";
    return "year";
  }
  if (source.format === "year") return "year";
  if (source.format === "iso") return "day";
  return "day";
}

/** Column names the mapping reads from a row. */
export function sourceColumnNames(
  source: DataTableTemporalSourceColumns | LegacyTemporalSourceColumns
): string[] {
  if ("kind" in source && source.kind === "instant") {
    return [source.column];
  }
  if ("kind" in source && source.kind === "components") {
    const names = [source.year];
    if (source.month) names.push(source.month);
    if (source.day) names.push(source.day);
    return names;
  }
  if ("kind" in source && source.kind === "span") {
    return [source.start, source.end];
  }
  const legacy = source as LegacyTemporalSourceColumns;
  return [legacy.instant, legacy.start, legacy.end].filter(
    (name): name is string => typeof name === "string" && name.length > 0
  );
}

/**
 * Coerce a wizard mapping or a stored TemporalInfo.sourceColumns into the
 * discriminated config used by preview / reprocess.
 */
export function toDataTableTemporalSourceColumns(
  source: TemporalSourceColumns
): DataTableTemporalSourceColumns | null {
  if (isDataTableTemporalSourceColumns(source)) return source;
  if (!isLegacyTemporalSourceColumns(source)) return null;
  if (source.instant) {
    return { kind: "instant", column: source.instant, format: "iso" };
  }
  if (source.start && source.end) {
    return { kind: "span", start: source.start, end: source.end, format: "iso" };
  }
  if (source.start) {
    return { kind: "instant", column: source.start, format: "iso" };
  }
  return null;
}

/** Reduced-precision ISO from UTC epoch milliseconds. */
export function formatTemporalIsoFromMs(
  ms: number,
  precision: TemporalPrecision
): TemporalIso {
  const date = new Date(ms);
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  if (precision === "year") return y;
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (precision === "month") return `${y}-${m}`;
  const d = String(date.getUTCDate()).padStart(2, "0");
  if (precision === "day") return `${y}-${m}-${d}`;
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  if (precision === "hour") return `${y}-${m}-${d}T${h}:00:00Z`;
  if (precision === "minute") return `${y}-${m}-${d}T${h}:${min}:00Z`;
  return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
}

function cellToText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function parseYearNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const year = Math.trunc(value);
    if (year >= 1000 && year <= 9999) return year;
    return null;
  }
  const text = cellToText(value);
  if (!text) return null;
  if (!/^\d{4}(?:\.0+)?$/.test(text)) return null;
  const year = parseInt(text, 10);
  if (year < 1000 || year > 9999) return null;
  return year;
}

function parseIntInRange(
  value: unknown,
  min: number,
  max: number
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n >= min && n <= max ? n : null;
  }
  const text = cellToText(value);
  if (!text || !/^\d{1,2}(?:\.0+)?$/.test(text)) return null;
  const n = parseInt(text, 10);
  return n >= min && n <= max ? n : null;
}

const SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function parseSlashDate(
  value: unknown,
  format: "mdy" | "dmy"
): IsoComponents | null {
  const text = cellToText(value);
  if (!text) return null;
  const m = SLASH_DATE_RE.exec(text);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const month = format === "mdy" ? a : b;
  const day = format === "mdy" ? b : a;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day, hour: 0, minute: 0, second: 0 };
}

function precisionFromIsoText(iso: string): TemporalPrecision {
  if (iso.length === 4) return "year";
  if (iso.length === 7) return "month";
  if (iso.length === 10) return "day";
  if (/T\d{2}:\d{2}:\d{2}/.test(iso)) return "second";
  if (/T\d{2}:\d{2}/.test(iso)) return "minute";
  if (/T\d{2}/.test(iso)) return "hour";
  return "day";
}

function intervalFromComponents(
  c: IsoComponents,
  precision: TemporalPrecision
): DerivedWhenInterval | null {
  const start = truncate(c, precision);
  const end = advance(c, precision);
  if (!(end > start)) return null;
  return {
    startSec: start / 1000,
    endSec: end / 1000,
    startIso: formatTemporalIsoFromMs(start, precision),
    endIso: formatTemporalIsoFromMs(end, precision),
    precision,
  };
}

function parseFormattedCell(
  value: unknown,
  format: TemporalDateFormat
): DerivedWhenInterval | null {
  if (format === "year") {
    const year = parseYearNumber(value);
    if (year === null) return null;
    return intervalFromComponents(
      { year, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
      "year"
    );
  }
  if (format === "mdy" || format === "dmy") {
    const c = parseSlashDate(value, format);
    if (!c) return null;
    return intervalFromComponents(c, "day");
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const ms = value.getTime();
    const d = new Date(ms);
    return intervalFromComponents(
      {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
      },
      "second"
    );
  }
  const text = cellToText(value);
  if (!text) return null;
  const c = parseTemporalIso(text);
  if (!c) return null;
  return intervalFromComponents(c, precisionFromIsoText(text));
}

function parseComponentsRow(
  row: Record<string, unknown>,
  source: Extract<DataTableTemporalSourceColumns, { kind: "components" }>
): DerivedWhenInterval | null {
  const year = parseYearNumber(row[source.year]);
  if (year === null) return null;
  let month = 1;
  let day = 1;
  let precision: TemporalPrecision = "year";
  if (source.month) {
    const parsedMonth = parseIntInRange(row[source.month], 1, 12);
    if (parsedMonth === null) return null;
    month = parsedMonth;
    precision = "month";
  }
  if (source.day) {
    const parsedDay = parseIntInRange(row[source.day], 1, 31);
    if (parsedDay === null) return null;
    day = parsedDay;
    precision = "day";
  }
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return intervalFromComponents(
    { year, month, day, hour: 0, minute: 0, second: 0 },
    precision
  );
}

/**
 * Expand one table row into `_when_start` / `_when_end` (UTC seconds).
 * Returns null when any required cell is missing or unparseable.
 */
export function deriveWhenIntervalFromRow(
  row: Record<string, unknown>,
  source: DataTableTemporalSourceColumns
): DerivedWhenInterval | null {
  if (source.kind === "instant") {
    return parseFormattedCell(row[source.column], source.format);
  }
  if (source.kind === "components") {
    return parseComponentsRow(row, source);
  }
  const start = parseFormattedCell(row[source.start], source.format);
  const end = parseFormattedCell(row[source.end], source.format);
  if (!start || !end) return null;
  const precision = finerPrecision(start.precision, end.precision);
  // Source span ends are inclusive calendar values; store exclusive end.
  if (!(end.endSec > start.startSec)) return null;
  return {
    startSec: start.startSec,
    endSec: end.endSec,
    startIso: start.startIso,
    endIso: end.endIso,
    precision,
  };
}

export function coverageFromDerivedIntervals(
  intervals: DerivedWhenInterval[]
): TemporalInterval | null {
  if (intervals.length === 0) return null;
  let minStart = intervals[0].startSec;
  let maxEnd = intervals[0].endSec;
  let startIso = intervals[0].startIso;
  let endIso = intervals[0].endIso;
  let precision = intervals[0].precision;
  for (let i = 1; i < intervals.length; i++) {
    const interval = intervals[i];
    if (interval.startSec < minStart) {
      minStart = interval.startSec;
      startIso = interval.startIso;
    }
    if (interval.endSec > maxEnd) {
      maxEnd = interval.endSec;
      endIso = interval.endIso;
    }
    precision = finerPrecision(precision, interval.precision);
  }
  return {
    kind: "interval",
    start: startIso,
    end: endIso,
    precision,
  };
}

/**
 * Sparse occupancy/count histogram at `resolution` (capped at day by callers
 * when native is finer). Empty bins are omitted.
 */
export function availabilityFromDerivedIntervals(
  intervals: DerivedWhenInterval[],
  resolution: TemporalPrecision
): TemporalAvailability | null {
  const coverage = coverageFromDerivedIntervals(intervals);
  if (!coverage) return null;
  const binCounts = new Map<string, number>();
  for (const interval of intervals) {
    let t = interval.startSec * 1000;
    const end = interval.endSec * 1000;
    while (t < end) {
      const iso = formatTemporalIsoFromMs(t, resolution);
      binCounts.set(iso, (binCounts.get(iso) || 0) + 1);
      const next = expandTemporalIso(iso, resolution);
      if (!next || next.end <= t) break;
      t = next.end;
    }
  }
  const bins = Array.from(binCounts.entries())
    .map(([start, count]) => ({ start, count }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return {
    type: "histogram",
    resolution,
    start: coverage.start,
    end: coverage.end,
    bins,
  };
}

/**
 * Finest precision among successful parses, falling back to the mapping's
 * implied native precision.
 */
export function nativeResolutionFromDerived(
  source: DataTableTemporalSourceColumns,
  intervals: DerivedWhenInterval[]
): TemporalPrecision {
  let precision = nativePrecisionFromSourceColumns(source);
  for (const interval of intervals) {
    precision = finerPrecision(precision, interval.precision);
  }
  return precision;
}
