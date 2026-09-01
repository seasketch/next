import mapboxgl from "mapbox-gl";
import {
  isTemporalInfo,
  isTemporalPrecision,
  TemporalClock,
  TemporalPrecision,
} from "@seasketch/geostats-types";
import {
  buildDataTableQuerySearchParams,
  combineSeriesSteps,
  DataTableAggregation,
  dataTableQueryClockParams,
  dataTableQueryFailureFromResponse,
  DataTableQuerySettings,
  isParsedDataTableQuerySeries,
  omitFiltersForColumns,
  ParsedDataTableQuerySeries,
  ParsedDataTableQueryValues,
  parseDataTableQueryGroups,
  parseDataTableQuerySeries,
  temporalSourceFilterColumns,
} from "./dataTableQueryApi";
import { stepKeysForClock } from "./mapTemporal";
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

type CachedQueryResult =
  | ParsedDataTableQueryValues
  | ParsedDataTableQuerySeries;

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
  /** sourceId → generation; stale applyFeatureState calls skip painting. */
  private applyGeneration = new Map<string, number>();
  /** Parsed query results keyed by getQueryKey (url + settings + when). */
  private resultCache = new Map<string, CachedQueryResult>();
  private resultCacheOrder: string[] = [];
  /** Shared in-flight fetches keyed by queryKey. Window fetches pass an AbortSignal. */
  private fetchInFlight = new Map<string, Promise<CachedQueryResult>>();
  /** sourceId → pending Range-query debounce (rejected when the clock moves). */
  private windowDebounces = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; reject: (error: Error) => void }
  >();
  /** sourceId → AbortController for the in-flight Range aggregate query. */
  private windowFetchAborts = new Map<string, AbortController>();

  private seriesCountsByTable = new Map<string, { [step: string]: number }>();
  private onSeriesCountsChange:
    | ((counts: { [tableStableId: string]: { [step: string]: number } }) => void)
    | null = null;
  private onQueryErrorsChange: ((errors: string[]) => void) | null = null;

  private temporalClock: TemporalClock | null = null;

  constructor(mapAccessToken: string | null) {
    this.mapAccessToken = mapAccessToken;
  }

  setTemporalClock(clock: TemporalClock | null) {
    this.temporalClock = clock;
  }

  setMapAccessToken(mapAccessToken: string | null) {
    this.mapAccessToken = mapAccessToken;
  }

  setMap(map: mapboxgl.Map) {
    this.map = map;
    this.applyGeneration.clear();
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

  setOnSeriesCountsChange(
    callback:
      | ((counts: {
          [tableStableId: string]: { [step: string]: number };
        }) => void)
      | null
  ) {
    this.onSeriesCountsChange = callback;
  }

  getSeriesCounts(): {
    [tableStableId: string]: { [step: string]: number };
  } {
    const counts: { [tableStableId: string]: { [step: string]: number } } = {};
    for (const [tableId, value] of this.seriesCountsByTable) {
      counts[tableId] = value;
    }
    return counts;
  }

  setOnQueryErrorsChange(callback: ((errors: string[]) => void) | null) {
    this.onQueryErrorsChange = callback;
  }

  getQueryErrors(): string[] {
    const seen = new Set<string>();
    const errors: string[] = [];
    for (const summary of this.legendSummaries.values()) {
      if (summary.error && !seen.has(summary.error)) {
        seen.add(summary.error);
        errors.push(summary.error);
      }
    }
    return errors;
  }

  /**
   * Drop "already applied" markers. In-flight fetches stay alive so a
   * subsequent apply can reuse them. Prefer {@link reconcileAppliedState}
   * after style updates — not every `setStyle` clears feature-state.
   */
  invalidateApplied() {
    this.applyGeneration.clear();
    this.clearAppliedMarkers();
  }

  private clearAppliedMarkers() {
    this.appliedQueryKeys.clear();
    this.appliedWitnesses.clear();
  }

  private publishLegendSummary(
    sourceId: string,
    summary: DataTableLegendSummary
  ) {
    this.legendSummaries.set(sourceId, summary);
    this.onLegendSummaryChange?.();
    this.onQueryErrorsChange?.(this.getQueryErrors());
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
   * Fetch query results and write feature-state. Instant clocks use one
   * `when.step` series request for the table's full coverage; scrubbing
   * only re-paints from that cache. Window clocks query the selected
   * `[start, end)` as a single aggregate (true mean/sum over the range).
   * Already-painted values stay on the map until the next result arrives.
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
    const query = this.queryWithClock(settings);
    const queryKey = this.getQueryKey(settings.table.queryUrl, query);
    const paintKey = clockAwarePaintKey(
      queryKey,
      this.temporalClock,
      settings.table.temporal
    );

    if (this.appliedQueryKeys.get(sourceId) === paintKey) {
      return;
    }
    // Histogram still needs the full-coverage series while a range query
    // paints. Instant queries *are* that series, so this is a cache hit.
    if (this.temporalClock?.mode === "window") {
      void this.refreshSeriesHistogram(settings, tokenRequired);
    }

    const generation = (this.applyGeneration.get(sourceId) ?? 0) + 1;
    this.applyGeneration.set(sourceId, generation);
    const isCurrent = () => this.applyGeneration.get(sourceId) === generation;
    const sourceReady = () => Boolean(this.map?.getSource(sourceId));
    const isWindow = this.temporalClock?.mode === "window";
    // Drop a pending Range debounce/fetch even when switching back to Instant.
    this.cancelWindowWork(sourceId);
    let didSetLoading = false;

    try {
      const cached = this.resultCache.get(queryKey);
      if (cached) {
        if (!sourceReady()) {
          return;
        }
        await this.paintCached(
          sourceId,
          sourceLayerId,
          settings,
          paintKey,
          cached,
          tokenRequired,
          isCurrent
        );
        return;
      }

      if (isWindow) {
        await this.waitWindowDebounce(sourceId);
        if (!isCurrent()) {
          return;
        }
      }

      const loadingIds = await this.getFeatureIds(settings, tokenRequired);
      if (!isCurrent()) {
        return;
      }
      if (!sourceReady() || !this.map) {
        return;
      }
      const previousSummary = this.legendSummaries.get(sourceId);
      this.publishLegendSummary(sourceId, {
        loading: true,
        scaleMin: previousSummary?.scaleMin ?? 0,
        scaleMax: previousSummary?.scaleMax ?? 0,
        hasZero: previousSummary?.hasZero ?? false,
      });
      didSetLoading = true;
      for (const id of loadingIds) {
        this.map.setFeatureState(
          {
            source: sourceId,
            sourceLayer: sourceLayerId,
            id,
          },
          { loading: true }
        );
      }

      let signal: AbortSignal | undefined;
      if (isWindow) {
        const controller = new AbortController();
        this.windowFetchAborts.set(sourceId, controller);
        signal = controller.signal;
      }
      const parsed = await this.fetchParsed(
        settings.table,
        query,
        tokenRequired,
        signal
      );
      if (!isCurrent() || !sourceReady()) {
        return;
      }
      await this.paintCached(
        sourceId,
        sourceLayerId,
        settings,
        paintKey,
        parsed,
        tokenRequired,
        isCurrent
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (didSetLoading) {
          await this.clearLoadingFeatureState(
            sourceId,
            sourceLayerId,
            settings,
            tokenRequired
          );
        }
        return;
      }
      console.error(error);
      if (isCurrent()) {
        const prev = this.legendSummaries.get(sourceId);
        this.publishLegendSummary(sourceId, {
          loading: false,
          error: error instanceof Error ? error.message : String(error),
          scaleMin: prev?.scaleMin ?? 0,
          scaleMax: prev?.scaleMax ?? 0,
          hasZero: prev?.hasZero ?? false,
        });
      }
    }
  }

  private static RESULT_CACHE_LIMIT = 32;
  /** Wait for the Range thumbs to settle before hitting the engine. */
  private static WINDOW_QUERY_DEBOUNCE_MS = 100;

  /**
   * Drop `loading: true` without wiping already-painted values. A newer
   * apply will set loading or paint; this only prevents a stuck grey state
   * when a Range fetch is aborted after loading markers were written.
   */
  private async clearLoadingFeatureState(
    sourceId: string,
    sourceLayerId: string | undefined,
    settings: ResolvedDataTableVisualizationSettings,
    tokenRequired: boolean
  ) {
    const map = this.map;
    if (!map?.getSource(sourceId)) {
      return;
    }
    const prev = this.legendSummaries.get(sourceId);
    if (prev?.loading) {
      this.publishLegendSummary(sourceId, {
        ...prev,
        loading: false,
      });
    }
    try {
      const ids = await this.getFeatureIds(settings, tokenRequired);
      if (!map.getSource(sourceId)) {
        return;
      }
      for (const id of ids) {
        map.setFeatureState(
          {
            source: sourceId,
            sourceLayer: sourceLayerId,
            id,
          },
          { loading: false }
        );
      }
    } catch {
      // Feature ids are best-effort; the next apply will repair state.
    }
  }

  private rememberParsed(queryKey: string, parsed: CachedQueryResult) {
    if (this.resultCache.has(queryKey)) {
      this.resultCacheOrder = this.resultCacheOrder.filter(
        (key) => key !== queryKey
      );
    }
    this.resultCache.set(queryKey, parsed);
    this.resultCacheOrder.push(queryKey);
    while (
      this.resultCacheOrder.length > DataTableQueryManager.RESULT_CACHE_LIMIT
    ) {
      const evict = this.resultCacheOrder.shift();
      if (evict) {
        this.resultCache.delete(evict);
      }
    }
  }

  private cancelWindowWork(sourceId: string) {
    const pending = this.windowDebounces.get(sourceId);
    if (pending) {
      clearTimeout(pending.timer);
      this.windowDebounces.delete(sourceId);
      pending.reject(new DOMException("AbortError", "AbortError"));
    }
    const controller = this.windowFetchAborts.get(sourceId);
    if (controller) {
      controller.abort();
      this.windowFetchAborts.delete(sourceId);
    }
  }

  private waitWindowDebounce(sourceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.windowDebounces.delete(sourceId);
        resolve();
      }, DataTableQueryManager.WINDOW_QUERY_DEBOUNCE_MS);
      this.windowDebounces.set(sourceId, { timer, reject });
    });
  }

  private fetchParsed(
    table: ClientOverlayDataTableFragment,
    query: DataTableQuerySettings,
    tokenRequired: boolean,
    signal?: AbortSignal
  ): Promise<CachedQueryResult> {
    const queryKey = this.getQueryKey(table.queryUrl!, query);
    const cached = this.resultCache.get(queryKey);
    if (cached) {
      return Promise.resolve(cached);
    }
    const existing = this.fetchInFlight.get(queryKey);
    if (existing && !signal) {
      return existing;
    }
    const promise = this.query(table, query, tokenRequired, signal)
      .then((parsed) => {
        if (signal?.aborted) {
          throw new DOMException("AbortError", "AbortError");
        }
        this.rememberParsed(queryKey, parsed);
        return parsed;
      })
      .finally(() => {
        if (this.fetchInFlight.get(queryKey) === promise) {
          this.fetchInFlight.delete(queryKey);
        }
      });
    if (!signal) {
      this.fetchInFlight.set(queryKey, promise);
    }
    return promise;
  }

  private async paintCached(
    sourceId: string,
    sourceLayerId: string | undefined,
    settings: ResolvedDataTableVisualizationSettings,
    paintKey: string,
    cached: CachedQueryResult,
    tokenRequired: boolean,
    isCurrent: () => boolean
  ) {
    if (isParsedDataTableQuerySeries(cached)) {
      const slice = this.sliceSeries(settings, cached);
      this.publishSeriesCounts(settings.table.stableId, cached);
      await this.paintParsed(
        sourceId,
        sourceLayerId,
        settings,
        paintKey,
        slice,
        tokenRequired,
        isCurrent,
        cached.scaleMin,
        cached.scaleMax,
        cached.hasZero
      );
      return;
    }
    const series = this.cachedSeriesFor(settings);
    if (series) {
      this.publishSeriesCounts(settings.table.stableId, series);
    }
    // Range aggregates fit the legend to this window, not the all-time series.
    await this.paintParsed(
      sourceId,
      sourceLayerId,
      settings,
      paintKey,
      cached,
      tokenRequired,
      isCurrent,
      cached.scaleMin,
      cached.scaleMax,
      cached.hasZero
    );
  }

  private async paintParsed(
    sourceId: string,
    sourceLayerId: string | undefined,
    settings: ResolvedDataTableVisualizationSettings,
    paintKey: string,
    parsed: ParsedDataTableQueryValues,
    tokenRequired: boolean,
    isCurrent: () => boolean,
    scaleMin = parsed.scaleMin,
    scaleMax = parsed.scaleMax,
    hasZero = parsed.hasZero
  ) {
    const map = this.map;
    if (!map || !isCurrent() || !map.getSource(sourceId)) {
      return;
    }
    const range = scaleMax - scaleMin;
    const scaleValue = (value: number) => {
      if (value === 0) {
        return DATA_TABLE_ZERO_SENTINEL;
      }
      if (value < 0) {
        return 0;
      }
      if (range === 0) {
        return 1;
      }
      return Math.min(Math.max((value - scaleMin) / range, 0), 1);
    };

    const featureIds = await this.getFeatureIds(settings, tokenRequired);
    if (!isCurrent() || !map.getSource(sourceId)) {
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
          rawValue: value,
        }
      );
    }

    this.appliedQueryKeys.set(sourceId, paintKey);
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
      scaleMin,
      scaleMax,
      hasZero,
    });
  }

  private queryWithClock(
    settings: ResolvedDataTableVisualizationSettings
  ): DataTableQuerySettings {
    const query = { ...settings.query };
    const temporal = settings.table.temporal;
    if (!tableHasRowTemporal(temporal)) {
      return query;
    }
    query.filters = omitFiltersForColumns(
      query.filters,
      temporalSourceFilterColumns(temporal)
    );
    const params = dataTableQueryClockParams(this.temporalClock, temporal);
    if (params.when) {
      query.when = params.when;
    }
    if (params.whenStep) {
      query.whenStep = params.whenStep;
      query.op = this.opsWithCount(query.op);
    } else {
      delete query.whenStep;
    }
    return query;
  }

  /** Full-coverage `when.step` query used for the histogram (and instant scrub). */
  private seriesQuerySettings(
    settings: ResolvedDataTableVisualizationSettings
  ): DataTableQuerySettings | null {
    const temporal = settings.table.temporal;
    if (!tableHasRowTemporal(temporal)) {
      return null;
    }
    const instantClock: TemporalClock | null = this.temporalClock
      ? { ...this.temporalClock, mode: "instant" }
      : this.temporalClock;
    const params = dataTableQueryClockParams(instantClock, temporal);
    if (!params.when || !params.whenStep) {
      return null;
    }
    const query = { ...settings.query };
    query.filters = omitFiltersForColumns(
      query.filters,
      temporalSourceFilterColumns(temporal)
    );
    query.when = params.when;
    query.whenStep = params.whenStep;
    query.op = this.opsWithCount(query.op);
    return query;
  }

  private cachedSeriesFor(
    settings: ResolvedDataTableVisualizationSettings
  ): ParsedDataTableQuerySeries | null {
    if (!settings.table.queryUrl) return null;
    const seriesQuery = this.seriesQuerySettings(settings);
    if (!seriesQuery) return null;
    const cached = this.resultCache.get(
      this.getQueryKey(settings.table.queryUrl, seriesQuery)
    );
    return isParsedDataTableQuerySeries(cached) ? cached : null;
  }

  private async refreshSeriesHistogram(
    settings: ResolvedDataTableVisualizationSettings,
    tokenRequired: boolean
  ) {
    if (!settings.table.queryUrl) return;
    const seriesQuery = this.seriesQuerySettings(settings);
    if (!seriesQuery) return;
    try {
      const parsed = await this.fetchParsed(
        settings.table,
        seriesQuery,
        tokenRequired
      );
      if (isParsedDataTableQuerySeries(parsed)) {
        this.publishSeriesCounts(settings.table.stableId, parsed);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.warn("Failed to refresh data table series histogram", error);
    }
  }

  private opsWithCount(
    op: DataTableQuerySettings["op"]
  ): DataTableAggregation | DataTableAggregation[] {
    const ops: DataTableAggregation[] = Array.isArray(op)
      ? op.slice()
      : op
      ? [op]
      : ["mean"];
    if (ops.indexOf("count") === -1) {
      ops.push("count");
    }
    return ops.length === 1 ? ops[0] : ops;
  }

  private sliceSeries(
    settings: ResolvedDataTableVisualizationSettings,
    series: ParsedDataTableQuerySeries
  ): ParsedDataTableQueryValues {
    const clock = this.temporalClock;
    const temporal = settings.table.temporal;
    const resolution: TemporalPrecision =
      clock?.viewResolution ||
      (isTemporalPrecision(series.step) ? series.step : "year");
    const coverage =
      isTemporalInfo(temporal) && temporal.coverage?.kind === "interval"
        ? temporal.coverage
        : null;
    const keys =
      clock && coverage
        ? stepKeysForClock(clock, coverage, resolution)
        : clock
        ? [clock.start]
        : [];
    const op: DataTableAggregation = Array.isArray(settings.query.op)
      ? settings.query.op[0]
      : settings.query.op || "mean";
    return combineSeriesSteps(series, keys, op);
  }

  private publishSeriesCounts(
    tableStableId: string,
    series: ParsedDataTableQuerySeries
  ) {
    const counts: { [step: string]: number } = {};
    for (const stat of series.stepStats) {
      counts[stat.step] = stat.rows;
    }
    this.seriesCountsByTable.set(tableStableId, counts);
    this.onSeriesCountsChange?.(this.getSeriesCounts());
  }

  /**
   * Fetches and parses query results. Always resolves to parsed values, or
   * rejects (including AbortError when `signal` is aborted).
   */
  private async query(
    table: ClientOverlayDataTableFragment,
    query: DataTableQuerySettings,
    tokenRequired: boolean,
    signal?: AbortSignal
  ): Promise<CachedQueryResult> {
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
      const failure = await dataTableQueryFailureFromResponse(response);
      throw new Error(failure.message);
    }
    const data = await response.json();
    if (signal && signal.aborted) {
      throw new DOMException("AbortError", "AbortError");
    }
    // Group keys in the response use the table join column (groupBy), not
    // the overlay property name. Values still match promoteId / feature ids.
    const series = parseDataTableQuerySeries(
      data.groups,
      data.series,
      table.joinColumn,
      query.op
    );
    if (series) {
      return series;
    }
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

/** Row-mapped tables are the only ones whose paint depends on the map clock. */
export function tableHasRowTemporal(temporal: unknown): boolean {
  return (
    isTemporalInfo(temporal) &&
    temporal.granularity === "row" &&
    temporal.mapping?.type === "row"
  );
}

/**
 * Feature-state cache key. Clock is only mixed in for row-temporal tables so
 * a shared timeslider does not force every data table to re-paint.
 */
export function clockAwarePaintKey(
  queryKey: string,
  clock: TemporalClock | null,
  temporal: unknown
): string {
  if (!clock || !tableHasRowTemporal(temporal)) {
    return queryKey;
  }
  return `${queryKey}#${clock.mode}:${clock.start}:${clock.end}`;
}
