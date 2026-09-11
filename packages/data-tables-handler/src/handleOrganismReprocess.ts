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
import {
  enrichOrganismValues,
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
import { getOverlayEngineAccessToken } from "./overlayEngineAccessToken";
import { inferCsvColumnPlans, buildTypedSelectSql, CSV_NULL_STRINGS_BASE, nullstrOption } from "./inferCsvColumnPlans";
import { normalizeCsvEncodingIfNeeded } from "./normalizeCsvEncoding";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const PARQUET_CONTENT_TYPE = "application/vnd.apache.parquet";

function escapePath(filePath: string): string {
  return filePath.replace(/'/g, "''");
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
  const { path: duckDbCsvPath } = normalizeCsvEncodingIfNeeded(
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

export async function copyOrganismSidecars(
  fromParquetRemote: string,
  toParquetRemote: string
): Promise<void> {
  for (const filename of Object.values(ORGANISM_SIDECAR_FILES)) {
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
    // eslint-disable-next-line no-console
    console.log(
      `[data-tables-handler] class table: ${classRows.length} rows`
    );
  }
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
  };
  await options.updateProgress("running", "resolving taxa", 0.3);
  const rows = await enrichOrganismValues({
    values,
    classRows,
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

  const catalogPath = path.join(options.tmpDir, ORGANISM_SIDECAR_FILES.catalog);
  const indexPath = path.join(options.tmpDir, ORGANISM_SIDECAR_FILES.searchIndex);
  const previewPath = path.join(options.tmpDir, ORGANISM_SIDECAR_FILES.preview);
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

  const tableRemote = options.parquetRemote;
  const catalogRemote = siblingRemote(tableRemote, ORGANISM_SIDECAR_FILES.catalog);
  const indexRemote = siblingRemote(tableRemote, ORGANISM_SIDECAR_FILES.searchIndex);
  const previewRemote = siblingRemote(tableRemote, ORGANISM_SIDECAR_FILES.preview);
  if (!catalogRemote || !indexRemote || !previewRemote) {
    throw new Error("Could not derive organism sidecar remotes from parquet_remote");
  }
  await putObject(catalogPath, catalogRemote, PARQUET_CONTENT_TYPE);
  await putObject(indexPath, indexRemote, JSON_CONTENT_TYPE);
  await putObject(previewPath, previewRemote, JSON_CONTENT_TYPE);

  return {
    organism: organismInfoFromConfig(
      options.config,
      "admin",
      organismClassificationCounts(rows, includeLow)
    ),
  };
}
