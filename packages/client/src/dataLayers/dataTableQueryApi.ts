/* eslint-disable i18next/no-literal-string -- query URL serialization, not UI copy */

/**
 * Data table query API — types and semantics for GET `/query` requests.
 *
 * Each overlay data table is served by the data-tables-worker at an immutable
 * R2 prefix (`projects/{slug}/public/dataTables/{uploadId}`). Map clients
 * compile {@link DataTableQuerySettings} into query-string parameters, fetch
 * aggregated JSON, and join results to vector features using
 * `column-stats.json` join metadata.
 *
 * **Endpoints** (relative to `{tablePath}` or `OverlayDataTable.queryUrl`):
 *
 * - `GET /{tablePath}/query` — run a query (`f=json` for JSON, or HTML UI)
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
 * | `f` | `json` or `html`; overrides `Accept` header |
 * | `groupBy` | Comma-separated columns, e.g. `site` or `site,year` |
 * | `op` | Comma-separated: `count`, `sum`, `mean`, `min`, `max`, `median` |
 * | `column` | Numeric column to aggregate; required unless only `count` |
 * | `orderBy` | Sort key, optional `:desc`, e.g. `mean:desc` or `site` |
 * | `limit` | Max groups/rows (omit for no limit) |
 * | `offset` | Skip N groups/rows after sorting (default 0) |
 *
 * **Column filters** use a `q.{columnName}` prefix with PostgREST-style
 * operators in the value. See {@link DataTableFilter} and
 * {@link serializeDataTableFilter}.
 *
 * **JSON response** (aggregated): `{ table, totalRows, rowsScanned, rowsMatched,
 * rowGroups, timing, groups }`. Raw mode returns `rows` instead of `groups`.
 *
 * Worker implementation: `packages/data-tables-worker/src/params.ts`.
 * Extended reference: `packages/data-tables-worker/README.md`.
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
 * `packages/data-tables-worker/src/params.ts`.
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
  /** Required for all ops except `isNull` and `notNull`. For `in`, comma-separated list items. */
  value?: string;
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
}

/**
 * Admin-configured constraints on how a data table may be visualized, as
 * stored on `overlay_data_tables.visualization_columns` /
 * `.visualization_ops`. Empty/null means "no constraint -- let the end user
 * choose".
 */
export interface DataTableVisualizationConstraints {
  visualizationColumns?: (string | null)[] | null;
  visualizationOps?: (string | null)[] | null;
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
}

/**
 * Combines admin-set constraints ({@link DataTableVisualizationConstraints})
 * with the end user's choice in "Display settings" to produce a valid
 * column/op pair to pass to {@link buildDataTableQuerySearchParams} (and, in
 * the future, to MapContextManager for style calculation):
 *
 * - `op` must be one of `visualizationOps` when that list is non-empty;
 *   otherwise falls back to the user's choice, or `"mean"`.
 * - `column` must be one of `visualizationColumns` when that list is
 *   non-empty; otherwise falls back to the user's choice (which may be
 *   undefined, e.g. for a bare `count`).
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

  return { column, op, filters: userChoice.filters };
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
      if (value === undefined) {
        throw new Error(`Filter on "${column}" with op "in" requires value`);
      }
      const items = value.split(",").map((item) => {
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

  return params;
}
