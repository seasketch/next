/** Live WoRMS REST. Used only when the public parquet snapshot misses. */
export declare const WORMS_REST_URL = "https://www.marinespecies.org/rest";
export declare const ORGANISM_USER_AGENT = "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
export declare const WORMS_MATCH_NAME_BATCH = 50;
/** Polite floor between WoRMS calls. 429s already back off. */
export declare const WORMS_MIN_INTERVAL_MS = 50;
/** Taxamatch can 500/hang on lumped survey names; fail the attempt instead. */
export declare const WORMS_FETCH_TIMEOUT_MS = 20000;
export type TaxonomyFetch = (url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
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
    /** Local WoRMS snapshot dir (`taxa/ids/names.parquet`). REST on miss. */
    wormsParquetDir?: string | null;
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
/** One shared iNat id, or null when the keys disagree or all miss. */
export declare function singleMappedInatId<K>(keys: K[], byKey: Map<K, number>): number | null;
/** Strip survey life-stage tags and lumped species lists before Taxamatch. */
export declare function sanitizeWormsQueryName(name: string): string | null;
export declare function wormsQueryName(input: ResolveOrganismInput): string | null;
export declare function ancestorsFromWormsRecord(worms: Record<string, unknown>): string[];
/**
 * Resolve many values from the WoRMS parquet snapshot first, then batched
 * REST match-names (≤50) on miss. REST records already carry rank fields,
 * so we do not call AphiaClassificationByAphiaID. Vernaculars REST runs
 * only for accepted IDs still missing from the snapshot (204 = none).
 * Then Wikidata SPARQL (AphiaID/name → iNat P3151). Query the accepted
 * Aphia/name, the class-table's own keys, and superseded AphiaIDs plus
 * bare synonym binomials from the snapshot. Wikidata often still has the
 * unaccepted Aphia (P850) and P225 after WoRMS accepts a new combination.
 * iNat taxa show
 * (`/v1/taxa/{id}`, not `?q=`) keeps the single active taxon and
 * follows `current_synonymous_taxon_ids` when Wikidata still points at
 * an inactive id. Thumbs load later from the catalog id.
 */
export type TaxonomyResolveProgress = {
    phase: "worms-ids" | "worms-names" | "worms-details" | "wikidata";
    done: number;
    total: number;
};
export declare function resolveOrganismTaxa(clients: TaxonomyClients, inputs: ResolveOrganismInput[], onProgress?: (update: TaxonomyResolveProgress) => Promise<void> | void): Promise<ResolvedTaxon[]>;
export declare function resolveOrganismTaxon(clients: TaxonomyClients, input: ResolveOrganismInput): Promise<ResolvedTaxon>;
