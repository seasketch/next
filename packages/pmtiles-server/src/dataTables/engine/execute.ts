import { AsyncBuffer, FileMetaData, parquetReadObjects } from "hyparquet";
import { parquetReadColumn } from "hyparquet/src/read.js";
import { Aggregation, ParsedQuery, QueryError } from "../params";
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

export interface QueryResult {
  /** Present for raw (non-aggregated) queries */
  rows?: Record<string, unknown>[];
  /** Present for aggregated queries */
  groups?: Record<string, unknown>[];
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

function makePredicate(filters: CompiledFilter[]): (row: Row) => boolean {
  if (filters.length === 0) {
    return () => true;
  }
  return (row: Row) => {
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
  const predicate = makePredicate(plan.filters);

  if (query.ops.length === 0) {
    return await executeRawQuery(options, predicate);
  }

  const aggColumn = query.column;
  const aggKind: ColumnKind | undefined = aggColumn
    ? plan.columns.get(aggColumn)?.kind
    : undefined;
  const needsMedian = query.ops.includes("median");
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
    await Promise.all(
      [...new Set(plan.filters.map((f) => f.column))].map(async (name) => {
        filterColumns.set(name, await readColumn(name, span));
      })
    );

    const matched: number[] = [];
    for (let i = 0; i < spanRows; i++) {
      let ok = true;
      for (const filter of plan.filters) {
        if (!matchesFilter(filterColumns.get(filter.column)![i], filter)) {
          ok = false;
          break;
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
      const keyValues = groupByData.map((data) => jsonValue(data[i]));
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

  const output: Record<string, unknown>[] = [];
  for (const group of groups.values()) {
    const entry: Record<string, unknown> = {};
    query.groupBy.forEach((col, i) => {
      entry[col] = group.keyValues[i];
    });
    for (const op of query.ops) {
      entry[op] = aggregateValue(op, group, aggColumn !== null);
    }
    output.push(entry);
  }

  const validKeys = (key: string) =>
    query.groupBy.includes(key) || (query.ops as string[]).includes(key);
  const paged = sortAndPage(
    output,
    query.orderBy,
    query.offset,
    query.limit,
    validKeys
  );

  return { groups: paged, rowsScanned, rowsMatched };
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
