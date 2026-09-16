/**
 * Batch AphiaID / scientific-name → iNaturalist taxon id via Wikidata.
 * iNat has no name-batch API; Wikidata P850 (WoRMS) + P3151 (iNat) + P225
 * (taxon name) can resolve hundreds of ids in a few SPARQL requests.
 */
export declare const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
export declare const WIKIDATA_CROSSWALK_BATCH = 50;
export declare const WIKIDATA_USER_AGENT = "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
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
/** Keep a key only when every hit agrees on the same iNat id. */
export declare function assignUniqueInatId(map: Map<string, number>, key: string, inat: number): void;
export type WikidataCrosswalk = {
    byAphiaId: Map<number, number>;
    byName: Map<string, number>;
};
export declare function fetchWikidataInatCrosswalk(fetchFn: WikidataFetch, options: {
    aphiaIds: number[];
    names: string[];
    onProgress?: (done: number, total: number) => Promise<void> | void;
}): Promise<WikidataCrosswalk>;
