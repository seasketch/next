import {
  expandTemporalIso,
  isRasterInfo,
  isTemporalInfo,
  TemporalInfo,
  TemporalPrecision,
  parseTemporalIso,
} from "@seasketch/geostats-types";
import {
  DataSourceTypes,
  FullAdminSourceFragment,
  SublayerType,
} from "../../../generated/graphql";

export type TemporalCoverageMode =
  | "none"
  | "column"
  | "bands"
  | "year"
  | "month"
  | "span";

export type SpanPrecision = "year" | "month" | "day";

export type TemporalCoverageFormState = {
  mode: TemporalCoverageMode;
  year: string;
  month: string;
  from: string;
  through: string;
  spanPrecision: SpanPrecision;
  ongoing: boolean;
};

export type SourceTemporalCapabilities = {
  hasColumn: boolean;
  hasBands: boolean;
};

const VECTOR_TYPES: DataSourceTypes[] = [
  DataSourceTypes.SeasketchVector,
  DataSourceTypes.SeasketchMvt,
  DataSourceTypes.Geojson,
  DataSourceTypes.ArcgisVector,
  DataSourceTypes.Vector,
];

const RASTER_TYPES: DataSourceTypes[] = [
  DataSourceTypes.SeasketchRaster,
  DataSourceTypes.Raster,
  DataSourceTypes.RasterDem,
  DataSourceTypes.Image,
  DataSourceTypes.ArcgisRasterTiles,
];

export function sourceTemporalCapabilities(
  source: Pick<FullAdminSourceFragment, "type" | "geostats">,
  sublayerType?: SublayerType | null
): SourceTemporalCapabilities {
  let isVector = VECTOR_TYPES.indexOf(source.type) !== -1;
  let isRaster = RASTER_TYPES.indexOf(source.type) !== -1;
  if (source.type === DataSourceTypes.ArcgisDynamicMapserver) {
    isVector = sublayerType === SublayerType.Vector;
    isRaster = sublayerType === SublayerType.Raster;
  }
  let hasBands = false;
  if (isRaster && isRasterInfo(source.geostats)) {
    hasBands = source.geostats.bands.length > 1;
  }
  return { hasColumn: isVector, hasBands };
}

export function allowedTemporalModes(
  caps: SourceTemporalCapabilities
): TemporalCoverageMode[] {
  const modes: TemporalCoverageMode[] = ["none"];
  if (caps.hasColumn) modes.push("column");
  if (caps.hasBands) modes.push("bands");
  modes.push("year", "month", "span");
  return modes;
}

export function emptyTemporalFormState(
  mode: TemporalCoverageMode = "none"
): TemporalCoverageFormState {
  return {
    mode,
    year: "",
    month: "",
    from: "",
    through: "",
    spanPrecision: "year",
    ongoing: false,
  };
}

/** Narrow a stored ISO value to the unit the picker expects. */
export function coerceSpanValue(
  value: string,
  precision: SpanPrecision
): string {
  const parsed = parseTemporalIso(value.trim());
  if (!parsed) return "";
  return formatAtPrecision(
    new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)),
    precision
  );
}

export function spanPickerType(
  precision: SpanPrecision
): "text" | "month" | "date" {
  if (precision === "year") return "text";
  if (precision === "month") return "month";
  return "date";
}

export function formatAtPrecision(
  date: Date,
  precision: SpanPrecision
): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  if (precision === "year") return y;
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (precision === "month") return `${y}-${m}`;
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function exclusiveEndFromInclusive(
  start: string,
  precision: SpanPrecision
): string | null {
  const expanded = expandTemporalIso(start, precision);
  if (!expanded) return null;
  return formatAtPrecision(new Date(expanded.end), precision);
}

export function inclusiveThroughFromExclusive(
  exclusiveEnd: string,
  precision: SpanPrecision
): string | null {
  const parsed = parseTemporalIso(exclusiveEnd);
  if (!parsed) return null;
  const startOfEnd = expandTemporalIso(exclusiveEnd, precision);
  if (!startOfEnd) return null;
  return formatAtPrecision(new Date(startOfEnd.start - 1), precision);
}

export function isOneUnitInterval(
  start: string,
  exclusiveEnd: string | null,
  precision: SpanPrecision
): boolean {
  if (exclusiveEnd === null) return false;
  const expected = exclusiveEndFromInclusive(start, precision);
  return expected === exclusiveEnd;
}

function asSpanPrecision(precision: TemporalPrecision): SpanPrecision {
  if (precision === "year" || precision === "month" || precision === "day") {
    return precision;
  }
  return "day";
}

export function inferTemporalMode(
  info: TemporalInfo | null,
  caps: SourceTemporalCapabilities
): TemporalCoverageMode {
  if (!info) return "none";
  if (info.granularity === "feature" && caps.hasColumn) return "column";
  if (info.granularity === "band" && caps.hasBands) return "bands";
  if (info.granularity === "row" && caps.hasColumn) return "column";
  const precision = asSpanPrecision(info.coverage.precision);
  if (
    info.granularity === "layer" &&
    isOneUnitInterval(info.coverage.start, info.coverage.end, precision)
  ) {
    if (precision === "year") return "year";
    if (precision === "month") return "month";
  }
  return "span";
}

export function formStateFromTemporal(
  info: TemporalInfo | null,
  caps: SourceTemporalCapabilities
): TemporalCoverageFormState {
  const mode = inferTemporalMode(info, caps);
  const empty = emptyTemporalFormState(mode);
  if (!info) return empty;
  const precision = asSpanPrecision(info.coverage.precision);
  const through =
    info.coverage.end === null
      ? ""
      : inclusiveThroughFromExclusive(info.coverage.end, precision) ||
        info.coverage.end;
  const oneUnit = isOneUnitInterval(
    info.coverage.start,
    info.coverage.end,
    precision
  );
  return {
    mode,
    year:
      precision === "year"
        ? String(parseInt(info.coverage.start, 10) || info.coverage.start)
        : empty.year,
    month: precision === "month" ? info.coverage.start.slice(0, 7) : empty.month,
    from: info.coverage.start,
    through,
    spanPrecision: precision,
    ongoing: info.coverage.end === null,
    ...(oneUnit && precision === "year"
      ? { year: String(parseInt(info.coverage.start, 10)) }
      : {}),
    ...(oneUnit && precision === "month"
      ? { month: info.coverage.start.slice(0, 7) }
      : {}),
  };
}

export type TemporalFormResult =
  | { ok: true; temporal: TemporalInfo | null }
  | { ok: false; error: string };

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function matchesPrecision(value: string, precision: SpanPrecision): boolean {
  if (precision === "year") return YEAR_RE.test(value);
  if (precision === "month") return MONTH_RE.test(value);
  return DAY_RE.test(value) && parseTemporalIso(value) !== null;
}

function createLayerDocument(
  start: string,
  exclusiveEnd: string | null,
  precision: SpanPrecision
): TemporalInfo {
  return {
    version: 1,
    granularity: "layer",
    coverage: {
      kind: "interval",
      start,
      end: exclusiveEnd,
      precision,
    },
    nativeResolution: precision,
    defaultViewResolution: precision,
    authoredBy: "admin",
  };
}

export function temporalFromFormState(
  state: TemporalCoverageFormState
): TemporalFormResult {
  if (state.mode === "none") {
    return { ok: true, temporal: null };
  }
  if (state.mode === "column" || state.mode === "bands") {
    return {
      ok: false,
      error: "unimplemented",
    };
  }
  if (state.mode === "year") {
    const year = state.year.trim();
    if (!YEAR_RE.test(year)) {
      return { ok: false, error: "year" };
    }
    return {
      ok: true,
      temporal: createLayerDocument(year, String(parseInt(year, 10) + 1), "year"),
    };
  }
  if (state.mode === "month") {
    const month = state.month.trim();
    if (!MONTH_RE.test(month)) {
      return { ok: false, error: "month" };
    }
    const end = exclusiveEndFromInclusive(month, "month");
    if (!end) return { ok: false, error: "month" };
    return { ok: true, temporal: createLayerDocument(month, end, "month") };
  }
  const from = state.from.trim();
  if (!matchesPrecision(from, state.spanPrecision)) {
    return { ok: false, error: "from" };
  }
  if (state.ongoing) {
    return {
      ok: true,
      temporal: createLayerDocument(from, null, state.spanPrecision),
    };
  }
  const through = state.through.trim();
  if (!matchesPrecision(through, state.spanPrecision)) {
    return { ok: false, error: "through" };
  }
  if (through < from) {
    return { ok: false, error: "order" };
  }
  const end = exclusiveEndFromInclusive(through, state.spanPrecision);
  if (!end) return { ok: false, error: "through" };
  return {
    ok: true,
    temporal: createLayerDocument(from, end, state.spanPrecision),
  };
}

/* Date labels are ISO / numeric; presentText is already translated. */
/* eslint-disable i18next/no-literal-string */
export function summarizeTemporalInfo(
  value: unknown,
  presentText: string
): { label: string; chip: "bands" | "features" | null } {
  if (!isTemporalInfo(value)) {
    return { label: "", chip: null };
  }
  const precision = asSpanPrecision(value.coverage.precision);
  const start = value.coverage.start;
  let label: string;
  if (value.coverage.end === null) {
    // eslint-disable-next-line i18next/no-literal-string
    label = `${start}–${presentText}`;
  } else if (isOneUnitInterval(start, value.coverage.end, precision)) {
    label = precision === "year" ? String(parseInt(start, 10)) : start;
  } else {
    const through =
      inclusiveThroughFromExclusive(value.coverage.end, precision) ||
      value.coverage.end;
    label =
      precision === "year"
        ? // eslint-disable-next-line i18next/no-literal-string
          `${parseInt(start, 10)}–${parseInt(through, 10)}`
        : // eslint-disable-next-line i18next/no-literal-string
          `${start}–${through}`;
  }
  if (value.granularity === "band") {
    return { label, chip: "bands" };
  }
  if (value.granularity === "feature" || value.granularity === "row") {
    return { label, chip: "features" };
  }
  return { label, chip: null };
}
/* eslint-enable i18next/no-literal-string */
