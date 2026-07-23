"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
exports.all = all;
exports.withDuckDb = withDuckDb;
const node_api_1 = require("@duckdb/node-api");
/** Run SQL that does not return rows (DDL / DML). */
async function run(conn, sql) {
    await conn.run(sql);
}
/** Run a query and return all rows as plain JSON objects. */
async function all(conn, sql) {
    const reader = await conn.runAndReadAll(sql);
    return reader.getRowObjectsJson();
}
/** Runs fn against a fresh in-memory DuckDB, always closing it afterwards. */
async function withDuckDb(fn) {
    const instance = await node_api_1.DuckDBInstance.create(":memory:");
    const conn = await instance.connect();
    try {
        return await fn(conn);
    }
    finally {
        conn.closeSync();
        instance.closeSync();
    }
}
