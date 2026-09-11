import {
  genusFromOrganismName,
  isLumpedOrganismValue,
  uniqueStrings,
} from "@seasketch/geostats-types";
import { fetchWikidataInatCrosswalk } from "./wikidataCrosswalk";

export const WORMS_REST_URL = "https://www.marinespecies.org/rest";
export const ORGANISM_USER_AGENT =
  "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";

export const WORMS_MATCH_NAME_BATCH = 50;
export const WORMS_MIN_INTERVAL_MS = 200;

export type TaxonomyFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
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
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<unknown> {
  await (clients.waitWorms || (async () => undefined))();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const started = Date.now();
    const response = await clients.fetch(url, {
      method: init?.method,
      headers: {
        Accept: "application/json",
        "User-Agent": ORGANISM_USER_AGENT,
        ...(init?.headers || {}),
      },
      body: init?.body,
    });
    const ms = Date.now() - started;
    const retry = attempt > 0 ? ` retry=${attempt}` : "";
    logTaxonomy(
      `${provider} ${response.status} ${ms}ms ${shortTaxonomyUrl(url)}${retry}`
    );
    if (response.ok) {
      return response.json();
    }
    lastError = new Error(`${provider} ${response.status} for ${url}`);
    if (response.status !== 429 && response.status < 500) {
      throw lastError;
    }
    const backoff = 1000 * 2 ** attempt;
    logTaxonomy(`${provider} backing off ${backoff}ms after ${response.status}`);
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

export async function fetchWormsMatchNames(
  clients: TaxonomyClients,
  names: string[]
): Promise<Array<Record<string, unknown>[]>> {
  if (names.length === 0) return [];
  const out: Array<Record<string, unknown>[]> = [];
  for (let i = 0; i < names.length; i += WORMS_MATCH_NAME_BATCH) {
    const batch = names.slice(i, i + WORMS_MATCH_NAME_BATCH);
    const params = new URLSearchParams();
    for (const name of batch) {
      params.append("scientificnames[]", name);
    }
    const json = await fetchJson(
      clients,
      "worms",
      `${WORMS_REST_URL}/AphiaRecordsByMatchNames`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );
    const groups = Array.isArray(json) ? json : batch.map(() => []);
    for (let g = 0; g < batch.length; g++) {
      const group = groups[g];
      out.push(Array.isArray(group) ? group.filter(isRecord) : []);
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

function stubFromInput(input: ResolveOrganismInput): ResolvedTaxon {
  return {
    scientificName: input.scientificName || null,
    commonName: input.commonName || null,
    commonNames: uniqueStrings([input.commonName, ...(input.extraNames || [])]),
    genus: input.genus || genusFromOrganismName(input.scientificName || input.value),
    family: null,
    ancestorNames: [],
    inatTaxonId: null,
    wormsAphiaId: input.wormsAphiaId || null,
    confidence: "unresolved",
  };
}

export function wormsQueryName(input: ResolveOrganismInput): string | null {
  if (input.scientificName) return input.scientificName;
  if (input.genus && input.species) return `${input.genus} ${input.species}`;
  if (isLumpedOrganismValue(input.value)) {
    return genusFromOrganismName(input.value);
  }
  return null;
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
}

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

  logTaxonomy("plan", {
    inputs: inputs.length,
    uniqueAphiaIds: uniqueAphiaIds.length,
    uniqueScientificNames: uniqueMatchNames.length,
    wormsEtaSec: Math.round(
      uniqueAphiaIds.length * 0.2 +
        Math.ceil(uniqueMatchNames.length / WORMS_MATCH_NAME_BATCH) * 0.2
    ),
  });

  const wormsById = new Map<number, Record<string, unknown>>();
  for (let i = 0; i < uniqueAphiaIds.length; i++) {
    const id = uniqueAphiaIds[i];
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
      total: uniqueAphiaIds.length,
    });
  }

  const wormsByName = new Map<string, Record<string, unknown>>();
  try {
    const groups: Array<Record<string, unknown>[]> = [];
    for (let i = 0; i < uniqueMatchNames.length; i += WORMS_MATCH_NAME_BATCH) {
      const batch = uniqueMatchNames.slice(i, i + WORMS_MATCH_NAME_BATCH);
      const batchGroups = await fetchWormsMatchNames(clients, batch);
      groups.push(...batchGroups);
      await report({
        phase: "worms-names",
        done: Math.min(i + batch.length, uniqueMatchNames.length),
        total: Math.max(uniqueMatchNames.length, 1),
      });
    }
    if (uniqueMatchNames.length === 0) {
      await report({ phase: "worms-names", done: 1, total: 1 });
    }
    for (let i = 0; i < uniqueMatchNames.length; i++) {
      const picked = pickWormsAccepted(groups[i] || []);
      if (picked) wormsByName.set(uniqueMatchNames[i].toLowerCase(), picked);
    }
  } catch (error) {
    logTaxonomy("worms match-names failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  for (let i = 0; i < results.length; i++) {
    const byId = results[i].wormsAphiaId
      ? wormsById.get(results[i].wormsAphiaId!)
      : undefined;
    const name = wormsNameByIndex[i];
    const byName = name ? wormsByName.get(name.toLowerCase()) : undefined;
    const worms = byId || byName;
    if (worms) applyWormsRecord(results[i], worms);
  }

  const acceptedIds: number[] = [];
  const seenAccepted = new Set<number>();
  for (const row of results) {
    if (row.wormsAphiaId && !seenAccepted.has(row.wormsAphiaId)) {
      seenAccepted.add(row.wormsAphiaId);
      acceptedIds.push(row.wormsAphiaId);
    }
  }

  const classificationById = new Map<number, string[]>();
  const vernacularsById = new Map<number, string[]>();
  logTaxonomy("worms details plan", {
    acceptedAphiaIds: acceptedIds.length,
    wormsDetailsEtaSec: Math.round(acceptedIds.length * 2 * 0.2),
  });
  for (let i = 0; i < acceptedIds.length; i++) {
    const id = acceptedIds[i];
    try {
      classificationById.set(id, await fetchWormsClassification(clients, id));
    } catch (error) {
      logTaxonomy(`worms classification ${id} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      classificationById.set(id, []);
    }
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
      total: Math.max(acceptedIds.length, 1),
    });
  }
  if (acceptedIds.length === 0) {
    await report({ phase: "worms-details", done: 1, total: 1 });
  }

  for (const row of results) {
    if (!row.wormsAphiaId) continue;
    row.ancestorNames = uniqueStrings([
      ...row.ancestorNames,
      ...(classificationById.get(row.wormsAphiaId) || []),
    ]);
    row.commonNames = uniqueStrings([
      ...row.commonNames,
      ...(vernacularsById.get(row.wormsAphiaId) || []),
    ]);
    if (row.scientificName) {
      row.confidence = "high";
    }
  }

  const wikiNames: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].scientificName) wikiNames.push(results[i].scientificName!);
    if (inputs[i].scientificName) wikiNames.push(inputs[i].scientificName);
    if (inputs[i].commonName) wikiNames.push(inputs[i].commonName);
  }

  logTaxonomy("wikidata plan", {
    aphiaIds: acceptedIds.length,
    names: wikiNames.length,
  });

  let wikiByAphia = new Map<number, number>();
  let wikiByName = new Map<string, number>();
  try {
    const crosswalk = await fetchWikidataInatCrosswalk(clients.fetch, {
      aphiaIds: acceptedIds,
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
    if (row.wormsAphiaId && wikiByAphia.has(row.wormsAphiaId)) {
      inatId = wikiByAphia.get(row.wormsAphiaId)!;
      confidence = "high";
    } else {
      const scientific = row.scientificName || inputs[i].scientificName;
      if (scientific && wikiByName.has(scientific.toLowerCase())) {
        inatId = wikiByName.get(scientific.toLowerCase())!;
        confidence = "high";
      } else {
        const common = inputs[i].commonName;
        if (common && wikiByName.has(common.toLowerCase())) {
          inatId = wikiByName.get(common.toLowerCase())!;
          confidence = row.wormsAphiaId || scientific ? "high" : "low";
        }
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
