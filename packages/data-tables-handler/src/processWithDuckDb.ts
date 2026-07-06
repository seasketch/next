import duckdb from "duckdb";
import * as path from "path";
import {
  DataTablesColumnStats,
  GeostatsAttribute,
} from "@seasketch/geostats-types";
import { inferGeostatsType } from "./validateJoinColumn";
import type { DataTableUploadProcessingOptions } from "./types";
import { normalizeCsvEncodingIfNeeded } from "./normalizeCsvEncoding";
import {
  buildTypedSelectSql,
  CSV_NULL_STRINGS_BASE,
  inferCsvColumnPlans,
  nullstrOption,
} from "./inferCsvColumnPlans";

function run(conn: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function all<T>(conn: duckdb.Connection, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
  });
}

function escapePath(path: string): string {
  return path.replace(/'/g, "''");
}

function delimiterOption(delimiter: string): string {
  switch (delimiter) {
    case "\t":
      return "delim='\\t'";
    case ";":
      return "delim=';'";
    case "|":
      return "delim='|'";
    default:
      return "";
  }
}

export async function processCsvWithDuckDb(
  csvPath: string,
  parquetPath: string,
  options: DataTableUploadProcessingOptions,
): Promise<{ rowCount: number; headers: string[]; joinValues: Set<string> }> {
  const db = new duckdb.Database(":memory:");
  const conn = db.connect();
  const { path: duckDbCsvPath, normalized } = normalizeCsvEncodingIfNeeded(
    csvPath,
    path.join(path.dirname(csvPath), "input.utf8.csv"),
  );
  if (normalized) {
    console.log(
      `[data-tables-handler] normalized csv encoding to utf-8: ${duckDbCsvPath}`,
    );
  }
  const delimiter = options.delimiter || ",";
  const hasHeader = options.hasHeaderRow !== false;
  const forceNotNull = options.forceNotNull || [];
  const forceNotNullSql =
    forceNotNull.length > 0
      ? `, force_not_null=[${forceNotNull.map((c) => `'${c.replace(/'/g, "''")}'`).join(", ")}]`
      : "";

  const readCsvOptionsSuffix = [
    "header=" + (hasHeader ? "true" : "false"),
    "sample_size=-1",
    delimiterOption(delimiter),
  ]
    .filter(Boolean)
    .join(", ");

  const columnPlans = await inferCsvColumnPlans(
    conn,
    duckDbCsvPath,
    readCsvOptionsSuffix,
  );
  const baseNullstr = nullstrOption(CSV_NULL_STRINGS_BASE);

  await run(
    conn,
    `CREATE OR REPLACE TEMP TABLE _csv_raw AS SELECT * FROM read_csv('${escapePath(duckDbCsvPath)}', ${readCsvOptionsSuffix}, ${baseNullstr}, all_varchar=true${forceNotNullSql})`,
  );
  await run(
    conn,
    `CREATE OR REPLACE TABLE observations AS SELECT ${buildTypedSelectSql(columnPlans)} FROM _csv_raw`,
  );
  await run(conn, "DROP TABLE IF EXISTS _csv_raw");

  const countRows = await all<{ count: number }>(
    conn,
    "SELECT COUNT(*)::INTEGER as count FROM observations",
  );
  const rowCount = countRows[0]?.count ?? 0;

  const columns = await all<{ column_name: string }>(
    conn,
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'observations' ORDER BY ordinal_position`,
  );
  const headers = columns.map((c) => c.column_name);

  await run(
    conn,
    `COPY observations TO '${escapePath(parquetPath)}' (FORMAT PARQUET)`,
  );

  conn.close();
  db.close();

  return { rowCount, headers, joinValues: new Set<string>() };
}

export async function readJoinValues(
  parquetPath: string,
  joinColumn: string,
): Promise<Set<string>> {
  const db = new duckdb.Database(":memory:");
  const conn = db.connect();
  const col = joinColumn.replace(/"/g, '""');
  const rows = await all<{ v: string }>(
    conn,
    `SELECT DISTINCT CAST("${col}" AS VARCHAR) as v FROM read_parquet('${escapePath(parquetPath)}') WHERE "${col}" IS NOT NULL`,
  );
  conn.close();
  db.close();
  return new Set(rows.map((r) => r.v));
}

export async function computeColumnStatsFromParquet(
  parquetPath: string,
  tableName: string,
  joinInfo: DataTablesColumnStats["join"],
): Promise<DataTablesColumnStats> {
  const db = new duckdb.Database(":memory:");
  const conn = db.connect();
  await run(
    conn,
    `CREATE OR REPLACE TABLE observations AS SELECT * FROM read_parquet('${escapePath(parquetPath)}')`,
  );

  const countRows = await all<{ count: number }>(
    conn,
    "SELECT COUNT(*)::INTEGER as count FROM observations",
  );
  const rowCount = countRows[0]?.count ?? 0;

  const schema = await all<{ column_name: string; data_type: string }>(
    conn,
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'observations' ORDER BY ordinal_position`,
  );

  const columns: GeostatsAttribute[] = [];
  for (const col of schema) {
    const colName = col.column_name.replace(/"/g, '""');
    const type = inferGeostatsType(col.data_type);
    const nonNull = await all<{ count: number }>(
      conn,
      `SELECT COUNT(*)::INTEGER as count FROM observations WHERE "${colName}" IS NOT NULL`,
    );
    const count = nonNull[0]?.count ?? 0;
    const distinctRows = await all<{ v: string; c: number }>(
      conn,
      `SELECT CAST("${colName}" AS VARCHAR) as v, COUNT(*)::INTEGER as c FROM observations WHERE "${colName}" IS NOT NULL GROUP BY 1 ORDER BY c DESC LIMIT 500`,
    );
    const values: { [key: string]: number } = {};
    for (const row of distinctRows) {
      values[row.v] = row.c;
    }
    const attr: GeostatsAttribute = {
      attribute: col.column_name,
      count,
      countDistinct: distinctRows.length,
      type,
      values,
    };
    if (type === "number") {
      const stats = await all<{
        min: number;
        max: number;
        avg: number;
        stdev: number;
      }>(
        conn,
        `SELECT MIN(CAST("${colName}" AS DOUBLE)) as min, MAX(CAST("${colName}" AS DOUBLE)) as max, AVG(CAST("${colName}" AS DOUBLE)) as avg, STDDEV(CAST("${colName}" AS DOUBLE)) as stdev FROM observations WHERE "${colName}" IS NOT NULL`,
      );
      if (stats[0]) {
        (attr as GeostatsAttribute & { min?: number; max?: number }).min =
          stats[0].min;
        (attr as GeostatsAttribute & { min?: number; max?: number }).max =
          stats[0].max;
      }
    }
    columns.push(attr);
  }

  conn.close();
  db.close();

  return {
    table: tableName,
    rowCount,
    columns,
    join: joinInfo,
  };
}
