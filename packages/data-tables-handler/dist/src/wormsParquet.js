"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORMS_CITATION = exports.WORMS_CHECKLISTBANK_URL = exports.WORMS_MANIFEST_R2_REMOTE = exports.WORMS_NAMES_R2_REMOTE = exports.WORMS_IDS_R2_REMOTE = exports.WORMS_TAXA_R2_REMOTE = exports.WORMS_MANIFEST_FILENAME = exports.WORMS_NAMES_FILENAME = exports.WORMS_IDS_FILENAME = exports.WORMS_TAXA_FILENAME = exports.WORMS_PARQUET_PUBLIC_BASE = exports.WORMS_PARQUET_R2_PREFIX = exports.WORMS_PARQUET_R2_BUCKET = exports.WORMS_PARQUET_VERSION = void 0;
exports.wormsParquetCacheDir = wormsParquetCacheDir;
exports.wormsParquetIsPresent = wormsParquetIsPresent;
exports.downloadWormsParquet = downloadWormsParquet;
exports.downloadWormsParquetFromHttp = downloadWormsParquetFromHttp;
exports.ensureWormsParquet = ensureWormsParquet;
exports.wormsParquetPaths = wormsParquetPaths;
exports.parseAphiaIdFromLsid = parseAphiaIdFromLsid;
exports.normalizeWormsNameKey = normalizeWormsNameKey;
exports.stripWormsAuthorship = stripWormsAuthorship;
exports.buildWormsParquet = buildWormsParquet;
exports.lookupWormsTaxaByAphiaIds = lookupWormsTaxaByAphiaIds;
exports.binomialFromWormsNameKey = binomialFromWormsNameKey;
exports.lookupWormsSynonymKeys = lookupWormsSynonymKeys;
exports.lookupWormsTaxaByNames = lookupWormsTaxaByNames;
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
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const duckDb_1 = require("./duckDb");
const remotes_1 = require("./remotes");
/** Bump when the parquet layout or R2 prefix changes (tiles cache is immutable). */
exports.WORMS_PARQUET_VERSION = "v1";
exports.WORMS_PARQUET_R2_BUCKET = "ssn-tiles";
/**
 * Public fixture prefix. Avoid `taxonomy/` (JWT WoRMS proxy) and
 * `dataLibrary/` (PMTiles TileJSON).
 */
exports.WORMS_PARQUET_R2_PREFIX = `worms/${exports.WORMS_PARQUET_VERSION}`;
exports.WORMS_PARQUET_PUBLIC_BASE = `https://tiles.seasketch.org/${exports.WORMS_PARQUET_R2_PREFIX}`;
exports.WORMS_TAXA_FILENAME = "taxa.parquet";
exports.WORMS_IDS_FILENAME = "ids.parquet";
exports.WORMS_NAMES_FILENAME = "names.parquet";
exports.WORMS_MANIFEST_FILENAME = "manifest.json";
exports.WORMS_TAXA_R2_REMOTE = `r2://${exports.WORMS_PARQUET_R2_BUCKET}/${exports.WORMS_PARQUET_R2_PREFIX}/${exports.WORMS_TAXA_FILENAME}`;
exports.WORMS_IDS_R2_REMOTE = `r2://${exports.WORMS_PARQUET_R2_BUCKET}/${exports.WORMS_PARQUET_R2_PREFIX}/${exports.WORMS_IDS_FILENAME}`;
exports.WORMS_NAMES_R2_REMOTE = `r2://${exports.WORMS_PARQUET_R2_BUCKET}/${exports.WORMS_PARQUET_R2_PREFIX}/${exports.WORMS_NAMES_FILENAME}`;
exports.WORMS_MANIFEST_R2_REMOTE = `r2://${exports.WORMS_PARQUET_R2_BUCKET}/${exports.WORMS_PARQUET_R2_PREFIX}/${exports.WORMS_MANIFEST_FILENAME}`;
exports.WORMS_CHECKLISTBANK_URL = "https://www.checklistbank.org/dataset/2011";
exports.WORMS_CITATION = "WoRMS Editorial Board (2026). World Register of Marine Species. ChecklistBank dataset 2011 (https://www.checklistbank.org/dataset/2011, doi:10.48580/d4fd). Available from https://www.marinespecies.org at VLIZ. doi:10.14284/170";
const APHIA_LSID = /taxname:(\d+)/;
function wormsParquetCacheDir() {
    return (process.env.WORMS_PARQUET_DIR ||
        (0, path_1.join)((0, os_1.tmpdir)(), `worms-parquet-${exports.WORMS_PARQUET_VERSION}`));
}
function wormsParquetIsPresent(dir) {
    const paths = wormsParquetPaths(dir);
    return (fileLooksPresent(paths.taxa) &&
        fileLooksPresent(paths.ids) &&
        fileLooksPresent(paths.names));
}
function fileLooksPresent(path) {
    try {
        return (0, fs_1.existsSync)(path);
    }
    catch {
        return false;
    }
}
/** Fetch the public snapshot from ssn-tiles (handler credentials; no map token). */
async function downloadWormsParquet(outDir) {
    (0, fs_1.mkdirSync)(outDir, { recursive: true });
    const paths = wormsParquetPaths(outDir);
    await (0, remotes_1.getR2Object)(exports.WORMS_TAXA_R2_REMOTE, paths.taxa);
    await (0, remotes_1.getR2Object)(exports.WORMS_IDS_R2_REMOTE, paths.ids);
    await (0, remotes_1.getR2Object)(exports.WORMS_NAMES_R2_REMOTE, paths.names);
    try {
        await (0, remotes_1.getR2Object)(exports.WORMS_MANIFEST_R2_REMOTE, paths.manifest);
    }
    catch {
        // Lookups only need the three parquet files.
    }
    return paths;
}
/** Public HTTP copy on tiles.seasketch.org (no map token). Used if R2 fails. */
async function downloadWormsParquetFromHttp(outDir) {
    (0, fs_1.mkdirSync)(outDir, { recursive: true });
    const paths = wormsParquetPaths(outDir);
    const required = [
        [exports.WORMS_TAXA_FILENAME, paths.taxa],
        [exports.WORMS_IDS_FILENAME, paths.ids],
        [exports.WORMS_NAMES_FILENAME, paths.names],
    ];
    for (const [filename, dest] of required) {
        const url = `${exports.WORMS_PARQUET_PUBLIC_BASE}/${filename}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`worms parquet HTTP ${response.status} ${url}`);
        }
        (0, fs_1.writeFileSync)(dest, Buffer.from(await response.arrayBuffer()));
    }
    return paths;
}
/**
 * Reuse a local/warm `/tmp` copy, else download from R2, else public HTTP.
 * Returns null when the snapshot cannot be loaded (caller uses REST).
 */
async function ensureWormsParquet(outDir) {
    const dir = outDir || wormsParquetCacheDir();
    if (wormsParquetIsPresent(dir)) {
        return wormsParquetPaths(dir);
    }
    try {
        return await downloadWormsParquet(dir);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.log(`[data-tables-handler] worms parquet R2 download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        return await downloadWormsParquetFromHttp(dir);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.log(`[data-tables-handler] worms parquet HTTP download failed: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
function wormsParquetPaths(dir) {
    return {
        dir,
        taxa: (0, path_1.join)(dir, exports.WORMS_TAXA_FILENAME),
        ids: (0, path_1.join)(dir, exports.WORMS_IDS_FILENAME),
        names: (0, path_1.join)(dir, exports.WORMS_NAMES_FILENAME),
        manifest: (0, path_1.join)(dir, exports.WORMS_MANIFEST_FILENAME),
    };
}
function parseAphiaIdFromLsid(value) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value !== "string")
        return null;
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
function normalizeWormsNameKey(value) {
    return stripWormsAuthorship(value).trim().toLowerCase().replace(/\s+/g, " ");
}
function stripWormsAuthorship(value) {
    return value
        .replace(/\s+\([^)]*\)\s*$/g, "")
        // Families in the snapshot keep "Fitzinger, 1873"; keys are lowercased.
        .replace(/\s+[A-Za-zÀ-ÖØ-öø-ÿ][^\s,]*[,\s]+\d{3,4}\s*$/g, "")
        .trim();
}
function escapePath(path) {
    return path.replace(/'/g, "''");
}
function readTsvSql(path) {
    return `read_csv('${escapePath(path)}', delim='\\t', header=true, quote='', sample_size=-1, ignore_errors=true, all_varchar=true)`;
}
/**
 * Accepted-only taxon payload plus skinny id/name indexes.
 * Synonym AphiaIDs and alternate spellings resolve through ids/names.
 */
async function buildWormsParquet(dwcaDir, outDir) {
    (0, fs_1.mkdirSync)(outDir, { recursive: true });
    const paths = wormsParquetPaths(outDir);
    const taxonPath = (0, path_1.join)(dwcaDir, "Taxon.tsv");
    const vernacularPath = (0, path_1.join)(dwcaDir, "VernacularName.tsv");
    const profilePath = (0, path_1.join)(dwcaDir, "SpeciesProfile.tsv");
    return (0, duckDb_1.withDuckDb)(async (conn) => {
        await (0, duckDb_1.run)(conn, `
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
      `);
        await (0, duckDb_1.run)(conn, `
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
      `);
        await (0, duckDb_1.run)(conn, `
      CREATE TEMP TABLE ids AS
      SELECT aphia_id, accepted_aphia_id
      FROM taxon
      `);
        await (0, duckDb_1.run)(conn, `
      CREATE TEMP TABLE vernacular_src AS
      SELECT
        CAST(regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) AS INTEGER) AS aphia_id,
        lower(trim(coalesce("dcterms:language", ''))) AS language,
        trim("dwc:vernacularName") AS vernacular
      FROM ${readTsvSql(vernacularPath)}
      WHERE regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) <> ''
        AND trim(coalesce("dwc:vernacularName", '')) <> ''
      `);
        await (0, duckDb_1.run)(conn, `
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
      `);
        await (0, duckDb_1.run)(conn, `
      CREATE TEMP TABLE profiles AS
      SELECT
        CAST(regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) AS INTEGER) AS aphia_id,
        lower(trim(coalesce("gbif:isMarine", ''))) IN ('true', '1') AS is_marine,
        lower(trim(coalesce("gbif:isFreshwater", ''))) IN ('true', '1') AS is_freshwater,
        lower(trim(coalesce("gbif:isTerrestrial", ''))) IN ('true', '1') AS is_terrestrial
      FROM ${readTsvSql(profilePath)}
      WHERE regexp_extract("dwc:taxonID", 'taxname:(\\d+)', 1) <> ''
      `);
        await (0, duckDb_1.run)(conn, `
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
      `);
        await (0, duckDb_1.run)(conn, `
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
      `);
        await (0, duckDb_1.run)(conn, `
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
      `);
        await (0, duckDb_1.run)(conn, `COPY (SELECT * FROM accepted ORDER BY aphia_id) TO '${escapePath(paths.taxa)}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 122880)`);
        await (0, duckDb_1.run)(conn, `COPY (SELECT * FROM ids ORDER BY aphia_id) TO '${escapePath(paths.ids)}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 122880)`);
        await (0, duckDb_1.run)(conn, `COPY (SELECT * FROM names ORDER BY name_key) TO '${escapePath(paths.names)}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 122880)`);
        const [counts] = await (0, duckDb_1.all)(conn, `SELECT
        (SELECT count(*) FROM accepted) AS taxa,
        (SELECT count(*) FROM ids) AS ids,
        (SELECT count(*) FROM names) AS names`);
        return {
            version: exports.WORMS_PARQUET_VERSION,
            builtAt: new Date().toISOString(),
            sourceDir: (0, path_1.basename)(dwcaDir),
            citation: exports.WORMS_CITATION,
            taxaRows: Number(counts.taxa),
            idRows: Number(counts.ids),
            nameRows: Number(counts.names),
            files: {
                taxa: `${exports.WORMS_PARQUET_R2_PREFIX}/${exports.WORMS_TAXA_FILENAME}`,
                ids: `${exports.WORMS_PARQUET_R2_PREFIX}/${exports.WORMS_IDS_FILENAME}`,
                names: `${exports.WORMS_PARQUET_R2_PREFIX}/${exports.WORMS_NAMES_FILENAME}`,
            },
        };
    });
}
function asStringList(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === "string" && item.length > 0);
}
function asOptionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
function asOptionalBool(value) {
    if (typeof value === "boolean")
        return value;
    return null;
}
function rowFromQuery(row) {
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
async function lookupWormsTaxaByAphiaIds(conn, parquetDir, aphiaIds) {
    const ids = Array.from(new Set(aphiaIds.filter((id) => Number.isInteger(id) && id > 0)));
    const out = new Map();
    if (ids.length === 0)
        return out;
    const paths = wormsParquetPaths(parquetDir);
    const rows = await (0, duckDb_1.all)(conn, `
    SELECT t.*
    FROM read_parquet('${escapePath(paths.ids)}') i
    JOIN read_parquet('${escapePath(paths.taxa)}') t ON t.aphia_id = i.accepted_aphia_id
    WHERE i.aphia_id IN (${ids.join(",")})
    `);
    const byAccepted = new Map();
    for (const row of rows) {
        byAccepted.set(Number(row.aphia_id), rowFromQuery(row));
    }
    const links = await (0, duckDb_1.all)(conn, `SELECT aphia_id, accepted_aphia_id FROM read_parquet('${escapePath(paths.ids)}') WHERE aphia_id IN (${ids.join(",")})`);
    for (const link of links) {
        const taxon = byAccepted.get(Number(link.accepted_aphia_id));
        if (taxon)
            out.set(Number(link.aphia_id), taxon);
    }
    return out;
}
const BARE_WORMS_NAME = /^[a-zà-öø-ÿ][a-zà-öø-ÿ-]*(?: [a-zà-öø-ÿ][a-zà-öø-ÿ-]*){0,3}$/;
/**
 * Genus capitalized, epithets left lower. Authorship and other decorated
 * keys return null — Wikidata P225 is the bare binomial.
 */
function binomialFromWormsNameKey(nameKey) {
    const key = nameKey.trim().toLowerCase().replace(/\s+/g, " ");
    if (!BARE_WORMS_NAME.test(key))
        return null;
    const [genus, ...rest] = key.split(" ");
    return [`${genus.charAt(0).toUpperCase()}${genus.slice(1)}`, ...rest].join(" ");
}
/**
 * Superseded AphiaIDs and bare synonym binomials that the snapshot folds
 * into each accepted id. Wikidata often still stores those old keys.
 */
async function lookupWormsSynonymKeys(conn, parquetDir, acceptedAphiaIds) {
    const ids = Array.from(new Set(acceptedAphiaIds.filter((id) => Number.isInteger(id) && id > 0)));
    const out = new Map();
    if (ids.length === 0)
        return out;
    const paths = wormsParquetPaths(parquetDir);
    const idList = ids.join(",");
    const aphiaRows = await (0, duckDb_1.all)(conn, `SELECT aphia_id, accepted_aphia_id
     FROM read_parquet('${escapePath(paths.ids)}')
     WHERE accepted_aphia_id IN (${idList})
       AND aphia_id <> accepted_aphia_id`);
    const nameRows = await (0, duckDb_1.all)(conn, `SELECT name_key, accepted_aphia_id
     FROM read_parquet('${escapePath(paths.names)}')
     WHERE accepted_aphia_id IN (${idList})`);
    const aphiaByAccepted = new Map();
    for (const row of aphiaRows) {
        const accepted = Number(row.accepted_aphia_id);
        const synonym = Number(row.aphia_id);
        if (!Number.isInteger(synonym) || synonym <= 0)
            continue;
        const list = aphiaByAccepted.get(accepted) || [];
        list.push(synonym);
        aphiaByAccepted.set(accepted, list);
    }
    const namesByAccepted = new Map();
    for (const row of nameRows) {
        const binomial = binomialFromWormsNameKey(String(row.name_key || ""));
        if (!binomial)
            continue;
        const accepted = Number(row.accepted_aphia_id);
        const list = namesByAccepted.get(accepted) || [];
        list.push(binomial);
        namesByAccepted.set(accepted, list);
    }
    for (const accepted of ids) {
        const aphiaIds = Array.from(new Set(aphiaByAccepted.get(accepted) || [])).sort((a, b) => a - b);
        const scientificNames = Array.from(new Set(namesByAccepted.get(accepted) || [])).sort((a, b) => a.localeCompare(b));
        if (aphiaIds.length === 0 && scientificNames.length === 0)
            continue;
        out.set(accepted, { aphiaIds, scientificNames });
    }
    return out;
}
async function lookupWormsTaxaByNames(conn, parquetDir, names) {
    const keys = Array.from(new Set(names
        .map((name) => normalizeWormsNameKey(name))
        .filter((name) => name.length > 0)));
    const out = new Map();
    if (keys.length === 0)
        return out;
    const paths = wormsParquetPaths(parquetDir);
    const literals = keys.map((key) => `'${key.replace(/'/g, "''")}'`).join(",");
    const likeClauses = keys
        .map((key) => `n.name_key LIKE '${key.replace(/'/g, "''")} %'`)
        .join(" OR ");
    const rows = await (0, duckDb_1.all)(conn, `
    SELECT n.name_key, t.*
    FROM read_parquet('${escapePath(paths.names)}') n
    JOIN read_parquet('${escapePath(paths.taxa)}') t ON t.aphia_id = n.accepted_aphia_id
    WHERE n.name_key IN (${literals}) OR ${likeClauses}
    `);
    const requested = new Set(keys);
    const exact = new Map();
    const stripped = new Map();
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
        if (hit)
            out.set(key, hit);
    }
    return out;
}
