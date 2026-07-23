import { AsyncBuffer, FileMetaData, SchemaElement, parquetSchema } from "hyparquet";
import {
  hashParquetValue,
  readBloomFilter,
  sbbfContains,
} from "hyparquet/src/bloom.js";
import { ParsedQuery, QueryError, RawFilter } from "../params";

export type ColumnKind = "string" | "number" | "boolean" | "timestamp";

export interface ColumnInfo {
  name: string;
  kind: ColumnKind;
}

/** A filter with its value(s) coerced to the column's type. */
export interface CompiledFilter extends Omit<RawFilter, "value" | "values"> {
  kind: ColumnKind;
  value?: string | number | boolean;
  values?: (string | number | boolean)[];
}

export interface ReadSpan {
  /** Global row index (inclusive) */
  rowStart: number;
  /** Global row index (exclusive) */
  rowEnd: number;
}

export interface QueryPlan {
  columns: Map<string, ColumnInfo>;
  filters: CompiledFilter[];
  /** Columns that must be read from the parquet file. undefined = all. */
  neededColumns: string[] | undefined;
  spans: ReadSpan[];
  rowGroupsTotal: number;
  rowGroupsScanned: number;
  totalRows: number;
}

function kindForSchemaElement(element: {
  type?: string;
  converted_type?: string;
  logical_type?: { type?: string };
}): ColumnKind {
  const logical = element.logical_type?.type;
  if (logical === "STRING" || element.converted_type === "UTF8") {
    return "string";
  }
  if (
    logical === "DATE" ||
    logical === "TIMESTAMP" ||
    element.converted_type === "DATE" ||
    element.converted_type === "TIMESTAMP_MILLIS" ||
    element.converted_type === "TIMESTAMP_MICROS" ||
    element.type === "INT96"
  ) {
    return "timestamp";
  }
  if (element.type === "BOOLEAN") {
    return "boolean";
  }
  if (
    element.type === "INT32" ||
    element.type === "INT64" ||
    element.type === "FLOAT" ||
    element.type === "DOUBLE" ||
    element.converted_type === "DECIMAL"
  ) {
    return "number";
  }
  // Unrecognized physical types (nested, byte arrays without UTF8, etc.)
  // are treated as strings for equality purposes.
  return "string";
}

export function columnsFromMetadata(
  metadata: FileMetaData
): Map<string, ColumnInfo> {
  const columns = new Map<string, ColumnInfo>();
  const schema = parquetSchema(metadata);
  for (const child of schema.children) {
    const name = child.element.name;
    columns.set(name, { name, kind: kindForSchemaElement(child.element) });
  }
  return columns;
}

function unknownColumnError(
  name: string,
  columns: Map<string, ColumnInfo>
): QueryError {
  return new QueryError(`Unknown column "${name}".`, 400, {
    validColumns: [...columns.values()].map((c) => ({
      name: c.name,
      type: c.kind,
    })),
  });
}

function coerceValue(
  raw: string,
  column: ColumnInfo
): string | number | boolean {
  switch (column.kind) {
    case "number": {
      const n = Number(raw);
      if (raw.trim() === "" || Number.isNaN(n)) {
        throw new QueryError(
          `Invalid numeric value "${raw}" for column "${column.name}".`
        );
      }
      return n;
    }
    case "boolean": {
      if (raw === "true" || raw === "1") return true;
      if (raw === "false" || raw === "0") return false;
      throw new QueryError(
        `Invalid boolean value "${raw}" for column "${column.name}". Use true or false.`
      );
    }
    case "timestamp": {
      const t = Date.parse(raw);
      if (Number.isNaN(t)) {
        throw new QueryError(
          `Invalid date value "${raw}" for column "${column.name}". Use an ISO 8601 date.`
        );
      }
      // timestamps are compared as epoch millis
      return t;
    }
    default:
      return raw;
  }
}

const COMPARISON_OPS = new Set(["gt", "gte", "lt", "lte"]);

export function compileFilters(
  filters: RawFilter[],
  columns: Map<string, ColumnInfo>
): CompiledFilter[] {
  return filters.map((filter) => {
    const column = columns.get(filter.column);
    if (!column) {
      throw unknownColumnError(filter.column, columns);
    }
    if (
      COMPARISON_OPS.has(filter.op) &&
      column.kind !== "number" &&
      column.kind !== "timestamp"
    ) {
      throw new QueryError(
        `Operator "${filter.op}" is only supported for numeric or date columns; "${column.name}" is a ${column.kind} column.`
      );
    }
    const compiled: CompiledFilter = {
      column: filter.column,
      op: filter.op,
      kind: column.kind,
    };
    if (filter.value !== undefined) {
      compiled.value = coerceValue(filter.value, column);
    }
    if (filter.values !== undefined) {
      compiled.values = filter.values.map((v) => coerceValue(v, column));
    }
    return compiled;
  });
}

/**
 * Normalizes a runtime or statistics value into something directly comparable
 * with compiled filter values (number | string | boolean), or null.
 */
export function normalizeValue(
  value: unknown,
  kind: ColumnKind
): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (kind === "number" && typeof value !== "number") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  if (kind === "timestamp" && typeof value === "number") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  return value as string | number | boolean;
}

/**
 * Bloom-filter pruning for eq/in filters. Statistics min/max rarely help for
 * high-cardinality string columns (e.g. species codes span the alphabet in
 * every row group), but split-block bloom filters written by DuckDB prove a
 * value's *absence*, letting us skip whole row groups. Filters are tiny
 * (tens to hundreds of bytes) and live next to the footer, so reads are
 * served from the cached tail blocks.
 *
 * Returns false if a bloom filter proves the row group cannot match.
 */
async function rowGroupPassesBloomFilters(
  file: AsyncBuffer,
  rowGroup: FileMetaData["row_groups"][number],
  filters: CompiledFilter[],
  schemaElements: Map<string, SchemaElement>
): Promise<boolean> {
  for (const filter of filters) {
    if (filter.op !== "eq" && filter.op !== "in") continue;
    const element = schemaElements.get(filter.column);
    if (!element) continue;
    const meta = rowGroup.columns.find(
      (c) => c.meta_data?.path_in_schema.join(".") === filter.column
    )?.meta_data;
    if (!meta?.bloom_filter_offset || !meta.bloom_filter_length) continue;

    const values = filter.op === "eq" ? [filter.value!] : filter.values!;
    const hashes = values.map((v) => hashParquetValue(v, element));
    // undefined = ambiguous type mapping; the bloom filter can't help.
    if (hashes.some((h) => h === undefined)) continue;

    const start = Number(meta.bloom_filter_offset);
    const buffer = await file.slice(start, start + meta.bloom_filter_length);
    const bloom = readBloomFilter({ view: new DataView(buffer), offset: 0 });
    if (!bloom) continue;
    if (hashes.every((h) => !sbbfContains(bloom.blocks, h!))) {
      return false;
    }
  }
  return true;
}

/**
 * Tests whether a row group could possibly contain rows matching the filter,
 * based on column chunk statistics. Conservative: returns true when unsure.
 */
function rowGroupMayMatch(
  filter: CompiledFilter,
  stats:
    | {
        min_value?: unknown;
        max_value?: unknown;
        null_count?: bigint | number;
      }
    | undefined,
  rowCount: number
): boolean {
  if (!stats) return true;
  const nullCount =
    stats.null_count === undefined ? undefined : Number(stats.null_count);

  if (filter.op === "isNull") {
    return nullCount === undefined || nullCount > 0;
  }
  if (filter.op === "notNull") {
    return nullCount === undefined || nullCount < rowCount;
  }

  // Timestamp statistics units vary by writer (millis/micros/DATE days).
  // Filter values are epoch millis; only prune when stats decoded to Dates.
  if (
    filter.kind === "timestamp" &&
    !(stats.min_value instanceof Date) &&
    !(stats.max_value instanceof Date)
  ) {
    return true;
  }
  const min = normalizeValue(stats.min_value, filter.kind);
  const max = normalizeValue(stats.max_value, filter.kind);
  if (min === null || max === null) return true;

  switch (filter.op) {
    case "eq":
      return filter.value! >= min && filter.value! <= max;
    case "in":
      return filter.values!.some((v) => v >= min && v <= max);
    case "gt":
      return max > filter.value!;
    case "gte":
      return max >= filter.value!;
    case "lt":
      return min < filter.value!;
    case "lte":
      return min <= filter.value!;
    default:
      // neq can only be pruned when min === max === value; rarely useful
      return !(
        filter.op === "neq" &&
        min === max &&
        min === filter.value
      );
  }
}

export async function planQuery(
  metadata: FileMetaData,
  query: ParsedQuery,
  /** When provided, bloom filters are consulted to prune row groups that
   * pass the min/max statistics check. */
  file?: AsyncBuffer
): Promise<QueryPlan> {
  const columns = columnsFromMetadata(metadata);

  // Validate built-in column references
  for (const name of query.groupBy) {
    if (!columns.has(name)) {
      throw unknownColumnError(name, columns);
    }
  }
  if (query.column !== null) {
    if (!columns.has(query.column)) {
      throw unknownColumnError(query.column, columns);
    }
    const kind = columns.get(query.column)!.kind;
    const numericOps = query.ops.filter(
      (op) => op !== "count" && op !== "min" && op !== "max"
    );
    if (numericOps.length > 0 && kind !== "number" && kind !== "timestamp") {
      throw new QueryError(
        `Aggregations ${numericOps.join(", ")} require a numeric column; "${
          query.column
        }" is a ${kind} column.`
      );
    }
  }

  const filters = compileFilters(query.filters, columns);

  // Determine which columns need to be read
  let neededColumns: string[] | undefined;
  if (query.ops.length > 0) {
    const needed = new Set<string>(query.groupBy);
    if (query.column) needed.add(query.column);
    for (const f of filters) needed.add(f.column);
    neededColumns = [...needed];
  } else {
    // raw row output returns all columns
    neededColumns = undefined;
  }

  // Row group pruning, first via column chunk statistics (free -- already in
  // the footer), then via bloom filters for surviving row groups.
  const statsPass = metadata.row_groups.map((rowGroup) => {
    const numRows = Number(rowGroup.num_rows);
    if (numRows === 0) return false;
    for (const filter of filters) {
      const chunk = rowGroup.columns.find(
        (c) => c.meta_data?.path_in_schema.join(".") === filter.column
      );
      if (!chunk?.meta_data) continue;
      if (!rowGroupMayMatch(filter, chunk.meta_data.statistics, numRows)) {
        return false;
      }
    }
    return true;
  });

  let mayMatch = statsPass;
  const hasBloomEligibleFilter = filters.some(
    (f) => f.op === "eq" || f.op === "in"
  );
  if (file && hasBloomEligibleFilter && statsPass.some((p) => p)) {
    const schemaElements = new Map<string, SchemaElement>();
    for (const child of parquetSchema(metadata).children) {
      schemaElements.set(child.element.name, child.element);
    }
    mayMatch = await Promise.all(
      metadata.row_groups.map((rowGroup, i) =>
        statsPass[i]
          ? rowGroupPassesBloomFilters(file, rowGroup, filters, schemaElements)
          : Promise.resolve(false)
      )
    );
  }

  const spans: ReadSpan[] = [];
  let rowStart = 0;
  let scanned = 0;
  metadata.row_groups.forEach((rowGroup, i) => {
    const numRows = Number(rowGroup.num_rows);
    if (mayMatch[i]) {
      scanned++;
      const last = spans[spans.length - 1];
      if (last && last.rowEnd === rowStart) {
        // merge contiguous row groups into a single read
        last.rowEnd = rowStart + numRows;
      } else {
        spans.push({ rowStart, rowEnd: rowStart + numRows });
      }
    }
    rowStart += numRows;
  });

  return {
    columns,
    filters,
    neededColumns,
    spans,
    rowGroupsTotal: metadata.row_groups.length,
    rowGroupsScanned: scanned,
    totalRows: Number(metadata.num_rows),
  };
}
