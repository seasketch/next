import { useEffect, useState } from "react";
import { DataTablesColumnStats } from "@seasketch/geostats-types";
import { withHostedAuthParams } from "./tilesAuth";

export interface DataTableColumnStatsState {
  columnStats?: DataTablesColumnStats;
  loading: boolean;
  error?: Error;
}

const columnStatsCache: { [url: string]: DataTablesColumnStats | undefined } =
  {};
const columnStatsErrors: { [url: string]: Error | undefined } = {};
const columnStatsRequests: {
  [url: string]: Promise<DataTablesColumnStats> | undefined;
} = {};

export function columnStatsUrlForTable(table: {
  columnStatsUrl?: string | null;
  queryUrl?: string | null;
}) {
  if (table.columnStatsUrl) {
    return table.columnStatsUrl;
  }
  if (!table.queryUrl) {
    return undefined;
  }
  try {
    const url = new URL(table.queryUrl);
    url.pathname = url.pathname.replace(/\/query$/, "/column-stats.json");
    url.search = "";
    return url.toString();
  } catch {
    return table.queryUrl.replace(/\/query(?:\?.*)?$/, "/column-stats.json");
  }
}

export function getCachedDataTableColumnStats(
  columnStatsUrl?: string | null
) {
  return columnStatsUrl ? columnStatsCache[columnStatsUrl] : undefined;
}

/**
 * Fetch column-stats.json for a data table. When `accessToken` is provided,
 * appends hosted-auth query params (same ACL as the parent layer tiles).
 * Cache keys use the bare URL so token rollover does not fragment the cache.
 */
export function fetchDataTableColumnStats(
  columnStatsUrl: string,
  accessToken?: string | null
) {
  if (columnStatsCache[columnStatsUrl]) {
    return Promise.resolve(columnStatsCache[columnStatsUrl]);
  }
  if (columnStatsRequests[columnStatsUrl]) {
    return columnStatsRequests[columnStatsUrl]!;
  }
  const authorizedUrl = withHostedAuthParams(columnStatsUrl, {
    accessToken,
  });
  const request = fetch(authorizedUrl)
    .then((response) => {
      if (!response.ok) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error(`Failed to fetch column stats (${response.status})`);
      }
      return response.json();
    })
    .then((columnStats: DataTablesColumnStats) => {
      columnStatsCache[columnStatsUrl] = columnStats;
      columnStatsErrors[columnStatsUrl] = undefined;
      return columnStats;
    })
    .catch((error: Error) => {
      columnStatsErrors[columnStatsUrl] = error;
      throw error;
    })
    .finally(() => {
      columnStatsRequests[columnStatsUrl] = undefined;
    });
  columnStatsRequests[columnStatsUrl] = request;
  return request;
}

/**
 * Fetches `column-stats.json` for a data table (see `columnStatsUrl` on
 * `OverlayDataTable`) so admin and end-user forms can present real column
 * names and types rather than free text.
 *
 * @see packages/pmtiles-server/README.md
 */
export function useDataTableColumnStats(
  columnStatsUrl?: string | null,
  accessToken?: string | null
): DataTableColumnStatsState {
  const [state, setState] = useState<DataTableColumnStatsState>({
    columnStats: getCachedDataTableColumnStats(columnStatsUrl),
    error: columnStatsUrl ? columnStatsErrors[columnStatsUrl] : undefined,
    loading: Boolean(
      columnStatsUrl &&
        !columnStatsCache[columnStatsUrl] &&
        columnStatsRequests[columnStatsUrl]
    ),
  });

  useEffect(() => {
    if (!columnStatsUrl) {
      setState({ loading: false });
      return;
    }
    const cached = columnStatsCache[columnStatsUrl];
    if (cached) {
      setState({ columnStats: cached, loading: false });
      return;
    }
    let cancelled = false;
    setState({
      loading: true,
      error: columnStatsErrors[columnStatsUrl],
    });
    fetchDataTableColumnStats(columnStatsUrl, accessToken)
      .then((columnStats: DataTablesColumnStats) => {
        if (!cancelled) {
          setState({ columnStats, loading: false });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ loading: false, error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [columnStatsUrl, accessToken]);

  return state;
}

export function useDataTableColumnStatsMap(
  columnStatsUrls: string[],
  accessToken?: string | null
) {
  const [state, setState] = useState<{
    [url: string]: DataTableColumnStatsState | undefined;
  }>(() =>
    Object.fromEntries(
      columnStatsUrls.map((url) => [
        url,
        {
          columnStats: columnStatsCache[url],
          error: columnStatsErrors[url],
          loading: Boolean(!columnStatsCache[url] && columnStatsRequests[url]),
        },
      ])
    )
  );

  useEffect(() => {
    let cancelled = false;
    setState((prev) => {
      const next = { ...prev };
      for (const url of columnStatsUrls) {
        next[url] = {
          columnStats: columnStatsCache[url],
          error: columnStatsErrors[url],
          loading: Boolean(!columnStatsCache[url]),
        };
      }
      return next;
    });
    for (const url of columnStatsUrls) {
      if (columnStatsCache[url]) {
        continue;
      }
      fetchDataTableColumnStats(url, accessToken)
        .then((columnStats) => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              [url]: { columnStats, loading: false },
            }));
          }
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              [url]: { error, loading: false },
            }));
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [columnStatsUrls, accessToken]);

  return state;
}

/** Column names with numeric values, suitable for `sum`/`mean`/`min`/`max`/`median` aggregation. */
export function numericColumnNames(columnStats?: DataTablesColumnStats) {
  return (columnStats?.columns || [])
    .filter((column) => column.type === "number")
    .map((column) => column.attribute);
}
