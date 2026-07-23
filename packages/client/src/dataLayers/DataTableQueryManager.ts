import mapboxgl from "mapbox-gl";
import {
  buildDataTableQuerySearchParams,
  DataTableQuerySettings,
  ParsedDataTableQueryValues,
} from "./dataTableQueryApi";
import { parseDataTableQueryGroups } from "./dataTableQueryApi";
import { fetchDataTableColumnStats } from "./useDataTableColumnStats";
import { ClientOverlayDataTableFragment } from "../generated/graphql";
import { shouldSendTilesAclNamespace, tilesAclNamespace } from "./tilesAuth";
import { DATA_TABLE_ZERO_SENTINEL } from "./dataTableMapStyle";

/** Catalog row + admin-resolved query, derived on demand from LayerState.dataTable. */
export type ResolvedDataTableVisualizationSettings = {
  table: ClientOverlayDataTableFragment;
  query: DataTableQuerySettings;
};

/** Lightweight query status for legend bubble scale — not the full values map. */
export type DataTableLegendSummary = {
  loading: boolean;
  error?: string;
  scaleMin: number;
  scaleMax: number;
  hasZero: boolean;
};

export class DataTableQueryManager {
  private mapAccessToken: string | null = null;
  private map: mapboxgl.Map | null = null;
  /** sourceId → queryKey that was successfully written to feature-state. */
  private appliedQueryKeys = new Map<string, string>();
  /**
   * One feature id per source used to detect whether feature-state survived
   * a style update. Style diffs often preserve sources (and their state);
   * full source rebuilds do not.
   */
  private appliedWitnesses = new Map<
    string,
    { featureId: string; sourceLayer?: string }
  >();
  /** sourceId → legend bubble extents / loading (no per-feature values). */
  private legendSummaries = new Map<string, DataTableLegendSummary>();
  private onLegendSummaryChange: (() => void) | null = null;
  private inFlightRequests = new Map<
    string,
    {
      abortController: AbortController;
      queryKey: string;
      promise: Promise<void>;
      error?: Error;
    }
  >();

  constructor(mapAccessToken: string | null) {
    this.mapAccessToken = mapAccessToken;
  }

  setMapAccessToken(mapAccessToken: string | null) {
    this.mapAccessToken = mapAccessToken;
  }

  setMap(map: mapboxgl.Map) {
    this.map = map;
    this.abortAllInFlight();
    this.clearAppliedMarkers();
  }

  /** Notify when legend summaries change (loading / extents / error). */
  setOnLegendSummaryChange(callback: (() => void) | null) {
    this.onLegendSummaryChange = callback;
  }

  getLegendSummary(sourceId: string): DataTableLegendSummary | undefined {
    return this.legendSummaries.get(sourceId);
  }

  clearLegendSummary(sourceId: string) {
    if (this.legendSummaries.delete(sourceId)) {
      this.onLegendSummaryChange?.();
    }
  }

  /**
   * Drop "already applied" markers (and abort in-flight work). Prefer
   * {@link reconcileAppliedState} after style updates — not every
   * `setStyle` clears feature-state.
   */
  invalidateApplied() {
    this.abortAllInFlight();
    this.clearAppliedMarkers();
  }

  private clearAppliedMarkers() {
    this.appliedQueryKeys.clear();
    this.appliedWitnesses.clear();
  }

  private abortAllInFlight() {
    for (const inFlight of this.inFlightRequests.values()) {
      inFlight.abortController.abort();
    }
    this.inFlightRequests.clear();
  }

  private publishLegendSummary(
    sourceId: string,
    summary: DataTableLegendSummary
  ) {
    this.legendSummaries.set(sourceId, summary);
    this.onLegendSummaryChange?.();
  }

  /**
   * If we marked this source as applied but the map no longer has our
   * feature-state (source removed or rebuilt), clear the marker so the next
   * {@link applyFeatureState} will run again.
   */
  reconcileAppliedState(sourceId: string, sourceLayerId?: string) {
    if (!this.appliedQueryKeys.has(sourceId)) {
      return;
    }
    if (!this.map?.getSource(sourceId)) {
      this.appliedQueryKeys.delete(sourceId);
      this.appliedWitnesses.delete(sourceId);
      return;
    }
    const witness = this.appliedWitnesses.get(sourceId);
    if (!witness) {
      this.appliedQueryKeys.delete(sourceId);
      return;
    }
    const state = this.map.getFeatureState({
      source: sourceId,
      id: witness.featureId,
      ...(sourceLayerId || witness.sourceLayer
        ? { sourceLayer: sourceLayerId || witness.sourceLayer }
        : {}),
    });
    if (!("loading" in state) && !("scaledValue" in state)) {
      this.appliedQueryKeys.delete(sourceId);
      this.appliedWitnesses.delete(sourceId);
    }
  }

  /**
   * Key that can be used to cache the result of a data table query.
   *
   * @param url - The URL of the data table query.
   * @param query - The query settings for the data table query.
   * @returns The key that can be used to cache the result of a data table query.
   */
  private getQueryKey(url: string, query: DataTableQuerySettings) {
    return JSON.stringify({
      url,
      query,
    });
  }

  /**
   * Fetch query results (relying on browser HTTP cache) and write
   * feature-state for every join id. Skips when this queryKey is already
   * applied or in flight for `sourceId`.
   */
  async applyFeatureState(
    sourceId: string,
    sourceLayerId: string | undefined,
    settings: ResolvedDataTableVisualizationSettings,
    tokenRequired: boolean = false
  ) {
    if (!settings.table.queryUrl) {
      throw new Error(
        "Query URL is required for data table proportional symbol layer"
      );
    }
    if (!this.map || (tokenRequired && !this.mapAccessToken)) {
      if (tokenRequired) {
        console.warn("Map or map access token is not set");
      }
      return;
    }
    const queryKey = this.getQueryKey(settings.table.queryUrl, settings.query);

    if (this.appliedQueryKeys.get(sourceId) === queryKey) {
      return;
    }

    const inFlight = this.inFlightRequests.get(sourceId);
    if (inFlight) {
      if (inFlight.queryKey === queryKey) {
        return;
      }
      inFlight.abortController.abort();
      this.inFlightRequests.delete(sourceId);
    }

    const map = this.map;
    const abortController = new AbortController();
    const { signal } = abortController;

    const promise = (async () => {
      const stillCurrent = () =>
        this.inFlightRequests.get(sourceId)?.abortController ===
        abortController;
      /** Source gone mid-flight (style rebuild) — leave unmarked for retry. */
      const sourceReady = () => Boolean(map.getSource(sourceId));

      try {
        // Mark loading as soon as join ids are known (column-stats, usually cached).
        const loadingIds = await this.getFeatureIds(settings, tokenRequired);
        if (signal.aborted || !stillCurrent()) {
          return;
        }
        if (!sourceReady()) {
          // Style still settling; caller will schedule another sync. Don't
          // publish loading:true here or the legend can stick with nothing
          // in flight after this request is cleared.
          return;
        }

        const previousSummary = this.legendSummaries.get(sourceId);
        this.publishLegendSummary(sourceId, {
          loading: true,
          scaleMin: previousSummary?.scaleMin ?? 0,
          scaleMax: previousSummary?.scaleMax ?? 0,
          hasZero: previousSummary?.hasZero ?? false,
        });

        for (const id of loadingIds) {
          map.setFeatureState(
            {
              source: sourceId,
              sourceLayer: sourceLayerId,
              id,
            },
            { loading: true }
          );
        }

        const parsed = await this.query(
          settings.table,
          settings.query,
          tokenRequired,
          signal
        );
        if (signal.aborted || !stillCurrent()) {
          return;
        }
        if (!sourceReady()) {
          return;
        }

        // Normalize positive values 0–1 against the positive extents
        // (scaleMin/scaleMax) so map radii line up with the legend's bubble
        // scale numbers. True zeros get a sentinel so paint expressions can
        // give them distinct symbology (smallest positive also scales to 0).
        const scaleMin = parsed.scaleMin;
        const range = parsed.scaleMax - scaleMin;
        const scaleValue = (value: number) => {
          if (value === 0) {
            return DATA_TABLE_ZERO_SENTINEL;
          }
          if (value < 0) {
            return 0;
          }
          if (range === 0) {
            // Single unique positive value renders at full size, matching
            // the legend's single-bubble presentation.
            return 1;
          }
          return Math.min(Math.max((value - scaleMin) / range, 0), 1);
        };

        const featureIds = await this.getFeatureIds(settings, tokenRequired);
        if (signal.aborted || !stillCurrent()) {
          return;
        }
        if (!sourceReady()) {
          return;
        }

        for (const id of featureIds) {
          const value = id in parsed.values ? parsed.values[id] : null;
          map.setFeatureState(
            {
              source: sourceId,
              sourceLayer: sourceLayerId,
              id,
            },
            {
              loading: false,
              scaledValue: value !== null ? scaleValue(value) : null,
            }
          );
        }

        if (stillCurrent()) {
          this.appliedQueryKeys.set(sourceId, queryKey);
          if (featureIds.length > 0) {
            this.appliedWitnesses.set(sourceId, {
              featureId: featureIds[0],
              sourceLayer: sourceLayerId,
            });
          } else {
            this.appliedWitnesses.delete(sourceId);
          }
          this.publishLegendSummary(sourceId, {
            loading: false,
            scaleMin: parsed.scaleMin,
            scaleMax: parsed.scaleMax,
            hasZero: parsed.hasZero,
          });
        }
      } catch (error) {
        if (
          signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        console.error(error);
        if (stillCurrent()) {
          const current = this.inFlightRequests.get(sourceId);
          if (current) {
            current.error = error as Error;
          }
          const prev = this.legendSummaries.get(sourceId);
          this.publishLegendSummary(sourceId, {
            loading: false,
            error: error instanceof Error ? error.message : String(error),
            scaleMin: prev?.scaleMin ?? 0,
            scaleMax: prev?.scaleMax ?? 0,
            hasZero: prev?.hasZero ?? false,
          });
        }
      } finally {
        if (stillCurrent()) {
          this.inFlightRequests.delete(sourceId);
        }
      }
    })();

    this.inFlightRequests.set(sourceId, {
      abortController,
      queryKey,
      promise,
    });
  }

  /**
   * Fetches and parses query results. Always resolves to parsed values, or
   * rejects (including AbortError when `signal` is aborted).
   */
  private async query(
    table: ClientOverlayDataTableFragment,
    query: DataTableQuerySettings,
    tokenRequired: boolean,
    signal: AbortSignal
  ): Promise<ParsedDataTableQueryValues> {
    const url = new URL(table.queryUrl!);
    const params = buildDataTableQuerySearchParams({
      ...query,
      groupBy: table.joinColumn,
    });
    params.set("f", "json");
    if (tokenRequired) {
      params.set("access_token", this.mapAccessToken!);
    }
    if (shouldSendTilesAclNamespace()) {
      params.set("ns", tilesAclNamespace());
    }
    url.search = params.toString();
    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
      },
      signal,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch data table query: ${response.statusText}`
      );
    }
    const data = await response.json();
    if (signal.aborted) {
      throw new DOMException("AbortError", "AbortError");
    }
    // Group keys in the response use the table join column (groupBy), not
    // the overlay property name. Values still match promoteId / feature ids.
    return parseDataTableQueryGroups(data.groups, table.joinColumn, query.op);
  }

  /**
   * Returns an exhaustive list of feature IDs, derived from column stats and
   * referencing the overlay join column. Can be used to set loading state and
   * proportional symbol values on all features of a data-table layer.
   * @param settings - The resolved data table visualization settings.
   * @returns A list of feature IDs (strings).
   */
  private async getFeatureIds(
    settings: ResolvedDataTableVisualizationSettings,
    tokenRequired: boolean = false
  ) {
    if (!settings.table.columnStatsUrl) {
      throw new Error(
        "Column stats URL is required for data table proportional symbol layer"
      );
    }
    const columnStats = await fetchDataTableColumnStats(
      settings.table.columnStatsUrl,
      tokenRequired ? this.mapAccessToken : null
    );
    if (!columnStats) {
      throw new Error("Failed to fetch column stats");
    }
    // column-stats describes the data table, so look up joinColumn (not the
    // overlay property name). Distinct values are the feature ids used with
    // promoteId / setFeatureState.
    const column = columnStats.columns.find(
      (column) => column.attribute === settings.table.joinColumn
    );
    if (!column) {
      throw new Error("Join column not found in column stats");
    }
    const featureIds = Object.keys(column.values);
    return featureIds;
  }
}
