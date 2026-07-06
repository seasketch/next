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

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
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

export interface ParsedQuery {
  /** null means "negotiate via the Accept header" */
  format: OutputFormat | null;
  groupBy: string[];
  ops: Aggregation[];
  /** Column to aggregate. Required for every op except count. */
  column: string | null;
  limit: number | null;
  offset: number;
  orderBy: { key: string; direction: "asc" | "desc" } | null;
  filters: RawFilter[];
}

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
  if (raw.startsWith("in.(") && raw.endsWith(")")) {
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
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("q.")) {
      const column = key.slice(2);
      if (!column) {
        throw new QueryError(`Invalid filter parameter "${key}".`);
      }
      filters.push(parseFilterParam(column, value));
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

  let limit: number | null = null;
  const limitParam = searchParams.get("limit");
  if (limitParam !== null) {
    if (limitParam.trim() === "") {
      limit = null;
    } else {
      limit = Number(limitParam);
      if (!Number.isInteger(limit) || limit < 1) {
        throw new QueryError(
          `Invalid limit "${limitParam}". Must be a positive integer, or omit for no limit.`
        );
      }
    }
  }

  let offset = 0;
  const offsetParam = searchParams.get("offset");
  if (offsetParam !== null) {
    offset = Number(offsetParam);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new QueryError(
        `Invalid offset "${offsetParam}". Must be a non-negative integer.`
      );
    }
  }

  let orderBy: ParsedQuery["orderBy"] = null;
  const orderByParam = searchParams.get("orderBy");
  if (orderByParam !== null && orderByParam.trim().length > 0) {
    const [key, direction = "asc"] = orderByParam.split(":");
    if (direction !== "asc" && direction !== "desc") {
      throw new QueryError(
        `Invalid orderBy direction "${direction}". Use :asc or :desc.`
      );
    }
    orderBy = { key: key.trim(), direction };
  }

  return { format, groupBy, ops, column, limit, offset, orderBy, filters };
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
