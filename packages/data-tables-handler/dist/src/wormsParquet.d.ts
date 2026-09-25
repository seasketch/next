import { type DuckDBConnection } from "./duckDb";
/** Bump when the parquet layout or R2 prefix changes (tiles cache is immutable). */
export declare const WORMS_PARQUET_VERSION = "v1";
export declare const WORMS_PARQUET_R2_BUCKET = "ssn-tiles";
/**
 * Public fixture prefix. Avoid `taxonomy/` (JWT WoRMS proxy) and
 * `dataLibrary/` (PMTiles TileJSON).
 */
export declare const WORMS_PARQUET_R2_PREFIX = "worms/v1";
export declare const WORMS_PARQUET_PUBLIC_BASE = "https://tiles.seasketch.org/worms/v1";
export declare const WORMS_TAXA_FILENAME = "taxa.parquet";
export declare const WORMS_IDS_FILENAME = "ids.parquet";
export declare const WORMS_NAMES_FILENAME = "names.parquet";
export declare const WORMS_MANIFEST_FILENAME = "manifest.json";
export declare const WORMS_TAXA_R2_REMOTE = "r2://ssn-tiles/worms/v1/taxa.parquet";
export declare const WORMS_IDS_R2_REMOTE = "r2://ssn-tiles/worms/v1/ids.parquet";
export declare const WORMS_NAMES_R2_REMOTE = "r2://ssn-tiles/worms/v1/names.parquet";
export declare const WORMS_MANIFEST_R2_REMOTE = "r2://ssn-tiles/worms/v1/manifest.json";
export declare const WORMS_CHECKLISTBANK_URL = "https://www.checklistbank.org/dataset/2011";
export declare const WORMS_CITATION = "WoRMS Editorial Board (2026). World Register of Marine Species. ChecklistBank dataset 2011 (https://www.checklistbank.org/dataset/2011, doi:10.48580/d4fd). Available from https://www.marinespecies.org at VLIZ. doi:10.14284/170";
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
export declare function wormsParquetCacheDir(): string;
export declare function wormsParquetIsPresent(dir: string): boolean;
/** Fetch the public snapshot from ssn-tiles (handler credentials; no map token). */
export declare function downloadWormsParquet(outDir: string): Promise<WormsParquetPaths>;
/** Public HTTP copy on tiles.seasketch.org (no map token). Used if R2 fails. */
export declare function downloadWormsParquetFromHttp(outDir: string): Promise<WormsParquetPaths>;
/**
 * Reuse a local/warm `/tmp` copy, else download from R2, else public HTTP.
 * Returns null when the snapshot cannot be loaded (caller uses REST).
 */
export declare function ensureWormsParquet(outDir?: string): Promise<WormsParquetPaths | null>;
export declare function wormsParquetPaths(dir: string): WormsParquetPaths;
export declare function parseAphiaIdFromLsid(value: unknown): number | null;
/** Lowercased binomial / uninomial used for local name lookup. */
export declare function normalizeWormsNameKey(value: string): string;
export declare function stripWormsAuthorship(value: string): string;
/**
 * Accepted-only taxon payload plus skinny id/name indexes.
 * Synonym AphiaIDs and alternate spellings resolve through ids/names.
 */
export declare function buildWormsParquet(dwcaDir: string, outDir: string): Promise<WormsParquetManifest>;
export declare function lookupWormsTaxaByAphiaIds(conn: DuckDBConnection, parquetDir: string, aphiaIds: number[]): Promise<Map<number, WormsTaxonRow>>;
/**
 * Genus capitalized, epithets left lower. Authorship and other decorated
 * keys return null — Wikidata P225 is the bare binomial.
 */
export declare function binomialFromWormsNameKey(nameKey: string): string | null;
export type WormsSynonymKeys = {
    aphiaIds: number[];
    scientificNames: string[];
};
/**
 * Superseded AphiaIDs and bare synonym binomials that the snapshot folds
 * into each accepted id. Wikidata often still stores those old keys.
 */
export declare function lookupWormsSynonymKeys(conn: DuckDBConnection, parquetDir: string, acceptedAphiaIds: number[]): Promise<Map<number, WormsSynonymKeys>>;
export declare function lookupWormsTaxaByNames(conn: DuckDBConnection, parquetDir: string, names: string[]): Promise<Map<string, WormsTaxonRow>>;
