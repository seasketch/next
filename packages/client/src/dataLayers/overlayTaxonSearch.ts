import { isOrganismInfo } from "@seasketch/geostats-types";
import { DataTableFilter } from "./dataTableQueryApi";
import { LayerDataTableState } from "./dataTableLayerState";
import { OrgQueryHit, tableLocationFromQueryUrl } from "./orgQueryApi";

/**
 * Must stay in sync with `ORG_QUERY_MAX_TABLES` in pmtiles-server.
 * One invalid or extra prefix makes the whole `/orgQuery` request fail.
 */
export const ORG_QUERY_MAX_TABLES = 50;

/** Ranked hits to keep from a project-wide search. Not a full catalog browse. */
export const OVERLAY_TAXON_SEARCH_LIMIT = 300;

export const OVERLAY_TAXON_SEARCH_MIN_LENGTH = 2;

const PUBLISHED_TABLE =
  /^projects\/[^/]+\/public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/dataTables\/[^/]+$/i;
const LEGACY_TABLE =
  /^[^/]+\/public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/dataTables\/[^/]+$/i;

export function isOrgQueryTablePrefix(prefix: string): boolean {
  return PUBLISHED_TABLE.test(prefix) || LEGACY_TABLE.test(prefix);
}

/**
 * Fields overlay search needs from a TOC item. Published `Overlay` and draft
 * `AdminOverlay` both satisfy this.
 */
export type OverlayTaxonTocItem = {
  id: number;
  stableId: string;
  title?: string | null;
  parentStableId?: string | null;
  translatedProps?: unknown;
  overlayDataTables?: ReadonlyArray<OverlayTaxonTable> | null;
};

export type OverlayTaxonTable = {
  id: number;
  stableId?: string | null;
  name?: string | null;
  description?: string | null;
  rowCount?: number | null;
  queryUrl?: string | null;
  organism?: unknown;
  deletedAt?: string | null;
  replacedById?: number | null;
};

export type EnrichedDataTableEntry = {
  tocStableId: string;
  tocItemId: number;
  layerTitle: string;
  layerTranslatedProps: unknown;
  folderPath: string[];
  folderTranslatedProps: unknown[];
  table: OverlayTaxonTable;
  prefix: string;
  origin: string;
  organismColumn: string;
};

export type TaxonSearchHit = {
  hit: OrgQueryHit;
  entry: EnrichedDataTableEntry;
};

export type RememberedOrganismSettings = {
  column?: string;
  op?: LayerDataTableState["op"];
  filters?: DataTableFilter[];
};

/**
 * Enriched data tables only. Tables without organism identity, a query URL,
 * or a prefix `/orgQuery` will accept are omitted so search is a no-op when
 * a project has no searchable catalogs.
 */
export function collectEnrichedDataTables(
  items: ReadonlyArray<OverlayTaxonTocItem>
): EnrichedDataTableEntry[] {
  const byStableId = new Map<string, OverlayTaxonTocItem>();
  for (const item of items) {
    if (item.stableId) {
      byStableId.set(item.stableId, item);
    }
  }
  const entries: EnrichedDataTableEntry[] = [];
  for (const item of items) {
    if (!item.stableId) continue;
    for (const table of item.overlayDataTables || []) {
      if (!table.stableId || table.deletedAt || table.replacedById) continue;
      if (!isOrganismInfo(table.organism)) continue;
      if (typeof table.queryUrl !== "string" || !table.queryUrl) continue;
      const location = tableLocationFromQueryUrl(table.queryUrl);
      if (!location || !isOrgQueryTablePrefix(location.prefix)) continue;
      const folders = folderLabels(item, byStableId);
      entries.push({
        tocStableId: item.stableId,
        tocItemId: item.id,
        layerTitle: item.title || "",
        layerTranslatedProps: item.translatedProps,
        folderPath: folders.titles,
        folderTranslatedProps: folders.translatedProps,
        table,
        prefix: location.prefix,
        origin: location.origin,
        organismColumn: table.organism.column,
      });
    }
  }
  return entries;
}

function folderLabels(
  item: OverlayTaxonTocItem,
  byStableId: Map<string, OverlayTaxonTocItem>
): { titles: string[]; translatedProps: unknown[] } {
  const titles: string[] = [];
  const translatedProps: unknown[] = [];
  const seen = new Set<string>();
  let parentId = item.parentStableId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byStableId.get(parentId);
    if (!parent) break;
    if (parent.title) {
      titles.push(parent.title);
      translatedProps.push(parent.translatedProps);
    }
    parentId = parent.parentStableId;
  }
  titles.reverse();
  translatedProps.reverse();
  return { titles, translatedProps };
}

/**
 * One `/orgQuery` URL per origin, chunked at the worker's table limit.
 * A project normally fits in a single request.
 */
export function buildOverlayOrgQueryUrls(
  entries: ReadonlyArray<EnrichedDataTableEntry>,
  limit = OVERLAY_TAXON_SEARCH_LIMIT
): string[] {
  const prefixesByOrigin = new Map<string, string[]>();
  for (const entry of entries) {
    const existing = prefixesByOrigin.get(entry.origin) || [];
    const key = entry.prefix.toLowerCase();
    if (!existing.some((prefix) => prefix.toLowerCase() === key)) {
      existing.push(entry.prefix);
    }
    prefixesByOrigin.set(entry.origin, existing);
  }
  const urls: string[] = [];
  for (const [origin, prefixes] of prefixesByOrigin) {
    for (let index = 0; index < prefixes.length; index += ORG_QUERY_MAX_TABLES) {
      const chunk = prefixes.slice(index, index + ORG_QUERY_MAX_TABLES);
      const url = new URL("/orgQuery", origin);
      url.searchParams.set("tables", chunk.join(","));
      url.searchParams.set("limit", String(limit));
      urls.push(url.toString());
    }
  }
  return urls;
}

export function matchHitToEntry(
  hit: Pick<OrgQueryHit, "table">,
  entries: ReadonlyArray<EnrichedDataTableEntry>
): EnrichedDataTableEntry | undefined {
  const key = hit.table.toLowerCase();
  return entries.find((entry) => entry.prefix.toLowerCase() === key);
}

/**
 * Keep the table's remembered column and aggregation, and replace any filter
 * on the organism column with an exact match for the chosen value.
 */
export function mergeOrganismFilter(
  remembered: RememberedOrganismSettings | undefined,
  organismColumn: string,
  value: string
): Pick<LayerDataTableState, "column" | "op" | "filters"> {
  const filters = (remembered?.filters || []).filter(
    (filter) => filter.column !== organismColumn
  );
  filters.push({ column: organismColumn, op: "eq", value });
  return {
    column: remembered?.column,
    op: remembered?.op,
    filters,
  };
}

export function taxonHitIsActive(
  layerState:
    | { visible?: boolean; hidden?: boolean; dataTable?: LayerDataTableState }
    | undefined,
  entry: Pick<EnrichedDataTableEntry, "table" | "organismColumn">,
  hit: Pick<OrgQueryHit, "value">
): boolean {
  // Hiding a layer keeps its last data-table filter. The checkmark means the
  // species is on the map right now, so a TOC-off or legend-hidden layer is not active.
  if (!layerState?.visible || layerState.hidden) {
    return false;
  }
  const dataTable = layerState.dataTable;
  if (!dataTable?.stableId || dataTable.stableId !== entry.table.stableId) {
    return false;
  }
  const filter = (dataTable.filters || []).find(
    (candidate) => candidate.column === entry.organismColumn
  );
  if (!filter) return false;
  if (filter.op === "eq") return filter.value === hit.value;
  if (filter.op === "in") {
    return Boolean(filter.values && filter.values.indexOf(hit.value) !== -1);
  }
  return false;
}

/**
 * Wrap query-token prefixes in `<<<>>>` so `SearchResultHighlights` can paint
 * them. MiniSearch does not return headlines. Matches are prefix-only at a
 * word boundary, same idea as the organism index (`prefix: true`).
 */
export function highlightQueryTerms(text: string, q: string): string {
  const tokens = q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= OVERLAY_TAXON_SEARCH_MIN_LENGTH);
  if (!text || tokens.length === 0) return text;
  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(token, from);
      if (index === -1) break;
      const prev = index === 0 ? "" : lower.charAt(index - 1);
      if (index === 0 || !/[a-z0-9]/i.test(prev)) {
        ranges.push([index, index + token.length]);
      }
      from = index + Math.max(token.length, 1);
    }
  }
  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }
  let out = "";
  let cursor = 0;
  for (const [start, end] of merged) {
    out += text.slice(cursor, start) + "<<<" + text.slice(start, end) + ">>>";
    cursor = end;
  }
  return out + text.slice(cursor);
}
