export declare const WORMS_REST_URL = "https://www.marinespecies.org/rest";
export declare const ORGANISM_USER_AGENT = "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
export declare const WORMS_MATCH_NAME_BATCH = 50;
/** Polite floor between WoRMS calls. 429s already back off. */
export declare const WORMS_MIN_INTERVAL_MS = 50;
export type TaxonomyFetch = (url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}>;
export type ResolvedTaxon = {
    scientificName: string | null;
    commonName: string | null;
    commonNames: string[];
    genus: string | null;
    family: string | null;
    ancestorNames: string[];
    inatTaxonId: number | null;
    wormsAphiaId: number | null;
    confidence: "high" | "low" | "unresolved";
};
export declare function createRateLimiter(minIntervalMs: number): () => Promise<void>;
export type TaxonomyClients = {
    fetch: TaxonomyFetch;
    waitWorms?: () => Promise<void>;
};
/**
 * Rewrite an upstream taxonomy URL through the pmtiles-server /taxonomy proxy.
 * `proxyBase` is `https://uploads.seasketch.org/taxonomy` (no trailing slash).
 */
export declare function rewriteTaxonomyUrl(url: string, proxyBase: string): string;
export declare function createTaxonomyFetch(fetchFn: typeof fetch, proxyBase?: string | null, accessToken?: string | null): TaxonomyFetch;
export declare function fetchWormsRecordByAphiaId(clients: TaxonomyClients, aphiaId: number): Promise<Record<string, unknown> | null>;
export declare function fetchWormsMatchNames(clients: TaxonomyClients, names: string[]): Promise<Array<Record<string, unknown>[]>>;
export declare function fetchWormsClassification(clients: TaxonomyClients, aphiaId: number): Promise<string[]>;
export declare function fetchWormsVernaculars(clients: TaxonomyClients, aphiaId: number): Promise<string[]>;
/** Prefer an accepted record; otherwise an unaccepted row with a valid_name. */
export declare function pickWormsAccepted(records: Record<string, unknown>[]): Record<string, unknown> | null;
export type ResolveOrganismInput = {
    value: string;
    scientificName?: string | null;
    genus?: string | null;
    species?: string | null;
    commonName?: string | null;
    wormsAphiaId?: number | null;
    extraNames?: string[];
};
export declare function wormsQueryName(input: ResolveOrganismInput): string | null;
/**
 * Resolve many values with batched WoRMS match-names (≤50) and Wikidata
 * SPARQL (AphiaID/name → iNat P3151). Does not call iNaturalist; thumbs load
 * later from the catalog id.
 */
export type TaxonomyResolveProgress = {
    phase: "worms-ids" | "worms-names" | "worms-details" | "wikidata";
    done: number;
    total: number;
};
export declare function resolveOrganismTaxa(clients: TaxonomyClients, inputs: ResolveOrganismInput[], onProgress?: (update: TaxonomyResolveProgress) => Promise<void> | void): Promise<ResolvedTaxon[]>;
export declare function resolveOrganismTaxon(clients: TaxonomyClients, input: ResolveOrganismInput): Promise<ResolvedTaxon>;
