import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

export type { DuckDBConnection };

/** Run SQL that does not return rows (DDL / DML). */
export async function run(conn: DuckDBConnection, sql: string): Promise<void> {
  await conn.run(sql);
}

/** Run a query and return all rows as plain JSON objects. */
export async function all<T extends Record<string, unknown>>(
  conn: DuckDBConnection,
  sql: string,
): Promise<T[]> {
  const reader = await conn.runAndReadAll(sql);
  return reader.getRowObjectsJson() as T[];
}

/** Runs fn against a fresh in-memory DuckDB, always closing it afterwards. */
export async function withDuckDb<T>(
  fn: (conn: DuckDBConnection) => Promise<T>,
): Promise<T> {
  const spillDir = mkdtempSync(path.join(tmpdir(), "duckdb-spill-"));
  const instance = await DuckDBInstance.create(":memory:", {
    temp_directory: spillDir,
  });
  const conn = await instance.connect();
  try {
    return await fn(conn);
  } finally {
    conn.closeSync();
    instance.closeSync();
    rmSync(spillDir, { recursive: true, force: true });
  }
}
