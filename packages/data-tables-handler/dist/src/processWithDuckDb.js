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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCsvWithDuckDb = processCsvWithDuckDb;
exports.readJoinValues = readJoinValues;
exports.computeColumnStatsFromParquet = computeColumnStatsFromParquet;
const duckdb_1 = __importDefault(require("duckdb"));
const path = __importStar(require("path"));
const validateJoinColumn_1 = require("./validateJoinColumn");
const normalizeCsvEncoding_1 = require("./normalizeCsvEncoding");
const inferCsvColumnPlans_1 = require("./inferCsvColumnPlans");
function run(conn, sql) {
    return new Promise((resolve, reject) => {
        conn.run(sql, (err) => (err ? reject(err) : resolve()));
    });
}
function all(conn, sql) {
    return new Promise((resolve, reject) => {
        conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}
function escapePath(path) {
    return path.replace(/'/g, "''");
}
function delimiterOption(delimiter) {
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
async function processCsvWithDuckDb(csvPath, parquetPath, options) {
    const db = new duckdb_1.default.Database(":memory:");
    const conn = db.connect();
    const { path: duckDbCsvPath, normalized } = (0, normalizeCsvEncoding_1.normalizeCsvEncodingIfNeeded)(csvPath, path.join(path.dirname(csvPath), "input.utf8.csv"));
    if (normalized) {
        console.log(`[data-tables-handler] normalized csv encoding to utf-8: ${duckDbCsvPath}`);
    }
    const delimiter = options.delimiter || ",";
    const hasHeader = options.hasHeaderRow !== false;
    const forceNotNull = options.forceNotNull || [];
    const forceNotNullSql = forceNotNull.length > 0
        ? `, force_not_null=[${forceNotNull.map((c) => `'${c.replace(/'/g, "''")}'`).join(", ")}]`
        : "";
    const readCsvOptionsSuffix = [
        "header=" + (hasHeader ? "true" : "false"),
        "sample_size=-1",
        delimiterOption(delimiter),
    ]
        .filter(Boolean)
        .join(", ");
    const columnPlans = await (0, inferCsvColumnPlans_1.inferCsvColumnPlans)(conn, duckDbCsvPath, readCsvOptionsSuffix);
    const baseNullstr = (0, inferCsvColumnPlans_1.nullstrOption)(inferCsvColumnPlans_1.CSV_NULL_STRINGS_BASE);
    await run(conn, `CREATE OR REPLACE TEMP TABLE _csv_raw AS SELECT * FROM read_csv('${escapePath(duckDbCsvPath)}', ${readCsvOptionsSuffix}, ${baseNullstr}, all_varchar=true${forceNotNullSql})`);
    await run(conn, `CREATE OR REPLACE TABLE observations AS SELECT ${(0, inferCsvColumnPlans_1.buildTypedSelectSql)(columnPlans)} FROM _csv_raw`);
    await run(conn, "DROP TABLE IF EXISTS _csv_raw");
    const countRows = await all(conn, "SELECT COUNT(*)::INTEGER as count FROM observations");
    const rowCount = countRows[0]?.count ?? 0;
    const columns = await all(conn, `SELECT column_name FROM information_schema.columns WHERE table_name = 'observations' ORDER BY ordinal_position`);
    const headers = columns.map((c) => c.column_name);
    await run(conn, `COPY observations TO '${escapePath(parquetPath)}' (FORMAT PARQUET)`);
    conn.close();
    db.close();
    return { rowCount, headers, joinValues: new Set() };
}
async function readJoinValues(parquetPath, joinColumn) {
    const db = new duckdb_1.default.Database(":memory:");
    const conn = db.connect();
    const col = joinColumn.replace(/"/g, '""');
    const rows = await all(conn, `SELECT DISTINCT CAST("${col}" AS VARCHAR) as v FROM read_parquet('${escapePath(parquetPath)}') WHERE "${col}" IS NOT NULL`);
    conn.close();
    db.close();
    return new Set(rows.map((r) => r.v));
}
async function computeColumnStatsFromParquet(parquetPath, tableName, joinInfo) {
    const db = new duckdb_1.default.Database(":memory:");
    const conn = db.connect();
    await run(conn, `CREATE OR REPLACE TABLE observations AS SELECT * FROM read_parquet('${escapePath(parquetPath)}')`);
    const countRows = await all(conn, "SELECT COUNT(*)::INTEGER as count FROM observations");
    const rowCount = countRows[0]?.count ?? 0;
    const schema = await all(conn, `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'observations' ORDER BY ordinal_position`);
    const columns = [];
    for (const col of schema) {
        const colName = col.column_name.replace(/"/g, '""');
        const type = (0, validateJoinColumn_1.inferGeostatsType)(col.data_type);
        const nonNull = await all(conn, `SELECT COUNT(*)::INTEGER as count FROM observations WHERE "${colName}" IS NOT NULL`);
        const count = nonNull[0]?.count ?? 0;
        const distinctRows = await all(conn, `SELECT CAST("${colName}" AS VARCHAR) as v, COUNT(*)::INTEGER as c FROM observations WHERE "${colName}" IS NOT NULL GROUP BY 1 ORDER BY c DESC LIMIT 500`);
        const values = {};
        for (const row of distinctRows) {
            values[row.v] = row.c;
        }
        const attr = {
            attribute: col.column_name,
            count,
            countDistinct: distinctRows.length,
            type,
            values,
        };
        if (type === "number") {
            const stats = await all(conn, `SELECT MIN(CAST("${colName}" AS DOUBLE)) as min, MAX(CAST("${colName}" AS DOUBLE)) as max, AVG(CAST("${colName}" AS DOUBLE)) as avg, STDDEV(CAST("${colName}" AS DOUBLE)) as stdev FROM observations WHERE "${colName}" IS NOT NULL`);
            if (stats[0]) {
                attr.min =
                    stats[0].min;
                attr.max =
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
