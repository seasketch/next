import * as path from "path";
import { writeFileSync } from "fs";
import {
  ORGANISM_SIDECAR_FILES,
  includeLowConfidenceMatchesEnabled,
  isDataTableOrganismConfig,
  organismClassificationCounts,
  organismInfoFromConfig,
  type DataTableOrganismConfig,
} from "@seasketch/geostats-types";
import { all, run, withDuckDb } from "./duckDb";
import { rewriteParquetClustered } from "./clusterParquet";

/** Survey coverage sidecar, read by the query worker beside data.parquet. */
export const COVERAGE_SIDECAR_FILE = "coverage.json";
import {
  enrichOrganismValues,
  joinOrganismCatalogRows,
  previewPayloadFromCatalog,
  serializeOrganismSearchIndex,
  type ClassTableRow,
} from "./enrichOrganisms";
import {
  putObject,
  siblingRemote,
  tryGetR2Object,
} from "./remotes";
import {
  WORMS_MIN_INTERVAL_MS,
  createRateLimiter,
  createTaxonomyFetch,
  type TaxonomyClients,
} from "./taxonomyApis";
import { ensureWormsParquet } from "./wormsParquet";
import { getOverlayEngineAccessToken } from "./overlayEngineAccessToken";
import { inferCsvColumnPlans, buildTypedSelectSql, CSV_NULL_STRINGS_BASE, nullstrOption } from "./inferCsvColumnPlans";
import { normalizeCsvEncodingIfNeeded } from "./normalizeCsvEncoding";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const PARQUET_CONTENT_TYPE = "application/vnd.apache.parquet";

function escapePath(filePath: string): string {
  return filePath.replace(/'/g, "''");
}

/** Sibling columns on the observation parquet, keyed by identity value. */
export async function readOrganismSourceRows(
  parquetPath: string,
  identityColumn: string,
  columns: string[]
): Promise<Map<string, ClassTableRow>> {
  const wanted = Array.from(
    new Set(columns.filter((name) => name && name !== identityColumn))
  );
  if (wanted.length === 0) return new Map();
  return withDuckDb(async (conn) => {
    const described = await all<{ column_name: string }>(
      conn,
      `SELECT column_name FROM (DESCRIBE SELECT * FROM read_parquet('${escapePath(parquetPath)}'))`
    );
    const actual = described.map((row) => String(row.column_name));
    const idCol = actual.find(
      (name) => name.toLowerCase() === identityColumn.toLowerCase()
    );
    if (!idCol) return new Map();
    const selected: string[] = [];
    for (const want of wanted) {
      const hit = actual.find((name) => name.toLowerCase() === want.toLowerCase());
      if (hit && hit !== idCol && selected.indexOf(hit) === -1) {
        selected.push(hit);
      }
    }
    if (selected.length === 0) return new Map();
    const projections = selected
      .map((name) => {
        const quoted = `"${name.replace(/"/g, '""')}"`;
        return `any_value(${quoted}) AS ${quoted}`;
      })
      .join(", ");
    const idQuoted = `"${idCol.replace(/"/g, '""')}"`;
    const rows = await all<ClassTableRow & { __organism_value: string }>(
      conn,
      `SELECT CAST(${idQuoted} AS VARCHAR) AS __organism_value, ${projections}
       FROM read_parquet('${escapePath(parquetPath)}')
       WHERE ${idQuoted} IS NOT NULL AND TRIM(CAST(${idQuoted} AS VARCHAR)) <> ''
       GROUP BY 1`
    );
    const out = new Map<string, ClassTableRow>();
    for (const row of rows) {
      const value = String(row.__organism_value || "").trim();
      if (!value) continue;
      const rest: ClassTableRow = { ...row };
      delete rest.__organism_value;
      out.set(value, rest);
    }
    return out;
  });
}

export async function readDistinctOrganismValues(
  parquetPath: string,
  column: string
): Promise<Array<{ value: string; occurrenceCount: number }>> {
  const col = column.replace(/"/g, '""');
  return withDuckDb(async (conn) => {
    const rows = await all<{ value: string; occurrence_count: number }>(
      conn,
      `SELECT CAST("${col}" AS VARCHAR) as value, COUNT(*)::INTEGER as occurrence_count
       FROM read_parquet('${escapePath(parquetPath)}')
       WHERE "${col}" IS NOT NULL AND TRIM(CAST("${col}" AS VARCHAR)) <> ''
       GROUP BY 1
       ORDER BY 1`
    );
    return rows.map((row) => ({
      value: String(row.value),
      occurrenceCount: Number(row.occurrence_count) || 0,
    }));
  });
}

export async function readClassTableRows(
  csvPath: string
): Promise<ClassTableRow[]> {
  const { path: duckDbCsvPath } = await normalizeCsvEncodingIfNeeded(
    csvPath,
    path.join(path.dirname(csvPath), "class.utf8.csv")
  );
  return withDuckDb(async (conn) => {
    const readOpts = "header=true, sample_size=-1";
    const columnPlans = await inferCsvColumnPlans(conn, duckDbCsvPath, readOpts);
    const baseNullstr = nullstrOption(CSV_NULL_STRINGS_BASE);
    await run(
      conn,
      `CREATE OR REPLACE TEMP TABLE _class_raw AS SELECT * FROM read_csv('${escapePath(duckDbCsvPath)}', ${readOpts}, ${baseNullstr}, all_varchar=true)`
    );
    await run(
      conn,
      `CREATE OR REPLACE TABLE class_table AS SELECT ${buildTypedSelectSql(columnPlans)} FROM _class_raw`
    );
    return all<ClassTableRow>(conn, "SELECT * FROM class_table");
  });
}

export async function writeOrganismCatalogParquet(
  rows: unknown[],
  parquetPath: string
): Promise<void> {
  const jsonPath = parquetPath.replace(/\.parquet$/, ".json");
  writeFileSync(jsonPath, JSON.stringify(rows));
  await withDuckDb(async (conn) => {
    await run(
      conn,
      `COPY (SELECT * FROM read_json_auto('${escapePath(jsonPath)}')) TO '${escapePath(parquetPath)}' (FORMAT PARQUET)`
    );
  });
}

/**
 * Copies every sidecar that lives beside data.parquet: organism catalog,
 * search index, preview, and the survey coverage file. Reprocessing writes
 * to a new prefix, and the query worker looks for these next to the parquet
 * it is reading, so a table would silently lose them otherwise.
 */
export async function copyOrganismSidecars(
  fromParquetRemote: string,
  toParquetRemote: string
): Promise<void> {
  const filenames = [
    ...Object.values(ORGANISM_SIDECAR_FILES),
    COVERAGE_SIDECAR_FILE,
  ];
  await copySidecars(fromParquetRemote, toParquetRemote, filenames);
}

/** Organism enrichment regenerates its own sidecars; only coverage carries over. */
export async function copyCoverageSidecar(
  fromParquetRemote: string,
  toParquetRemote: string
): Promise<void> {
  await copySidecars(fromParquetRemote, toParquetRemote, [COVERAGE_SIDECAR_FILE]);
}

async function copySidecars(
  fromParquetRemote: string,
  toParquetRemote: string,
  filenames: string[]
): Promise<void> {
  for (const filename of filenames) {
    const from = siblingRemote(fromParquetRemote, filename);
    const to = siblingRemote(toParquetRemote, filename);
    if (!from || !to) continue;
    const tmp = path.join(require("os").tmpdir(), `copy-${filename}`);
    const ok = await tryGetR2Object(from, tmp);
    if (ok) {
      const contentType = filename.endsWith(".parquet")
        ? PARQUET_CONTENT_TYPE
        : JSON_CONTENT_TYPE;
      await putObject(tmp, to, contentType);
    }
  }
}

export async function runOrganismEnrichment(options: {
  parquetPath: string;
  parquetRemote: string;
  config: DataTableOrganismConfig;
  classCsvPath?: string;
  slug: string;
  sourceUuid: string;
  uploadId: string;
  tmpDir: string;
  joinColumn?: string | null;
  requiredFilterColumns?: string[] | null;
  updateProgress: (
    state: "running",
    message: string,
    progress?: number
  ) => Promise<void>;
  fetchImpl?: typeof fetch;
}): Promise<{ organism: ReturnType<typeof organismInfoFromConfig> }> {
  if (!isDataTableOrganismConfig(options.config)) {
    throw new Error("Invalid organism_config");
  }
  const values = await readDistinctOrganismValues(
    options.parquetPath,
    options.config.column
  );
  if (values.length === 0) {
    throw new Error(
      `No distinct values in organism column "${options.config.column}"`
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `[data-tables-handler] organism column "${options.config.column}": ${values.length} distinct values`
  );
  let classRows: ClassTableRow[] | undefined;
  if (options.classCsvPath) {
    await options.updateProgress("running", "reading class table", 0.2);
    classRows = await readClassTableRows(options.classCsvPath);
    const headers = classRows[0] ? Object.keys(classRows[0]) : [];
    const joinHeader = headers.find(
      (header) =>
        header.toLowerCase() ===
        (options.config.classJoinColumn || "").toLowerCase()
    );
    if (!options.config.classJoinColumn || !joinHeader) {
      throw new Error(
        "classJoinColumn is required and must match a class-table column"
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `[data-tables-handler] class table: ${classRows.length} rows`
    );
  }
  const catalogPath = path.join(options.tmpDir, ORGANISM_SIDECAR_FILES.catalog);
  const indexPath = path.join(options.tmpDir, ORGANISM_SIDECAR_FILES.searchIndex);
  const previewPath = path.join(options.tmpDir, ORGANISM_SIDECAR_FILES.preview);
  const tableRemote = options.parquetRemote;
  const catalogRemote = siblingRemote(tableRemote, ORGANISM_SIDECAR_FILES.catalog);
  const indexRemote = siblingRemote(tableRemote, ORGANISM_SIDECAR_FILES.searchIndex);
  const previewRemote = siblingRemote(tableRemote, ORGANISM_SIDECAR_FILES.preview);
  if (!catalogRemote || !indexRemote || !previewRemote) {
    throw new Error("Could not derive organism sidecar remotes from parquet_remote");
  }

  const sourceRows = await readOrganismSourceRows(
    options.parquetPath,
    options.config.column,
    Object.keys(options.config.roles)
  );
  const draftRows = joinOrganismCatalogRows({
    values,
    classRows,
    sourceRows,
    config: options.config,
  });
  writeFileSync(
    previewPath,
    JSON.stringify(previewPayloadFromCatalog(draftRows, options.config))
  );
  await putObject(previewPath, previewRemote, JSON_CONTENT_TYPE);
  await options.updateProgress("running", "loading worms snapshot", 0.26);
  const wormsSnapshot = await ensureWormsParquet();
  if (wormsSnapshot) {
    // eslint-disable-next-line no-console
    console.log(
      `[data-tables-handler] using WoRMS parquet snapshot ${wormsSnapshot.dir}`
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      "[data-tables-handler] WoRMS parquet snapshot unavailable; using REST"
    );
  }
  await options.updateProgress("running", "resolving taxa", 0.28);

  const proxyBase = process.env.TAXONOMY_PROXY_URL;
  const accessToken = proxyBase
    ? await getOverlayEngineAccessToken()
    : undefined;
  const clients: TaxonomyClients = {
    fetch: createTaxonomyFetch(
      options.fetchImpl || fetch,
      proxyBase,
      accessToken
    ),
    waitWorms: createRateLimiter(WORMS_MIN_INTERVAL_MS),
    wormsParquetDir: wormsSnapshot?.dir || null,
  };
  const rows = await enrichOrganismValues({
    values,
    classRows,
    sourceRows,
    config: options.config,
    clients,
    onProgress: async (update) => {
      const ranges: Record<typeof update.phase, [number, number]> = {
        "worms-ids": [0.3, 0.4],
        "worms-names": [0.4, 0.5],
        "worms-details": [0.5, 0.68],
        wikidata: [0.68, 0.85],
      };
      const [start, end] = ranges[update.phase];
      const fraction =
        start + (update.done / Math.max(update.total, 1)) * (end - start);
      const label = `resolving ${update.phase.replace("-", " ")} ${update.done}/${update.total}`;
      await options.updateProgress("running", label, fraction);
    },
  });

  await options.updateProgress("running", "writing catalog", 0.85);
  await writeOrganismCatalogParquet(rows, catalogPath);
  const includeLow = includeLowConfidenceMatchesEnabled(options.config);
  writeFileSync(
    indexPath,
    serializeOrganismSearchIndex(rows, options.config.column, includeLow)
  );
  writeFileSync(
    previewPath,
    JSON.stringify(previewPayloadFromCatalog(rows, options.config))
  );
  await putObject(catalogPath, catalogRemote, PARQUET_CONTENT_TYPE);
  await putObject(indexPath, indexRemote, JSON_CONTENT_TYPE);
  await putObject(previewPath, previewRemote, JSON_CONTENT_TYPE);

  await options.updateProgress("running", "clustering table", 0.92);
  const cluster = await rewriteParquetClustered(options.parquetPath, {
    organismColumn: options.config.column,
    joinColumn: options.joinColumn,
    requiredFilterColumns: options.requiredFilterColumns,
  });
  // eslint-disable-next-line no-console
  console.log(
    `[data-tables-handler] clustered data.parquet by ${cluster.join(", ") || "(none)"}`
  );

  return {
    organism: organismInfoFromConfig(
      options.config,
      "admin",
      organismClassificationCounts(rows, includeLow)
    ),
  };
}
