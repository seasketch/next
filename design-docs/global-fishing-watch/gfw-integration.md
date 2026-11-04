# Global Fishing Watch integration

Notes from 2026-11-04. Companion to [Temporal Data](../temporal-data/temporal-data.md) and [Timeslider UI References](../temporal-data/timeslider-ui-references.md). Supersedes the 2024 `feature-gfw-source-type` branch, which is kept only as reference.

## Goal

Bring Global Fishing Watch (GFW) apparent fishing activity into SeaSketch in a way that feels like gfw.org rather than "a 2024 fishing effort layer uploaded by hand":

1. A **Data Library item** an admin adds to a project. It renders GFW's gridded activity from the 4Wings API on the map, and the map clock (timeslider) scrubs it in time without refetching tiles.
2. A **report widget** that farms overlay analysis out to the 4Wings report endpoint and shows fishing effort over time for a sketch, with the configuration options GFW's own area reports offer (dataset, gear types, flags, distance from port, grouping, period).

Both are driven by the same stored configuration and the same `TemporalInfo` descriptor, so a report widget can point at the project's GFW layer and "show on map" sets the clock to the widget's period.

## Scope

**Phase 1 (spike + first release)** supports **annual** aggregation only: one frame per year, 2012 through the current partial year. Monthly stays in the schema and the proxy allowlist. Turning it on is more than a flag: a monthly tile URL covers at most 2000 days, and its property keys are `year * 12 + monthIndex`. Daily and hourly views are out of scope entirely; the timeslider must not offer them for a GFW source. Visualizing individual vessel tracks is out of scope.

## Why not finish the 2024 branch

`feature-gfw-source-type` (last commit April 2024) added a `gfw-4wings` source type, five `gfw_4wings_*` columns on `data_sources`, a `create_gfw_4wings_source` function, and an `AddGFWSourceModal` under "Add Layer → From Authoritative Sources". It proved several things that are still true: `format=MVT` with `temporal-aggregation=false` and `interval=YEAR` yields one property per year on each cell (`["get", "2023"]` styles the 2023 frame), the `bins` endpoint scales with zoom, and a hover tooltip over cells is straightforward. It also has three problems that make a fresh start cheaper than a rebase:

- The API token is stored on `data_sources.gfw_4wings_token` and interpolated into tile URLs from `REACT_APP_GFW_API_TOKEN`. GFW's [terms](https://globalfishingwatch.org/our-apis/documentation/docs/license-rate-limits) now say the token may not appear in a publicly discoverable web interface, and a leaked token spends the shared quota.
- New columns on `data_sources` require updating the hard-coded column lists in `publish_table_of_contents` and `copy_table_of_contents_item`. Existing columns (`query_parameters`, `temporal`, `tiles`) can carry everything.
- It casts to `'gfw'::interactivity_type`, which does not exist on `master`, and predates the time slider, `TemporalInfo`, and the metrics pipeline it would now build on.

## GFW API facts the design depends on

Checked against the GFW documentation on 2026-11-04. Re-verify during the spike.

| Fact | Consequence |
| --- | --- |
| Current API is **v3**; the map-visualization API is still called **4Wings**. Endpoints: `tile/heatmap/{z}/{x}/{y}`, `report`, `last-report`, `bins/{z}`, `generate-png`, `interaction/{z}/{x}/{y}/{cells}`, `stats`. | Nothing in the old branch's URL shapes is stale except the `v2` bins call. |
| Datasets: `public-global-fishing-effort` (apparent fishing hours, 2012 → 96 h ago), `public-global-presence` (AIS presence hours, 2012 → 96 h ago), `public-global-sar-presence` (detections, 2017 → 5 days ago). All support tiles and reports. | The source type and metric are dataset-agnostic. Phase 1 ships fishing effort; presence and SAR are presets later. |
| **Pipeline v5** released 2026-10-21. `:latest` resolves to v5. The new fishing model is more conservative ("materially lower fishing activity"). `:v3.x` are deprecated. | Store an explicit version (`:v5.0`) in config and include the resolved version in every cache key and dependency hash. Never persist `:latest`. |
| Filters on fishing effort: `flag in (...)`, `geartype in (...)`, `vessel_id`, `distance_from_port_km` (enum 0–5; GFW's map defaults to **3**). | Default `distance_from_port_km=3` so SeaSketch numbers reconcile with gfw.org. |
| Tiles: `interval` ∈ `YEAR`, `MONTH`, `10DAYS`, `DAY`, `HOUR`. `temporal-aggregation=false` returns one value per frame per cell. Source-layer is `main`. Zoom 0–12. Date-range caps, from a 422: hour 10 days, day 366 days, **month 2000 days, year no limit**. | One YEAR tile URL covers 2012–present. A MONTH view of the same span is several URLs of ≤2000 days, not one. |
| `bins/{z}`: zoom > 0 breaks are the zoom-0 breaks divided by 4^z. Confirmed exactly (z5 = z0 / 1024) aside from the leading 0. | One bins call per (dataset, version, filters, interval). Derive other zooms locally. |
| Report: `POST` with a GeoJSON **object** (`{ "geojson": <FeatureCollection> }`; a stringified GeoJSON is `body malformed`) or `GET` with `region-id`/`region-dataset`. Required: `format`, `group-by`, `temporal-resolution`, `datasets[0]`. **`date-range` maximum is 366 days**, including `YEARLY`. `MONTHLY` over one calendar year works and returns `YYYY-MM`, omitting empty months. `spatial-aggregation=true` sums to one row per group per period. Values are sums of hours. Rows are nested: `entries[0]["<dataset>:<version>"]`. | A multi-year series is one request per calendar year. A monthly series for one year is one request. |
| **One concurrent report per token.** A second request returns 429 naming the in-flight report. Recover the last completed report at **`/v3/4wings/last-report`** (not `/report/last`). That endpoint is per token, so only the job that owns the in-flight request may call it. Nothing we ran exceeded 5 s, so 524 was not observed. | Serialized queue. Do not poll `last-report` from a second job. |
| `stats` is worldwide only and returns one row, not a time series. The field name is `ACTIVITY-HOURS` (hyphenated). 2024 came back as 122,061,890 hours. | Slider histograms come from loaded tiles. |
| Quota: **50,000 requests/day, 1.5M/month per user**. Headers `x-ratelimit-daily-*` and `x-ratelimit-monthly-*` are present. They stayed at 0 usage across this whole session, so they lag (the docs say checks run every 30 minutes) and are not a live counter. Tiles respond `cache-control: private, max-age=86400` and `cf-cache-status: DYNAMIC` even on an immediate repeat. | The proxy cache is what makes the quota survivable. Do not treat the rate-limit headers as realtime. |
| License CC BY-NC 4.0. Attribution "Powered by Global Fishing Watch" linked to globalfishingwatch.org on any page or graphic, plus a citation line with dataset, version, date range, and access date for embedded graphics. | Legend, widget footer, and exports all carry attribution. |
| gfw.org's frontend uses deck.gl with a custom `4WINGS` varint tile format and client-side frame aggregation (`libs/deck-loaders/src/fourwings/lib/parse-fourwings.ts` in their repo). | We get the same scrub-without-refetch behavior from MVT per-frame properties and paint expressions; we do not need deck.gl. |

## Spike results (2026-11-04)

Run against `public-global-fishing-effort:v5.0` with a SeaSketch application token. Scripts stayed in `/tmp` and are not in the repo. The token is not recorded here.

### Tiles

`interval=YEAR`, `temporal-aggregation=false`, `date-range=2012-01-01,2026-11-01`:

| Tile | Bytes | Features | Time |
| --- | --- | --- | --- |
| z0 (world) | 782 KB | 3,873 | 1.5 s |
| z5, East China Sea | 1.06 MB | 10,912 | ~2 s |
| z10, same area | 803 KB | 11,185 | ~2 s |
| z7, 2×2 neighborhood, cold / immediate repeat | 3.2 MB total | — | 7.1 s / 0.7 s |

Property keys are the calendar year as a string (`"2012"` … `"2026"`), plus `cell` (number) and `id` (string `"{z}/{x}/{y}/{cell}"`). Years with no activity are **omitted**, not zero, so paint is `["to-number", ["get", year], 0]`. The protobuf feature id is unset; `promoteId` must be the string `id` (`cell` repeats across tiles). Response headers `x-scale: 1` and `x-offset: 0`: the numbers are hours. 2026 is already a frame, so the partial year is in the tiles.

`interval=MONTH` over 2012–present is rejected: `Duration exceeded by interval (hour: 10days, day: 366days, month: 2000days, year: no limit)`. One year of months at the same z5 tile is 807 KB and 8,867 features. Month keys are `year * 12 + monthIndex` (`24288` = January 2024 through `24299` = December 2024), not `"2024-01"`.

`:latest` resolves to v5.0 (`x-datasets`) and omits `x-deprecated-dataset`. Requesting `:v5.0` sends `x-deprecated-dataset: v5.0=v4.0`, and requesting `:v4.0` sends the pair reversed, so that header is a sibling pointer, not "v5 is deprecated." The z0 bin breaks differ between v4 and v5 (top break 6.31e6 vs 8.32e6). Pin `:v5.0`.

### Reports

All of these used `group-by=GEARTYPE`, `format=JSON`, `spatial-aggregation=true` unless noted. A 0.02° polygon in the East China Sea (123.873°E, 28.598°N):

| Request | Result |
| --- | --- |
| 2024, aggregated | 132.273 h in 1.4 s (trawlers 122.31, generic `fishing` 9.96) |
| 2024, gridded HIGH (0.01°) | 14 cells, **sum 132.272 h**. Only 109.4 h have centers inside the polygon |
| 2024, gridded LOW (0.1°) | 2 rows at one cell center, sum 132.273 h |
| 0.005° polygon inside it | 8.626 h aggregated = the full hours of two 0.01° cells, **both centers outside the polygon** |
| 0.2° polygon around it | 20,433.763 h aggregated = the LOW gridded sum. Centers-inside subset is 11,815 h |
| 0.3° "sketch", 2024 | 48,493.7 h in 1.8 s |
| Senegal EEZ, `region-id=8371`, `region-dataset=public-eez-areas`, 2024 | 153,313.8 h in 2.0 s |
| 2022–2025 and 2012–2026 | 422, `Maximum of 366 days time range supported` |
| 2026-01-01 → 2026-11-04 | 200, `date: "2026"`, ~154 h in 4.4 s. A partial year can already exceed a previous full year |
| `temporal-resolution=MONTHLY` for calendar 2024 | 200 in 0.9 s, dates `2024-01` … `2024-12` with empty months omitted, sum 132.272 h |

`spatial-aggregation=true` equals the sum of **whole cells that intersect** the polygon. It is not centroid-in and it is not area-weighted. A sketch smaller than a cell receives the whole cell, and two polygons that share an edge both receive the boundary cell.

`filters[0]=flag in ('CHN')` dropped the 0.02° total from 132.27 h to 128.55 h. `distance_from_port_km > 3` was accepted there and returned the unfiltered total; that cell is offshore, so this did not prove the predicate. `vesselIDs` is a count of vessels in the group, not a list.

Two overlapping POSTs: the second returned 429 in 271 ms while the first finished 200. The body names the in-flight report and points at `apis@globalfishingwatch.org` for higher concurrency. `GET /v3/4wings/last-report` then returned that completed report.

### What this changes

- Phase 1 map: one YEAR tile URL per layer config. Missing years are 0. `promoteId: "id"`.
- Phase 2 map: MONTH needs a date window of at most 2000 days, and paint keys are `year * 12 + monthIndex`.
- Reports are one **calendar year** per call (a leap year fits in 366 days). A 14-year series is 14 calls. Monthly-within-a-year is one `MONTHLY` call, not twelve.
- Do the report on the **sketch union**, not on each fragment. Whole-cell intersection would double-count every shared edge, and fragment × year × a one-at-a-time token does not finish. Cache each completed year forever; recompute the partial current year on its own hash.
- `gfw-aggregated` is the phase 1 subject model. It matches gfw.org and these calls all returned in under 5 s. `gridded-clipped` stays possible later: HIGH rows carry `lat`, `lon`, and `hours` at 0.01°. The widget says that a small sketch is counted as the cells it touches.
- `spatial_metrics` RLS finds the sketch through `sketch_fragments` (`check_sketch_rls_policy` on `fragment_hash`). A union is not a fragment, so `gfw_report` needs its own subject, `subject_sketch_id`, beside the existing geography subject. The reports plugin must not expand this metric across fragments.

## Architecture

### 1. Proxy worker

All browser and Lambda traffic to `gateway.api.globalfishingwatch.org` goes through a SeaSketch-controlled proxy. Model it on the allowlisted WoRMS taxonomy proxy in `packages/pmtiles-server` (Cache API, allowlisted routes, not an open proxy). It can live in that worker under a `/gfw/` prefix or as its own worker; the deciding factor is whether tile isolates should share a cache namespace with the rest of `uploads.seasketch.org`.

Responsibilities:

- Hold the GFW token as a `wrangler secret`. Add `Authorization: Bearer` on the way out; never echo it.
- Accept only an allowlist: dataset ids and versions we support, `interval ∈ {YEAR, MONTH}`, `format=MVT`, `temporal-aggregation=false`, `filters[0]` built from a validated structure (not free text), `date-range` snapped to interval boundaries.
- **Canonicalize** the upstream URL (sorted params, normalized filter text, snapped dates) so every SeaSketch user and project hitting the same configuration hits the same cache entry.
- Cache tiles. Ranges entirely in the past can be cached for weeks. The trailing frame (current year) changes daily; cache it for a few hours.
- Proxy `bins/{z}` and, later, `interaction` with the same allowlist.
- Record upstream `x-ratelimit-*` headers to a metric (Cloudflare analytics or a KV counter) so quota exhaustion is visible before a 24 h block.
- Return GFW 4xx/5xx as-is with the token stripped.

The report path does not use the worker for the request itself (reports are server-to-server from the overlay path) but does use the same allowlist code to build parameters. The Lambda reads the token from Secrets Manager the same way it reads `overlayEngineAccessTokenSecret` in `packages/infra/lib/OverlayWorkerLambdaStack.ts`. Add the variable to the secrets classification in [secrets-management](../dev-environment/secrets-management.md) as production-only, and update the GFW row in [service-inventory](../dev-environment/service-inventory.md).

### 2. Source type and Data Library item

Add `gfw-4wings` to `data_source_types`. Do not add columns. Reuse:

| Column | Content |
| --- | --- |
| `type` | `gfw-4wings` |
| `query_parameters` (jsonb) | `GfwSourceConfig` below. Add `gfw-4wings` to the `query_parameters` check in the `data_sources` validation trigger (currently `arcgis-vector`, `arcgis-dynamic-mapserver`, `inaturalist`). |
| `temporal` | The remote descriptor below. |
| `tiles` | One proxy URL template. The manager rewrites the query string from `query_parameters` and the clock, so the stored value is informational. |
| `minzoom`, `maxzoom` | 0 and 12. |
| `attribution` | `<a href="https://globalfishingwatch.org">Powered by Global Fishing Watch</a>` |

```ts
type GfwSourceConfig = {
  version: 1;
  dataset: "public-global-fishing-effort" | "public-global-presence" | "public-global-sar-presence";
  /** Explicit, e.g. "v5.0". Never "latest". */
  datasetVersion: string;
  filters: {
    flags?: string[]; // ISO3
    geartypes?: string[]; // GFW gear type ids
    vesselTypes?: string[]; // presence dataset
    distanceFromPortKm?: 0 | 1 | 2 | 3 | 4 | 5; // fishing effort only; default 3
  };
  /** Which intervals this layer may request. Phase 1 stores ["YEAR"]. */
  intervals: Array<"YEAR" | "MONTH">;
  /** Optional rendering hints: ramp name, opacity. */
  style?: { ramp?: string };
};
```

Temporal descriptor, per the worked example in [Temporal Data](../temporal-data/temporal-data.md#remote-sources-gfw) but narrowed to this scope:

```json
{
  "version": 1,
  "granularity": "remote",
  "coverage": { "kind": "interval", "start": "2012-01-01", "end": null, "precision": "day" },
  "nativeResolution": "month",
  "defaultViewResolution": "year",
  "supportedViewResolutions": ["year"],
  "providesSliderStats": true,
  "mapping": { "type": "remote", "driver": "gfw-4wings" },
  "authoredBy": "library"
}
```

Enabling monthly later means `supportedViewResolutions: ["month", "year"]` and `intervals: ["YEAR", "MONTH"]`. `supportedViewResolutionsForSources` in `packages/client/src/dataLayers/mapTemporal.ts` intersects the lists of visible sources, so a GFW layer never causes the slider to offer day even beside a daily Data Table. The worked example in the temporal design doc should be updated to say day is not offered.

**Data Library card.** Follow the iNaturalist pattern (card → configuration modal → project-local item) rather than the superuser-template copy, because each project wants its own filters. `DataLibraryModal.tsx` gets a "Global Fishing Watch" card whose modal has: dataset (phase 1: fishing effort only, others disabled with a note), gear types (multi-select from GFW's list), flags (multi-select), distance from port (default 3 km), title. It calls a new `create_gfw_4wings_table_of_contents_item(slug, params jsonb, title text, metadata jsonb)` function in `current.sql` modeled on `create_inaturalist_table_of_contents_item`, which inserts the source, a `data_layers` row with a default style, and the TOC item, and stamps `copied_from_data_library_template_id = 'GFW_FISHING_EFFORT'` so report commands can find the project's GFW layers the way Distance to Port finds `WORLD_PORTS` (see `packages/api/src/DataLibrary/README.md`). Several GFW layers per project are allowed. Default metadata (ProseMirror doc) carries the dataset description, the caveats link, and the citation line.

The preview-map modal from the 2024 branch (`AddRemoteServiceMapModal` with a live GFW layer and legend) is the right shape for this modal.

### 3. Map rendering and the time slider

The slider controls two independent channels. `MapTemporalStateContext` already separates them:

- **Domain and resolution → tile URL.** Phase 1 uses `interval=YEAR` and `date-range=2012-01-01,<today>`, which the API allows with no length cap, so there is one tile set per layer config. Monthly (phase 2) is capped at 2000 days, so that view is several windows, not one URL.
- **Clock → paint expression.** Each cell carries one property per frame. Year keys are `"2012"`; a missing key means no activity. Instant mode styles `["to-number", ["get", "<year>"], 0]`. Window mode sums those expressions. Cumulative mode sums from the domain start. A mean-over-window option divides by the number of years. A clock tick is `setPaintProperty`; no tiles are refetched. Set `promoteId: "id"` (the string `{z}/{x}/{y}/{cell}`). Month keys, when enabled, are `year * 12 + monthIndex`.

Implementation lives in `MapContextManager.getComputedStyle()` as a new style-computation input, the path the temporal design doc reserves for "remote (4Wings tile params from the clock)". `setTemporalClock` (today it drives Data Table queries) also updates remote paint. `tocIdsHiddenByClock` keeps ignoring remote sources; they are never clock-hidden, only re-expressed. Add `GFW_4WINGS` to `PRELOADABLE_SOURCE_TYPES` in `mapTemporalStyle.ts` so opacity transitions snap the way other preloaded sources do.

Other rendering details:

- **Zoom normalization and legend.** Cell values grow with cell area. Call `bins/{z=0}` once per config (through the proxy, cached) and derive the other zooms with the documented 4^z rule, or compute breaks from `querySourceFeatures` on loaded tiles. The legend shows hours with the frame label ("hours fished, 2023"). Phase 1 uses a fixed sequential ramp (the AI cartographer prompt already prefers `interpolatePlasma` for GFW effort).
- **Current partial year.** The last frame is year-to-date, lagging ~96 h, and it is already in the tiles. Legend, tooltip, and the slider label say so ("2026, through Nov 4"). A partial year can already exceed a previous full year, so the label is there for comparison, not because the value is always smaller.
- **Hover.** Tooltip with hours for the clock's frame(s), as in the 2024 branch. Click → `interaction` for contributing vessels is phase 3 because it costs requests.
- **Attribution.** The `attribution` column feeds the Mapbox attribution control; the legend entry also carries the linked "Powered by Global Fishing Watch" text.
- **Slider histogram.** `providesSliderStats: true`, but `stats` is worldwide-only, so compute per-frame totals from loaded tiles (`querySourceFeatures`, summed per frame key) and publish them through the same channel the Data Table `queryStepCounts` use. It is a viewport approximation and is labeled as such.
- **Viewer filters.** gfw.org lets viewers change gear and flag live. Each change is a new tile set. Phase 1 is admin-configured only; a small viewer filter panel in the legend is phase 3.

### 4. `gfw_report` metric and widget

**Metric type.** Add `gfw_report` to `MetricType` in `packages/overlay-engine/src/metrics/metrics.ts` and to the `spatial_metric_type` enum. Parameters (on `MetricDependencyParameters` or a nested `gfw` object):

```ts
type GfwReportParameters = {
  dataset: GfwSourceConfig["dataset"];
  datasetVersion: string; // explicit
  filters: GfwSourceConfig["filters"];
  /** Inclusive start / exclusive end, year or month precision. */
  dateRange: { start: TemporalIso; end: TemporalIso };
  temporalResolution: "YEARLY" | "MONTHLY" | "ENTIRE"; // phase 1 offers YEARLY and ENTIRE
  groupBy: "FLAG" | "GEARTYPE" | "FLAGANDGEARTYPE"; // API requires one; sum groups for a total
  /** See subject model below. */
  spatialMode: "gfw-aggregated" | "gridded-clipped";
};
```

Result shape: `{ series: Array<{ date: string; values: { [groupKey: string]: number }; vesselIds?: { [groupKey: string]: number } }>, unit: "hours" | "detections", datasetResolved: string, accessedAt: string, partialLastPeriod: boolean }`. `vesselIDs` on each GFW row is a count. One row is the whole sketch for one calendar year. A collection sums child sketches in the widget; where two sketches touch, the shared cell is counted twice, and the footer says so.

**Source URL and hashing.** `resolve_spatial_metrics_batch` requires an `overlaySourceUrl` for non-`total_area` types. Use a synthetic `gfw://public-global-fishing-effort:v5.0` the way `distance_to_shore` defaults to the land FGB URL in `packages/api/src/plugins/reportsPlugin.ts`. `hashMetricDependency` then keys the metric by dataset and version, so a pipeline bump invalidates cached metrics. Date ranges are stored as explicit ISO values in parameters; relative ranges ("last 3 years") are resolved to year or month boundaries when the widget is inserted or edited, not at calculation time, so hashes are stable.

**Dispatch.** `calculateSpatialMetricsBatch` fans out to the overlay-worker Lambda at 128-way concurrency. GFW metrics leave that path: the batch task skips `gfw_report` rows and enqueues one `calculateGfwReportMetric` graphile-worker job per metric with `queue_name = 'gfw-report'` (the same serial `queue_name` pattern as `geostats_pii_backfill` and `tiles_acl_backfill`). Each job is **one calendar year of one sketch or geography**. It POSTs `{ geojson: <FeatureCollection object> }` with `spatial-aggregation=true`. A 429 means another job broke the queue; requeue with backoff and do not call `last-report` unless this job is the one in flight. A 524, which we did not observe, is recovered with `GET /v3/4wings/last-report` from that same job only. Completed years are immutable. The current partial year puts the UTC date it runs through into the dependency hash so it refreshes daily. If GFW grants higher concurrency, raise the limiter.

**Subject model.** Phase 1 is `gfw-aggregated` on the **sketch union**, not on fragments. The spike showed `spatial-aggregation=true` equals the sum of whole intersecting 0.01° cells, including cells whose centers fall outside the polygon. Splitting into fragments would count each shared edge twice, and a 14-year series times the fragments of a sketch would be hundreds of serial calls. A collection sums child-sketch totals and the footer notes boundary cells. `gridded-clipped` (HIGH rows, area-weighted) stays a later option for sketches smaller than a cell; it will not match gfw.org.

Geography subjects use `subject_geography_id` and POST the geography polygon. A GFW `region-id` is faster to cache on their side when we have one (Senegal EEZ `8371` returned in 2 s) but SeaSketch geographies do not carry those ids, so the polygon is the general path.

`spatial_metrics` authorizes a row by joining `subject_fragment_id` to `sketch_fragments`. A union hash is not a fragment, so add `subject_sketch_id` and extend the exclusive-subject check and the RLS policy. The reports plugin creates one `gfw_report` row per sketch per year and does not expand it across fragments. The widget's "% of the geography" figure is a second metric on the geography subject.

**Widget.** A block widget `GfwFishingActivity` under `src/reports/widgets/` following the README conventions:

- Time series of annual totals via `TimeSeriesChart` (line or bars; grouped series need a stacked mode, which is a small addition to that chart). A summary table with total hours, hours by group, and % of geography. Collection breakdown through `useCollectionSketchExpand` and `sketchContributionsForClassTableRow`.
- Tooltip controls: dataset (phase 1 fixed), period (year pickers), temporal resolution (YEARLY / ENTIRE in phase 1), group-by, filters popover, linked layer (`LayerPickerDropdown` filtered to `copiedFromDataLibraryTemplateId = GFW_*`), and a `TooltipMorePopover` naming the widget type and holding `spatialMode`.
- Slash command: "Fishing activity (Global Fishing Watch)". If the project has a GFW layer, the command prefills from its `query_parameters` and links it; otherwise it offers to add one from the Data Library the way Distance to Port offers World Ports.
- **Show on map**: toggles the linked layer through `useReportStyleToggle` and calls `setClock` with the widget's period in window mode.
- Footer: "Powered by Global Fishing Watch" link and the citation line (dataset, version, date range, accessed date), plus caveats: apparent fishing activity is model-derived, v5 classifies many vessels as generic `fishing`, AIS coverage gaps, 96 h latency, hours are whole intersecting 0.01° cells (a small sketch gets the full cell; adjacent sketches can share a boundary cell), and the last year is partial.
- Inline presentation in `InlineMetric`: "1,240 fishing hours (2024)".
- Exporter registered in `exports/registry.ts`; rows are the flat series with `scope`, `date`, group key, and value, and the citation line goes in the manifest.
- Print mode: nothing hidden behind tabs in phase 1.

## Alternatives considered

- **Port GFW's deck.gl `FourwingsLayer`** through a `MapboxOverlay`. Highest fidelity, but a second rendering system beside a deliberately centralized `MapContextManager`, a larger bundle, and a dependency on packages coupled to GFW's app state.
- **PNG tiles via `generate-png`.** Simplest layer, but every clock tick refetches tiles (quota), there is no hover, and no client-side aggregation.
- **Bulk ingest** of GFW's 0.1° daily effort into an annual or monthly COG/MRT stack. Reuses `RasterTimeSeries` and raster metrics with no runtime quota or token, but loses gear and flag filtering, HIGH resolution, presence and SAR datasets, and freshness, and band-level map-clock support is not implemented yet. Keep as an offline fallback story.

## Phase plan

### Phase 0: spike

A throwaway script (not committed to the repo) run with a personal token.

- [x] Confirm `interval=YEAR`, `temporal-aggregation=false` MVT property keys and `id` format at z0, z5, z10. Record a MONTH tile's size at the same zooms for the later decision.
- [x] Call `bins/0` for the default config and confirm the 4^z rule against `bins/5`.
- [x] Run `report` on a small polygon (smaller than a 0.1° cell) with `spatial-aggregation=true` and with `=false` at HIGH, and compare. Decide `gfw-aggregated` vs `gridded-clipped`.
- [x] Time reports for a typical sketch, a large geography, and `temporal-resolution=YEARLY` over 2012–present. Note any 524.
- [x] Fire two reports concurrently; record the 429 body and `last-report` behavior.
- [x] Count requests from a realistic map session (pan and zoom over a region for a minute) to size the cache and quota.
- [ ] Email `apis@globalfishingwatch.org`: confirm SeaSketch's non-commercial use and request a partner token with higher report concurrency. Cell membership is answered by the spike (whole intersecting cells).

### Phase 1: annual layer and report

- [ ] Proxy routes, allowlist, canonicalization, caching, quota metric, token secret.
- [ ] `gfw-4wings` source type, `query_parameters` constraint, `create_gfw_4wings_table_of_contents_item`, Data Library card and modal, `GFW_FISHING_EFFORT` template id documented in `packages/api/src/DataLibrary/README.md`.
- [ ] `getComputedStyle()` remote input: tile URL from config, paint from clock (instant, window, cumulative). Legend from `bins`, hover tooltip, attribution, partial-year labels.
- [ ] Slider histogram from loaded tiles.
- [ ] `gfw_report` metric type, `subject_sketch_id`, parameters, hashing, serialized worker task with 429/524 handling, one calendar year per row, synthetic source URL.
- [ ] `GfwFishingActivity` widget, inline presentation, slash command, show-on-map, exporter, attribution footer and caveats.
- [ ] Update the GFW worked example in [Temporal Data](../temporal-data/temporal-data.md) and the GFW row in [service-inventory](../dev-environment/service-inventory.md).
- [ ] Golden snapshot: none required. The card creates project-local items; no superuser template is seeded.

### Phase 2: monthly

- [ ] Flip `supportedViewResolutions` and `intervals`. Allowlist `MONTH`, with date windows of at most 2000 days. Paint keys are `year * 12 + monthIndex`. A one-year monthly tile at z5 was 807 KB.
- [ ] `MONTHLY` in the widget's resolution control. One report call covers a calendar year (`date` comes back as `YYYY-MM`); a longer monthly series is one call per year.

### Phase 3: closer to gfw.org

- [ ] Presence and SAR datasets as presets in the card and widget (unit becomes detections for SAR).
- [ ] Cell click → `interaction` → contributing vessels.
- [ ] Viewer-side gear and flag filter panel in the legend.
- [ ] Relative periods ("last 3 full years") with a scheduled refresh that re-resolves and recalculates.

## Open questions

- Whether GFW will grant partner concurrency. Until then the queue is serial, and the widget's loading state should say it is waiting on that queue. A 14-year sketch is about 14 calls; the calls we timed were 1–4 s, so a cold sketch is on the order of a minute if nothing else is queued.
- How `distance_from_port_km` is spelled so it actually filters. `> 3` was accepted and, on an offshore cell, changed nothing. Confirm against a nearshore polygon before defaulting the layer to 3 km.
- Polygon complexity. The spike used simple boxes and one EEZ region id. A detailed coastline sketch was not timed, and GFW has not documented a vertex limit. Simplify with the overlay worker's tolerance if a real sketch is slow or rejected.
- Whether low-zoom tile hours are raw sums. `x-scale: 1` and `x-offset: 0`, and `bins/{z}` divides by exactly 4^z, which is what raw sums of quartered cells look like. The legend can use the derived breaks. Confirm visually against gfw.org once the layer renders.
