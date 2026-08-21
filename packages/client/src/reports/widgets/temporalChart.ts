import {
  expandTemporalValue,
  isTemporalInfo,
  TemporalPrecision,
} from "@seasketch/geostats-types";

const PRECISION_RANK: Record<TemporalPrecision, number> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
  minute: 4,
  second: 5,
};

const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const ISO_DATE_RE =
  /\b\d{4}-\d{2}(?:-\d{2})?(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?\b/g;
const MONTH_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;

export type TemporalCoverage = {
  /** Inclusive start, ms since epoch (UTC). */
  start: number;
  /** Exclusive end, ms since epoch (UTC). */
  end: number;
  /** True when coverage is longer than one native-resolution unit. */
  span: boolean;
  label: string;
  nativeResolution: TemporalPrecision;
};

export type TimeSeriesTocItem = {
  id: number;
  title: string;
  stableId: string;
  parentStableId?: string | null;
  isFolder?: boolean | null;
};

export type TimeSeriesSiblingSource = {
  stableId: string;
  tableOfContentsItemId?: number | null;
  rasterBandCount?: number | null;
  styleGroupByColumn?: string | null;
  tableOfContentsItem?: { title?: string | null } | null;
};

/**
 * Expands a source's TemporalInfo coverage to a UTC interval used for
 * plotting. Multi-unit coverage is flagged as a span. Returns null when
 * the layer has no usable temporal metadata.
 */
export function coverageForSource(source: unknown): TemporalCoverage | null {
  if (!source || typeof source !== "object") {
    return null;
  }
  if (!("temporal" in source)) {
    return null;
  }
  const temporal = source.temporal;
  if (!isTemporalInfo(temporal)) {
    return null;
  }
  const interval = expandTemporalValue(temporal.coverage);
  if (!interval || !(interval.end > interval.start)) {
    return null;
  }
  const nativeResolution = temporal.nativeResolution;
  const unit = nativeUnitMs(interval.start, nativeResolution);
  return {
    start: interval.start,
    end: interval.end,
    span: interval.end - interval.start > unit,
    label: coverageLabel(interval.start, interval.end, nativeResolution),
    nativeResolution,
  };
}

/**
 * @deprecated Prefer {@link coverageForSource}. Kept so export rows that
 * already expose `timePosition` keep a numeric sort key (coverage start).
 */
export function temporalPositionForSource(source: unknown): {
  x: number;
  label: string;
} | null {
  const coverage = coverageForSource(source);
  if (!coverage) return null;
  return { x: coverage.start, label: coverage.label };
}

/** Finest (most specific) native resolution among coverages. */
export function finestPrecision(
  coverages: Array<Pick<TemporalCoverage, "nativeResolution">>
): TemporalPrecision {
  let best: TemporalPrecision = "year";
  for (const c of coverages) {
    if (PRECISION_RANK[c.nativeResolution] > PRECISION_RANK[best]) {
      best = c.nativeResolution;
    }
  }
  return best;
}

export function formatTimeTick(
  ms: number,
  precision: TemporalPrecision
): string {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const month = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hour = pad2(d.getUTCHours());
  const minute = pad2(d.getUTCMinutes());
  switch (precision) {
    case "year":
      return String(y);
    case "month":
      // eslint-disable-next-line i18next/no-literal-string
      return `${y}-${month}`;
    case "day":
      // eslint-disable-next-line i18next/no-literal-string
      return `${y}-${month}-${day}`;
    case "hour":
      // eslint-disable-next-line i18next/no-literal-string
      return `${y}-${month}-${day} ${hour}:00`;
    case "minute":
    case "second":
      // eslint-disable-next-line i18next/no-literal-string
      return `${y}-${month}-${day} ${hour}:${minute}`;
    default:
      return String(y);
  }
}

/**
 * Split samples into observed runs. A new run starts when the next sample's
 * start is after the running exclusive end — i.e. TemporalInfo coverage
 * does not touch or overlap. That is the gap rule: missing time at the
 * declared resolution, not an observed-step heuristic.
 */
export function splitObservedRuns<T extends { start: number; end: number }>(
  samples: T[]
): T[][] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort(
    (a, b) => a.start - b.start || a.end - b.end
  );
  const runs: T[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const run = runs[runs.length - 1];
    const runEnd = Math.max(...run.map((s) => s.end));
    if (sorted[i].start <= runEnd) {
      run.push(sorted[i]);
    } else {
      runs.push([sorted[i]]);
    }
  }
  return runs;
}

/**
 * Strip year / ISO-date / month-name tokens from a layer title so yearly
 * siblings collapse to the same key ("DHW 2015" and "DHW 2016" → "dhw").
 */
export function titleKeyWithoutDates(title: string): string {
  return title
    .replace(ISO_DATE_RE, " ")
    .replace(YEAR_RE, " ")
    .replace(MONTH_RE, " ")
    .replace(/[\s,;:_\-–—./\\()[\]{}]+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Same-folder title siblings that look like the same raster series.
 * Requires TOC parent topology (folder or root). Returns other overlay
 * source stableIds only — never invents layers that are not already
 * processed for reporting.
 */
export function findTimeSeriesSiblingStableIds(args: {
  subject: TimeSeriesSiblingSource;
  sources: TimeSeriesSiblingSource[];
  tocItems: TimeSeriesTocItem[];
}): string[] {
  const { subject, sources, tocItems } = args;
  if (!subject.stableId || !subject.tableOfContentsItemId) {
    return [];
  }
  const subjectToc = tocItems.find((i) => i.id === subject.tableOfContentsItemId);
  if (!subjectToc || subjectToc.isFolder) {
    return [];
  }
  const parent = subjectToc.parentStableId ?? null;
  const key = titleKeyWithoutDates(
    subjectToc.title || subject.tableOfContentsItem?.title || ""
  );
  if (key.length < 2) {
    return [];
  }
  const subjectShape = rasterSeriesShape(subject);
  const ids: string[] = [];
  for (const item of tocItems) {
    if (item.isFolder || item.id === subjectToc.id) continue;
    if ((item.parentStableId ?? null) !== parent) continue;
    if (titleKeyWithoutDates(item.title) !== key) continue;
    const source = sources.find((s) => s.tableOfContentsItemId === item.id);
    if (!source?.stableId || source.stableId === subject.stableId) continue;
    if (rasterSeriesShape(source) !== subjectShape) continue;
    if (!ids.includes(source.stableId)) {
      ids.push(source.stableId);
    }
  }
  return ids;
}

/** First-band value domain from raster geostats, or null. */
export function rasterBandValueDomain(
  geostats: unknown
): [number, number] | null {
  if (!geostats || typeof geostats !== "object") return null;
  if (!("bands" in geostats)) return null;
  const bands = (geostats as { bands: unknown }).bands;
  if (!Array.isArray(bands) || bands.length === 0) return null;
  const band = bands[0];
  if (!band || typeof band !== "object") return null;
  const min =
    "minimum" in band ? (band as { minimum: unknown }).minimum : undefined;
  const max =
    "maximum" in band ? (band as { maximum: unknown }).maximum : undefined;
  if (typeof min !== "number" || typeof max !== "number") return null;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return [min, max];
}

/** Union of first-band domains across sources. */
export function unionRasterValueDomain(
  sources: Array<{ geostats?: unknown }>
): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const source of sources) {
    const domain = rasterBandValueDomain(source.geostats);
    if (!domain) continue;
    lo = Math.min(lo, domain[0]);
    hi = Math.max(hi, domain[1]);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return [lo, hi];
}

function rasterSeriesShape(source: TimeSeriesSiblingSource): string {
  const bands = source.rasterBandCount ?? 0;
  const categorical = source.styleGroupByColumn === "value";
  // eslint-disable-next-line i18next/no-literal-string
  return `${bands}:${categorical ? "cat" : "cont"}`;
}

function nativeUnitMs(start: number, precision: TemporalPrecision): number {
  const d = new Date(start);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  switch (precision) {
    case "year":
      return Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1);
    case "month":
      return Date.UTC(y, m + 1, 1) - Date.UTC(y, m, 1);
    case "day":
      return Date.UTC(y, m, day + 1) - Date.UTC(y, m, day);
    case "hour":
      return Date.UTC(y, m, day, h + 1) - Date.UTC(y, m, day, h);
    case "minute":
      return Date.UTC(y, m, day, h, min + 1) - Date.UTC(y, m, day, h, min);
    case "second":
      return (
        Date.UTC(y, m, day, h, min, s + 1) - Date.UTC(y, m, day, h, min, s)
      );
    default:
      return Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1);
  }
}

function coverageLabel(
  start: number,
  end: number,
  precision: TemporalPrecision
): string {
  const a = formatTimeTick(start, precision);
  const b = formatTimeTick(end - 1, precision);
  // eslint-disable-next-line i18next/no-literal-string
  return a === b ? a : `${a}–${b}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
