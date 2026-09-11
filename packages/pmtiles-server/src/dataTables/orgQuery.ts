import MiniSearch, { type SearchResult } from "minisearch";
import {
  ORGANISM_SEARCH_INDEX_OPTIONS,
  ORGANISM_SIDECAR_FILES,
} from "@seasketch/geostats-types";
import { QueryError } from "./params";

export const ORG_QUERY_PATH = "/orgQuery";
export const ORG_QUERY_FETCH_CONCURRENCY = 6;
/** Large enough for a full KFM-sized catalog (~700) without a second request. */
export const ORG_QUERY_DEFAULT_LIMIT = 2000;
export const ORG_QUERY_MAX_LIMIT = 5000;
export const ORG_QUERY_MAX_TABLES = 50;

const PUBLISHED_TABLE =
  /^projects\/[^/]+\/public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/dataTables\/[^/]+$/i;
const LEGACY_TABLE =
  /^[^/]+\/public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/dataTables\/[^/]+$/i;

export type OrgQueryHit = {
  table: string;
  column: string;
  value: string;
  scientificName: string | null;
  commonName: string | null;
  description: string | null;
  inatTaxonId: number | null;
  wormsAphiaId: number | null;
  score: number;
  matchedFields: string[];
};

export type OrgQueryResponse = {
  q: string;
  tablesScanned: number;
  hits: OrgQueryHit[];
};

export type OrgQueryParams = {
  q: string;
  tables: string[];
  limit: number;
};

type CachedIndex = {
  etag: string;
  mini: MiniSearch;
  /** All stored documents, sorted for empty-`q` browse. */
  documents: OrgQueryHit[];
};

const indexCache = new Map<string, CachedIndex>();
const MAX_INDEX_CACHE = 40;

export function resetOrgQueryCache() {
  indexCache.clear();
}

export function isOrgQueryPath(pathname: string): boolean {
  return pathname === ORG_QUERY_PATH || pathname === `${ORG_QUERY_PATH}/`;
}

function emptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Accept a table prefix, `/query` URL, or sidecar key and return the R2
 * prefix next to `organism-search.json`.
 */
export function normalizeOrgQueryTableRef(raw: unknown): string | null {
  if (!emptyString(raw)) return null;
  let value = raw.trim();
  if (!value) return null;
  try {
    if (/^https?:\/\//i.test(value)) {
      value = new URL(value).pathname;
    }
  } catch {
    return null;
  }
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  value = value.replace(/^\/+/, "").replace(/\/+$/, "");
  const suffixes = [
    "/query",
    `/${ORGANISM_SIDECAR_FILES.searchIndex}`,
    `/${ORGANISM_SIDECAR_FILES.catalog}`,
    `/${ORGANISM_SIDECAR_FILES.preview}`,
    "/data.parquet",
    "/column-stats.json",
  ];
  for (const suffix of suffixes) {
    if (value.toLowerCase().endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  if (
    !value ||
    value.includes("\\") ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    return null;
  }
  if (!PUBLISHED_TABLE.test(value) && !LEGACY_TABLE.test(value)) {
    return null;
  }
  return value;
}

export function parseOrgQueryParams(search: URLSearchParams): OrgQueryParams {
  const q = (search.get("q") || "").trim();
  const rawTables = search.get("tables") || "";
  const tables: string[] = [];
  const seen = new Set<string>();
  for (const part of rawTables.split(",")) {
    const prefix = normalizeOrgQueryTableRef(part);
    if (!prefix) {
      if (part.trim()) {
        throw new QueryError(`Invalid table ref "${part.trim()}"`, 400);
      }
      continue;
    }
    const key = prefix.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tables.push(prefix);
  }
  if (tables.length === 0) {
    throw new QueryError("tables is required", 400);
  }
  if (tables.length > ORG_QUERY_MAX_TABLES) {
    throw new QueryError(
      `tables is limited to ${ORG_QUERY_MAX_TABLES}`,
      400
    );
  }
  const limitRaw = search.get("limit");
  let limit = ORG_QUERY_DEFAULT_LIMIT;
  if (limitRaw != null && limitRaw !== "") {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new QueryError("limit must be a positive integer", 400);
    }
    limit = Math.min(parsed, ORG_QUERY_MAX_LIMIT);
  }
  return { q, tables, limit };
}

export type OrgQueryObject = {
  text: string;
  etag: string;
};

export type OrgQueryStore = {
  stat: (key: string) => Promise<{ etag: string } | null>;
  get: (key: string) => Promise<OrgQueryObject | null>;
};

function rememberIndex(prefix: string, entry: CachedIndex) {
  if (indexCache.size >= MAX_INDEX_CACHE && !indexCache.has(prefix)) {
    const oldest = indexCache.keys().next().value;
    if (oldest !== undefined) {
      indexCache.delete(oldest);
    }
  }
  indexCache.set(prefix, entry);
}

export async function loadOrganismSearchIndex(
  store: OrgQueryStore,
  prefix: string
): Promise<CachedIndex | null> {
  const key = `${prefix}/${ORGANISM_SIDECAR_FILES.searchIndex}`;
  const cached = indexCache.get(prefix);
  const stat = await store.stat(key);
  if (!stat) return null;
  if (cached && cached.etag === stat.etag) {
    return cached;
  }
  const object = await store.get(key);
  if (!object) return null;
  const mini = MiniSearch.loadJSON(object.text, ORGANISM_SEARCH_INDEX_OPTIONS);
  const documents = browseDocumentsFromIndexJson(prefix, object.text);
  const entry = { etag: object.etag, mini, documents };
  rememberIndex(prefix, entry);
  return entry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalStoredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalStoredInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export function orgQueryHitLabel(hit: Pick<OrgQueryHit, "commonName" | "scientificName" | "value">): string {
  return hit.commonName || hit.scientificName || hit.value;
}

export function compareBrowseHits(a: OrgQueryHit, b: OrgQueryHit): number {
  return (
    orgQueryHitLabel(a).localeCompare(orgQueryHitLabel(b), undefined, {
      sensitivity: "base",
    }) || a.value.localeCompare(b.value)
  );
}

function hitFromStoredRecord(
  table: string,
  stored: unknown,
  id: unknown,
  extras?: { score?: number; matchedFields?: string[] }
): OrgQueryHit {
  const record = isRecord(stored) ? stored : {};
  const fallbackId =
    typeof id === "string" && id
      ? id
      : typeof id === "number"
        ? String(id)
        : "";
  return {
    table,
    column: optionalStoredString(record.column) || "",
    value: optionalStoredString(record.value) || fallbackId,
    scientificName: optionalStoredString(record.scientific_name),
    commonName: optionalStoredString(record.common_name),
    description: optionalStoredString(record.description),
    inatTaxonId: optionalStoredInt(record.inat_taxon_id),
    wormsAphiaId: optionalStoredInt(record.worms_aphia_id),
    score: extras?.score ?? 0,
    matchedFields: extras?.matchedFields ?? [],
  };
}

/**
 * MiniSearch has no public "get all". The serialized index maps short ids to
 * stored display fields — enough to browse without a second sidecar.
 */
export function browseDocumentsFromIndexJson(
  table: string,
  text: string
): OrgQueryHit[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];
  const documentIds = parsed.documentIds;
  const storedFields = parsed.storedFields;
  if (!isRecord(documentIds) || !isRecord(storedFields)) return [];
  const hits: OrgQueryHit[] = [];
  for (const [shortId, id] of Object.entries(documentIds)) {
    hits.push(hitFromStoredRecord(table, storedFields[shortId], id));
  }
  hits.sort(compareBrowseHits);
  return hits;
}

function matchedFieldsFromResult(result: SearchResult): string[] {
  const match = result.match;
  if (!match || typeof match !== "object") return [];
  const fields = new Set<string>();
  for (const terms of Object.values(match)) {
    if (!Array.isArray(terms)) continue;
    for (const field of terms) {
      if (typeof field === "string") fields.add(field);
    }
  }
  return [...fields];
}

export function hitsFromSearchResult(
  table: string,
  result: SearchResult
): OrgQueryHit {
  return hitFromStoredRecord(table, result, result.id, {
    score: typeof result.score === "number" ? result.score : 0,
    matchedFields: matchedFieldsFromResult(result),
  });
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

export async function executeOrgQuery(
  params: OrgQueryParams,
  store: OrgQueryStore,
  options?: { concurrency?: number }
): Promise<OrgQueryResponse> {
  const concurrency = options?.concurrency ?? ORG_QUERY_FETCH_CONCURRENCY;
  const loaded = await mapPool(params.tables, concurrency, async (table) => {
    const index = await loadOrganismSearchIndex(store, table);
    return { table, index };
  });
  const hits: OrgQueryHit[] = [];
  let tablesScanned = 0;
  for (const { table, index } of loaded) {
    if (!index) continue;
    tablesScanned += 1;
    if (!params.q) {
      hits.push(...index.documents);
      continue;
    }
    const results = index.mini.search(
      params.q,
      ORGANISM_SEARCH_INDEX_OPTIONS.searchOptions
    );
    for (const result of results) {
      hits.push(hitsFromSearchResult(table, result));
    }
  }
  if (!params.q) {
    hits.sort(compareBrowseHits);
  } else {
    hits.sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));
  }
  return {
    q: params.q,
    tablesScanned,
    hits: hits.slice(0, params.limit),
  };
}

export function r2OrgQueryStore(bucket: R2Bucket): OrgQueryStore {
  return {
    async stat(key) {
      const head = await bucket.head(key);
      if (!head) return null;
      return { etag: head.httpEtag || head.etag };
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      return {
        text: await object.text(),
        etag: object.httpEtag || object.etag || key,
      };
    },
  };
}

export async function handleOrgQuery(
  request: Request,
  env: Env,
  options?: { store?: OrgQueryStore }
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }
  const url = new URL(request.url);
  let params: OrgQueryParams;
  try {
    params = parseOrgQueryParams(url.searchParams);
  } catch (error) {
    if (error instanceof QueryError) {
      return Response.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        }
      );
    }
    throw error;
  }

  const body = await executeOrgQuery(
    params,
    options?.store || r2OrgQueryStore(env.TILES_BUCKET)
  );
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "private, max-age=60",
    },
  });
}
