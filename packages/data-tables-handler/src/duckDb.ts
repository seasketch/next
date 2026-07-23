import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

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
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  try {
    return await fn(conn);
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
}
