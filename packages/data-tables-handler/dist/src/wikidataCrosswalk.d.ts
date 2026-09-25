/**
 * Batch AphiaID / scientific-name → iNaturalist taxon id via Wikidata.
 * iNat has no name-batch API; Wikidata P850 (WoRMS) + P3151 (iNat) + P225
 * (taxon name) can resolve hundreds of ids in a few SPARQL requests.
 * When one key has two P3151s, ask iNat `/v1/taxa/{id,id}` for `is_active`
 * and keep the single live taxon (Rock Scallop: 54526 over 187594).
 * A lone inactive P3151 follows `current_synonymous_taxon_ids`
 * (California Sheephead: 53699 → 1439813).
 */
export declare const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
export declare const WIKIDATA_CROSSWALK_BATCH = 50;
export declare const WIKIDATA_USER_AGENT = "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
export declare const INATURALIST_TAXA_URL = "https://api.inaturalist.org/v1/taxa";
export declare const INATURALIST_TAXA_BATCH = 30;
export type WikidataFetch = (url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}>;
export declare function escapeSparqlString(value: string): string;
export declare function buildWikidataAphiaQuery(aphiaIds: number[]): string;
export declare function buildWikidataNameQuery(names: string[]): string;
export declare function buildWikidataLabelQuery(names: string[]): string;
export declare function parseWikidataInatBindings(json: unknown): Array<{
    aphia: string | null;
    query: string | null;
    inat: number;
}>;
export declare function addInatCandidate(map: Map<string, Set<number>>, key: string, inat: number): void;
/**
 * One candidate: keep it. Several: keep the only `is_active` id.
 * Zero or two-plus live taxa: drop. Inactive singles are remapped
 * later via `current_synonymous_taxon_ids`.
 */
export declare function pickActiveInatId(ids: Iterable<number>, activity: Map<number, boolean>): number | null;
export type InatTaxonShowInfo = {
    isActive: boolean;
    synonymIds: number[];
};
export declare function parseInatTaxonShow(json: unknown): Map<number, InatTaxonShowInfo>;
export declare function parseInatTaxonActivity(json: unknown): Map<number, boolean>;
/** Prefer a live iNat id. A lone inactive P3151 follows its accepted synonym. */
export declare function followInactiveInatId(id: number, show: Map<number, InatTaxonShowInfo>): number;
export type WikidataCrosswalk = {
    byAphiaId: Map<number, number>;
    byName: Map<string, number>;
};
export declare function fetchWikidataInatCrosswalk(fetchFn: WikidataFetch, options: {
    aphiaIds: number[];
    names: string[];
    onProgress?: (done: number, total: number) => Promise<void> | void;
}): Promise<WikidataCrosswalk>;
