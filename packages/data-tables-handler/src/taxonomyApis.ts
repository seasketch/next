import {
  genusFromOrganismName,
  isLumpedOrganismValue,
  uniqueStrings,
} from "@seasketch/geostats-types";
import { withDuckDb } from "./duckDb";
import { fetchWikidataInatCrosswalk } from "./wikidataCrosswalk";
import {
  lookupWormsSynonymKeys,
  lookupWormsTaxaByAphiaIds,
  lookupWormsTaxaByNames,
  lookupWormsTaxaByVernaculars,
  normalizeVernacularKey,
  normalizeWormsNameKey,
  stripWormsAuthorship,
  vernacularLookupLabel,
  vernacularRestCandidates,
  type WormsSynonymKeys,
  type WormsTaxonRow,
  type WormsVernacularHit,
} from "./wormsParquet";

/** Live WoRMS REST. Used only when the public parquet snapshot misses. */
export const WORMS_REST_URL = "https://www.marinespecies.org/rest";
export const ORGANISM_USER_AGENT =
  "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";

export const WORMS_MATCH_NAME_BATCH = 50;
/** Polite floor between WoRMS calls. 429s already back off. */
export const WORMS_MIN_INTERVAL_MS = 50;
/** Taxamatch can 500/hang on lumped survey names; fail the attempt instead. */
export const WORMS_FETCH_TIMEOUT_MS = 20_000;

export type TaxonomyFetch = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortTaxonomyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function logTaxonomy(message: string, details?: Record<string, unknown>) {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  // eslint-disable-next-line no-console
  console.log(`[data-tables-handler] taxonomy ${message}${suffix}`);
}

export function createRateLimiter(minIntervalMs: number) {
  let nextAt = 0;
  return async function waitForSlot() {
    const now = Date.now();
    const wait = Math.max(0, nextAt - now);
    nextAt = Math.max(now, nextAt) + minIntervalMs;
    if (wait > 0) {
      await sleep(wait);
    }
  };
}

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
export function rewriteTaxonomyUrl(url: string, proxyBase: string): string {
  const base = proxyBase.replace(/\/+$/, "");
  if (url.startsWith(WORMS_REST_URL)) {
    return `${base}/worms${url.slice(WORMS_REST_URL.length)}`;
  }
  return url;
}

export function createTaxonomyFetch(
  fetchFn: typeof fetch,
  proxyBase?: string | null,
  accessToken?: string | null
): TaxonomyFetch {
  return async (url, init) => {
    const target = proxyBase ? rewriteTaxonomyUrl(url, proxyBase) : url;
    const headers: Record<string, string> = { ...(init?.headers || {}) };
    if (proxyBase && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const response = await fetchFn(target, {
      method: init?.method,
      headers,
      body: init?.body,
      signal: init?.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = parseInt(value, 10);
    return n > 0 ? n : null;
  }
  return null;
}

function flattenWormsClassification(node: unknown, names: string[] = []): string[] {
  if (!isRecord(node)) return names;
  if (typeof node.scientificname === "string") {
    names.push(node.scientificname);
  }
  if (node.child) {
    flattenWormsClassification(node.child, names);
  }
  return names;
}

async function fetchJson(
  clients: TaxonomyClients,
  provider: "worms",
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
  maxAttempts = 4
): Promise<unknown> {
  await (clients.waitWorms || (async () => undefined))();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const started = Date.now();
    const retry = attempt > 0 ? ` retry=${attempt}` : "";
    try {
      const response = await clients.fetch(url, {
        method: init?.method,
        headers: {
          Accept: "application/json",
          "User-Agent": ORGANISM_USER_AGENT,
          ...(init?.headers || {}),
        },
        body: init?.body,
        signal: AbortSignal.timeout(WORMS_FETCH_TIMEOUT_MS),
      });
      const ms = Date.now() - started;
      logTaxonomy(
        `${provider} ${response.status} ${ms}ms ${shortTaxonomyUrl(url)}${retry}`
      );
      if (response.ok) {
        // WoRMS uses 204 (empty body) for “no vernaculars”, not a redirect.
        if (response.status === 204) return null;
        try {
          return await response.json();
        } catch {
          return null;
        }
      }
      lastError = new Error(`${provider} ${response.status} for ${url}`);
      if (response.status !== 429 && response.status < 500) {
        throw lastError;
      }
    } catch (error) {
      if (error instanceof Error && lastError === error) {
        throw error;
      }
      lastError =
        error instanceof Error ? error : new Error(String(error));
      const ms = Date.now() - started;
      logTaxonomy(
        `${provider} ${lastError.message} ${ms}ms ${shortTaxonomyUrl(url)}${retry}`
      );
    }
    if (attempt >= maxAttempts - 1) break;
    const backoff = 1000 * 2 ** attempt;
    logTaxonomy(
      `${provider} backing off ${backoff}ms after ${lastError?.message || "error"}`
    );
    await sleep(backoff);
  }
  throw lastError || new Error(`${provider} failed for ${url}`);
}

export async function fetchWormsRecordByAphiaId(
  clients: TaxonomyClients,
  aphiaId: number
): Promise<Record<string, unknown> | null> {
  const json = await fetchJson(
    clients,
    "worms",
    `${WORMS_REST_URL}/AphiaRecordByAphiaID/${aphiaId}`
  );
  return isRecord(json) ? json : null;
}

async function fetchWormsMatchNameBatch(
  clients: TaxonomyClients,
  batch: string[]
): Promise<Array<Record<string, unknown>[]>> {
  const params = new URLSearchParams();
  for (const name of batch) {
    params.append("scientificnames[]", name);
  }
  const json = await fetchJson(
    clients,
    "worms",
    `${WORMS_REST_URL}/AphiaRecordsByMatchNames?${params.toString()}`,
    undefined,
    batch.length > 1 ? 1 : 4
  );
  const groups = Array.isArray(json) ? json : batch.map(() => []);
  return batch.map((_, g) => {
    const group = groups[g];
    return Array.isArray(group) ? group.filter(isRecord) : [];
  });
}

export async function fetchWormsMatchNames(
  clients: TaxonomyClients,
  names: string[]
): Promise<Array<Record<string, unknown>[]>> {
  if (names.length === 0) return [];
  const out: Array<Record<string, unknown>[]> = [];
  for (let i = 0; i < names.length; i += WORMS_MATCH_NAME_BATCH) {
    const batch = names.slice(i, i + WORMS_MATCH_NAME_BATCH);
    try {
      out.push(...(await fetchWormsMatchNameBatch(clients, batch)));
    } catch (error) {
      if (batch.length === 1) {
        logTaxonomy("worms match-names name failed", {
          name: batch[0],
          error: error instanceof Error ? error.message : String(error),
        });
        out.push([]);
        continue;
      }
      logTaxonomy("worms match-names batch failed; retrying names", {
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
      for (const name of batch) {
        try {
          out.push(...(await fetchWormsMatchNameBatch(clients, [name])));
        } catch (nameError) {
          logTaxonomy("worms match-names name failed", {
            name,
            error:
              nameError instanceof Error ? nameError.message : String(nameError),
          });
          out.push([]);
        }
      }
    }
  }
  return out;
}

export async function fetchWormsClassification(
  clients: TaxonomyClients,
  aphiaId: number
): Promise<string[]> {
  const json = await fetchJson(
    clients,
    "worms",
    `${WORMS_REST_URL}/AphiaClassificationByAphiaID/${aphiaId}`
  );
  return uniqueStrings(flattenWormsClassification(json));
}

export type CommonNameVernacularQuery = {
  label: string;
  key: string;
  restLabels: string[];
};

/**
 * Common-name lookup used only when there is no AphiaID and no scientific
 * name. Returns null so a class table binomial keeps the scientific path.
 */
export function commonNameVernacularQuery(
  input: ResolveOrganismInput,
  scientificQuery: string | null
): CommonNameVernacularQuery | null {
  if (input.wormsAphiaId || scientificQuery) return null;
  const common = input.commonName?.trim();
  if (!common) return null;
  const label = vernacularLookupLabel(common);
  const key = label ? normalizeVernacularKey(label) : null;
  if (!label || !key) return null;
  return { label, key, restLabels: vernacularRestCandidates(label) };
}

function acceptedAphiaFromRecord(record: Record<string, unknown>): number | null {
  return asInt(record.valid_AphiaID) || asInt(record.AphiaID);
}

/** Exact vernacular records. like=false so "Sheephead" does not match "sheephead grunt". */
export async function fetchWormsRecordsByVernacular(
  clients: TaxonomyClients,
  name: string
): Promise<Record<string, unknown>[]> {
  const encoded = encodeURIComponent(name);
  const url = `${WORMS_REST_URL}/AphiaRecordsByVernacular/${encoded}?like=false&offset=1`;
  try {
    const json = await fetchJson(clients, "worms", url);
    if (!Array.isArray(json)) return [];
    return json.filter(isRecord);
  } catch (error) {
    logTaxonomy("worms vernacular name failed", {
      name,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Snapshot misses only. Unions every spelling candidate, then keeps a species
 * when those records share one accepted AphiaID.
 */
async function resolveCommonNamesByVernacularRest(
  clients: TaxonomyClients,
  results: ResolvedTaxon[],
  vernacularByIndex: Array<CommonNameVernacularQuery | null>,
  ambiguousVernacular: Set<number>
): Promise<void> {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < vernacularByIndex.length; i++) {
    const query = vernacularByIndex[i];
    if (!query || ambiguousVernacular.has(i) || results[i].wormsAphiaId) continue;
    for (const label of query.restLabels) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(label);
    }
  }
  if (labels.length === 0) return;

  const recordsByLabel = new Map<string, Record<string, unknown>[]>();
  for (const label of labels) {
    recordsByLabel.set(
      label.toLowerCase(),
      await fetchWormsRecordsByVernacular(clients, label)
    );
  }

  for (let i = 0; i < vernacularByIndex.length; i++) {
    const query = vernacularByIndex[i];
    if (!query || ambiguousVernacular.has(i) || results[i].wormsAphiaId) continue;
    const records: Record<string, unknown>[] = [];
    for (const label of query.restLabels) {
      records.push(...(recordsByLabel.get(label.toLowerCase()) || []));
    }
    const ids: number[] = [];
    for (const record of records) {
      const id = acceptedAphiaFromRecord(record);
      if (id && !ids.includes(id)) ids.push(id);
    }
    if (ids.length > 1) {
      ambiguousVernacular.add(i);
      continue;
    }
    if (ids.length !== 1) continue;
    const matching = records.filter(
      (record) => acceptedAphiaFromRecord(record) === ids[0]
    );
    const picked = pickWormsAccepted(matching);
    if (picked) applyWormsRecord(results[i], picked);
  }
}

export async function fetchWormsVernaculars(
  clients: TaxonomyClients,
  aphiaId: number
): Promise<string[]> {
  const json = await fetchJson(
    clients,
    "worms",
    `${WORMS_REST_URL}/AphiaVernacularsByAphiaID/${aphiaId}`
  );
  if (!Array.isArray(json)) return [];
  return uniqueStrings(
    json.map((row) => (isRecord(row) ? String(row.vernacular || "") : ""))
  );
}

/** Prefer an accepted record; otherwise an unaccepted row with a valid_name. */
export function pickWormsAccepted(
  records: Record<string, unknown>[]
): Record<string, unknown> | null {
  if (records.length === 0) return null;
  const accepted = records.find((row) => row.status === "accepted");
  if (accepted) return accepted;
  const unaccepted = records.find(
    (row) =>
      (typeof row.valid_name === "string" && row.valid_name) ||
      asInt(row.valid_AphiaID)
  );
  return unaccepted || records[0];
}

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
export function singleMappedInatId<K>(
  keys: K[],
  byKey: Map<K, number>
): number | null {
  let found: number | null = null;
  for (const key of keys) {
    const id = byKey.get(key);
    if (!id) continue;
    if (found !== null && found !== id) return null;
    found = id;
  }
  return found;
}

function stubFromInput(input: ResolveOrganismInput): ResolvedTaxon {
  // A common-name value is not a binomial. Don't invent a genus from "Kelp Bass".
  const genusSource =
    input.scientificName || (input.commonName ? null : input.value);
  return {
    scientificName: input.scientificName || null,
    commonName: input.commonName || null,
    commonNames: uniqueStrings([input.commonName, ...(input.extraNames || [])]),
    genus: input.genus || genusFromOrganismName(genusSource),
    family: null,
    ancestorNames: [],
    inatTaxonId: null,
    wormsAphiaId: input.wormsAphiaId || null,
    confidence: "unresolved",
  };
}

const WORMS_LIFE_STAGE_SUFFIX =
  /\s+(eggs?|yoy|young[-\s]of[-\s]year|larvae|larva|juveniles?|adults?|recruits?)$/i;

/** Strip survey life-stage tags and lumped species lists before Taxamatch. */
export function sanitizeWormsQueryName(name: string): string | null {
  let cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  cleaned = cleaned.replace(WORMS_LIFE_STAGE_SUFFIX, "").trim();
  if (/[,/]/.test(cleaned)) {
    return genusFromOrganismName(cleaned);
  }
  cleaned = stripWormsAuthorship(cleaned).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

/**
 * Scientific name for Taxamatch and names.parquet.
 * Common names are not sent here. A slash-separated common name such as
 * "Olive/Yellowtail Rockfish" must not be collapsed to a genus query.
 */
export function wormsQueryName(input: ResolveOrganismInput): string | null {
  const raw =
    input.scientificName ||
    (input.genus && input.species ? `${input.genus} ${input.species}` : null) ||
    (isLumpedOrganismValue(input.value)
      ? genusFromOrganismName(input.value)
      : null);
  return raw ? sanitizeWormsQueryName(raw) : null;
}

const WORMS_RECORD_RANKS = [
  "kingdom",
  "phylum",
  "class",
  "order",
  "family",
  "genus",
] as const;

export function ancestorsFromWormsRecord(
  worms: Record<string, unknown>
): string[] {
  const names: string[] = [];
  for (const field of WORMS_RECORD_RANKS) {
    const value = worms[field];
    if (typeof value === "string" && value.trim()) names.push(value.trim());
  }
  if (typeof worms.scientificname === "string" && worms.scientificname.trim()) {
    names.push(worms.scientificname.trim());
  }
  return uniqueStrings(names);
}

function applyWormsRecord(
  target: ResolvedTaxon,
  worms: Record<string, unknown>
): void {
  const acceptedId = asInt(worms.valid_AphiaID) || asInt(worms.AphiaID);
  const acceptedName =
    (typeof worms.valid_name === "string" && worms.valid_name) ||
    (typeof worms.scientificname === "string" && worms.scientificname) ||
    null;
  target.wormsAphiaId = acceptedId;
  target.scientificName = acceptedName || target.scientificName;
  if (typeof worms.genus === "string") target.genus = worms.genus;
  if (typeof worms.family === "string") target.family = worms.family;
  target.ancestorNames = uniqueStrings([
    ...target.ancestorNames,
    ...ancestorsFromWormsRecord(worms),
  ]);
}

function applyWormsTaxonRow(target: ResolvedTaxon, taxon: WormsTaxonRow): void {
  target.wormsAphiaId = taxon.accepted_aphia_id || taxon.aphia_id;
  if (taxon.scientific_name) {
    target.scientificName =
      stripWormsAuthorship(taxon.scientific_name) || taxon.scientific_name;
  }
  if (taxon.genus) target.genus = taxon.genus;
  if (taxon.family) target.family = taxon.family;
  target.ancestorNames = uniqueStrings([
    ...target.ancestorNames,
    ...taxon.ancestor_names,
  ]);
  target.commonNames = uniqueStrings([
    ...target.commonNames,
    ...taxon.vernaculars,
  ]);
  if (!target.commonName && taxon.common_name) {
    target.commonName = taxon.common_name;
  }
  if (target.scientificName) {
    target.confidence = "high";
  }
}

/**
 * Resolve many values from the WoRMS parquet snapshot first, then batched
 * REST match-names (≤50) on miss. Common names with no scientific name are
 * matched against snapshot vernaculars (hyphens and diacritics folded). A
 * name that hits two accepted species stays unresolved: no scientific name,
 * no AphiaID, and no iNaturalist id. REST AphiaRecordsByVernacular uses
 * like=false and is only the miss fallback. REST records already carry rank
 * fields, so we do not call AphiaClassificationByAphiaID. Vernaculars REST
 * runs only for accepted IDs still missing from the snapshot (204 = none).
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

export async function resolveOrganismTaxa(
  clients: TaxonomyClients,
  inputs: ResolveOrganismInput[],
  onProgress?: (update: TaxonomyResolveProgress) => Promise<void> | void
): Promise<ResolvedTaxon[]> {
  const results = inputs.map(stubFromInput);
  const report = async (update: TaxonomyResolveProgress) => {
    logTaxonomy(`${update.phase} ${update.done}/${update.total}`);
    if (!onProgress) return;
    const every = update.phase === "wikidata" ? 1 : 5;
    const isLast = update.done >= update.total;
    if (isLast || update.done === 1 || update.done % every === 0) {
      await onProgress(update);
    }
  };
  const wormsNameByIndex: Array<string | null> = inputs.map((input, i) =>
    results[i].wormsAphiaId ? null : wormsQueryName(input)
  );
  const vernacularByIndex = inputs.map((input, i) =>
    commonNameVernacularQuery(input, wormsNameByIndex[i])
  );
  const ambiguousVernacular = new Set<number>();

  const uniqueAphiaIds: number[] = [];
  const seenAphia = new Set<number>();
  for (const row of results) {
    if (row.wormsAphiaId && !seenAphia.has(row.wormsAphiaId)) {
      seenAphia.add(row.wormsAphiaId);
      uniqueAphiaIds.push(row.wormsAphiaId);
    }
  }

  const uniqueMatchNames: string[] = [];
  const seenNames = new Set<string>();
  for (const name of wormsNameByIndex) {
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    uniqueMatchNames.push(name);
  }

  const parquetFilledIds = new Set<number>();
  let restAphiaIds = uniqueAphiaIds.slice();
  let restMatchNames = uniqueMatchNames.slice();
  let vernacularHits = new Map<string, WormsVernacularHit>();

  if (clients.wormsParquetDir) {
    try {
      const parquet = await withDuckDb(async (conn) => {
        const byId = await lookupWormsTaxaByAphiaIds(
          conn,
          clients.wormsParquetDir as string,
          uniqueAphiaIds
        );
        const byName = await lookupWormsTaxaByNames(
          conn,
          clients.wormsParquetDir as string,
          uniqueMatchNames
        );
        const vernacularKeys = vernacularByIndex
          .map((query) => query?.key)
          .filter((key): key is string => Boolean(key));
        let byVernacular = new Map<string, WormsVernacularHit>();
        try {
          byVernacular = await lookupWormsTaxaByVernaculars(
            conn,
            clients.wormsParquetDir as string,
            vernacularKeys
          );
        } catch (error) {
          logTaxonomy("parquet vernacular lookup failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return { byId, byName, byVernacular };
      });
      vernacularHits = parquet.byVernacular;
      for (let i = 0; i < results.length; i++) {
        const id = results[i].wormsAphiaId;
        const fromId = id ? parquet.byId.get(id) : undefined;
        if (fromId) {
          applyWormsTaxonRow(results[i], fromId);
          const filledId = results[i].wormsAphiaId;
          if (filledId) parquetFilledIds.add(filledId);
          continue;
        }
        const name = wormsNameByIndex[i];
        const fromName = name
          ? parquet.byName.get(normalizeWormsNameKey(name))
          : undefined;
        if (fromName) {
          applyWormsTaxonRow(results[i], fromName);
          const filledId = results[i].wormsAphiaId;
          if (filledId) parquetFilledIds.add(filledId);
        }
      }
      let vernacularUnique = 0;
      for (let i = 0; i < results.length; i++) {
        const query = vernacularByIndex[i];
        if (!query || results[i].wormsAphiaId) continue;
        const hit = vernacularHits.get(query.key);
        if (!hit) continue;
        if (hit.kind === "ambiguous") {
          ambiguousVernacular.add(i);
          continue;
        }
        applyWormsTaxonRow(results[i], hit.taxon);
        const filledId = results[i].wormsAphiaId;
        if (filledId) parquetFilledIds.add(filledId);
        vernacularUnique += 1;
      }
      restAphiaIds = uniqueAphiaIds.filter((id) => !parquet.byId.has(id));
      restMatchNames = uniqueMatchNames.filter(
        (name) => !parquet.byName.has(normalizeWormsNameKey(name))
      );
      logTaxonomy("parquet", {
        hitsById: parquet.byId.size,
        hitsByName: parquet.byName.size,
        vernacularUnique,
        vernacularAmbiguous: ambiguousVernacular.size,
        missIds: restAphiaIds.length,
        missNames: restMatchNames.length,
      });
    } catch (error) {
      logTaxonomy("parquet lookup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logTaxonomy("plan", {
    inputs: inputs.length,
    uniqueAphiaIds: uniqueAphiaIds.length,
    uniqueScientificNames: uniqueMatchNames.length,
    restAphiaIds: restAphiaIds.length,
    restScientificNames: restMatchNames.length,
    wormsEtaSec: Math.round(
      (restAphiaIds.length +
        Math.ceil(restMatchNames.length / WORMS_MATCH_NAME_BATCH)) *
        (WORMS_MIN_INTERVAL_MS / 1000)
    ),
  });

  const wormsById = new Map<number, Record<string, unknown>>();
  if (restAphiaIds.length === 0) {
    await report({ phase: "worms-ids", done: 1, total: 1 });
  }
  for (let i = 0; i < restAphiaIds.length; i++) {
    const id = restAphiaIds[i];
    try {
      const record = await fetchWormsRecordByAphiaId(clients, id);
      if (record) wormsById.set(id, record);
    } catch (error) {
      logTaxonomy(`worms id ${id} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await report({
      phase: "worms-ids",
      done: i + 1,
      total: restAphiaIds.length,
    });
  }

  const wormsByName = new Map<string, Record<string, unknown>>();
  try {
    const groups: Array<Record<string, unknown>[]> = [];
    for (let i = 0; i < restMatchNames.length; i += WORMS_MATCH_NAME_BATCH) {
      const batch = restMatchNames.slice(i, i + WORMS_MATCH_NAME_BATCH);
      await report({
        phase: "worms-names",
        done: Math.min(i + 1, restMatchNames.length),
        total: Math.max(restMatchNames.length, 1),
      });
      const batchGroups = await fetchWormsMatchNames(clients, batch);
      groups.push(...batchGroups);
      await report({
        phase: "worms-names",
        done: Math.min(i + batch.length, restMatchNames.length),
        total: Math.max(restMatchNames.length, 1),
      });
    }
    if (restMatchNames.length === 0) {
      await report({ phase: "worms-names", done: 1, total: 1 });
    }
    for (let i = 0; i < restMatchNames.length; i++) {
      const picked = pickWormsAccepted(groups[i] || []);
      if (picked) wormsByName.set(restMatchNames[i].toLowerCase(), picked);
    }
  } catch (error) {
    logTaxonomy("worms match-names failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  for (let i = 0; i < results.length; i++) {
    const alreadyFilled = results[i].wormsAphiaId;
    if (alreadyFilled && parquetFilledIds.has(alreadyFilled)) {
      continue;
    }
    const byId = results[i].wormsAphiaId
      ? wormsById.get(results[i].wormsAphiaId!)
      : undefined;
    const name = wormsNameByIndex[i];
    const byName = name ? wormsByName.get(name.toLowerCase()) : undefined;
    const worms = byId || byName;
    if (worms) applyWormsRecord(results[i], worms);
  }

  await resolveCommonNamesByVernacularRest(
    clients,
    results,
    vernacularByIndex,
    ambiguousVernacular
  );

  const acceptedIds: number[] = [];
  const seenAccepted = new Set<number>();
  for (const row of results) {
    if (row.wormsAphiaId && !seenAccepted.has(row.wormsAphiaId)) {
      seenAccepted.add(row.wormsAphiaId);
      acceptedIds.push(row.wormsAphiaId);
    }
  }

  // Taxamatch / synonym REST can land on an AphiaID the snapshot already has.
  if (clients.wormsParquetDir) {
    const pending = acceptedIds.filter((id) => !parquetFilledIds.has(id));
    if (pending.length > 0) {
      try {
        const byId = await withDuckDb(async (conn) =>
          lookupWormsTaxaByAphiaIds(
            conn,
            clients.wormsParquetDir as string,
            pending
          )
        );
        for (const row of results) {
          if (!row.wormsAphiaId || parquetFilledIds.has(row.wormsAphiaId)) {
            continue;
          }
          const taxon = byId.get(row.wormsAphiaId);
          if (!taxon) continue;
          applyWormsTaxonRow(row, taxon);
          parquetFilledIds.add(row.wormsAphiaId);
        }
      } catch (error) {
        logTaxonomy("parquet refill failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const restDetailIds = acceptedIds.filter((id) => !parquetFilledIds.has(id));

  const vernacularsById = new Map<number, string[]>();
  logTaxonomy("worms details plan", {
    acceptedAphiaIds: acceptedIds.length,
    restDetailIds: restDetailIds.length,
    wormsDetailsEtaSec: Math.round(
      restDetailIds.length * (WORMS_MIN_INTERVAL_MS / 1000)
    ),
  });
  for (let i = 0; i < restDetailIds.length; i++) {
    const id = restDetailIds[i];
    try {
      vernacularsById.set(id, await fetchWormsVernaculars(clients, id));
    } catch (error) {
      logTaxonomy(`worms vernaculars ${id} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      vernacularsById.set(id, []);
    }
    await report({
      phase: "worms-details",
      done: i + 1,
      total: Math.max(restDetailIds.length, 1),
    });
  }
  if (restDetailIds.length === 0) {
    await report({ phase: "worms-details", done: 1, total: 1 });
  }

  for (const row of results) {
    if (!row.wormsAphiaId) continue;
    row.commonNames = uniqueStrings([
      ...row.commonNames,
      ...(vernacularsById.get(row.wormsAphiaId) || []),
    ]);
    if (row.scientificName) {
      row.confidence = "high";
    }
  }

  let synonymsByAccepted = new Map<number, WormsSynonymKeys>();
  if (clients.wormsParquetDir && acceptedIds.length > 0) {
    try {
      synonymsByAccepted = await withDuckDb((conn) =>
        lookupWormsSynonymKeys(
          conn,
          clients.wormsParquetDir as string,
          acceptedIds
        )
      );
    } catch (error) {
      logTaxonomy("parquet synonyms failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const wikiAphiaIds: number[] = [];
  const seenWikiAphia = new Set<number>();
  const addWikiAphia = (id: number | null | undefined) => {
    if (!id || id <= 0 || seenWikiAphia.has(id)) return;
    seenWikiAphia.add(id);
    wikiAphiaIds.push(id);
  };
  for (const row of results) {
    addWikiAphia(row.wormsAphiaId);
    const synonyms = row.wormsAphiaId
      ? synonymsByAccepted.get(row.wormsAphiaId)
      : undefined;
    for (const id of synonyms?.aphiaIds || []) addWikiAphia(id);
  }
  for (const input of inputs) addWikiAphia(input.wormsAphiaId);

  const wikiNames: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (ambiguousVernacular.has(i)) continue;
    const row = results[i];
    const input = inputs[i];
    const synonyms = row.wormsAphiaId
      ? synonymsByAccepted.get(row.wormsAphiaId)
      : undefined;
    for (const name of [
      row.scientificName,
      input.scientificName,
      input.commonName,
      row.commonName,
      ...(input.extraNames || []),
      ...row.commonNames,
      ...(synonyms?.scientificNames || []),
    ]) {
      if (name) wikiNames.push(name);
    }
  }

  logTaxonomy("wikidata plan", {
    aphiaIds: wikiAphiaIds.length,
    names: wikiNames.length,
  });

  let wikiByAphia = new Map<number, number>();
  let wikiByName = new Map<string, number>();
  try {
    const crosswalk = await fetchWikidataInatCrosswalk(clients.fetch, {
      aphiaIds: wikiAphiaIds,
      names: wikiNames,
      onProgress: async (done, total) => {
        await report({ phase: "wikidata", done, total });
      },
    });
    wikiByAphia = crosswalk.byAphiaId;
    wikiByName = crosswalk.byName;
  } catch (error) {
    logTaxonomy("wikidata crosswalk failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    await report({ phase: "wikidata", done: 1, total: 1 });
  }

  logTaxonomy("wikidata hits", {
    aphia: wikiByAphia.size,
    names: wikiByName.size,
  });

  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    let inatId: number | null = null;
    let confidence: "high" | "low" = "low";
    const inputAphia = inputs[i].wormsAphiaId;
    const scientific = row.scientificName || inputs[i].scientificName;
    const synonyms = row.wormsAphiaId
      ? synonymsByAccepted.get(row.wormsAphiaId)
      : undefined;
    if (row.wormsAphiaId && wikiByAphia.has(row.wormsAphiaId)) {
      inatId = wikiByAphia.get(row.wormsAphiaId)!;
      confidence = "high";
    }
    if (inatId === null) {
      const fromSynonymAphia = singleMappedInatId(
        synonyms?.aphiaIds || [],
        wikiByAphia
      );
      if (fromSynonymAphia) {
        inatId = fromSynonymAphia;
        confidence = "high";
      }
    }
    if (inatId === null && inputAphia && wikiByAphia.has(inputAphia)) {
      inatId = wikiByAphia.get(inputAphia)!;
      confidence = "high";
    }
    if (
      inatId === null &&
      scientific &&
      wikiByName.has(scientific.toLowerCase())
    ) {
      inatId = wikiByName.get(scientific.toLowerCase())!;
      confidence = "high";
    }
    if (inatId === null) {
      const fromSynonymName = singleMappedInatId(
        (synonyms?.scientificNames || []).map((name) => name.toLowerCase()),
        wikiByName
      );
      if (fromSynonymName) {
        inatId = fromSynonymName;
        confidence = "high";
      }
    }
    if (inatId === null && !ambiguousVernacular.has(i)) {
      const common = inputs[i].commonName;
      if (common && wikiByName.has(common.toLowerCase())) {
        inatId = wikiByName.get(common.toLowerCase())!;
        confidence = row.wormsAphiaId || scientific ? "high" : "low";
      }
    }
    if (inatId) {
      row.inatTaxonId = inatId;
      row.confidence = row.wormsAphiaId ? "high" : confidence;
    } else if (row.wormsAphiaId) {
      row.confidence = "high";
    }
  }

  return results;
}

export async function resolveOrganismTaxon(
  clients: TaxonomyClients,
  input: ResolveOrganismInput
): Promise<ResolvedTaxon> {
  const [row] = await resolveOrganismTaxa(clients, [input]);
  return row;
}
