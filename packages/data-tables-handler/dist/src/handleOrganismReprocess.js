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
exports.readOrganismSourceRows = readOrganismSourceRows;
exports.readDistinctOrganismValues = readDistinctOrganismValues;
exports.readClassTableRows = readClassTableRows;
exports.writeOrganismCatalogParquet = writeOrganismCatalogParquet;
exports.copyOrganismSidecars = copyOrganismSidecars;
exports.runOrganismEnrichment = runOrganismEnrichment;
const path = __importStar(require("path"));
const fs_1 = require("fs");
const geostats_types_1 = require("@seasketch/geostats-types");
const duckDb_1 = require("./duckDb");
const clusterParquet_1 = require("./clusterParquet");
const enrichOrganisms_1 = require("./enrichOrganisms");
const remotes_1 = require("./remotes");
const taxonomyApis_1 = require("./taxonomyApis");
const wormsParquet_1 = require("./wormsParquet");
const overlayEngineAccessToken_1 = require("./overlayEngineAccessToken");
const inferCsvColumnPlans_1 = require("./inferCsvColumnPlans");
const normalizeCsvEncoding_1 = require("./normalizeCsvEncoding");
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const PARQUET_CONTENT_TYPE = "application/vnd.apache.parquet";
function escapePath(filePath) {
    return filePath.replace(/'/g, "''");
}
/** Sibling columns on the observation parquet, keyed by identity value. */
async function readOrganismSourceRows(parquetPath, identityColumn, columns) {
    const wanted = Array.from(new Set(columns.filter((name) => name && name !== identityColumn)));
    if (wanted.length === 0)
        return new Map();
    return (0, duckDb_1.withDuckDb)(async (conn) => {
        const described = await (0, duckDb_1.all)(conn, `SELECT column_name FROM (DESCRIBE SELECT * FROM read_parquet('${escapePath(parquetPath)}'))`);
        const actual = described.map((row) => String(row.column_name));
        const idCol = actual.find((name) => name.toLowerCase() === identityColumn.toLowerCase());
        if (!idCol)
            return new Map();
        const selected = [];
        for (const want of wanted) {
            const hit = actual.find((name) => name.toLowerCase() === want.toLowerCase());
            if (hit && hit !== idCol && selected.indexOf(hit) === -1) {
                selected.push(hit);
            }
        }
        if (selected.length === 0)
            return new Map();
        const projections = selected
            .map((name) => {
            const quoted = `"${name.replace(/"/g, '""')}"`;
            return `any_value(${quoted}) AS ${quoted}`;
        })
            .join(", ");
        const idQuoted = `"${idCol.replace(/"/g, '""')}"`;
        const rows = await (0, duckDb_1.all)(conn, `SELECT CAST(${idQuoted} AS VARCHAR) AS __organism_value, ${projections}
       FROM read_parquet('${escapePath(parquetPath)}')
       WHERE ${idQuoted} IS NOT NULL AND TRIM(CAST(${idQuoted} AS VARCHAR)) <> ''
       GROUP BY 1`);
        const out = new Map();
        for (const row of rows) {
            const value = String(row.__organism_value || "").trim();
            if (!value)
                continue;
            const rest = { ...row };
            delete rest.__organism_value;
            out.set(value, rest);
        }
        return out;
    });
}
async function readDistinctOrganismValues(parquetPath, column) {
    const col = column.replace(/"/g, '""');
    return (0, duckDb_1.withDuckDb)(async (conn) => {
        const rows = await (0, duckDb_1.all)(conn, `SELECT CAST("${col}" AS VARCHAR) as value, COUNT(*)::INTEGER as occurrence_count
       FROM read_parquet('${escapePath(parquetPath)}')
       WHERE "${col}" IS NOT NULL AND TRIM(CAST("${col}" AS VARCHAR)) <> ''
       GROUP BY 1
       ORDER BY 1`);
        return rows.map((row) => ({
            value: String(row.value),
            occurrenceCount: Number(row.occurrence_count) || 0,
        }));
    });
}
async function readClassTableRows(csvPath) {
    const { path: duckDbCsvPath } = await (0, normalizeCsvEncoding_1.normalizeCsvEncodingIfNeeded)(csvPath, path.join(path.dirname(csvPath), "class.utf8.csv"));
    return (0, duckDb_1.withDuckDb)(async (conn) => {
        const readOpts = "header=true, sample_size=-1";
        const columnPlans = await (0, inferCsvColumnPlans_1.inferCsvColumnPlans)(conn, duckDbCsvPath, readOpts);
        const baseNullstr = (0, inferCsvColumnPlans_1.nullstrOption)(inferCsvColumnPlans_1.CSV_NULL_STRINGS_BASE);
        await (0, duckDb_1.run)(conn, `CREATE OR REPLACE TEMP TABLE _class_raw AS SELECT * FROM read_csv('${escapePath(duckDbCsvPath)}', ${readOpts}, ${baseNullstr}, all_varchar=true)`);
        await (0, duckDb_1.run)(conn, `CREATE OR REPLACE TABLE class_table AS SELECT ${(0, inferCsvColumnPlans_1.buildTypedSelectSql)(columnPlans)} FROM _class_raw`);
        return (0, duckDb_1.all)(conn, "SELECT * FROM class_table");
    });
}
async function writeOrganismCatalogParquet(rows, parquetPath) {
    const jsonPath = parquetPath.replace(/\.parquet$/, ".json");
    (0, fs_1.writeFileSync)(jsonPath, JSON.stringify(rows));
    await (0, duckDb_1.withDuckDb)(async (conn) => {
        await (0, duckDb_1.run)(conn, `COPY (SELECT * FROM read_json_auto('${escapePath(jsonPath)}')) TO '${escapePath(parquetPath)}' (FORMAT PARQUET)`);
    });
}
async function copyOrganismSidecars(fromParquetRemote, toParquetRemote) {
    for (const filename of Object.values(geostats_types_1.ORGANISM_SIDECAR_FILES)) {
        const from = (0, remotes_1.siblingRemote)(fromParquetRemote, filename);
        const to = (0, remotes_1.siblingRemote)(toParquetRemote, filename);
        if (!from || !to)
            continue;
        const tmp = path.join(require("os").tmpdir(), `copy-${filename}`);
        const ok = await (0, remotes_1.tryGetR2Object)(from, tmp);
        if (ok) {
            const contentType = filename.endsWith(".parquet")
                ? PARQUET_CONTENT_TYPE
                : JSON_CONTENT_TYPE;
            await (0, remotes_1.putObject)(tmp, to, contentType);
        }
    }
}
async function runOrganismEnrichment(options) {
    if (!(0, geostats_types_1.isDataTableOrganismConfig)(options.config)) {
        throw new Error("Invalid organism_config");
    }
    const values = await readDistinctOrganismValues(options.parquetPath, options.config.column);
    if (values.length === 0) {
        throw new Error(`No distinct values in organism column "${options.config.column}"`);
    }
    // eslint-disable-next-line no-console
    console.log(`[data-tables-handler] organism column "${options.config.column}": ${values.length} distinct values`);
    let classRows;
    if (options.classCsvPath) {
        await options.updateProgress("running", "reading class table", 0.2);
        classRows = await readClassTableRows(options.classCsvPath);
        const headers = classRows[0] ? Object.keys(classRows[0]) : [];
        const joinHeader = headers.find((header) => header.toLowerCase() ===
            (options.config.classJoinColumn || "").toLowerCase());
        if (!options.config.classJoinColumn || !joinHeader) {
            throw new Error("classJoinColumn is required and must match a class-table column");
        }
        // eslint-disable-next-line no-console
        console.log(`[data-tables-handler] class table: ${classRows.length} rows`);
    }
    const catalogPath = path.join(options.tmpDir, geostats_types_1.ORGANISM_SIDECAR_FILES.catalog);
    const indexPath = path.join(options.tmpDir, geostats_types_1.ORGANISM_SIDECAR_FILES.searchIndex);
    const previewPath = path.join(options.tmpDir, geostats_types_1.ORGANISM_SIDECAR_FILES.preview);
    const tableRemote = options.parquetRemote;
    const catalogRemote = (0, remotes_1.siblingRemote)(tableRemote, geostats_types_1.ORGANISM_SIDECAR_FILES.catalog);
    const indexRemote = (0, remotes_1.siblingRemote)(tableRemote, geostats_types_1.ORGANISM_SIDECAR_FILES.searchIndex);
    const previewRemote = (0, remotes_1.siblingRemote)(tableRemote, geostats_types_1.ORGANISM_SIDECAR_FILES.preview);
    if (!catalogRemote || !indexRemote || !previewRemote) {
        throw new Error("Could not derive organism sidecar remotes from parquet_remote");
    }
    const sourceRows = await readOrganismSourceRows(options.parquetPath, options.config.column, Object.keys(options.config.roles));
    const draftRows = (0, enrichOrganisms_1.joinOrganismCatalogRows)({
        values,
        classRows,
        sourceRows,
        config: options.config,
    });
    (0, fs_1.writeFileSync)(previewPath, JSON.stringify((0, enrichOrganisms_1.previewPayloadFromCatalog)(draftRows, options.config)));
    await (0, remotes_1.putObject)(previewPath, previewRemote, JSON_CONTENT_TYPE);
    await options.updateProgress("running", "loading worms snapshot", 0.26);
    const wormsSnapshot = await (0, wormsParquet_1.ensureWormsParquet)();
    if (wormsSnapshot) {
        // eslint-disable-next-line no-console
        console.log(`[data-tables-handler] using WoRMS parquet snapshot ${wormsSnapshot.dir}`);
    }
    else {
        // eslint-disable-next-line no-console
        console.log("[data-tables-handler] WoRMS parquet snapshot unavailable; using REST");
    }
    await options.updateProgress("running", "resolving taxa", 0.28);
    const proxyBase = process.env.TAXONOMY_PROXY_URL;
    const accessToken = proxyBase
        ? await (0, overlayEngineAccessToken_1.getOverlayEngineAccessToken)()
        : undefined;
    const clients = {
        fetch: (0, taxonomyApis_1.createTaxonomyFetch)(options.fetchImpl || fetch, proxyBase, accessToken),
        waitWorms: (0, taxonomyApis_1.createRateLimiter)(taxonomyApis_1.WORMS_MIN_INTERVAL_MS),
        wormsParquetDir: wormsSnapshot?.dir || null,
    };
    const rows = await (0, enrichOrganisms_1.enrichOrganismValues)({
        values,
        classRows,
        sourceRows,
        config: options.config,
        clients,
        onProgress: async (update) => {
            const ranges = {
                "worms-ids": [0.3, 0.4],
                "worms-names": [0.4, 0.5],
                "worms-details": [0.5, 0.68],
                wikidata: [0.68, 0.85],
            };
            const [start, end] = ranges[update.phase];
            const fraction = start + (update.done / Math.max(update.total, 1)) * (end - start);
            const label = `resolving ${update.phase.replace("-", " ")} ${update.done}/${update.total}`;
            await options.updateProgress("running", label, fraction);
        },
    });
    await options.updateProgress("running", "writing catalog", 0.85);
    await writeOrganismCatalogParquet(rows, catalogPath);
    const includeLow = (0, geostats_types_1.includeLowConfidenceMatchesEnabled)(options.config);
    (0, fs_1.writeFileSync)(indexPath, (0, enrichOrganisms_1.serializeOrganismSearchIndex)(rows, options.config.column, includeLow));
    (0, fs_1.writeFileSync)(previewPath, JSON.stringify((0, enrichOrganisms_1.previewPayloadFromCatalog)(rows, options.config)));
    await (0, remotes_1.putObject)(catalogPath, catalogRemote, PARQUET_CONTENT_TYPE);
    await (0, remotes_1.putObject)(indexPath, indexRemote, JSON_CONTENT_TYPE);
    await (0, remotes_1.putObject)(previewPath, previewRemote, JSON_CONTENT_TYPE);
    await options.updateProgress("running", "clustering table", 0.92);
    const cluster = await (0, clusterParquet_1.rewriteParquetClustered)(options.parquetPath, {
        organismColumn: options.config.column,
        joinColumn: options.joinColumn,
        requiredFilterColumns: options.requiredFilterColumns,
    });
    // eslint-disable-next-line no-console
    console.log(`[data-tables-handler] clustered data.parquet by ${cluster.join(", ") || "(none)"}`);
    return {
        organism: (0, geostats_types_1.organismInfoFromConfig)(options.config, "admin", (0, geostats_types_1.organismClassificationCounts)(rows, includeLow)),
    };
}
