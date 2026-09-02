/* eslint-disable i18next/no-literal-string -- query URL serialization, not UI copy */

import {
  expandTemporalClock,
  expandTemporalValue,
  isTemporalInfo,
  isTemporalPrecision,
  sourceColumnNames,
  TemporalClock,
  TemporalPrecision,
  toDataTableTemporalSourceColumns,
} from "@seasketch/geostats-types";

/**
 * Data table query API — types and semantics for GET `/query` requests.
 *
 * Each overlay data table lives at an immutable R2 prefix under the parent
 * layer hosted UUID
 * (`projects/{slug}/public/{sourceUuid}/dataTables/{uploadId}`), served by
 * the Overlay Data Server (`uploads.seasketch.org` / pmtiles-server). Map
 * clients compile {@link DataTableQuerySettings} into query-string
 * parameters, fetch aggregated JSON (with `access_token` when required by
 * the parent layer ACL), and join results to vector features using
 * `column-stats.json` join metadata.
 *
 * **Endpoints** (relative to `{tablePath}` or `OverlayDataTable.queryUrl`):
 *
 * - `GET /{tablePath}/query` — DataTablesBackend aggregation (`f=json` or HTML UI)
 * - `GET /{tablePath}/column-stats.json` — column metadata and join stats
 * - `GET /{tablePath}/data.parquet` — download underlying parquet
 *
 * **Query modes**
 *
 * 1. *Aggregated* — set {@link DataTableQuerySettings.groupBy} and
 *    {@link DataTableQuerySettings.op}. Response contains a `groups` array; each
 *    object has the group key column(s) plus one property per aggregation.
 * 2. *Raw rows* — omit `groupBy` and `op`. Response contains a `rows` array
 *    (all columns). Rarely used for map joins.
 *
 * **Built-in query parameters**
 *
 * | Param | Description |
 * | ----- | ----------- |
 * | `f` | `json` (default) or `html` (interactive query UI) |
 * | `groupBy` | Comma-separated columns, e.g. `site` or `site,year` |
 * | `op` | Comma-separated: `count`, `sum`, `mean`, `min`, `max`, `median` |
 * | `column` | Numeric column to aggregate; required unless only `count` |
 * | `orderBy` | Sort key, optional `:desc`, e.g. `mean:desc` or `site` |
 * | `limit` | Max groups/rows (omit for no limit) |
 * | `offset` | Skip N groups/rows after sorting (default 0) |
 * | `when.start` / `when.end` | Half-open clock window (UTC epoch seconds) |
 * | `when.step` | With `when.*`, aggregate every timeslider step in that range |
 *
 * **Column filters** use a `q.{columnName}` prefix with PostgREST-style
 * operators in the value. See {@link DataTableFilter} and
 * {@link serializeDataTableFilter}.
 *
 * **JSON response** (aggregated): `{ table, totalRows, rowsScanned, rowsMatched,
 * rowGroups, timing, groups }`. Raw mode returns `rows` instead of `groups`.
 *
 * Implementation: `packages/pmtiles-server/src/dataTables/params.ts`.
 * Extended reference: `packages/pmtiles-server/README.md`.
 *
 * @module dataTableQueryApi
 */

/** Aggregation operations supported by the query endpoint. */
export type DataTableAggregation =
  | "count"
  | "sum"
  | "mean"
  | "min"
  | "max"
  | "median";

/** All aggregation operations, in the order they should be presented in UI. */
export const DATA_TABLE_AGGREGATIONS: DataTableAggregation[] = [
  "mean",
  "sum",
  "count",
  "min",
  "max",
  "median",
];

/**
 * Filter operator for structured settings. Matches `FilterOperator` in
 * `packages/pmtiles-server/src/dataTables/params.ts`.
 *
 * URL encoding: `isNull` → `q.{col}=is.null`, `notNull` → `q.{col}=not.null`.
 * There is no `not.in`; use `neq` or multiple filters instead.
 */
export type DataTableFilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "isNull"
  | "notNull";

/**
 * A single column filter. Serializes to `q.{column}=…` via
 * {@link serializeDataTableFilter}.
 */
export interface DataTableFilter {
  column: string;
  op: DataTableFilterOperator;
  /** Required for all ops except `isNull`, `notNull`, and `in`. */
  value?: string;
  /** List items for `in`. Items may contain commas; they are quoted on serialization. */
  values?: string[];
}

/**
 * Returns the list items of an `in` filter, tolerating the legacy
 * comma-joined `value` representation.
 */
/** Date columns replaced by the map clock; must not also appear as `q.*`. */
export function temporalSourceFilterColumns(temporal: unknown): string[] {
  if (!isTemporalInfo(temporal) || temporal.mapping?.type !== "row") {
    return [];
  }
  const mapped = temporal.mapping.sourceColumns
    ? toDataTableTemporalSourceColumns(temporal.mapping.sourceColumns)
    : null;
  return mapped ? sourceColumnNames(mapped) : [];
}

export function omitFiltersForColumns(
  filters: DataTableFilter[] | undefined,
  columns: string[]
): DataTableFilter[] | undefined {
  if (!filters || columns.length === 0) {
    return filters;
  }
  const hidden = new Set(columns);
  const next = filters.filter((filter) => !hidden.has(filter.column));
  return next;
}

export function dataTableInFilterValues(filter: DataTableFilter): string[] {
  if (filter.values) {
    return filter.values;
  }
  return (filter.value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Structured settings for querying a data table for map display. Compile with
 * {@link buildDataTableQuerySearchParams} and append to `{queryUrl}`.
 *
 * Applied on top of any base data table settings set by the admin.
 */
export interface DataTableQuerySettings {
  /** Aggregation(s) to compute per group. Multiple ops share one `column`. */
  op?: DataTableAggregation | DataTableAggregation[];
  /** Numeric column to aggregate. Omit when using `count` alone (row count). */
  column?: string;
  /** Group key column(s), e.g. the join column for a thematic map. */
  groupBy?: string | string[];
  filters?: DataTableFilter[];
  /** Half-open clock window in UTC epoch seconds (`when.start` / `when.end`). */
  when?: { start: number; end: number } | null;
  /**
   * With {@link when}, request one series covering every timeslider step
   * (`when.step=year`). Groups include a `step` key; the response also has
   * `series` summary stats (global scale, per-step row counts).
   */
  whenStep?: TemporalPrecision | null;
}

/**
 * Clock → `/query` `when.*` params.
 *
 * Instant: one `when.step` series over the table's full coverage so the
 * slider can scrub from cache. Window (range): a single aggregate over the
 * selected `[start, end)` — means/sums must be recalculated by the engine,
 * not combined from per-step bins (rows can overlap multiple steps).
 */
export function dataTableQueryClockParams(
  clock: TemporalClock | null,
  temporal: unknown
): Pick<DataTableQuerySettings, "when" | "whenStep"> {
  if (
    !isTemporalInfo(temporal) ||
    temporal.granularity !== "row" ||
    temporal.mapping?.type !== "row"
  ) {
    return {};
  }
  if (!clock) {
    return {};
  }
  if (clock.mode === "window") {
    const expanded = expandTemporalClock(clock);
    if (!expanded || !(expanded.end > expanded.start)) {
      return {};
    }
    return {
      when: {
        start: Math.floor(expanded.start / 1000),
        end: Math.floor(expanded.end / 1000),
      },
    };
  }
  const coverage = expandTemporalValue(temporal.coverage);
  if (coverage && coverage.end > coverage.start) {
    return {
      when: {
        start: Math.floor(coverage.start / 1000),
        end: Math.floor(coverage.end / 1000),
      },
      whenStep:
        clock.viewResolution ||
        temporal.defaultViewResolution ||
        temporal.nativeResolution ||
        "year",
    };
  }
  const expanded = expandTemporalClock(clock);
  if (!expanded || !(expanded.end > expanded.start)) {
    return {};
  }
  return {
    when: {
      start: Math.floor(expanded.start / 1000),
      end: Math.floor(expanded.end / 1000),
    },
  };
}

/**
 * Admin-configured constraints on how a data table may be visualized, as
 * stored on `overlay_data_tables.visualization_columns` /
 * `.visualization_ops` / `.required_filter_columns`. Empty/null
 * visualization columns/ops means "no constraint -- let the end user
 * choose". Empty required filter columns means no filters are forced.
 */
export interface DataTableVisualizationConstraints {
  visualizationColumns?: (string | null)[] | null;
  visualizationOps?: (string | null)[] | null;
  /** Columns that must always appear as map filters (values are user-chosen). */
  requiredFilterColumns?: (string | null)[] | null;
}

/** Metadata needed by the legend display settings UI before query/style work begins. */
export interface DataTableVisualizationMetadata
  extends DataTableVisualizationConstraints {
  queryUrl?: string | null;
  columnStatsUrl?: string | null;
}

/** Raw user picks from the "Display settings" UI, before reconciling with admin constraints. */
export interface DataTableUserVisualizationChoice {
  column?: string;
  op?: DataTableAggregation;
  filters?: DataTableFilter[];
}

/** Result of {@link resolveDataTableVisualizationSettings}: a valid, ready-to-query column/op pair. */
export interface ResolvedDataTableVisualization {
  column?: string;
  op: DataTableAggregation;
  filters?: DataTableFilter[];
  requiredFilterColumns: string[];
}

/**
 * Combines admin-set constraints ({@link DataTableVisualizationConstraints})
 * with the end user's choice in "Display settings" to produce a valid
 * column/op pair to pass to {@link buildDataTableQuerySearchParams}:
 *
 * - `op` must be one of `visualizationOps` when that list is non-empty;
 *   otherwise falls back to the user's choice, or `"mean"`.
 * - `column` must be one of `visualizationColumns` when that list is
 *   non-empty; otherwise falls back to the user's choice. When neither
 *   admin constraints nor a user choice supply a column, callers should
 *   treat **all numeric columns** (from column-stats) as valid and pick a
 *   default — see {@link DataTableVisualizationControls}.
 */
export function resolveDataTableVisualizationSettings(
  constraints: DataTableVisualizationConstraints,
  userChoice: DataTableUserVisualizationChoice
): ResolvedDataTableVisualization {
  const allowedOps = (constraints.visualizationOps?.filter(
    (op): op is DataTableAggregation =>
      Boolean(op) && (DATA_TABLE_AGGREGATIONS as string[]).includes(op!)
  ) || []) as DataTableAggregation[];

  const op =
    allowedOps.length > 0
      ? userChoice.op && allowedOps.includes(userChoice.op)
        ? userChoice.op
        : allowedOps[0]
      : userChoice.op || "mean";

  const allowedColumns = (constraints.visualizationColumns?.filter(
    (column): column is string => Boolean(column)
  ) || []) as string[];

  const column =
    allowedColumns.length > 0
      ? userChoice.column && allowedColumns.includes(userChoice.column)
        ? userChoice.column
        : allowedColumns[0]
      : userChoice.column;

  const requiredFilterColumns = (constraints.requiredFilterColumns?.filter(
    (column): column is string => Boolean(column)
  ) || []) as string[];

  return {
    column,
    op,
    filters: userChoice.filters,
    requiredFilterColumns,
  };
}

/** Normalize admin-required filter column names (drop empties, preserve order). */
export function requiredDataTableFilterColumns(
  constraints: DataTableVisualizationConstraints
): string[] {
  return (constraints.requiredFilterColumns?.filter(
    (column): column is string => Boolean(column)
  ) || []) as string[];
}

/**
 * Prefer a sensible default numeric column when admin visualization
 * constraints are empty. Prefers a column named `count` when present.
 */
export function pickDefaultDataTableColumn(
  numericColumns: string[]
): string | undefined {
  if (numericColumns.length === 0) {
    return undefined;
  }
  const countColumn = numericColumns.find(
    (column) => column.toLowerCase() === "count"
  );
  return countColumn || numericColumns[0];
}

/**
 * Serialize one {@link DataTableFilter} to a `q.{column}` query parameter value.
 */
export function serializeDataTableFilter(filter: DataTableFilter): string {
  const { column, op, value } = filter;
  switch (op) {
    case "isNull":
      return "is.null";
    case "notNull":
      return "not.null";
    case "in": {
      const rawItems = dataTableInFilterValues(filter);
      if (rawItems.length === 0) {
        throw new Error(`Filter on "${column}" with op "in" requires values`);
      }
      const items = rawItems.map((item) => {
        const trimmed = item.trim();
        if (trimmed.includes(",") || trimmed.includes('"')) {
          return `"${trimmed.replace(/"/g, '""')}"`;
        }
        return trimmed;
      });
      return `in.(${items.join(",")})`;
    }
    case "eq":
      return value ?? "";
    default:
      if (value === undefined) {
        throw new Error(`Filter on "${column}" with op "${op}" requires value`);
      }
      return `${op}.${value}`;
  }
}

/**
 * Compile {@link DataTableQuerySettings} into URLSearchParams for a GET query.
 * Does not set `f`; callers should request JSON via `Accept: application/json`
 * or `f=json`.
 */
export function buildDataTableQuerySearchParams(
  settings: DataTableQuerySettings
): URLSearchParams {
  const params = new URLSearchParams();

  if (settings.groupBy !== undefined) {
    const groupBy = Array.isArray(settings.groupBy)
      ? settings.groupBy.join(",")
      : settings.groupBy;
    params.set("groupBy", groupBy);
  }

  if (settings.op !== undefined) {
    const op = Array.isArray(settings.op) ? settings.op.join(",") : settings.op;
    params.set("op", op);
  }

  if (settings.column !== undefined) {
    params.set("column", settings.column);
  }

  for (const filter of settings.filters ?? []) {
    params.append(`q.${filter.column}`, serializeDataTableFilter(filter));
  }

  if (settings.when) {
    params.set("when.start", String(settings.when.start));
    params.set("when.end", String(settings.when.end));
  }
  if (settings.whenStep) {
    params.set("when.step", settings.whenStep);
  }

  return params;
}

/** Structured `/query` failure. Server `QueryError` is `{ error, code?, ... }`. */
export type DataTableQueryFailure = {
  message: string;
  code?: string;
  step?: string;
  maxSteps?: number;
};

export const WHEN_STEP_LIMIT_ERROR_CODE = "when_step_limit";

export function isWhenStepLimitError(failure: DataTableQueryFailure): boolean {
  if (failure.code === WHEN_STEP_LIMIT_ERROR_CODE) {
    return true;
  }
  return /produces more than \d+ bins/.test(failure.message);
}

export function dataTableQueryFailureFromBody(
  body: unknown,
  fallback: string
): DataTableQueryFailure {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { message: fallback };
  }
  const record = body as { [key: string]: unknown };
  if (typeof record.error !== "string" || !record.error) {
    return { message: fallback };
  }
  return {
    message: record.error,
    code: typeof record.code === "string" ? record.code : undefined,
    step: typeof record.step === "string" ? record.step : undefined,
    maxSteps: typeof record.maxSteps === "number" ? record.maxSteps : undefined,
  };
}

/**
 * Read a failed `/query` response. Prefer the JSON `error` string so callers
 * can show the server reason instead of a generic HTTP status.
 */
export async function dataTableQueryFailureFromResponse(
  response: Response
): Promise<DataTableQueryFailure> {
  const fallback = `Failed to fetch data table query: ${
    response.statusText || response.status
  }`;
  try {
    return dataTableQueryFailureFromBody(await response.json(), fallback);
  } catch {
    return { message: fallback };
  }
}

/** One row/group object from an aggregated `/query` JSON response. */
export type DataTableQueryResultGroup = {
  [key: string]: string | number | null | undefined;
};

/** Parsed join values + scale extents from an aggregated query response. */
export interface ParsedDataTableQueryValues {
  values: { [featureId: string]: number };
  min: number;
  max: number;
  /** Min of positive values only (for bubble scale); 0 when none. */
  scaleMin: number;
  /** Max of positive values only (for bubble scale); 0 when none. */
  scaleMax: number;
  hasZero: boolean;
}

/**
 * Turn aggregated `/query` JSON into a featureId → numeric value map plus
 * extents used for data-table circle symbology.
 */
export function parseDataTableQueryGroups(
  groups: DataTableQueryResultGroup[] | null | undefined,
  joinColumn: string,
  op: DataTableAggregation | DataTableAggregation[] | undefined
): ParsedDataTableQueryValues {
  const resolvedOp = Array.isArray(op) ? op[0] : op;
  const values: { [featureId: string]: number } = {};
  for (const group of groups || []) {
    const featureId = group[joinColumn];
    const value = resolvedOp ? group[resolvedOp] : undefined;
    if (
      featureId !== null &&
      featureId !== undefined &&
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      values[String(featureId)] = value;
    }
  }
  const numericValues = Object.values(values);
  const positiveValues = numericValues.filter((value) => value > 0);
  return {
    values,
    min: numericValues.length ? Math.min(...numericValues) : 0,
    max: numericValues.length ? Math.max(...numericValues) : 0,
    scaleMin: positiveValues.length ? Math.min(...positiveValues) : 0,
    scaleMax: positiveValues.length ? Math.max(...positiveValues) : 0,
    hasZero: numericValues.some((value) => value === 0),
  };
}

export const EMPTY_DATA_TABLE_QUERY_VALUES: ParsedDataTableQueryValues = {
  values: {},
  min: 0,
  max: 0,
  scaleMin: 0,
  scaleMax: 0,
  hasZero: false,
};

export type DataTableQuerySeriesStepStat = {
  step: string;
  rows: number;
  groups: number;
};

/** Server `series` object on a `when.step` query. */
export type DataTableQuerySeriesMeta = {
  step: string;
  steps: string[];
  min: number;
  max: number;
  scaleMin: number;
  scaleMax: number;
  hasZero: boolean;
  stepStats: DataTableQuerySeriesStepStat[];
};

export type ParsedDataTableQuerySeries = DataTableQuerySeriesMeta & {
  byStep: { [step: string]: ParsedDataTableQueryValues };
  featureCountsByStep: { [step: string]: { [featureId: string]: number } };
};

export function isDataTableQuerySeriesMeta(
  value: unknown
): value is DataTableQuerySeriesMeta {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  if (!("step" in value) || !("steps" in value) || !("stepStats" in value)) {
    return false;
  }
  if (!isTemporalPrecision(value.step) || !Array.isArray(value.steps)) {
    return false;
  }
  if (!value.steps.every((step) => typeof step === "string")) {
    return false;
  }
  if (!Array.isArray(value.stepStats)) {
    return false;
  }
  if (!("min" in value) || !("max" in value)) {
    return false;
  }
  if (!("scaleMin" in value) || !("scaleMax" in value) || !("hasZero" in value)) {
    return false;
  }
  return (
    typeof value.min === "number" &&
    typeof value.max === "number" &&
    typeof value.scaleMin === "number" &&
    typeof value.scaleMax === "number" &&
    typeof value.hasZero === "boolean"
  );
}

export function isParsedDataTableQuerySeries(
  value: unknown
): value is ParsedDataTableQuerySeries {
  return (
    isDataTableQuerySeriesMeta(value) &&
    "byStep" in value &&
    typeof value.byStep === "object" &&
    value.byStep !== null
  );
}

/**
 * Split a `when.step` `/query` response into per-step join maps. Uses the
 * server's global `scaleMin`/`scaleMax` so symbol sizes stay consistent
 * while scrubbing.
 */
export function parseDataTableQuerySeries(
  groups: DataTableQueryResultGroup[] | null | undefined,
  series: unknown,
  joinColumn: string,
  op: DataTableAggregation | DataTableAggregation[] | undefined
): ParsedDataTableQuerySeries | null {
  if (!isDataTableQuerySeriesMeta(series)) {
    return null;
  }
  const buckets: { [step: string]: DataTableQueryResultGroup[] } = {};
  const featureCountsByStep: {
    [step: string]: { [featureId: string]: number };
  } = {};
  for (const group of groups || []) {
    const step = group.step;
    if (typeof step !== "string") {
      continue;
    }
    if (!buckets[step]) {
      buckets[step] = [];
    }
    buckets[step].push(group);
    const featureId = group[joinColumn];
    const count = group.count;
    if (
      featureId !== null &&
      featureId !== undefined &&
      typeof count === "number" &&
      Number.isFinite(count)
    ) {
      if (!featureCountsByStep[step]) {
        featureCountsByStep[step] = {};
      }
      featureCountsByStep[step][String(featureId)] = count;
    }
  }
  const byStep: { [step: string]: ParsedDataTableQueryValues } = {};
  for (const step of Object.keys(buckets)) {
    byStep[step] = parseDataTableQueryGroups(buckets[step], joinColumn, op);
  }
  return {
    ...series,
    byStep,
    featureCountsByStep,
  };
}

function extentsFromValues(values: {
  [featureId: string]: number;
}): ParsedDataTableQueryValues {
  const numericValues = Object.values(values);
  const positiveValues = numericValues.filter((value) => value > 0);
  return {
    values,
    min: numericValues.length ? Math.min(...numericValues) : 0,
    max: numericValues.length ? Math.max(...numericValues) : 0,
    scaleMin: positiveValues.length ? Math.min(...positiveValues) : 0,
    scaleMax: positiveValues.length ? Math.max(...positiveValues) : 0,
    hasZero: numericValues.some((value) => value === 0),
  };
}

/** Combine one or more series bins (instant scrub uses a single key). */
export function combineSeriesSteps(
  series: ParsedDataTableQuerySeries,
  stepKeys: string[],
  op: DataTableAggregation
): ParsedDataTableQueryValues {
  if (stepKeys.length === 0) {
    return EMPTY_DATA_TABLE_QUERY_VALUES;
  }
  if (stepKeys.length === 1) {
    return series.byStep[stepKeys[0]] || EMPTY_DATA_TABLE_QUERY_VALUES;
  }
  const values: { [featureId: string]: number } = {};
  const weights: { [featureId: string]: number } = {};
  const medianBags: { [featureId: string]: number[] } = {};
  for (const step of stepKeys) {
    const parsed = series.byStep[step];
    if (!parsed) continue;
    const stepCounts = series.featureCountsByStep[step] || {};
    for (const featureId of Object.keys(parsed.values)) {
      const value = parsed.values[featureId];
      const n = stepCounts[featureId] ?? 1;
      if (op === "mean") {
        const prevWeight = weights[featureId] ?? 0;
        const prevSum = (values[featureId] ?? 0) * prevWeight;
        const nextWeight = prevWeight + n;
        values[featureId] = nextWeight
          ? (prevSum + value * n) / nextWeight
          : 0;
        weights[featureId] = nextWeight;
      } else if (op === "sum" || op === "count") {
        values[featureId] = (values[featureId] ?? 0) + value;
      } else if (op === "min") {
        values[featureId] =
          featureId in values ? Math.min(values[featureId], value) : value;
      } else if (op === "max") {
        values[featureId] =
          featureId in values ? Math.max(values[featureId], value) : value;
      } else {
        if (!medianBags[featureId]) {
          medianBags[featureId] = [];
        }
        medianBags[featureId].push(value);
      }
    }
  }
  if (op === "median") {
    for (const featureId of Object.keys(medianBags)) {
      const bag = medianBags[featureId].slice().sort((a, b) => a - b);
      const mid = Math.floor(bag.length / 2);
      values[featureId] =
        bag.length % 2 === 1 ? bag[mid] : (bag[mid - 1] + bag[mid]) / 2;
    }
  }
  return extentsFromValues(values);
}
