/**
 * Parses query string parameters for the /query endpoint.
 *
 * Built-in parameters use bare names (f, groupBy, op, column, limit, offset,
 * orderBy). Column filters use a `q.` prefix with PostgREST-style operators
 * embedded in the value:
 *
 *   q.year=2018                          equality (bare value)
 *   q.year=eq.2018                       equality (explicit)
 *   q.count=gte.5                        gt / gte / lt / lte / neq
 *   q.observer=in.(Chad Burt,Lyal B)     IN list ("quoted" items may contain commas)
 *   q.code=not.in.(PeopleAll,DogsAll)    NOT IN list; empty cells are kept
 *   q.size=is.null / q.size=not.null     null tests
 *
 * Repeating the same q.<col> param ANDs the conditions together.
 */

export type OutputFormat = "json" | "html";

export const AGGREGATIONS = [
  "count",
  "sum",
  "mean",
  "min",
  "max",
  "median",
] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];

export const WITHIN_AGGREGATIONS = ["sum", "mean", "min", "max"] as const;
export type WithinAggregation = (typeof WITHIN_AGGREGATIONS)[number];

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "notIn"
  | "isNull"
  | "notNull";

/** A filter as parsed from the query string, before schema-aware coercion. */
export interface RawFilter {
  column: string;
  op: FilterOperator;
  /** Raw string value for eq/neq/gt/gte/lt/lte. */
  value?: string;
  /** Raw string values for `in`. */
  values?: string[];
}

export interface TemporalWhenFilter {
  /** Inclusive clock start, UTC seconds since epoch. */
  startSec: number;
  /** Exclusive clock end, UTC seconds since epoch. */
  endSec: number;
}

export type WhenStepPrecision =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second";

export interface ParsedQuery {
  /** null means "negotiate via the Accept header" */
  format: OutputFormat | null;
  groupBy: string[];
  /**
   * Replicate columns. Code name: replicateBy.
   * With the row's survey time (`_when_start`, `_when_end`) and `groupBy`,
   * these identify one replicate. Empty means each row is already a summary.
   */
  replicateBy: string[];
  /** Within a replicate. Code name: within. Required when `replicateBy` is set. */
  within: WithinAggregation | null;
  ops: Aggregation[];
  /** Value column. Code name: column. Required for every op except count. */
  column: string | null;
  limit: number | null;
  offset: number;
  orderBy: { key: string; direction: "asc" | "desc" } | null;
  /** Survey filters. Code name: q.*. Selecting these chooses which replicates exist. */
  filters: RawFilter[];
  /**
   * Subject and detail filters. Code name: v.* / contributionFilters.
   * Applied after a replicate is registered. They narrow what is counted
   * and never drop the replicate.
   */
  contributionFilters: RawFilter[];
  /** Subject column. Rows whose value is an effort marker do not contribute. */
  subjectColumn: string | null;
  /** Detail columns. Filters on them gate contribution without dropping replicates. */
  detailColumns: string[];
  /** Nothing seen rows. Code name: effortMarkers. Matched against the subject column only. */
  effortMarkers: string[];
  /**
   * When a subject is missing from a replicate.
   * Null outside replicate mode. Defaults to all_surveyed when replicateBy is set.
   */
  coverageMode: "all_surveyed" | "rows_only" | "coverage_file" | null;
  /** Join column. Required when `explain` is set, so the audit modal can name one feature. */
  joinColumn: string | null;
  /**
   * When true, aggregate output includes one entry per replicate for a single
   * join-column equality filter.
   */
  explain: boolean;
  /**
   * Optional map-clock filter. Applied as
   * `_when_start < endSec && _when_end > startSec` when those columns exist;
   * ignored when they do not.
   */
  when: TemporalWhenFilter | null;
  /**
   * When set with `when`, aggregated groups are also keyed by the time-step
   * bin they overlap (`when.step=year` → `"2018"`). Requires `when.start` /
   * `when.end` and at least one aggregation.
   */
  whenStep: WhenStepPrecision | null;
  /**
   * Raw-row queries only (`includeWhen=1`): include the derived
   * `_when_start` / `_when_end` columns (UTC epoch seconds) in row output
   * instead of stripping them. Lets QA/QC clients show exactly which
   * temporal interval the engine assigned to each row.
   */
  includeWhen: boolean;
}

/** Upper bound for `limit` and `offset`; keeps responses and sort buffers
 * within Workers memory limits. */
export const MAX_LIMIT = 100000;

export class QueryError extends Error {
  status: number;
  details?: Record<string, unknown>;
  constructor(
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.details = details;
  }
}


const COMPARISON_PREFIX = /^(eq|neq|gt|gte|lt|lte)\.([\s\S]*)$/;

/**
 * Parses the inner portion of an `in.(...)` list. Items may be double-quoted
 * to include commas or leading/trailing whitespace, e.g.
 * `in.("Smith, John",UCSB)`.
 */
export function parseInList(inner: string): string[] {
  const values: string[] = [];
  let i = 0;
  while (i < inner.length) {
    // skip whitespace between items
    while (i < inner.length && inner[i] === " ") i++;
    if (inner[i] === '"') {
      // quoted item; "" escapes a literal quote
      let value = "";
      i++;
      while (i < inner.length) {
        if (inner[i] === '"' && inner[i + 1] === '"') {
          value += '"';
          i += 2;
        } else if (inner[i] === '"') {
          i++;
          break;
        } else {
          value += inner[i];
          i++;
        }
      }
      values.push(value);
      // skip to next comma
      while (i < inner.length && inner[i] !== ",") i++;
      i++;
    } else {
      let end = inner.indexOf(",", i);
      if (end === -1) end = inner.length;
      values.push(inner.slice(i, end).trim());
      i = end + 1;
    }
  }
  return values.filter((v) => v.length > 0);
}

function parseFilterParam(column: string, raw: string): RawFilter {
  if (raw === "is.null") {
    return { column, op: "isNull" };
  }
  if (raw === "not.null") {
    return { column, op: "notNull" };
  }
  if (raw.startsWith("not.in.")) {
    if (!raw.startsWith("not.in.(") || !raw.endsWith(")")) {
      throw new QueryError(
        `Malformed not.in list for column "${column}". Use not.in.(a,b,"c,d").`
      );
    }
    const values = parseInList(raw.slice(8, -1));
    if (values.length === 0) {
      throw new QueryError(
        `Empty not.in.() list for column "${column}". Provide at least one value.`
      );
    }
    return { column, op: "notIn", values };
  }
  if (raw.startsWith("in.")) {
    if (!raw.startsWith("in.(") || !raw.endsWith(")")) {
      throw new QueryError(
        `Malformed in list for column "${column}". Use in.(a,b,"c,d").`
      );
    }
    const values = parseInList(raw.slice(4, -1));
    if (values.length === 0) {
      throw new QueryError(
        `Empty in.() list for column "${column}". Provide at least one value.`
      );
    }
    return { column, op: "in", values };
  }
  const match = COMPARISON_PREFIX.exec(raw);
  if (match) {
    return {
      column,
      op: match[1] as FilterOperator,
      value: match[2],
    };
  }
  // bare value = equality
  return { column, op: "eq", value: raw };
}

export function parseQueryParams(searchParams: URLSearchParams): ParsedQuery {
  const filters: RawFilter[] = [];
  const contributionFilters: RawFilter[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("q.")) {
      const column = key.slice(2);
      if (!column) {
        throw new QueryError(`Invalid filter parameter "${key}".`);
      }
      filters.push(parseFilterParam(column, value));
    } else if (key.startsWith("v.")) {
      const column = key.slice(2);
      if (!column) {
        throw new QueryError(`Invalid filter parameter "${key}".`);
      }
      contributionFilters.push(parseFilterParam(column, value));
    }
  }

  let format: OutputFormat | null = null;
  const f = searchParams.get("f");
  if (f !== null) {
    if (f !== "json" && f !== "html") {
      throw new QueryError(`Invalid format "${f}". Use f=json or f=html.`);
    }
    format = f;
  }

  const groupBy = (searchParams.get("groupBy") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const replicateBy = (searchParams.get("replicateBy") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const withinRaw = searchParams.get("within");
  let within: WithinAggregation | null = null;
  if (replicateBy.length > 0) {
    if (withinRaw === null || withinRaw.trim() === "") {
      throw new QueryError(
        `replicateBy requires within (sum, mean, min, or max).`
      );
    }
    if (!(WITHIN_AGGREGATIONS as readonly string[]).includes(withinRaw.trim())) {
      throw new QueryError(
        `Invalid within "${withinRaw}". Use ${WITHIN_AGGREGATIONS.join(", ")}.`
      );
    }
    within = withinRaw.trim() as WithinAggregation;
    const overlap = replicateBy.filter((name) => groupBy.includes(name));
    if (overlap.length > 0) {
      throw new QueryError(
        `replicateBy cannot include groupBy column(s): ${overlap.join(", ")}.`
      );
    }
  }

  const ops: Aggregation[] = [];
  const opParam = searchParams.get("op");
  if (opParam !== null) {
    for (const op of opParam.split(",").map((s) => s.trim())) {
      if (!op) continue;
      if (!(AGGREGATIONS as readonly string[]).includes(op)) {
        throw new QueryError(
          `Unknown aggregation "${op}". Supported: ${AGGREGATIONS.join(", ")}.`
        );
      }
      if (!ops.includes(op as Aggregation)) {
        ops.push(op as Aggregation);
      }
    }
  }

  const column = searchParams.get("column");
  const needsColumn = ops.filter((op) => op !== "count");
  if (needsColumn.length > 0 && !column) {
    throw new QueryError(
      `The "column" parameter is required for op=${needsColumn.join(",")}.`
    );
  }
  if (groupBy.length > 0 && ops.length === 0) {
    throw new QueryError(
      `groupBy requires at least one aggregation via the "op" parameter.`
    );
  }
  if (
    contributionFilters.length > 0 &&
    ops.length > 0 &&
    replicateBy.length === 0
  ) {
    throw new QueryError(
      "v.* filters require replicateBy and within. Subject and detail filters are only applied inside replicates."
    );
  }

  let limit: number | null = null;
  const limitParam = searchParams.get("limit");
  if (limitParam !== null && limitParam.trim() !== "") {
    if (!/^\d+$/.test(limitParam.trim())) {
      throw new QueryError(
        `Invalid limit "${limitParam}". Must be a positive integer, or omit for no limit.`
      );
    }
    limit = parseInt(limitParam, 10);
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new QueryError(
        `Invalid limit "${limitParam}". Must be between 1 and ${MAX_LIMIT}.`
      );
    }
  }

  let offset = 0;
  const offsetParam = searchParams.get("offset");
  if (offsetParam !== null) {
    if (!/^\d+$/.test(offsetParam.trim())) {
      throw new QueryError(
        `Invalid offset "${offsetParam}". Must be a non-negative integer.`
      );
    }
    offset = parseInt(offsetParam, 10);
    if (offset > MAX_LIMIT) {
      throw new QueryError(
        `Invalid offset "${offsetParam}". Must be at most ${MAX_LIMIT}.`
      );
    }
  }

  let orderBy: ParsedQuery["orderBy"] = null;
  const orderByParam = searchParams.get("orderBy");
  if (orderByParam !== null && orderByParam.trim().length > 0) {
    // Split on the last colon so keys containing ":" still parse.
    const raw = orderByParam.trim();
    const colon = raw.lastIndexOf(":");
    let key = raw;
    let direction: "asc" | "desc" = "asc";
    if (colon !== -1) {
      const suffix = raw.slice(colon + 1);
      if (suffix !== "asc" && suffix !== "desc") {
        throw new QueryError(
          `Invalid orderBy direction "${suffix}". Use :asc or :desc.`
        );
      }
      key = raw.slice(0, colon);
      direction = suffix;
    }
    key = key.trim();
    if (!key) {
      throw new QueryError(`orderBy requires a key, e.g. orderBy=mean:desc.`);
    }
    orderBy = { key, direction };
  }

  const when = parseWhenParams(searchParams);
  const whenStep = parseWhenStepParam(searchParams, when, ops, groupBy);
  const includeWhen = parseIncludeWhenParam(searchParams, ops);
  const subjectColumn = blankToNull(searchParams.get("subjectColumn"));
  const detailColumns = splitCsv(searchParams.get("detailColumns"));
  const effortMarkers = splitCsv(searchParams.get("effortMarkers"));
  const joinColumn = blankToNull(searchParams.get("joinColumn"));
  const coverageMode = parseCoverageMode(searchParams.get("coverageMode"));
  const explain = searchParams.get("explain") === "1";

  const resolvedCoverage =
    replicateBy.length === 0 ? null : coverageMode ?? "all_surveyed";

  if (explain) {
    if (!joinColumn) {
      throw new QueryError("explain=1 requires joinColumn.");
    }
    const joinEqualities = filters.filter(
      (filter) => filter.column === joinColumn && filter.op === "eq"
    );
    const otherJoin = filters.filter(
      (filter) => filter.column === joinColumn && filter.op !== "eq"
    );
    if (joinEqualities.length !== 1 || otherJoin.length > 0) {
      throw new QueryError(
        "explain=1 requires a single join-column equality filter."
      );
    }
  }

  if (effortMarkers.length > 0 && subjectColumn) {
    const markerSet = new Set(effortMarkers);
    for (const filter of contributionFilters) {
      if (filter.column !== subjectColumn) continue;
      const values =
        filter.op === "eq" && filter.value !== undefined
          ? [filter.value]
          : filter.op === "in"
            ? filter.values || []
            : [];
      for (const value of values) {
        if (markerSet.has(value)) {
          throw new QueryError(
            `"${value}" is a nothing-seen value and cannot be filtered.`
          );
        }
      }
    }
  }

  return {
    format,
    groupBy,
    replicateBy,
    within,
    ops,
    column,
    limit,
    offset,
    orderBy,
    filters,
    contributionFilters,
    subjectColumn,
    detailColumns,
    effortMarkers,
    coverageMode: resolvedCoverage,
    joinColumn,
    explain,
    when,
    whenStep,
    includeWhen,
  };
}

function splitCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function blankToNull(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCoverageMode(
  raw: string | null
): "all_surveyed" | "rows_only" | "coverage_file" | null {
  if (raw === null || raw.trim() === "") return null;
  if (
    raw === "all_surveyed" ||
    raw === "rows_only" ||
    raw === "coverage_file"
  ) {
    return raw;
  }
  throw new QueryError(
    `Invalid coverageMode "${raw}". Use all_surveyed, rows_only, or coverage_file.`
  );
}

const WHEN_START_COLUMN = "_when_start";
const WHEN_END_COLUMN = "_when_end";

export function isHiddenWhenColumn(name: string): boolean {
  return name === WHEN_START_COLUMN || name === WHEN_END_COLUMN;
}

export { WHEN_START_COLUMN, WHEN_END_COLUMN };

/**
 * `nocache=true` (or `1`) tells the query endpoint not to emit browser or CDN
 * cache headers. The response is `Cache-Control: no-store` and
 * `CDN-Cache-Control: no-store`, with no ETag.
 */
export function nocacheRequested(searchParams: URLSearchParams): boolean {
  const raw = searchParams.get("nocache");
  return raw === "true" || raw === "1";
}

/** Headers that keep a response out of the browser cache and the CDN. */
export function nocacheResponseHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "CDN-Cache-Control": "no-store",
  };
}

function parseEpochSeconds(raw: string, label: string): number {
  if (!/^-?\d+$/.test(raw.trim())) {
    throw new QueryError(
      `Invalid ${label} "${raw}". Use integer UTC seconds since epoch.`
    );
  }
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) {
    throw new QueryError(
      `Invalid ${label} "${raw}". Value is outside the safe integer range.`
    );
  }
  return n;
}

function parseWhenParams(
  searchParams: URLSearchParams
): TemporalWhenFilter | null {
  const startRaw = searchParams.get("when.start");
  const endRaw = searchParams.get("when.end");
  if (startRaw === null && endRaw === null) return null;
  if (startRaw === null || endRaw === null) {
    throw new QueryError(
      `when.start and when.end must be provided together (UTC epoch seconds).`
    );
  }
  const startSec = parseEpochSeconds(startRaw, "when.start");
  const endSec = parseEpochSeconds(endRaw, "when.end");
  if (!(endSec > startSec)) {
    throw new QueryError(
      `when.end must be greater than when.start (half-open interval).`
    );
  }
  return { startSec, endSec };
}

const WHEN_STEP_VALUES: WhenStepPrecision[] = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
];

function parseWhenStepParam(
  searchParams: URLSearchParams,
  when: TemporalWhenFilter | null,
  ops: Aggregation[],
  groupBy: string[]
): WhenStepPrecision | null {
  const raw = searchParams.get("when.step");
  if (raw === null || raw.trim() === "") return null;
  const step = raw.trim();
  if (!(WHEN_STEP_VALUES as string[]).includes(step)) {
    throw new QueryError(
      `Invalid when.step "${raw}". Use ${WHEN_STEP_VALUES.join(", ")}.`
    );
  }
  if (!when) {
    throw new QueryError(
      `when.step requires when.start and when.end (the full series range).`
    );
  }
  if (ops.length === 0) {
    throw new QueryError(
      `when.step requires an aggregation via the "op" parameter.`
    );
  }
  if (groupBy.includes("step")) {
    throw new QueryError(
      `groupBy cannot include "step" when when.step is set; "step" is reserved.`
    );
  }
  return step as WhenStepPrecision;
}

function parseIncludeWhenParam(
  searchParams: URLSearchParams,
  ops: Aggregation[]
): boolean {
  const raw = searchParams.get("includeWhen");
  if (raw === null || raw.trim() === "") return false;
  const value = raw.trim();
  if (value !== "1" && value !== "true") {
    throw new QueryError(
      `Invalid includeWhen "${raw}". Use includeWhen=1 to include the derived _when_* columns in raw row output.`
    );
  }
  if (ops.length > 0) {
    throw new QueryError(
      `includeWhen is only supported for raw row queries (omit the "op" parameter).`
    );
  }
  return true;
}

/**
 * Produces a canonical query string so that logically identical requests
 * (parameter order, whitespace) share a single cache entry.
 */
export function canonicalQueryString(searchParams: URLSearchParams): string {
  const entries: [string, string][] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "f") continue; // format normalized separately
    entries.push([key, value]);
  }
  entries.sort((a, b) =>
    a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
  );
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.append(key, value);
  }
  return params.toString();
}
