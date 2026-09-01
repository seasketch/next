import { AsyncBuffer, FileMetaData, parquetReadObjects } from "hyparquet";
import { parquetReadColumn } from "hyparquet/src/read.js";
import {
  Aggregation,
  isHiddenWhenColumn,
  MAX_LIMIT,
  ParsedQuery,
  QueryError,
  TemporalWhenFilter,
  WHEN_END_COLUMN,
  WHEN_START_COLUMN,
} from "../params";
import {
  enumerateWhenSteps,
  stepsOverlappingInterval,
} from "../whenStep";
import { ByteBudgetCache } from "./blockReader";
import {
  ColumnKind,
  CompiledFilter,
  QueryPlan,
  normalizeValue,
} from "./plan";

/**
 * Decoded column arrays for a warm isolate. Parquet decode is CPU-heavy;
 * caching by file version + column + row span lets filter sweeps (changing
 * species/year against the same columns) skip decode on repeat queries.
 * Identical queries should hit HTTP/Workers Cache instead and never reach here.
 */
const DECODED_COLUMN_BUDGET = 48 * 1024 * 1024;
const decodedColumns = new ByteBudgetCache<unknown[]>(DECODED_COLUMN_BUDGET);

function estimateDecodedBytes(data: unknown[]): number {
  let bytes = 0;
  for (const value of data) {
    bytes += typeof value === "string" ? 16 + value.length * 2 : 16;
  }
  return bytes;
}

export interface QuerySeriesStepStat {
  step: string;
  rows: number;
  groups: number;
}

export interface QuerySeries {
  step: string;
  steps: string[];
  min: number;
  max: number;
  scaleMin: number;
  scaleMax: number;
  hasZero: boolean;
  stepStats: QuerySeriesStepStat[];
}

export interface QueryResult {
  /** Present for raw (non-aggregated) queries */
  rows?: Record<string, unknown>[];
  /** Present for aggregated queries */
  groups?: Record<string, unknown>[];
  /** Present when `when.step` is active and `_when_*` columns exist. */
  series?: QuerySeries;
  rowsScanned: number;
  rowsMatched: number;
}

type Row = Record<string, unknown>;
type Primitive = string | number | boolean | null;

function matchesFilter(raw: unknown, filter: CompiledFilter): boolean {
  const value = normalizeValue(raw, filter.kind);
  switch (filter.op) {
    case "isNull":
      return value === null;
    case "notNull":
      return value !== null;
    case "eq":
      return value !== null && value === filter.value;
    case "neq":
      return value !== null && value !== filter.value;
    case "in":
      return value !== null && filter.values!.includes(value);
    case "gt":
      return value !== null && value > filter.value!;
    case "gte":
      return value !== null && value >= filter.value!;
    case "lt":
      return value !== null && value < filter.value!;
    case "lte":
      return value !== null && value <= filter.value!;
  }
}

export function rowMatchesWhen(
  startRaw: unknown,
  endRaw: unknown,
  when: TemporalWhenFilter
): boolean {
  const start = normalizeValue(startRaw, "number");
  const end = normalizeValue(endRaw, "number");
  if (typeof start !== "number" || typeof end !== "number") return false;
  return start < when.endSec && end > when.startSec;
}

function makePredicate(
  filters: CompiledFilter[],
  when: TemporalWhenFilter | null
): (row: Row) => boolean {
  return (row: Row) => {
    if (
      when &&
      !rowMatchesWhen(row[WHEN_START_COLUMN], row[WHEN_END_COLUMN], when)
    ) {
      return false;
    }
    for (const filter of filters) {
      if (!matchesFilter(row[filter.column], filter)) return false;
    }
    return true;
  };
}

/** Converts values to JSON-serializable output (BigInt, Date handling). */
function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  if (value === undefined) {
    return null;
  }
  return value;
}

function jsonRow(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (isHiddenWhenColumn(key)) continue;
    out[key] = jsonValue(row[key]);
  }
  return out;
}

interface GroupAccumulator {
  keyValues: unknown[];
  rowCount: number;
  valueCount: number;
  sum: number;
  min: Primitive;
  max: Primitive;
  /** buffered values for median */
  values?: number[];
}

function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sortAndPage<T extends Record<string, unknown>>(
  items: T[],
  orderBy: ParsedQuery["orderBy"],
  offset: number,
  limit: number | null,
  validKeys: (key: string) => boolean
): T[] {
  if (orderBy) {
    if (!validKeys(orderBy.key)) {
      throw new QueryError(
        `orderBy key "${orderBy.key}" is not present in the output.`
      );
    }
    const dir = orderBy.direction === "desc" ? -1 : 1;
    items.sort((a, b) => dir * compareValues(a[orderBy.key], b[orderBy.key]));
  }
  return limit === null
    ? items.slice(offset)
    : items.slice(offset, offset + limit);
}

export async function executeQuery(options: {
  file: AsyncBuffer;
  metadata: FileMetaData;
  query: ParsedQuery;
  plan: QueryPlan;
  /** Unique per file version (e.g. the object etag). Enables the decoded
   * column cache; omit for one-shot reads. */
  cacheKey?: string;
}): Promise<QueryResult> {
  const { file, metadata, query, plan, cacheKey } = options;
  const predicate = makePredicate(plan.filters, plan.when);

  if (query.ops.length === 0) {
    return await executeRawQuery(options, predicate);
  }

  const aggColumn = query.column;
  const aggKind: ColumnKind | undefined = aggColumn
    ? plan.columns.get(aggColumn)?.kind
    : undefined;
  const needsMedian = query.ops.includes("median");
  const whenStep =
    query.whenStep && plan.when ? query.whenStep : null;
  const groups = new Map<string, GroupAccumulator>();
  let rowsScanned = 0;
  let rowsMatched = 0;

  // Columnar execution: evaluate filters against just the filter columns to
  // produce matched row indices, then read the remaining columns only for
  // spans with matches. Avoids materializing an object per scanned row.
  const readColumn = async (
    name: string,
    span: { rowStart: number; rowEnd: number }
  ): Promise<unknown[]> => {
    const key = cacheKey
      ? `${cacheKey}#${name}#${span.rowStart}-${span.rowEnd}`
      : null;
    if (key) {
      const cached = decodedColumns.get(key);
      if (cached) return cached;
    }
    const data = (await parquetReadColumn({
      file,
      metadata,
      columns: [name],
      rowStart: span.rowStart,
      rowEnd: span.rowEnd,
    })) as unknown[];
    if (key) {
      decodedColumns.set(key, data, estimateDecodedBytes(data));
    }
    return data;
  };

  for (const span of plan.spans) {
    const spanRows = span.rowEnd - span.rowStart;
    rowsScanned += spanRows;

    const filterColumns = new Map<string, unknown[]>();
    const filterNames = new Set(plan.filters.map((f) => f.column));
    if (plan.when) {
      filterNames.add(WHEN_START_COLUMN);
      filterNames.add(WHEN_END_COLUMN);
    }
    await Promise.all(
      [...filterNames].map(async (name) => {
        filterColumns.set(name, await readColumn(name, span));
      })
    );

    const startCol = plan.when
      ? filterColumns.get(WHEN_START_COLUMN)
      : undefined;
    const endCol = plan.when ? filterColumns.get(WHEN_END_COLUMN) : undefined;
    const matched: number[] = [];
    for (let i = 0; i < spanRows; i++) {
      let ok = true;
      if (
        plan.when &&
        !rowMatchesWhen(startCol![i], endCol![i], plan.when)
      ) {
        ok = false;
      }
      if (ok) {
        for (const filter of plan.filters) {
          if (!matchesFilter(filterColumns.get(filter.column)![i], filter)) {
            ok = false;
            break;
          }
        }
      }
      if (ok) matched.push(i);
    }
    rowsMatched += matched.length;
    if (matched.length === 0) continue;

    const otherColumns = new Set<string>(query.groupBy);
    if (aggColumn) otherColumns.add(aggColumn);
    const columnData = new Map<string, unknown[]>(filterColumns);
    await Promise.all(
      [...otherColumns]
        .filter((name) => !columnData.has(name))
        .map(async (name) => {
          columnData.set(name, await readColumn(name, span));
        })
    );

    const groupByData = query.groupBy.map((col) => columnData.get(col)!);
    const aggData = aggColumn ? columnData.get(aggColumn)! : null;

    for (const i of matched) {
      const groupValues = groupByData.map((data) => jsonValue(data[i]));
      const stepKeys =
        whenStep && plan.when
          ? (() => {
              const rowStart = normalizeValue(startCol![i], "number");
              const rowEnd = normalizeValue(endCol![i], "number");
              if (typeof rowStart !== "number" || typeof rowEnd !== "number") {
                return [];
              }
              return stepsOverlappingInterval(
                rowStart,
                rowEnd,
                plan.when,
                whenStep
              );
            })()
          : [null];
      for (const stepKey of stepKeys) {
        const keyValues =
          stepKey === null ? groupValues : [stepKey, ...groupValues];
        const key = JSON.stringify(keyValues);
        let group = groups.get(key);
        if (!group) {
          group = {
            keyValues,
            rowCount: 0,
            valueCount: 0,
            sum: 0,
            min: null,
            max: null,
            values: needsMedian ? [] : undefined,
          };
          groups.set(key, group);
        }
        group.rowCount++;

        if (aggData) {
          const value = normalizeValue(aggData[i], aggKind || "string");
          if (value !== null) {
            group.valueCount++;
            if (typeof value === "number") {
              group.sum += value;
              group.values?.push(value);
            }
            if (group.min === null || compareValues(value, group.min) < 0) {
              group.min = value;
            }
            if (group.max === null || compareValues(value, group.max) > 0) {
              group.max = value;
            }
          }
        }
      }
    }
  }

  if (groups.size > MAX_LIMIT) {
    throw new QueryError(
      `when.step produced ${groups.size} groups (max ${MAX_LIMIT}). Use a coarser when.step or add filters.`
    );
  }

  const output: Record<string, unknown>[] = [];
  const primaryOp = query.ops[0];
  const valuesByStep = new Map<
    string,
    { rows: number; groups: number; values: number[] }
  >();
  for (const group of groups.values()) {
    const entry: Record<string, unknown> = {};
    const valueOffset = whenStep ? 1 : 0;
    if (whenStep) {
      entry.step = group.keyValues[0];
    }
    query.groupBy.forEach((col, i) => {
      entry[col] = group.keyValues[i + valueOffset];
    });
    for (const op of query.ops) {
      entry[op] = aggregateValue(op, group, aggColumn !== null);
    }
    output.push(entry);
    if (whenStep && typeof entry.step === "string") {
      let stat = valuesByStep.get(entry.step);
      if (!stat) {
        stat = { rows: 0, groups: 0, values: [] };
        valuesByStep.set(entry.step, stat);
      }
      stat.rows += group.rowCount;
      stat.groups += 1;
      const primary = entry[primaryOp];
      if (typeof primary === "number" && Number.isFinite(primary)) {
        stat.values.push(primary);
      }
    }
  }

  const series =
    whenStep && plan.when
      ? buildQuerySeries(whenStep, plan.when, valuesByStep)
      : undefined;

  const validKeys = (key: string) =>
    key === "step" ||
    query.groupBy.includes(key) ||
    (query.ops as string[]).includes(key);
  const paged = sortAndPage(
    output,
    query.orderBy,
    query.offset,
    query.limit,
    validKeys
  );

  return { groups: paged, series, rowsScanned, rowsMatched };
}

function buildQuerySeries(
  step: NonNullable<ParsedQuery["whenStep"]>,
  window: TemporalWhenFilter,
  valuesByStep: Map<string, { rows: number; groups: number; values: number[] }>
): QuerySeries {
  const steps = enumerateWhenSteps(window, step);
  const allValues: number[] = [];
  for (const stat of valuesByStep.values()) {
    allValues.push(...stat.values);
  }
  const positives = allValues.filter((value) => value > 0);
  return {
    step,
    steps,
    min: allValues.length ? Math.min(...allValues) : 0,
    max: allValues.length ? Math.max(...allValues) : 0,
    scaleMin: positives.length ? Math.min(...positives) : 0,
    scaleMax: positives.length ? Math.max(...positives) : 0,
    hasZero: allValues.some((value) => value === 0),
    stepStats: steps
      .map((iso) => {
        const stat = valuesByStep.get(iso);
        return {
          step: iso,
          rows: stat?.rows ?? 0,
          groups: stat?.groups ?? 0,
        };
      })
      .filter((stat) => stat.rows > 0),
  };
}

function aggregateValue(
  op: Aggregation,
  group: GroupAccumulator,
  hasColumn: boolean
): unknown {
  switch (op) {
    case "count":
      // With an aggregation column, count non-null values (like SQL
      // COUNT(col)); otherwise count matching rows (COUNT(*)).
      return hasColumn ? group.valueCount : group.rowCount;
    case "sum":
      return group.valueCount > 0 ? group.sum : null;
    case "mean":
      return group.valueCount > 0 ? group.sum / group.valueCount : null;
    case "min":
      return group.min;
    case "max":
      return group.max;
    case "median":
      return median(group.values || []);
  }
}

async function executeRawQuery(
  options: {
    file: AsyncBuffer;
    metadata: FileMetaData;
    query: ParsedQuery;
    plan: QueryPlan;
  },
  predicate: (row: Row) => boolean
): Promise<QueryResult> {
  const { file, metadata, query, plan } = options;
  const matched: Record<string, unknown>[] = [];
  let rowsScanned = 0;
  let rowsMatched = 0;
  // Without an orderBy we can stop reading as soon as the page is filled.
  const target = query.orderBy
    ? Infinity
    : query.offset + (query.limit ?? Infinity);

  for (const span of plan.spans) {
    const rows = (await parquetReadObjects({
      file,
      metadata,
      columns: plan.neededColumns,
      rowStart: span.rowStart,
      rowEnd: span.rowEnd,
    })) as Row[];
    rowsScanned += rows.length;
    for (const row of rows) {
      if (!predicate(row)) continue;
      rowsMatched++;
      if (matched.length < target) {
        matched.push(jsonRow(row));
      }
    }
    if (matched.length >= target) break;
  }

  const columnNames = new Set(plan.columns.keys());
  const paged = sortAndPage(
    matched,
    query.orderBy,
    query.offset,
    query.limit,
    (key) => columnNames.has(key)
  );
  return { rows: paged, rowsScanned, rowsMatched };
}
