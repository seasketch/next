import { sql, createPool as cPool } from "slonik";
import pg from "pg";

const DB_URL =
  process.env.TEST_DB || "postgres://postgres:password@localhost:54321/";

export function createPool(tableName: string) {
  return cPool(DB_URL + tableName);
}

export function createPgPool(tableName: string) {
  return new pg.Pool({ connectionString: DB_URL + tableName });
}

export const DATABASE_URL = DB_URL;
