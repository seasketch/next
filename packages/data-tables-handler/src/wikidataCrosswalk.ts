/**
 * Batch AphiaID / scientific-name → iNaturalist taxon id via Wikidata.
 * iNat has no name-batch API; Wikidata P850 (WoRMS) + P3151 (iNat) + P225
 * (taxon name) can resolve hundreds of ids in a few SPARQL requests.
 * When one key has two P3151s, ask iNat `/v1/taxa/{id,id}` for `is_active`
 * and keep the single live taxon (Rock Scallop: 54526 over 187594).
 */

export const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
export const WIKIDATA_CROSSWALK_BATCH = 50;
export const WIKIDATA_USER_AGENT =
  "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
export const INATURALIST_TAXA_URL = "https://api.inaturalist.org/v1/taxa";
export const INATURALIST_TAXA_BATCH = 30;
const INATURALIST_MIN_INTERVAL_MS = 1000;

export type WikidataFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function escapeSparqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildWikidataAphiaQuery(aphiaIds: number[]): string {
  const values = aphiaIds.map((id) => `"${id}"`).join(" ");
  return `SELECT ?aphia ?inat WHERE {
  VALUES ?aphia { ${values} }
  ?item wdt:P850 ?aphia .
  ?item wdt:P3151 ?inat .
}`;
}

export function buildWikidataNameQuery(names: string[]): string {
  const values = names.map((name) => `"${escapeSparqlString(name)}"`).join(" ");
  // Only indexed properties bound to VALUES. Do not BIND() a language-tagged
  // rdfs:label inside a UNION — WDQS can treat ?label as unbound and return
  // every P3151 row (Node then dies creating a >512MB string).
  return `SELECT ?query ?inat WHERE {
  VALUES ?query { ${values} }
  ?item wdt:P3151 ?inat .
  { ?item wdt:P225 ?query . } UNION { ?item wdt:P1843 ?query . }
}`;
}

export function buildWikidataLabelQuery(names: string[]): string {
  const values = names
    .map((name) => `"${escapeSparqlString(name)}"@en`)
    .join(" ");
  return `SELECT ?query ?inat WHERE {
  VALUES ?label { ${values} }
  ?item rdfs:label ?label .
  ?item wdt:P3151 ?inat .
  BIND(STR(?label) AS ?query)
}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bindingLiteral(
  row: Record<string, unknown>,
  key: string
): string | null {
  const cell = row[key];
  if (!isRecord(cell) || typeof cell.value !== "string") return null;
  const text = cell.value.trim();
  return text.length > 0 ? text : null;
}

export function parseWikidataInatBindings(
  json: unknown
): Array<{ aphia: string | null; query: string | null; inat: number }> {
  if (!isRecord(json) || !isRecord(json.results)) return [];
  const bindings = json.results.bindings;
  if (!Array.isArray(bindings)) return [];
  const out: Array<{ aphia: string | null; query: string | null; inat: number }> =
    [];
  for (const row of bindings) {
    if (!isRecord(row)) continue;
    const inatText = bindingLiteral(row, "inat");
    if (!inatText || !/^\d+$/.test(inatText)) continue;
    const inat = parseInt(inatText, 10);
    if (inat <= 0) continue;
    out.push({
      aphia: bindingLiteral(row, "aphia"),
      query: bindingLiteral(row, "query"),
      inat,
    });
  }
  return out;
}

export function addInatCandidate(
  map: Map<string, Set<number>>,
  key: string,
  inat: number
): void {
  let ids = map.get(key);
  if (!ids) {
    ids = new Set();
    map.set(key, ids);
  }
  ids.add(inat);
}

/**
 * One candidate: keep it (even if inactive). Several: keep the only
 * `is_active` id. Zero or two-plus live taxa: drop.
 */
export function pickActiveInatId(
  ids: Iterable<number>,
  activity: Map<number, boolean>
): number | null {
  const unique: number[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];
  const active = unique.filter((id) => activity.get(id) === true);
  return active.length === 1 ? active[0] : null;
}

export function parseInatTaxonActivity(json: unknown): Map<number, boolean> {
  const out = new Map<number, boolean>();
  if (!isRecord(json) || !Array.isArray(json.results)) return out;
  for (const row of json.results) {
    if (!isRecord(row)) continue;
    if (typeof row.id !== "number" || !Number.isInteger(row.id) || row.id <= 0) {
      continue;
    }
    if (typeof row.is_active !== "boolean") continue;
    out.set(row.id, row.is_active);
  }
  return out;
}

function conflictInatIds(maps: Array<Map<string, Set<number>>>): number[] {
  const ids = new Set<number>();
  for (const map of maps) {
    for (const set of map.values()) {
      if (set.size < 2) continue;
      for (const id of set) ids.add(id);
    }
  }
  return Array.from(ids);
}

function finalizeCandidateMap(
  candidates: Map<string, Set<number>>,
  activity: Map<number, boolean>
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [key, ids] of candidates) {
    const picked = pickActiveInatId(ids, activity);
    if (picked != null) out.set(key, picked);
  }
  return out;
}

async function fetchInatTaxonActivity(
  fetchFn: WikidataFetch,
  ids: number[]
): Promise<Map<number, boolean>> {
  const activity = new Map<number, boolean>();
  const unique = Array.from(
    new Set(ids.filter((id) => Number.isInteger(id) && id > 0))
  );
  for (let i = 0; i < unique.length; i += INATURALIST_TAXA_BATCH) {
    if (i > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, INATURALIST_MIN_INTERVAL_MS)
      );
    }
    const batch = unique.slice(i, i + INATURALIST_TAXA_BATCH);
    const url = `${INATURALIST_TAXA_URL}/${batch.join(",")}`;
    try {
      const response = await fetchFn(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": WIKIDATA_USER_AGENT,
        },
      });
      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.log(
          `[data-tables-handler] taxonomy inat activity ${response.status}`
        );
        continue;
      }
      const parsed = parseInatTaxonActivity(await response.json());
      for (const [id, active] of parsed) activity.set(id, active);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(
        `[data-tables-handler] taxonomy inat activity failed ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  return activity;
}

async function runSparql(
  fetchFn: WikidataFetch,
  query: string
): Promise<unknown> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchFn(WIKIDATA_SPARQL_URL, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": WIKIDATA_USER_AGENT,
      },
      body: `query=${encodeURIComponent(query)}`,
    });
    if (response.ok) {
      return response.json();
    }
    lastError = new Error(`wikidata ${response.status}`);
    if (response.status !== 429 && response.status < 500) {
      throw lastError;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
  throw lastError || new Error("wikidata SPARQL failed");
}

export type WikidataCrosswalk = {
  byAphiaId: Map<number, number>;
  byName: Map<string, number>;
};

export async function fetchWikidataInatCrosswalk(
  fetchFn: WikidataFetch,
  options: {
    aphiaIds: number[];
    names: string[];
    onProgress?: (done: number, total: number) => Promise<void> | void;
  }
): Promise<WikidataCrosswalk> {
  const uniqueAphia = Array.from(new Set(options.aphiaIds.filter((id) => id > 0)));
  const uniqueNames: string[] = [];
  const seenNames = new Set<string>();
  for (const name of options.names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    uniqueNames.push(trimmed);
  }

  const aphiaBatches = Math.ceil(uniqueAphia.length / WIKIDATA_CROSSWALK_BATCH);
  const nameBatches = Math.ceil(uniqueNames.length / WIKIDATA_CROSSWALK_BATCH);
  const total = Math.max(aphiaBatches + nameBatches * 2, 1);
  let done = 0;
  const report = async () => {
    if (options.onProgress) await options.onProgress(done, total);
  };

  const runBatch = async (
    query: string,
    apply: (json: unknown) => void
  ) => {
    try {
      apply(await runSparql(fetchFn, query));
    } catch (error) {
      // Keep earlier batches. One bad SPARQL must not wipe Aphia hits.
      // eslint-disable-next-line no-console
      console.log(
        `[data-tables-handler] taxonomy wikidata batch failed ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    done += 1;
    await report();
  };

  const byAphiaKey = new Map<string, Set<number>>();
  for (let i = 0; i < uniqueAphia.length; i += WIKIDATA_CROSSWALK_BATCH) {
    const batch = uniqueAphia.slice(i, i + WIKIDATA_CROSSWALK_BATCH);
    await runBatch(buildWikidataAphiaQuery(batch), (json) => {
      for (const row of parseWikidataInatBindings(json)) {
        if (row.aphia) addInatCandidate(byAphiaKey, row.aphia, row.inat);
      }
    });
  }

  const byNameCandidates = new Map<string, Set<number>>();
  const applyNameHits = (json: unknown) => {
    for (const row of parseWikidataInatBindings(json)) {
      if (row.query) {
        addInatCandidate(byNameCandidates, row.query.toLowerCase(), row.inat);
      }
    }
  };
  for (let i = 0; i < uniqueNames.length; i += WIKIDATA_CROSSWALK_BATCH) {
    const batch = uniqueNames.slice(i, i + WIKIDATA_CROSSWALK_BATCH);
    await runBatch(buildWikidataNameQuery(batch), applyNameHits);
    await runBatch(buildWikidataLabelQuery(batch), applyNameHits);
  }

  if (done === 0) {
    done = 1;
    await report();
  }

  const conflictIds = conflictInatIds([byAphiaKey, byNameCandidates]);
  const activity =
    conflictIds.length > 0
      ? await fetchInatTaxonActivity(fetchFn, conflictIds)
      : new Map<number, boolean>();

  const byAphiaPicked = finalizeCandidateMap(byAphiaKey, activity);
  const byName = finalizeCandidateMap(byNameCandidates, activity);
  const byAphiaId = new Map<number, number>();
  for (const [key, inat] of byAphiaPicked) {
    const aphia = parseInt(key, 10);
    if (aphia > 0) byAphiaId.set(aphia, inat);
  }
  return { byAphiaId, byName };
}
