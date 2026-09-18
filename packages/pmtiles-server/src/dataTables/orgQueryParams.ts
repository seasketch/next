import { ORGANISM_SIDECAR_FILES } from "@seasketch/geostats-types";
import { QueryError } from "./params";

export const ORG_QUERY_PATH = "/orgQuery";
/** Large enough for a full KFM-sized catalog (~700) without a second request. */
export const ORG_QUERY_DEFAULT_LIMIT = 2000;
export const ORG_QUERY_MAX_LIMIT = 5000;
export const ORG_QUERY_MAX_TABLES = 50;

const PUBLISHED_TABLE =
  /^projects\/[^/]+\/public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/dataTables\/[^/]+$/i;
const LEGACY_TABLE =
  /^[^/]+\/public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/dataTables\/[^/]+$/i;

export type OrgQueryParams = {
  q: string;
  tables: string[];
  limit: number;
};

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
