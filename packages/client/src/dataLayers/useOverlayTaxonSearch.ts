import { useEffect, useMemo, useRef, useState } from "react";
import useDebounce from "../useDebounce";
import { fetchOrgQuery } from "./orgQueryApi";
import {
  OVERLAY_TAXON_SEARCH_LIMIT,
  OVERLAY_TAXON_SEARCH_MIN_LENGTH,
  OverlayTaxonTocItem,
  TaxonSearchHit,
  buildOverlayOrgQueryUrls,
  collectEnrichedDataTables,
  matchHitToEntry,
} from "./overlayTaxonSearch";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Project-wide organism search. Runs beside overlay title search and never
 * touches Apollo, so a slow `/orgQuery` cannot block the layer list.
 */
export default function useOverlayTaxonSearch({
  items,
  search,
  accessToken,
  enabled: featureEnabled,
}: {
  items: ReadonlyArray<OverlayTaxonTocItem>;
  search?: string;
  accessToken?: string | null;
  enabled: boolean;
}) {
  const entries = useMemo(() => collectEnrichedDataTables(items), [items]);
  const entriesKey = entries
    .map(
      (entry) =>
        `${entry.prefix}\0${entry.table.stableId}\0${entry.organismColumn}`
    )
    .join("\n");
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const enabled = Boolean(featureEnabled) && entries.length > 0;
  const query = (search || "").trim();
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const [hits, setHits] = useState<TaxonSearchHit[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentEntries = entriesRef.current;
    if (
      !enabled ||
      debouncedQuery.length < OVERLAY_TAXON_SEARCH_MIN_LENGTH
    ) {
      setHits((current) => (current.length === 0 ? current : []));
      setFetching(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setFetching(true);
    setError(null);
    const urls = buildOverlayOrgQueryUrls(currentEntries);
    Promise.all(
      urls.map((url) =>
        fetchOrgQuery(url, debouncedQuery, {
          accessToken,
          limit: OVERLAY_TAXON_SEARCH_LIMIT,
          signal: controller.signal,
        })
      )
    )
      .then((responses) => {
        if (cancelled) return;
        const merged: TaxonSearchHit[] = [];
        for (const response of responses) {
          for (const hit of response.hits) {
            const entry = matchHitToEntry(hit, currentEntries);
            if (entry) {
              merged.push({ hit, entry });
            }
          }
        }
        merged.sort(
          (a, b) =>
            b.hit.score - a.hit.score ||
            a.hit.value.localeCompare(b.hit.value)
        );
        setHits(merged);
        setFetching(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setHits([]);
        setError(err instanceof Error ? err.message : "orgQuery failed");
        setFetching(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accessToken, debouncedQuery, enabled, entriesKey]);

  const pendingDebounce =
    enabled &&
    query.length >= OVERLAY_TAXON_SEARCH_MIN_LENGTH &&
    query !== debouncedQuery;

  return {
    enabled,
    hits,
    loading: pendingDebounce || fetching,
    error,
    tablesSearched: enabled ? entries.length : 0,
  };
}
