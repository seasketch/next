import { DuckDBConnection } from "@duckdb/node-api";
export type { DuckDBConnection };
/** Run SQL that does not return rows (DDL / DML). */
export declare function run(conn: DuckDBConnection, sql: string): Promise<void>;
/** Run a query and return all rows as plain JSON objects. */
export declare function all<T extends Record<string, unknown>>(conn: DuckDBConnection, sql: string): Promise<T[]>;
/** Runs fn against a fresh in-memory DuckDB, always closing it afterwards. */
export declare function withDuckDb<T>(fn: (conn: DuckDBConnection) => Promise<T>): Promise<T>;
