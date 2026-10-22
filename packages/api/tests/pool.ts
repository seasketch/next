import { createPool as cPool, DatabasePoolType } from "slonik";
import pg from "pg";

const DB_URL =
  process.env.TEST_DB || "postgres://postgres:password@localhost:54321/";

export function createPool(tableName: string): DatabasePoolType {
  const pool = cPool(DB_URL + tableName);
  // slonik 23.0 opened a fresh connection for every pool.transaction() and
  // closed it afterwards. Later 23.x releases return the connection to the
  // pool, and Postgres then reports a custom GUC one test defined (for
  // example session.survey_invite_email) as '' instead of NULL in the next
  // test that reuses the connection, which breaks casts such as ::email.
  // Explicit connections are still closed after use, so route transactions
  // through pool.connect() to keep each test's session isolated.
  return {
    ...pool,
    transaction: (handler, transactionRetryLimit) =>
      pool.connect((connection) =>
        connection.transaction(handler, transactionRetryLimit)
      ),
  };
}

export function createPgPool(tableName: string) {
  return new pg.Pool({ connectionString: DB_URL + tableName });
}

export const DATABASE_URL = DB_URL;
