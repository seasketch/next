"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteIdent = quoteIdent;
exports.escapePath = escapePath;
exports.clusterColumns = clusterColumns;
exports.copyObservationsParquetSql = copyObservationsParquetSql;
exports.bloomColumnsFor = bloomColumnsFor;
exports.rewriteParquetClustered = rewriteParquetClustered;
const duckDb_1 = require("./duckDb");
/**
 * Row-group clustering for overlay data-table parquet.
 *
 * Equality filters (`q.{column}=value`) can only prune row groups when a
 * value's min/max (or bloom) excludes other groups. Tables written in
 * arrival order often put every filter value in every group, so the Worker
 * decodes the whole file. Sorting by columns we *already know* will be
 * filtered — required filters, organism identity, time, join — packs each
 * value into one or two DuckDB row groups.
 *
 * Column names are never guessed. Only configured keys are used.
 */
const WHEN_START = "_when_start";
const WHEN_END = "_when_end";
function quoteIdent(name) {
    return `"${name.replace(/"/g, '""')}"`;
}
function escapePath(path) {
    return path.replace(/'/g, "''");
}
function clusterColumns(hints) {
    const have = new Set(hints.columns);
    const out = [];
    const add = (name) => {
        if (!name || !have.has(name) || out.includes(name))
            return;
        if (name === WHEN_END)
            return;
        out.push(name);
    };
    add(hints.subjectColumn || hints.organismColumn);
    for (const name of hints.requiredFilterColumns || []) {
        add(name);
    }
    if (have.has(WHEN_START)) {
        add(WHEN_START);
        for (const name of hints.replicateColumns || []) {
            add(name);
        }
    }
    for (const name of hints.temporalColumns || []) {
        add(name);
    }
    add(hints.joinColumn);
    const replicateCount = (hints.replicateColumns || []).filter((name) => name && have.has(name) && name !== WHEN_END).length;
    return out.slice(0, 4 + replicateCount);
}
/** COPY observations, optionally clustered so filters can prune row groups. */
function copyObservationsParquetSql(parquetPath, cluster, bloomColumns = []) {
    const order = cluster.map(quoteIdent).join(", ");
    const select = order
        ? `SELECT * FROM observations ORDER BY ${order}`
        : `SELECT * FROM observations`;
    const bloom = bloomColumns
        .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
        .map((name) => `${name}: 0.05`)
        .join(", ");
    const bloomClause = bloom ? `, BLOOM_FILTER_COLUMNS {${bloom}}` : "";
    return `COPY (${select}) TO '${escapePath(parquetPath)}' (FORMAT PARQUET, ROW_GROUP_SIZE 122880${bloomClause})`;
}
function bloomColumnsFor(hints) {
    const have = new Set(hints.columns);
    const names = [hints.joinColumn, hints.subjectColumn || hints.organismColumn];
    return names.filter((name) => Boolean(name) && have.has(name));
}
/** Rewrite an existing observations parquet using configured cluster columns. */
async function rewriteParquetClustered(parquetPath, hints) {
    return (0, duckDb_1.withDuckDb)(async (conn) => {
        await (0, duckDb_1.run)(conn, `CREATE OR REPLACE TABLE observations AS SELECT * FROM read_parquet('${escapePath(parquetPath)}')`);
        const schema = await (0, duckDb_1.all)(conn, `SELECT column_name FROM information_schema.columns WHERE table_name = 'observations'`);
        const cluster = clusterColumns({
            ...hints,
            columns: schema.map((row) => row.column_name),
        });
        await (0, duckDb_1.run)(conn, copyObservationsParquetSql(parquetPath, cluster, bloomColumnsFor({
            ...hints,
            columns: schema.map((row) => row.column_name),
        })));
        return cluster;
    });
}
