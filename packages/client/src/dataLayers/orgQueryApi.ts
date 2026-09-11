/* eslint-disable i18next/no-literal-string -- query URL serialization, not UI copy */

import { isOrganismInfo } from "@seasketch/geostats-types";
import { withHostedAuthParams } from "./tilesAuth";

export const ORG_QUERY_DEFAULT_LIMIT = 2000;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  return null;
}

export function isOrgQueryHit(value: unknown): value is OrgQueryHit {
  if (!isRecord(value)) return false;
  if (typeof value.table !== "string" || !value.table) return false;
  if (typeof value.column !== "string") return false;
  if (typeof value.value !== "string" || !value.value) return false;
  if (value.scientificName !== null && typeof value.scientificName !== "string") {
    return false;
  }
  if (value.commonName !== null && typeof value.commonName !== "string") {
    return false;
  }
  if (value.description !== null && typeof value.description !== "string") {
    return false;
  }
  if (
    value.inatTaxonId !== null &&
    (typeof value.inatTaxonId !== "number" ||
      !Number.isInteger(value.inatTaxonId) ||
      value.inatTaxonId <= 0)
  ) {
    return false;
  }
  if (
    value.wormsAphiaId !== null &&
    (typeof value.wormsAphiaId !== "number" ||
      !Number.isInteger(value.wormsAphiaId) ||
      value.wormsAphiaId <= 0)
  ) {
    return false;
  }
  if (typeof value.score !== "number" || !Number.isFinite(value.score)) {
    return false;
  }
  return (
    Array.isArray(value.matchedFields) &&
    value.matchedFields.every((field) => typeof field === "string")
  );
}

export function isOrgQueryResponse(value: unknown): value is OrgQueryResponse {
  if (!isRecord(value)) return false;
  if (typeof value.q !== "string") return false;
  if (
    typeof value.tablesScanned !== "number" ||
    !Number.isInteger(value.tablesScanned) ||
    value.tablesScanned < 0
  ) {
    return false;
  }
  return Array.isArray(value.hits) && value.hits.every(isOrgQueryHit);
}

/**
 * GraphQL `orgQueryUrl`, or a `/query` URL rewritten onto `/orgQuery`.
 */
export function orgQueryUrlForTable(table: {
  orgQueryUrl?: string | null;
  queryUrl?: string | null;
}): string | null {
  if (typeof table.orgQueryUrl === "string" && table.orgQueryUrl) {
    return table.orgQueryUrl;
  }
  if (typeof table.queryUrl !== "string" || !table.queryUrl) {
    return null;
  }
  try {
    const queryUrl = new URL(table.queryUrl);
    const prefix = queryUrl.pathname.replace(/\/query\/?$/, "").replace(/^\//, "");
    if (!prefix) return null;
    return `${queryUrl.origin}/orgQuery?tables=${encodeURIComponent(prefix)}`;
  } catch {
    return null;
  }
}

export function buildOrgQueryUrl(
  orgQueryUrl: string,
  q: string,
  limit = ORG_QUERY_DEFAULT_LIMIT
): string {
  const url = new URL(orgQueryUrl);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

export async function fetchOrgQuery(
  orgQueryUrl: string,
  q: string,
  options?: {
    accessToken?: string | null;
    limit?: number;
    signal?: AbortSignal;
  }
): Promise<OrgQueryResponse> {
  const url = withHostedAuthParams(
    buildOrgQueryUrl(orgQueryUrl, q, options?.limit),
    { accessToken: options?.accessToken }
  );
  const response = await fetch(url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`orgQuery ${response.status}`);
  }
  const json: unknown = await response.json();
  if (!isOrgQueryResponse(json)) {
    throw new Error("orgQuery returned an unexpected payload");
  }
  return json;
}

export function orgQueryHitLabel(hit: OrgQueryHit): string {
  return hit.commonName || hit.scientificName || hit.value;
}

export function orgQueryHitMatchedAncestor(hit: OrgQueryHit): boolean {
  return hit.matchedFields.indexOf("ancestor_names") !== -1;
}

export function organismColumnFromTable(table: {
  organism?: unknown;
} | null | undefined): string | null {
  if (!table || !isOrganismInfo(table.organism)) {
    return null;
  }
  return table.organism.column;
}
