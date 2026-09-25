"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
exports.all = all;
exports.withDuckDb = withDuckDb;
const node_api_1 = require("@duckdb/node-api");
const fs_1 = require("fs");
const os_1 = require("os");
const path = __importStar(require("path"));
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
    const spillDir = (0, fs_1.mkdtempSync)(path.join((0, os_1.tmpdir)(), "duckdb-spill-"));
    const instance = await node_api_1.DuckDBInstance.create(":memory:", {
        temp_directory: spillDir,
    });
    const conn = await instance.connect();
    try {
        return await fn(conn);
    }
    finally {
        conn.closeSync();
        instance.closeSync();
        (0, fs_1.rmSync)(spillDir, { recursive: true, force: true });
    }
}
