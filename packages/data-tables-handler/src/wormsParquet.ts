/**
 * Public WoRMS snapshot for organism enrichment, built from ChecklistBank
 * dataset 2011 (https://www.checklistbank.org/dataset/2011, COL
 * package col-clb-2011).
 *
 * Built by `scripts/buildWormsParquet.ts` (`npm run worms:build`). Stored on
 * ssn-tiles as public fixtures (no map token):
 *   r2://ssn-tiles/worms/v1/{taxa,ids,names}.parquet
 *   https://tiles.seasketch.org/worms/v1/…
 *
 * `resolveOrganismTaxa` queries these files first, then WoRMS REST on miss.
 * Full notes: ./README.md and design-docs/data-tables/organism-identity.md
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";
import { all, run, type DuckDBConnection, withDuckDb } from "./duckDb";
import { getR2Object } from "./remotes";

/** Bump when the parquet layout or R2 prefix changes (tiles cache is immutable). */
export const WORMS_PARQUET_VERSION = "v1";

export const WORMS_PARQUET_R2_BUCKET = "ssn-tiles";
/**
 * Public fixture prefix. Avoid `taxonomy/` (JWT WoRMS proxy) and
 * `dataLibrary/` (PMTiles TileJSON).
 */
export const WORMS_PARQUET_R2_PREFIX = `worms/${WORMS_PARQUET_VERSION}`;
export const WORMS_PARQUET_PUBLIC_BASE = `https://tiles.seasketch.org/${WORMS_PARQUET_R2_PREFIX}`;

export const WORMS_TAXA_FILENAME = "taxa.parquet";
export const WORMS_IDS_FILENAME = "ids.parquet";
export const WORMS_NAMES_FILENAME = "names.parquet";
export const WORMS_MANIFEST_FILENAME = "manifest.json";

export const WORMS_TAXA_R2_REMOTE = `r2://${WORMS_PARQUET_R2_BUCKET}/${WORMS_PARQUET_R2_PREFIX}/${WORMS_TAXA_FILENAME}`;
export const WORMS_IDS_R2_REMOTE = `r2://${WORMS_PARQUET_R2_BUCKET}/${WORMS_PARQUET_R2_PREFIX}/${WORMS_IDS_FILENAME}`;
export const WORMS_NAMES_R2_REMOTE = `r2://${WORMS_PARQUET_R2_BUCKET}/${WORMS_PARQUET_R2_PREFIX}/${WORMS_NAMES_FILENAME}`;
export const WORMS_MANIFEST_R2_REMOTE = `r2://${WORMS_PARQUET_R2_BUCKET}/${WORMS_PARQUET_R2_PREFIX}/${WORMS_MANIFEST_FILENAME}`;

export const WORMS_CHECKLISTBANK_URL =
  "https://www.checklistbank.org/dataset/2011";

export const WORMS_CITATION =
  "WoRMS Editorial Board (2026). World Register of Marine Species. ChecklistBank dataset 2011 (https://www.checklistbank.org/dataset/2011, doi:10.48580/d4fd). Available from https://www.marinespecies.org at VLIZ. doi:10.14284/170";

const APHIA_LSID = /taxname:(\d+)/;

export type WormsTaxonRow = {
  aphia_id: number;
  accepted_aphia_id: number;
  scientific_name: string;
  status: string;
  rank: string | null;
  genus: string | null;
  family: string | null;
  ancestor_names: string[];
  vernaculars: string[];
  common_name: string | null;
  is_marine: boolean | null;
  is_freshwater: boolean | null;
  is_terrestrial: boolean | null;
};

export type WormsParquetManifest = {
  version: string;
  builtAt: string;
  sourceDir: string;
  citation: string;
  taxaRows: number;
  idRows: number;
  nameRows: number;
  files: {
    taxa: string;
    ids: string;
    names: string;
  };
};

export type WormsParquetPaths = {
  dir: string;
  taxa: string;
  ids: string;
  names: string;
  manifest: string;
};

export function wormsParquetCacheDir(): string {
  return (
    process.env.WORMS_PARQUET_DIR ||
    join(tmpdir(), `worms-parquet-${WORMS_PARQUET_VERSION}`)
  );
}

export function wormsParquetIsPresent(dir: string): boolean {
  const paths = wormsParquetPaths(dir);
  return (
    fileLooksPresent(paths.taxa) &&
    fileLooksPresent(paths.ids) &&
    fileLooksPresent(paths.names)
  );
}

function fileLooksPresent(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/** Fetch the public snapshot from ssn-tiles (handler credentials; no map token). */
export async function downloadWormsParquet(outDir: string): Promise<WormsParquetPaths> {
  mkdirSync(outDir, { recursive: true });
  const paths = wormsParquetPaths(outDir);
  await getR2Object(WORMS_TAXA_R2_REMOTE, paths.taxa);
  await getR2Object(WORMS_IDS_R2_REMOTE, paths.ids);
  await getR2Object(WORMS_NAMES_R2_REMOTE, paths.names);
  try {
    await getR2Object(WORMS_MANIFEST_R2_REMOTE, paths.manifest);
  } catch {
    // Lookups only need the three parquet files.
  }
  return paths;
}

/** Public HTTP copy on tiles.seasketch.org (no map token). Used if R2 fails. */
export async function downloadWormsParquetFromHttp(
  outDir: string
): Promise<WormsParquetPaths> {
  mkdirSync(outDir, { recursive: true });
  const paths = wormsParquetPaths(outDir);
  const required: Array<[string, string]> = [
    [WORMS_TAXA_FILENAME, paths.taxa],
    [WORMS_IDS_FILENAME, paths.ids],
    [WORMS_NAMES_FILENAME, paths.names],
  ];
  for (const [filename, dest] of required) {
    const url = `${WORMS_PARQUET_PUBLIC_BASE}/${filename}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`worms parquet HTTP ${response.status} ${url}`);
    }
    writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  }
  return paths;
}

/**
 * Reuse a local/warm `/tmp` copy, else download from R2, else public HTTP.
 * Returns null when the snapshot cannot be loaded (caller uses REST).
 */
export async function ensureWormsParquet(
  outDir?: string
): Promise<WormsParquetPaths | null> {
  const dir = outDir || wormsParquetCacheDir();
  if (wormsParquetIsPresent(dir)) {
    return wormsParquetPaths(dir);
  }
  try {
    return await downloadWormsParquet(dir);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(
      `[data-tables-handler] worms parquet R2 download failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  try {
    return await downloadWormsParquetFromHttp(dir);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(
      `[data-tables-handler] worms parquet HTTP download failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

export function wormsParquetPaths(dir: string): WormsParquetPaths {
  return {
    dir,
    taxa: join(dir, WORMS_TAXA_FILENAME),
    ids: join(dir, WORMS_IDS_FILENAME),
    names: join(dir, WORMS_NAMES_FILENAME),
    manifest: join(dir, WORMS_MANIFEST_FILENAME),
  };
}

export function parseAphiaIdFromLsid(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") return null;
  const match = value.match(APHIA_LSID);
  if (!match) {
    if (/^\d+$/.test(value.trim())) {
      const n = parseInt(value.trim(), 10);
      return n > 0 ? n : null;
    }
    return null;
  }
  const n = parseInt(match[1], 10);
  return n > 0 ? n : null;
}

/** Lowercased binomial / uninomial used for local name lookup. */
export function normalizeWormsNameKey(value: string): string {
  return stripWormsAuthorship(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function stripWormsAuthorship(value: string): string {
  return value
    .replace(/\s+\([^)]*\)\s*$/g, "")
    // Families in the snapshot keep "Fitzinger, 1873"; keys are lowercased.
    .replace(/\s+[A-Za-zÀ-ÖØ-öø-ÿ][^\s,]*[,\s]+\d{3,4}\s*$/g, "")
    .trim();
}

function escapePath(path: string): string {
  return path.replace(/'/g, "''");
}

function readTsvSql(path: string): string {
  return `read_csv('${escapePath(path)}', delim='\\t', header=true, quote='', sample_size=-1, ignore_errors=true, all_varchar=true)`;
}

/**
 * Accepted-only taxon payload plus skinny id/name indexes.
 * Synonym AphiaIDs and alternate spellings resolve through ids/names.
 */
export async function buildWormsParquet(
  dwcaDir: string,
  outDir: string
): Promise<WormsParquetManifest> {
  mkdirSync(outDir, { recursive: true });
  const paths = wormsParquetPaths(outDir);
  const taxonPath = join(dwcaDir, "Taxon.tsv");
  const vernacularPath = join(dwcaDir, "VernacularName.tsv");
  const profilePath = join(dwcaDir, "SpeciesProfile.tsv");

  return withDuckDb(async (conn) => {
    await run(
      conn,
      `
      CREATE TEMP TABLE raw_taxon AS
      SELECT
        CAST(regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) AS INTEGER) AS aphia_id,
        CAST(nullif(regexp_extract(coalesce("dwc:acceptedNameUsageID", ''), 'taxname:(\\d+)', 1), '') AS INTEGER) AS accepted_from_source,
        lower(trim(coalesce("dwc:taxonomicStatus", ''))) AS status,
        nullif(trim(coalesce("dwc:taxonRank", '')), '') AS rank,
        nullif(trim(coalesce("dwc:scientificName", '')), '') AS scientific_name_raw,
        nullif(trim(coalesce("dwc:genericName", '')), '') AS generic_name,
        nullif(trim(coalesce("dwc:specificEpithet", '')), '') AS specific_epithet,
        nullif(trim(coalesce("dwc:infraspecificEpithet", '')), '') AS infra_epithet,
        nullif(trim(coalesce("dwc:kingdom", '')), '') AS kingdom,
        nullif(trim(coalesce("dwc:phylum", '')), '') AS phylum,
        nullif(trim(coalesce("dwc:class", '')), '') AS class,
        nullif(trim(coalesce("dwc:order", '')), '') AS "order",
        nullif(trim(coalesce("dwc:superfamily", '')), '') AS superfamily,
        nullif(trim(coalesce("dwc:family", '')), '') AS family,
        nullif(trim(coalesce("dwc:subfamily", '')), '') AS subfamily,
        nullif(trim(coalesce("dwc:tribe", '')), '') AS tribe,
        nullif(trim(coalesce("dwc:subtribe", '')), '') AS subtribe,
        nullif(trim(coalesce("dwc:genus", '')), '') AS genus,
        nullif(trim(coalesce("dwc:subgenus", '')), '') AS subgenus
      FROM ${readTsvSql(taxonPath)}
      WHERE regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) <> ''
      `
    );

    await run(
      conn,
      `
      CREATE TEMP TABLE taxon AS
      SELECT
        aphia_id,
        coalesce(accepted_from_source, aphia_id) AS accepted_aphia_id,
        status,
        rank,
        scientific_name_raw,
        CASE
          WHEN generic_name IS NOT NULL AND specific_epithet IS NOT NULL AND infra_epithet IS NOT NULL
            THEN generic_name || ' ' || specific_epithet || ' ' || infra_epithet
          WHEN generic_name IS NOT NULL AND specific_epithet IS NOT NULL
            THEN generic_name || ' ' || specific_epithet
          WHEN generic_name IS NOT NULL THEN generic_name
          ELSE trim(regexp_replace(coalesce(scientific_name_raw, ''), '\\s+\\([^)]*\\)\\s*$', ''))
        END AS scientific_name,
        generic_name,
        kingdom, phylum, class, "order", superfamily, family, subfamily, tribe, subtribe, genus, subgenus
      FROM raw_taxon
      WHERE aphia_id IS NOT NULL
      `
    );

    await run(
      conn,
      `
      CREATE TEMP TABLE ids AS
      SELECT aphia_id, accepted_aphia_id
      FROM taxon
      `
    );

    await run(
      conn,
      `
      CREATE TEMP TABLE vernacular_src AS
      SELECT
        CAST(regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) AS INTEGER) AS aphia_id,
        lower(trim(coalesce("dcterms:language", ''))) AS language,
        trim("dwc:vernacularName") AS vernacular
      FROM ${readTsvSql(vernacularPath)}
      WHERE regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) <> ''
        AND trim(coalesce("dwc:vernacularName", '')) <> ''
      `
    );

    await run(
      conn,
      `
      CREATE TEMP TABLE vernaculars AS
      SELECT
        coalesce(i.accepted_aphia_id, v.aphia_id) AS accepted_aphia_id,
        list(v.vernacular ORDER BY CASE WHEN v.language IN ('eng', 'en') THEN 0 ELSE 1 END, v.vernacular) AS vernaculars_raw,
        coalesce(
          (list(v.vernacular) FILTER (WHERE v.language IN ('eng', 'en')))[1],
          list(v.vernacular)[1]
        ) AS common_name
      FROM vernacular_src v
      LEFT JOIN ids i ON i.aphia_id = v.aphia_id
      GROUP BY 1
      `
    );

    await run(
      conn,
      `
      CREATE TEMP TABLE profiles AS
      SELECT
        CAST(regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) AS INTEGER) AS aphia_id,
        lower(trim(coalesce("gbif:isMarine", ''))) IN ('true', '1') AS is_marine,
        lower(trim(coalesce("gbif:isFreshwater", ''))) IN ('true', '1') AS is_freshwater,
        lower(trim(coalesce("gbif:isTerrestrial", ''))) IN ('true', '1') AS is_terrestrial
      FROM ${readTsvSql(profilePath)}
      WHERE regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) <> ''
      `
    );

    await run(
      conn,
      `
      CREATE TEMP TABLE accepted AS
      SELECT
        t.aphia_id,
        t.aphia_id AS accepted_aphia_id,
        t.scientific_name,
        t.status,
        t.rank,
        coalesce(t.genus, t.generic_name) AS genus,
        t.family,
        list_filter(
          [t.kingdom, t.phylum, t.class, t."order", t.superfamily, t.family, t.subfamily, t.tribe, t.subtribe, coalesce(t.genus, t.generic_name), t.subgenus, t.scientific_name],
          x -> x IS NOT NULL AND x <> ''
        ) AS ancestor_names,
        coalesce(list_distinct(v.vernaculars_raw), []) AS vernaculars,
        v.common_name,
        p.is_marine,
        p.is_freshwater,
        p.is_terrestrial
      FROM taxon t
      LEFT JOIN vernaculars v ON v.accepted_aphia_id = t.aphia_id
      LEFT JOIN profiles p ON p.aphia_id = t.aphia_id
      WHERE t.aphia_id = t.accepted_aphia_id
      `
    );

    await run(
      conn,
      `
      CREATE TEMP TABLE name_keys AS
      SELECT accepted_aphia_id, lower(trim(scientific_name)) AS name_key
      FROM taxon
      WHERE scientific_name IS NOT NULL AND trim(scientific_name) <> ''
      UNION
      SELECT accepted_aphia_id, lower(trim(scientific_name_raw)) AS name_key
      FROM taxon
      WHERE scientific_name_raw IS NOT NULL AND trim(scientific_name_raw) <> ''
      UNION
      SELECT accepted_aphia_id, lower(trim(regexp_replace(scientific_name_raw, '\\s+\\([^)]*\\)\\s*$', ''))) AS name_key
      FROM taxon
      WHERE scientific_name_raw IS NOT NULL AND trim(scientific_name_raw) <> ''
      UNION
      SELECT accepted_aphia_id, lower(trim(regexp_replace(
        regexp_replace(coalesce(scientific_name, scientific_name_raw), '\\s+\\([^)]*\\)\\s*$', ''),
        '\\s+[A-Za-zÀ-ÖØ-öø-ÿ][^\\s,]*[,\\s]+\\d{3,4}\\s*$',
        ''
      ))) AS name_key
      FROM taxon
      WHERE coalesce(scientific_name, scientific_name_raw) IS NOT NULL
      `
    );

    await run(
      conn,
      `
      CREATE TEMP TABLE names AS
      SELECT name_key, accepted_aphia_id
      FROM (
        SELECT
          n.name_key,
          n.accepted_aphia_id,
          row_number() OVER (
            PARTITION BY n.name_key
            ORDER BY
              CASE WHEN a.status IN ('accepted', 'provisionally accepted') THEN 0 ELSE 1 END,
              CASE WHEN a.is_marine THEN 0 ELSE 1 END,
              n.accepted_aphia_id
          ) AS rn
        FROM name_keys n
        JOIN accepted a ON a.aphia_id = n.accepted_aphia_id
        WHERE n.name_key <> ''
      )
      WHERE rn = 1
      `
    );

    await run(
      conn,
      `COPY (SELECT * FROM accepted ORDER BY aphia_id) TO '${escapePath(paths.taxa)}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 122880)`
    );
    await run(
      conn,
      `COPY (SELECT * FROM ids ORDER BY aphia_id) TO '${escapePath(paths.ids)}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 122880)`
    );
    await run(
      conn,
      `COPY (SELECT * FROM names ORDER BY name_key) TO '${escapePath(paths.names)}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 122880)`
    );

    const [counts] = await all<{
      taxa: number;
      ids: number;
      names: number;
    }>(
      conn,
      `SELECT
        (SELECT count(*) FROM accepted) AS taxa,
        (SELECT count(*) FROM ids) AS ids,
        (SELECT count(*) FROM names) AS names`
    );

    return {
      version: WORMS_PARQUET_VERSION,
      builtAt: new Date().toISOString(),
      sourceDir: basename(dwcaDir),
      citation: WORMS_CITATION,
      taxaRows: Number(counts.taxa),
      idRows: Number(counts.ids),
      nameRows: Number(counts.names),
      files: {
        taxa: `${WORMS_PARQUET_R2_PREFIX}/${WORMS_TAXA_FILENAME}`,
        ids: `${WORMS_PARQUET_R2_PREFIX}/${WORMS_IDS_FILENAME}`,
        names: `${WORMS_PARQUET_R2_PREFIX}/${WORMS_NAMES_FILENAME}`,
      },
    };
  });
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asOptionalBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function rowFromQuery(row: Record<string, unknown>): WormsTaxonRow {
  return {
    aphia_id: Number(row.aphia_id),
    accepted_aphia_id: Number(row.accepted_aphia_id),
    scientific_name: String(row.scientific_name || ""),
    status: String(row.status || ""),
    rank: asOptionalString(row.rank),
    genus: asOptionalString(row.genus),
    family: asOptionalString(row.family),
    ancestor_names: asStringList(row.ancestor_names),
    vernaculars: asStringList(row.vernaculars),
    common_name: asOptionalString(row.common_name),
    is_marine: asOptionalBool(row.is_marine),
    is_freshwater: asOptionalBool(row.is_freshwater),
    is_terrestrial: asOptionalBool(row.is_terrestrial),
  };
}

export async function lookupWormsTaxaByAphiaIds(
  conn: DuckDBConnection,
  parquetDir: string,
  aphiaIds: number[]
): Promise<Map<number, WormsTaxonRow>> {
  const ids = Array.from(new Set(aphiaIds.filter((id) => Number.isInteger(id) && id > 0)));
  const out = new Map<number, WormsTaxonRow>();
  if (ids.length === 0) return out;
  const paths = wormsParquetPaths(parquetDir);
  const rows = await all<Record<string, unknown>>(
    conn,
    `
    SELECT t.*
    FROM read_parquet('${escapePath(paths.ids)}') i
    JOIN read_parquet('${escapePath(paths.taxa)}') t ON t.aphia_id = i.accepted_aphia_id
    WHERE i.aphia_id IN (${ids.join(",")})
    `
  );
  const byAccepted = new Map<number, WormsTaxonRow>();
  for (const row of rows) {
    byAccepted.set(Number(row.aphia_id), rowFromQuery(row));
  }
  const links = await all<{ aphia_id: number; accepted_aphia_id: number }>(
    conn,
    `SELECT aphia_id, accepted_aphia_id FROM read_parquet('${escapePath(paths.ids)}') WHERE aphia_id IN (${ids.join(",")})`
  );
  for (const link of links) {
    const taxon = byAccepted.get(Number(link.accepted_aphia_id));
    if (taxon) out.set(Number(link.aphia_id), taxon);
  }
  return out;
}

export async function lookupWormsTaxaByNames(
  conn: DuckDBConnection,
  parquetDir: string,
  names: string[]
): Promise<Map<string, WormsTaxonRow>> {
  const keys = Array.from(
    new Set(
      names
        .map((name) => normalizeWormsNameKey(name))
        .filter((name) => name.length > 0)
    )
  );
  const out = new Map<string, WormsTaxonRow>();
  if (keys.length === 0) return out;
  const paths = wormsParquetPaths(parquetDir);
  const literals = keys.map((key) => `'${key.replace(/'/g, "''")}'`).join(",");
  const likeClauses = keys
    .map((key) => `n.name_key LIKE '${key.replace(/'/g, "''")} %'`)
    .join(" OR ");
  const rows = await all<Record<string, unknown> & { name_key: string }>(
    conn,
    `
    SELECT n.name_key, t.*
    FROM read_parquet('${escapePath(paths.names)}') n
    JOIN read_parquet('${escapePath(paths.taxa)}') t ON t.aphia_id = n.accepted_aphia_id
    WHERE n.name_key IN (${literals}) OR ${likeClauses}
    `
  );
  const requested = new Set(keys);
  const exact = new Map<string, WormsTaxonRow>();
  const stripped = new Map<string, WormsTaxonRow>();
  for (const row of rows) {
    const nameKey = String(row.name_key);
    const taxon = rowFromQuery(row);
    if (requested.has(nameKey)) {
      exact.set(nameKey, taxon);
    }
    const strippedKey = normalizeWormsNameKey(nameKey);
    if (requested.has(strippedKey) && !stripped.has(strippedKey)) {
      stripped.set(strippedKey, taxon);
    }
  }
  for (const key of keys) {
    const hit = exact.get(key) || stripped.get(key);
    if (hit) out.set(key, hit);
  }
  return out;
}
