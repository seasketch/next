import {
  isDataTableNodataConfig,
  normalizeNodataValues,
  type DataTableNodataValue,
} from "@seasketch/geostats-types";
import { WHEN_END_COLUMN, WHEN_START_COLUMN } from "@seasketch/geostats-types";
import { all, run, withDuckDb } from "./duckDb";

function escapePath(path: string): string {
  return path.replace(/'/g, "''");
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumberLiteral(value: number): string {
  return Number.isFinite(value) ? String(value) : "NULL";
}

const DERIVED_COLUMNS = new Set([WHEN_START_COLUMN, WHEN_END_COLUMN]);

export function nodataMatchSql(
  quotedColumn: string,
  values: DataTableNodataValue[],
): string | null {
  if (values.length === 0) return null;
  const numbers = values.filter((value): value is number => typeof value === "number");
  const strings = values.map((value) => String(value));
  const parts: string[] = [];
  if (numbers.length > 0) {
    parts.push(
      `(try_cast(${quotedColumn} AS DOUBLE) IN (${numbers
        .map(sqlNumberLiteral)
        .join(", ")}))`,
    );
  }
  if (strings.length > 0) {
    parts.push(
      `(CAST(${quotedColumn} AS VARCHAR) IN (${strings
        .map(sqlStringLiteral)
        .join(", ")}))`,
    );
  }
  if (parts.length === 0) return null;
  return parts.join(" OR ");
}

export function configFromStoredNodata(
  value: unknown,
): { values: DataTableNodataValue[] } | null {
  const values = normalizeNodataValues(value);
  return values.length > 0 ? { values } : null;
}

export function parseNodataConfig(
  value: unknown,
): { values: DataTableNodataValue[] } | null {
  if (isDataTableNodataConfig(value)) {
    const values = normalizeNodataValues(value);
    return { values };
  }
  const values = normalizeNodataValues(value);
  return values.length > 0 || Array.isArray(value) ? { values } : null;
}

export type ApplyNodataResult = {
  rowCount: number;
  values: DataTableNodataValue[];
};

export async function applyNodataValuesOnParquet(
  parquetPath: string,
  values: DataTableNodataValue[],
  excludeColumns: string[] = [],
): Promise<ApplyNodataResult> {
  const sentinels = normalizeNodataValues(values);
  return withDuckDb(async (conn) => {
    const escaped = escapePath(parquetPath);
    const columns = await all<{ column_name: string }>(
      conn,
      `SELECT column_name FROM (DESCRIBE SELECT * FROM read_parquet('${escaped}'))`,
    );
    const exclude = new Set([...excludeColumns, ...DERIVED_COLUMNS]);
    const selectList = columns.map((column) => {
      const name = column.column_name;
      const quoted = quoteIdent(name);
      if (exclude.has(name) || sentinels.length === 0) {
        return quoted;
      }
      const predicate = nodataMatchSql(quoted, sentinels);
      if (!predicate) return quoted;
      return `CASE WHEN ${quoted} IS NULL THEN NULL WHEN (${predicate}) THEN NULL ELSE ${quoted} END AS ${quoted}`;
    });

    await run(
      conn,
      `CREATE OR REPLACE TABLE observations AS
       SELECT ${selectList.join(", ")}
       FROM read_parquet('${escaped}')`,
    );
    const counts = await all<{ total: number }>(
      conn,
      `SELECT COUNT(*)::INTEGER as total FROM observations`,
    );
    await run(
      conn,
      `COPY observations TO '${escaped}' (FORMAT PARQUET)`,
    );
    return {
      rowCount: counts[0]?.total ?? 0,
      values: sentinels,
    };
  });
}
