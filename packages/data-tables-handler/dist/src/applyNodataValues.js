"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodataMatchSql = nodataMatchSql;
exports.configFromStoredNodata = configFromStoredNodata;
exports.parseNodataConfig = parseNodataConfig;
exports.applyNodataValuesOnParquet = applyNodataValuesOnParquet;
const geostats_types_1 = require("@seasketch/geostats-types");
const geostats_types_2 = require("@seasketch/geostats-types");
const duckDb_1 = require("./duckDb");
const clusterParquet_1 = require("./clusterParquet");
function escapePath(path) {
    return path.replace(/'/g, "''");
}
function quoteIdent(name) {
    return `"${name.replace(/"/g, '""')}"`;
}
function sqlStringLiteral(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
function sqlNumberLiteral(value) {
    return Number.isFinite(value) ? String(value) : "NULL";
}
const DERIVED_COLUMNS = new Set([geostats_types_2.WHEN_START_COLUMN, geostats_types_2.WHEN_END_COLUMN]);
function nodataMatchSql(quotedColumn, values) {
    if (values.length === 0)
        return null;
    const numbers = values.filter((value) => typeof value === "number");
    const strings = values.map((value) => String(value));
    const parts = [];
    if (numbers.length > 0) {
        parts.push(`(try_cast(${quotedColumn} AS DOUBLE) IN (${numbers
            .map(sqlNumberLiteral)
            .join(", ")}))`);
    }
    if (strings.length > 0) {
        parts.push(`(CAST(${quotedColumn} AS VARCHAR) IN (${strings
            .map(sqlStringLiteral)
            .join(", ")}))`);
    }
    if (parts.length === 0)
        return null;
    return parts.join(" OR ");
}
function configFromStoredNodata(value) {
    const values = (0, geostats_types_1.normalizeNodataValues)(value);
    return values.length > 0 ? { values } : null;
}
function parseNodataConfig(value) {
    if ((0, geostats_types_1.isDataTableNodataConfig)(value)) {
        const values = (0, geostats_types_1.normalizeNodataValues)(value);
        return { values };
    }
    const values = (0, geostats_types_1.normalizeNodataValues)(value);
    return values.length > 0 || Array.isArray(value) ? { values } : null;
}
async function applyNodataValuesOnParquet(parquetPath, values, excludeColumns = [], clusterHints) {
    const sentinels = (0, geostats_types_1.normalizeNodataValues)(values);
    return (0, duckDb_1.withDuckDb)(async (conn) => {
        const escaped = escapePath(parquetPath);
        const columns = await (0, duckDb_1.all)(conn, `SELECT column_name FROM (DESCRIBE SELECT * FROM read_parquet('${escaped}'))`);
        const exclude = new Set([...excludeColumns, ...DERIVED_COLUMNS]);
        const selectList = columns.map((column) => {
            const name = column.column_name;
            const quoted = quoteIdent(name);
            if (exclude.has(name) || sentinels.length === 0) {
                return quoted;
            }
            const predicate = nodataMatchSql(quoted, sentinels);
            if (!predicate)
                return quoted;
            return `CASE WHEN ${quoted} IS NULL THEN NULL WHEN (${predicate}) THEN NULL ELSE ${quoted} END AS ${quoted}`;
        });
        await (0, duckDb_1.run)(conn, `CREATE OR REPLACE TABLE observations AS
       SELECT ${selectList.join(", ")}
       FROM read_parquet('${escaped}')`);
        const counts = await (0, duckDb_1.all)(conn, `SELECT COUNT(*)::INTEGER as total FROM observations`);
        const hints = {
            columns: columns.map((column) => column.column_name),
            joinColumn: clusterHints?.joinColumn,
            organismColumn: clusterHints?.organismColumn,
            subjectColumn: clusterHints?.subjectColumn,
            requiredFilterColumns: clusterHints?.requiredFilterColumns,
            temporalColumns: clusterHints?.temporalColumns,
            replicateColumns: clusterHints?.replicateColumns,
        };
        await (0, duckDb_1.run)(conn, (0, clusterParquet_1.copyObservationsParquetSql)(parquetPath, (0, clusterParquet_1.clusterColumns)(hints), (0, clusterParquet_1.bloomColumnsFor)(hints)));
        return {
            rowCount: counts[0]?.total ?? 0,
            values: sentinels,
        };
    });
}
