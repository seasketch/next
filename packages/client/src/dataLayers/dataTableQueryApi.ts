/* eslint-disable i18next/no-literal-string -- query URL serialization, not UI copy */

import {
  expandTemporalClock,
  expandTemporalIso,
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
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string | undefined) => {
    if (!name || seen.has(name)) {
      return;
    }
    seen.add(name);
    names.push(name);
  };
  const mapped = temporal.mapping.sourceColumns
    ? toDataTableTemporalSourceColumns(temporal.mapping.sourceColumns)
    : null;
  if (mapped) {
    for (const name of sourceColumnNames(mapped)) {
      add(name);
    }
  }
  add(temporal.mapping.startColumn);
  add(temporal.mapping.endColumn);
  return names;
}

/** Derived coverage columns (`_when_start`, `_when_end`, …). */
export function isInternalWhenColumn(column: string): boolean {
  return column.startsWith("_when_");
}

/**
 * Join, temporal-source, and derived `_when_*` columns are not user filters
 * and do not appear in admin Filter settings.
 */
export function isAlwaysHiddenFilterColumn(
  column: string,
  temporal?: unknown,
  joinColumn?: string | null
): boolean {
  if (!column || isInternalWhenColumn(column)) {
    return true;
  }
  if (joinColumn && column === joinColumn) {
    return true;
  }
  return temporalSourceFilterColumns(temporal).indexOf(column) !== -1;
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
  /** Sort key (column, aggregate name, or `_when_start` for raw rows). */
  orderBy?: { key: string; direction: "asc" | "desc" };
  /** Max groups/rows returned (server caps at 100,000). */
  limit?: number;
  offset?: number;
  /**
   * Raw-row queries only: include the derived `_when_start` / `_when_end`
   * columns (UTC epoch seconds) in row output so QA/QC UIs can show exactly
   * which temporal interval the engine assigned to each row.
   */
  includeWhen?: boolean;
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
 * `.visualization_ops` / `.required_filter_columns` /
 * `.hidden_filter_columns` / `.filter_column_labels`. Empty/null
 * visualization columns/ops means "no constraint -- let the end user
 * choose". Empty required filter columns means no filters are forced.
 */
export interface DataTableVisualizationConstraints {
  visualizationColumns?: (string | null)[] | null;
  visualizationOps?: (string | null)[] | null;
  /** Columns that must always appear as map filters (values are user-chosen). */
  requiredFilterColumns?: (string | null)[] | null;
  /** Columns omitted from the end-user Add filter list. */
  hiddenFilterColumns?: (string | null)[] | null;
  /** Custom labels keyed by original column name. Untrusted JSON at runtime. */
  filterColumnLabels?: unknown;
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
 *   default — see {@link effectiveDataTableVisualizationColumn}.
 *
 * Legend labels and persisted layer state must use this resolved column
 * (or {@link effectiveDataTableVisualizationColumn}), not a raw stored
 * pick. A leftover column from first-numeric defaulting or an earlier
 * admin setting can be invalid once visualizationColumns is set.
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

/**
 * Column the legend should show and persist. Same value the map query
 * uses: a stored pick only when it is still allowed, otherwise the first
 * admin-allowed column, otherwise a numeric default from column-stats.
 */
export function effectiveDataTableVisualizationColumn(
  resolved: Pick<ResolvedDataTableVisualization, "column">,
  numericColumns: string[]
): string | undefined {
  return resolved.column || pickDefaultDataTableColumn(numericColumns);
}

/** Admin-configured map-value columns, or `[]` when any numeric column is allowed. */
export function configuredDataTableVisualizationColumns(
  constraints?: DataTableVisualizationConstraints | null
): string[] {
  return (constraints?.visualizationColumns?.filter(
    (column): column is string => Boolean(column)
  ) || []) as string[];
}

/**
 * Columns that can be the map value — and therefore stay out of filters.
 * Uses the admin list when it is non-empty; otherwise every numeric column.
 */
export function allowedDataTableVisualizationColumns(
  constraints: DataTableVisualizationConstraints | undefined,
  numericColumns: string[]
): string[] {
  const configured = configuredDataTableVisualizationColumns(constraints);
  return configured.length > 0 ? configured : numericColumns;
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
 * True when `value` is a string-to-string map of filter column labels.
 * GraphQL `JSON` is untrusted; callers must use this before reading keys.
 */
export function isFilterColumnLabels(
  value: unknown
): value is Record<string, string> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    const entry = (value as Record<string, unknown>)[key];
    if (typeof entry !== "string") {
      return false;
    }
  }
  return true;
}

/** Drop empty keys/values from a filter-label map. Invalid JSON yields `{}`. */
export function parseFilterColumnLabels(
  value: unknown
): Record<string, string> {
  if (!isFilterColumnLabels(value)) {
    return {};
  }
  const next: Record<string, string> = {};
  for (const [column, label] of Object.entries(value)) {
    const trimmed = label.trim();
    if (column && trimmed) {
      next[column] = trimmed;
    }
  }
  return next;
}

export function dataTableFilterLabel(
  column: string,
  labels?: Record<string, string> | null
): string {
  const label = labels?.[column]?.trim();
  return label || column;
}

/**
 * Normalize admin-hidden filter columns. Required columns cannot be hidden.
 */
export function hiddenDataTableFilterColumns(
  constraints: DataTableVisualizationConstraints
): string[] {
  const required = new Set(requiredDataTableFilterColumns(constraints));
  return (constraints.hiddenFilterColumns?.filter(
    (column): column is string =>
      typeof column === "string" &&
      column.length > 0 &&
      !required.has(column)
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
  if (settings.orderBy) {
    params.set(
      "orderBy",
      `${settings.orderBy.key}:${settings.orderBy.direction}`
    );
  }
  if (settings.limit !== undefined) {
    params.set("limit", String(settings.limit));
  }
  if (settings.offset !== undefined) {
    params.set("offset", String(settings.offset));
  }
  if (settings.includeWhen) {
    params.set("includeWhen", "1");
  }

  return params;
}

/** Derived temporal columns written at ingest. Mirrors
 * `packages/pmtiles-server/src/dataTables/params.ts`. */
export const WHEN_START_COLUMN = "_when_start";
export const WHEN_END_COLUMN = "_when_end";

/** Page size for the QA/QC "rows in calculation" modal. */
export const DATA_TABLE_CALCULATION_ROWS_LIMIT = 5000;

/** Engine step keys encode their precision by length (`2018`, `2018-06`, …). */
export function precisionForStep(step: string): TemporalPrecision {
  if (step.length >= 13) return "hour";
  if (step.length >= 10) return "day";
  if (step.length >= 7) return "month";
  return "year";
}

/** Half-open epoch-second interval covered by an engine step key. */
export function stepIntervalSeconds(
  step: string
): { startSec: number; endSec: number } | null {
  const expanded = expandTemporalIso(step, precisionForStep(step));
  if (!expanded) {
    return null;
  }
  return { startSec: expanded.start / 1000, endSec: expanded.end / 1000 };
}

/**
 * The engine's row↔step assignment rule, mirrored for client-side step
 * filtering in the QA/QC rows modal.
 *
 * CONSISTENCY: pmtiles-server's `stepsOverlappingInterval` assigns a row to
 * every step whose calendar interval (expanded with the same
 * `expandTemporalIso` from @seasketch/geostats-types used here) overlaps the
 * row's `_when_*` interval, half-open. Rows returned by the raw query already
 * passed the map-clock window filter, so testing overlap against the
 * unclamped `_when_*` values selects exactly the rows the engine folded into
 * a step's statistic. If the engine's assignment rule ever changes, this must
 * change with it.
 */
export function rowWhenOverlapsStep(
  row: { [column: string]: unknown },
  step: string
): boolean {
  const interval = stepIntervalSeconds(step);
  if (!interval) {
    return false;
  }
  const start = row[WHEN_START_COLUMN];
  const end = row[WHEN_END_COLUMN];
  return (
    typeof start === "number" &&
    typeof end === "number" &&
    start < interval.endSec &&
    end > interval.startSec
  );
}

/**
 * Same overlap rule as {@link rowWhenOverlapsStep}, true when the row
 * overlaps any of `steps`. Step intervals are expanded once and reused, so
 * auditing a multi-year map clock does not re-parse every step per row.
 *
 * Contiguous clock steps tile one window. A row between two non-adjacent
 * steps does not match — the union of the outer bounds would wrongly include
 * that gap.
 */
export function filterRowsOverlappingSteps<
  T extends { [column: string]: unknown }
>(rows: T[], steps: string[]): T[] {
  const intervals: { startSec: number; endSec: number }[] = [];
  for (const step of steps) {
    const interval = stepIntervalSeconds(step);
    if (interval) {
      intervals.push(interval);
    }
  }
  if (intervals.length === 0) {
    return [];
  }
  return rows.filter((row) => {
    const start = row[WHEN_START_COLUMN];
    const end = row[WHEN_END_COLUMN];
    if (typeof start !== "number" || typeof end !== "number") {
      return false;
    }
    for (const interval of intervals) {
      if (start < interval.endSec && end > interval.startSec) {
        return true;
      }
    }
    return false;
  });
}

/**
 * What the QA/QC rows modal is auditing.
 *
 * - a step key: one timeslider bin
 * - `"window"`: every step in the current map clock (a date range)
 * - `"all"`: every row the raw query returned
 */
export type CalculationRowsSelection = string | "window" | "all";

/**
 * Resolve the rows-modal time selection.
 *
 * A map clock that covers more than one step stays on that whole window.
 * Collapsing it to the latest step would show a different statistic than
 * the one painted on the map. An instant clock selects that one step, or
 * the latest observed step when the site has no data there. An explicit
 * choice (a chart click, the range, or "All steps") is kept when it still
 * applies to this site.
 */
export function resolveCalculationRowsSelection(
  chosen: CalculationRowsSelection | undefined,
  observedSteps: string[],
  currentSteps: string[]
): CalculationRowsSelection | undefined {
  if (chosen === "all") {
    return "all";
  }
  if (chosen === "window" && currentSteps.length > 1) {
    return "window";
  }
  if (
    chosen &&
    chosen !== "window" &&
    observedSteps.indexOf(chosen) !== -1
  ) {
    return chosen;
  }
  if (currentSteps.length > 1) {
    return "window";
  }
  if (observedSteps.length === 0) {
    return undefined;
  }
  for (const step of currentSteps) {
    if (observedSteps.indexOf(step) !== -1) {
      return step;
    }
  }
  return observedSteps[observedSteps.length - 1];
}

/**
 * Columns hidden by default in the QA/QC rows modal: any column whose value
 * is identical on every fetched row, except columns central to auditing the
 * calculation (active filters, temporal source columns, the organism
 * identifier, and the measure column). Users can override via the modal's
 * hidden-columns dropdown.
 */
export function defaultHiddenCalculationColumns(
  columns: string[],
  rows: { [column: string]: unknown }[],
  keep: {
    filterColumns: string[];
    temporalSourceColumns: string[];
    organismColumn?: string | null;
    measureColumn?: string | null;
  }
): Set<string> {
  const hidden = new Set<string>();
  if (rows.length === 0) {
    return hidden;
  }
  const keepSet = new Set<string>(
    [
      ...keep.filterColumns,
      ...keep.temporalSourceColumns,
      keep.organismColumn,
      keep.measureColumn,
    ].filter((name): name is string => Boolean(name))
  );
  for (const name of columns) {
    if (keepSet.has(name)) {
      continue;
    }
    const first = rows[0][name] ?? null;
    let constant = true;
    for (const row of rows) {
      if (!Object.is(row[name] ?? null, first)) {
        constant = false;
        break;
      }
    }
    if (constant) {
      hidden.add(name);
    }
  }
  return hidden;
}


/**
 * Derive the raw-row ("Show rows in calculation") query from the *exact*
 * aggregated query used to paint the map.
 *
 * CONSISTENCY INVARIANT — the QA/QC rows modal must never lie
 * -----------------------------------------------------------
 * The rows modal promises scientists "these are the rows behind the
 * statistic on the map". That promise only holds when the raw-row request
 * carries the same `q.*` filters and `when.*` window as the stats request,
 * because the query engine guarantees (and tests, in
 * `packages/pmtiles-server/test/dataTables/rawAggConsistency.test.ts`) that
 * raw and aggregated queries with identical filter/when parameters select
 * identical row sets.
 *
 * Therefore:
 * - `statsQuery` MUST be the settings object actually used for the map
 *   query — i.e. the output of `DataTableQueryManager.queryWithClock`, not a
 *   reconstruction. Callers should go through
 *   `DataTableQueryManager.fetchCalculationRows`.
 * - This function must never add, drop, or rewrite filters other than
 *   narrowing to one join-column value, and must never touch `when`.
 * - If you add a new dimension to stats queries (e.g. a new filter type or
 *   temporal parameter), it must flow through here untouched. See the unit
 *   tests in `dataTableCalculationRows.test.ts`.
 */
export function deriveDataTableCalculationRowsQuery(
  statsQuery: DataTableQuerySettings,
  joinColumn: string,
  featureId: string
): DataTableQuerySettings {
  const temporal = Boolean(statsQuery.when);
  return {
    // Identical filters, narrowed to the requested site/join value.
    filters: [
      ...(statsQuery.filters ?? []),
      { column: joinColumn, op: "eq", value: String(featureId) },
    ],
    // Identical temporal window. `whenStep` is intentionally dropped: it only
    // controls aggregate binning and is invalid on raw-row queries; the same
    // window's rows feed every step bin.
    when: statsQuery.when,
    // Raw mode: no op / column / groupBy.
    orderBy: temporal
      ? { key: WHEN_START_COLUMN, direction: "asc" }
      : undefined,
    includeWhen: temporal || undefined,
    limit: DATA_TABLE_CALCULATION_ROWS_LIMIT,
  };
}

/** One raw row from a `/query` response (all columns, untyped). */
export type DataTableCalculationRow = { [column: string]: unknown };

/** Result of a "rows in calculation" fetch. */
export interface DataTableCalculationRowsResult {
  rows: DataTableCalculationRow[];
  /** Total matching rows (may exceed `rows.length` when the page is full). */
  rowsMatched: number;
  totalRows: number;
  /** The raw-row query sent; mirrors the stats query's filters/when. */
  query: DataTableQuerySettings;
}

export function parseDataTableCalculationRowsBody(
  body: unknown,
  query: DataTableQuerySettings
): DataTableCalculationRowsResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Unexpected rows response from data table query");
  }
  const record = body as { [key: string]: unknown };
  if (!Array.isArray(record.rows)) {
    throw new Error("Unexpected rows response from data table query");
  }
  return {
    rows: record.rows.filter(
      (row): row is DataTableCalculationRow =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row)
    ),
    rowsMatched:
      typeof record.rowsMatched === "number" ? record.rowsMatched : 0,
    totalRows: typeof record.totalRows === "number" ? record.totalRows : 0,
    query,
  };
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

/** One clock step in a per-feature `when.step` series (null = no rows). */
export type DataTableFeatureSeriesPoint = {
  step: string;
  value: number | null;
  /**
   * Engine `count` aggregate for this feature at this step — the number of
   * values folded into `value` (n). Null when the step has no rows.
   */
  count?: number | null;
};

/**
 * Values for one join key across every series step (the table timescale).
 * Missing groups stay `null` so a sparkline can show gaps instead of
 * interpolating through them, without shrinking the x-axis to this site.
 */
export function featureSeriesFromParsed(
  series: ParsedDataTableQuerySeries,
  featureId: string
): DataTableFeatureSeriesPoint[] {
  const id = String(featureId);
  const steps = series.steps.length > 0 ? series.steps : Object.keys(series.byStep);
  return steps.map((step) => {
    const value = series.byStep[step]?.values[id];
    const count = series.featureCountsByStep[step]?.[id];
    return {
      step,
      value: typeof value === "number" && Number.isFinite(value) ? value : null,
      count: typeof count === "number" && Number.isFinite(count) ? count : null,
    };
  });
}

/** A chart is useful only when the site has at least two observed steps. */
export function shouldShowDataTableSeriesChart(
  points: DataTableFeatureSeriesPoint[] | undefined | null
): boolean {
  if (!points || points.length < 2) {
    return false;
  }
  let observed = 0;
  for (const point of points) {
    if (point.value !== null) {
      observed += 1;
      if (observed >= 2) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Thin a long daily series for an SVG sparkline. Always keeps the first and
 * last points plus any `keepSteps` (the current clock selection).
 */
export function downsampleFeatureSeries(
  points: DataTableFeatureSeriesPoint[],
  maxPoints: number,
  keepSteps: string[] = []
): DataTableFeatureSeriesPoint[] {
  if (maxPoints < 2 || points.length <= maxPoints) {
    return points;
  }
  const keep = new Set(keepSteps);
  const chosen = new Set<number>([0, points.length - 1]);
  for (let i = 0; i < points.length; i++) {
    if (keep.has(points[i].step)) {
      chosen.add(i);
    }
  }
  const remaining = Math.max(maxPoints - chosen.size, 0);
  if (remaining > 0) {
    const stride = (points.length - 1) / (remaining + 1);
    for (let i = 1; i <= remaining; i++) {
      chosen.add(Math.round(i * stride));
    }
  }
  return points.filter((_, index) => chosen.has(index));
}
