# Temporal Data in SeaSketch

As SeaSketch is used increasingly to support use cases in MPA Monitoring and Implementation, the visualization and analysis of the temporal component of data will be critical. Currently, simple solutions like having a list of layers representing annual mangrove cover are used, but this has important UX shortcomings and simply does not scale to deeply multidimensional monitoring data. We cannot represent 30 years of counts of 100 species as individual data layers. SeaSketch will need ways to encode and understand both the temporal coverage of spatial layers in their entirety, and the temporal component of individual features, bands, or other within-layer components of data.

There are two goals supported by having temporal information explicitly understood by SeaSketch. One is to improve the UX during map visualization. Activating layers with temporal coverage should open a time-slider, similar to Google Earth, which enables users to scrub through a time series of data, or show features and layers for a defined time-span. The second is to support analytical reports. Right now there are no time-series supporting report widgets because we do not have enough insight into the data sources to support them. While we could have an interface in the report-builder to assign particular overlay sources to particular years directly in that authoring environment, it would make much more sense to instead have the tools recognize sources with temporal coverage and automatically provide a means to represent stats in a time series.

## Data Source Examples

There are a diverse number of data sources SeaSketch could encounter with temporal coverage. These differ in nuanced ways that will be important to support.

- KML layers with TimeStamp or TimeSpan. KML is currently unsupported, but if it were would likely be "exploded" into SeaSketch-native folders, vector, and raster layers. Each of these may have temporal information associated with them.
- Raster or vector layers where the entire layer represent a particular date or span. For example, mangrove cover for 1999, 2000, 2010, 2018, etc. This is very common in current SeaSketch projects, but the year is just represented in the layer title.
- Global Mangrove Watch data is available as a single, global raster with 42 bands. Each band represents annual mangrove coverage. This compact representation would be much easier to upload if SeaSketch could somehow represent it as tiles (COG, MRT, or custom tile service?) and store appropriate metadata to derive temporal coverage.
- Coral Reef Watch also provides similar types of rasters, but also as NetCDF, which has native temporal metadata. We don't take advantage of that currently, and instead just treat uploaded NetCDF as single-band rasters.
- "Data Tables" associated with monitoring sites often represent observations of species size or abundance for a particular year or date.
- Vector uploads (fgb, geojson, shapefile) may have features with timestamps or spans for individual features -- similar to KML. For example, visualize the travel of a tagged white shark over time.
- 3rd-party service integrations. Adding Global Fishing Watch data visualization and exploration is a high-priority for our Waitt projects. Their map-service API supports visualizing data over time, and even controlling how data is aggregated (e.g. annually, monthly, daily, etc). They also support visualizing individual vessel tracks, which we might want to add support for in the future.

## Desired Visualization and Reporting Features

### Map Timeslider

Visualizing layers with temporal metadata on the map should prompt the appearance of a _Timeslider_ control, similar to what is available in Google Earth but adopting any new and useful UI patterns from modern tools. A screenshot review of those tools is in [Timeslider UI References](timeslider-ui-references.md). It should have the following features:

- Users can scrub through points in time or play an animation, for example to visualize change in species abundance over time, or change in mangrove coverage from 1985-2026.
- It should also be possible to show a range of dates, in order to show all layers or features within that span.
- The client should interpret metadata about newly toggled layers, currently visible layers, and UI interaction history and state to decide what moment or timespan should be displayed. For example, it's clear that if nothing else is displayed, and "Mangroves 2020" is shown, the timeslider should show 2020. But what happens if they then toggle "Mangroves 2021", or 1985? Should the timeslider change to show those ranges of dates, the most recent date selected? I'm not sure, but it could be confusing to users if they toggle a layer and nothing is displayed on the map because of the slider settings.
- The slider should be adaptive to the layers displayed on the map. If there are only layers for 2018 - 2020 on the map, a narrow time range should be displayed with only those years selectable. If GFW is turned on, then the time range should expand to the available years of that program.
- Adaptive resolution - If only layers with annual measures are displayed, the timeslider should only show years as options. If viewing something like animal tracker logs with hourly resolution, it will need to control down to the hour. If the source supports aggregating to monthy, yearly, or daily views like the GFW API, we want to show those options, as in the GFW screenshot below: GFW Time Slider Example
- We may also want to aggregation for higher resolution "samples" in Data Tables. For example, monitoring data observations are recorded to the day during annual surveys, but they are really meant to be compared and visualized by year. The timeslider should have some way to show a courser-resolution (year). It may be that temporal layers and data-tables should have a setting to specify dates/times should be treated at a certain resolution by default.
- GFW supports showing aggregate stats on fishing effort in the time slider itself (see screenshot above). The "Data Table" backend could be made to support such dynamic time series visualizations across the entire source.
- Showing stats in the timeslider is a somewhat special case to GFW and Data Table sources. But we could also show representation of layer temporal coverage and/or individual feature temporal coverage and frequency within the time slider to help navigate data.

### Reporting Widgets

Reports using the legacy Geoprocessing Framework already include time-series charts. The new reporting system would replicate these sorts of products using temporal metadata to automatically assign overlay statistics to an appropriate position on the axis.

Global Mangrove Watch Time Series

In the example above, results are calculated from 11 discrete raster layers of annual coverage. In this new system, we could assign temporal coverage metadata to each of these individual layers, or start to use the 42-band mangrove raster to represent all annual measures in a single product. This would be more efficient to setup, but would also mean that if we update the GMW source in the "Data Library", report widgets referencing this source could automatically get annual updates.

As shown above, we also may have use for temporal metadata when displaying "InlineMetric" report widgets. These could calculate stats for a particular annual source, but if we move to a raster-band-per-annum source the widget would need to provide additional configuration to pick stats for the latest year. It might even provide the option to pick a temporal span, so for example the text above the chart could report an average mangrove coverage for all or some subset of years recorded.

Coral Reef Watch Degree-Heating Weeks Time Series

Another example of a time series above. This shows the min, max, and avg of DHW pixels within a zone. The taxonomy of time-series widgets would need to either include distinct widgets for column stats vs overlay-area (and other stats?), or include that choice as a configuration option for a single time-series widget.

## Prior Art

Map UIs, interchange formats, and metadata standards that already model time were reviewed to inform the timeslider and SeaSketch's stored temporal schema.

A screenshot review of these UIs, aimed at the timeslider questions above, is in [Timeslider UI References](timeslider-ui-references.md).

**Map UIs**

- **Google Earth** — the KML timeslider; appears automatically; distinct UX for `TimeStamp` (a moving time window) vs `TimeSpan` (instant transitions between overlays).
- **ArcGIS Online / Pro** — layer `timeInfo` (start/end fields, full extent, default interval). Pro can lock the slider to visible layers and paints gaps where no data exists.
- **QGIS Temporal Controller** — per-layer config, including Fixed Time Range Per Band (the 42-band GMW case).
- **NASA Worldview / GIBS** — date-templated WMTS tiles (`TIME=YYYY-MM-DD`).
- **Cesium / CZML** and **Kepler.gl** — tracks and dense point time series.
- **Global Fishing Watch** — aggregation resolution (hour / day / month / year) as a slider control; aggregate stats in the slider itself.
- **Google Earth Engine**, **MapLibre** — dated raster collections vs client-side attribute filters (MapLibre has no built-in timeslider).

**Formats and metadata**

- **KML** `TimeStamp` / `TimeSpan` (reduced-precision ISO 8601); **GPX** `<time>` per trackpoint; **GeoJSON-T** `when`; **OGC Moving Features JSON** for trajectories.
- **GeoJSON, FlatGeobuf, Shapefile, COG** — no standard temporal member. Time is an attribute, a sidecar, or missing (year in the layer title). Sidecars worth parsing: FGDC/ISO `.xml`, STAC Item `datetime` or `start_datetime`/`end_datetime`, GDAL PAM `.aux.xml`, per-band GDAL tags.
- **netCDF-CF** — the raster exception: a real `time` dimension, which we would still copy onto a COG or into SeaSketch metadata on ingest.
- **WMS-T / WMTS** `TIME`, ArcGIS `timeInfo`, GeoPackage `DATETIME` + `gpkg_metadata`.

### Observations

- **Instant and interval are both required.** KML, STAC, QGIS/ArcGIS, and ISO 19115 all distinguish a moment from a span. SeaSketch should too, at both layer and feature level.
- **Time appears at more than one granularity.** Layer coverage ("this raster is 2018 mangroves"), feature/row time (tracks, survey events), and band/dimension time (GMW band 17 = 2001) all show up in the sources above. A single layer-level year is not enough.
- **Precision should be first-class.** Monitoring data is labeled at year, month, day, or timestamp resolution. KML's reduced-precision ISO 8601 (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or a full timestamp) matches that. STAC and OGC API require RFC 3339 full date-times, so `2018` must become a range or a separate precision field. Do not infer precision only from string width.
- **The formats we already ingest do not carry time.** GeoTIFF `DateTime` is often file modification time, not data time. We will need SeaSketch-native metadata (and, for features, filterable columns — ISO 8601 strings and GeoJSON-T will not work in Mapbox GL expressions).
- **Timesliders appear automatically** when any visible layer is time-enabled. Default extent is usually the union of those layers, sometimes with a lock-to-subset control. Showing where data actually exists along the slider (ArcGIS Pro) is useful coverage/frequency UI for the "toggle a layer and nothing shows" problem.
- **Resolution is both data and view.** Native spacing (annual bands, hourly fixes) is a property of the source. Aggregation (GFW hour/day/month/year; Data Table surveys recorded to the day but compared by year) is a query/display choice over the same data. The timeslider needs both.
- **Ingest can extract, not invent.** KML, STAC, WMS dimensions, and Esri/FGDC sidecars are worth parsing. Filename/title heuristics (how current projects encode year) are a helper, not the stored model. Inclusive vs exclusive end bounds also differ across specs; pick one and document it.

## Temporal Metadata and Data Schemas

This is the proposed system of record. Everything else — timeslider domain and step, Mapbox filters, overlay metrics, admin fields, ingest — should read from it rather than re-deriving time from titles or ad-hoc columns.

The observations above collapse into a small set of rules:

- **Instant and interval are both first-class**, at every granularity (layer, feature/row, band).
- **Precision is a field**, not inferred from string width. `2018` is a year, not midnight on 1 January.
- **Bounds are half-open:** inclusive start, exclusive end (`start ≤ t < end`), as QGIS shows it. Convert inclusive-end formats (KML `TimeSpan`, some ISO 19115, STAC) on ingest.
- **Calendar values are UTC.** Date-only data is a UTC calendar year/month/day, not a project-local timezone. Full timestamps with an offset are converted to UTC on ingest. v1 does not store a source timezone.
- **Metadata is the source of truth.** Feature/row columns and raster band ids are projections of that metadata into a form each renderer can query. Do not treat filename years, GeoJSON-T `when`, or GeoTIFF `DateTime` as stored time.

### Core values

A temporal value is either an instant or an interval, plus an explicit precision. Display and admin editing use reduced-precision ISO 8601, the same lexical convention as KML (`2018`, `2018-06`, `2018-06-15`, `2018-06-15T14:30:00Z`). Comparison, filtering, and the map clock use the **expanded half-open interval** of that value.

```ts
type TemporalPrecision =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second";

/** Reduced-precision ISO 8601. Precision is *not* inferred from this string. */
type TemporalIso = string;

type TemporalInstant = {
  kind: "instant";
  at: TemporalIso;
  precision: TemporalPrecision;
};

type TemporalInterval = {
  kind: "interval";
  /** Inclusive. */
  start: TemporalIso;
  /** Exclusive. `null` means open-ended (through present / latest available). */
  end: TemporalIso | null;
  precision: TemporalPrecision;
};

type TemporalValue = TemporalInstant | TemporalInterval;
```

**Expansion** (the only matching rule):

| Value | Expanded `[start, end)` |
| --- | --- |
| instant `2018` @ year | `[2018-01-01T00:00:00Z, 2019-01-01T00:00:00Z)` |
| instant `2018-06-15T14:30:00Z` @ second | `[14:30:00Z, 14:30:01Z)` |
| interval `2018` → `2020` @ year | `[2018-01-01T00:00:00Z, 2020-01-01T00:00:00Z)` |
| interval `2018` → `null` @ year | `[2018-01-01T00:00:00Z, now)` |

A source, feature, band, or row is **visible** when its expanded interval intersects the map clock interval: `value.start < clock.end && clock.start < value.end`. An instant clock is itself expanded to one step of the current view resolution so “show 2018” is a year, not a zero-width tick.

That expansion is why **annual mangrove cover is an interval, not an instant**. Admin can type `2018`; the stored value is `{ kind: "interval", start: "2018", end: "2019", precision: "year" }`. A tagged-shark ping is an instant. The two kinds also pick timeslider UX (Google Earth’s `TimeSpan` pointer vs `TimeStamp` moving window); matching still goes through the same intersection rule.

Intervals may be open-ended (`end: null`) for living programs such as GFW. The client substitutes “now” or the source’s latest available granule when resolving the clock.

### Source metadata

Store this as JSON on the hosted object that owns the pixels or rows — `data_sources.temporal` for layers, `overlay_data_tables.temporal` for Data Tables — **not** only inside `geostats`. Geostats is regenerated on process and is the wrong place for admin corrections. Raster band stats may *copy* a `when` for convenience; the source of record is still `temporal`.

```ts
type TemporalGranularity =
  | "layer"    // whole source is one instant or interval ("Mangroves 2018")
  | "feature"  // per-vector-feature time (tracks, KML placemarks)
  | "band"     // per-raster-band / raster-array field (GMW, CRW)
  | "row"      // Data Table observations
  | "remote";  // GFW and similar; SeaSketch does not store the time series

type TemporalStep = {
  count: number;
  unit: TemporalPrecision;
};

type TemporalInfo = {
  version: 1;
  granularity: TemporalGranularity;
  /**
   * Union of the source in time. Always an interval (instants are expanded).
   * This is what the timeslider uses for domain and coverage paint.
   */
  coverage: TemporalInterval;
  /**
   * Native spacing of members (annual bands, hourly fixes). Default slider step
   * is the coarsest native resolution among visible sources.
   */
  nativeResolution: TemporalPrecision;
  /**
   * Default *view* resolution. May be coarser than native — survey events
   * recorded to the day but compared by year.
   */
  defaultViewResolution: TemporalPrecision;
  /**
   * Present only if this source can re-aggregate the same data (GFW 4Wings,
   * Data Tables). Do not list values the renderer cannot honor.
   */
  supportedViewResolutions?: TemporalPrecision[];
  /** How members are addressed. Omitted when granularity is `layer`. */
  mapping?: TemporalMapping;
  /**
   * Regular series. Prefer this over listing 42 annual members.
   * `end` is exclusive, same as intervals.
   */
  series?: {
    start: TemporalIso;
    end: TemporalIso | null;
    step: TemporalStep;
  };
  /**
   * Irregular or sparse members, when `series` would lie (1999, 2000, 2010,
   * 2018). Also the place to pin per-band time if the step is not uniform.
   */
  members?: TemporalValue[];
  /** Kepler/GFW-style histogram in the slider is cheap for this source. */
  providesSliderStats?: boolean;
  /** Who last wrote this record. Re-ingest must not clobber `admin`. */
  authoredBy?: "ingest" | "admin" | "heuristic" | "library";
};

type TemporalMapping =
  | {
      type: "feature" | "row";
      startColumn: "_when_start";
      endColumn: "_when_end";
      /** Original columns the wizard / ingest used. */
      sourceColumns?: { instant?: string; start?: string; end?: string };
    }
  | {
      type: "band";
      /** Tileset band id (MRT / raster-array) or 1-based GDAL band index. */
      bands: Array<{ id: string; index: number; when: TemporalValue }>;
    }
  | { type: "remote"; driver: "gfw-4wings" };
```

`coverage` is always an interval so the client never has to guess. For a layer-level year it equals the expanded value. For a 41-year cube it is the union (`1985` → `2026`). For feature tracks it is computed at ingest from the populated columns (min start, max end).

`nativeResolution` and `defaultViewResolution` are the two knobs from the timeslider review. A 42-band annual COG has both set to `year` and **no** `supportedViewResolutions` — the slider must not offer hour ticks. GFW has `nativeResolution: "hour"` and `supportedViewResolutions: ["hour", "day", "month", "year"]`. A Data Table of daily survey samples intended for annual comparison has `nativeResolution: "day"` and `defaultViewResolution: "year"`.

Folders of separate annual layers do not need a parent schema. Each layer carries its own `coverage`; the map clock unions currently visible sources, as in [Timeslider UI References](timeslider-ui-references.md).

### Feature and row columns

Mapbox GL expressions cannot filter GeoJSON-T `when` objects, and they cannot filter *mixed-width* ISO 8601 (`"2018"` vs `"2018-06-15T14:00:00Z"` sorts as a string prefix, not as time). The columns therefore store the **already-expanded** half-open interval as ordinary JSON numbers.

The quantum is **seconds since 1970-01-01T00:00:00Z**. That is enough for tracks (shark pings, vessel fixes) without inventing a millisecond type. A year-precision feature is still just the expanded interval (`2018-01-01T00:00:00Z` → `2019-01-01T00:00:00Z`), not a single midnight instant.

| Column | Type | Meaning |
| --- | --- | --- |
| `_when_start` | number | Inclusive start, UTC seconds since epoch |
| `_when_end` | number | Exclusive end, UTC seconds since epoch |

```
_when_start < clockEndSec && clockStartSec < _when_end
```

**2038 is not a problem for this representation.** The Y2038 bug is signed int32 overflowing at `2^31 − 1` seconds (19 January 2038). JSON numbers, JavaScript, Mapbox GL, and Parquet `timestamp[s]` are IEEE 754 doubles or int64. Seconds stay exact in a double until `2^53` (~year 285 million). Living sources with `end: null` (GFW, “through present”) will be fine in 2038, 2048, and well beyond.

The ingest pipeline must not *down-cast* these columns to 32-bit. Write them as Integer64 (or float64) in FlatGeobuf. Pin tippecanoe with `-T _when_start:int` / `-T _when_end:int` so MVT uses the spec’s int64, not int32 and not float32 (float32 spacing around 2026 is ~128 seconds). Small GeoJSON sources already go through JSON numbers and need no special case. Postgres `integer` (int4) is also int32 — if these ever become first-class columns, use `bigint`.

Do **not** use a single `_when` column. It cannot represent a span, and a year written as one epoch instant would collapse to midnight 1 January. Expansion happens once, at ingest or in the Data Table wizard.

An optional `_when` string (the original reduced-precision ISO) may be kept for popups and labels. It is not a filter key.

For **Data Tables**, Parquet/Arrow `timestamp[s, UTC]` is the matching physical type. The query engine can derive `_when_start` / `_when_end` from that timestamp plus `TemporalInfo.precision`, or persist the two numbers. Dedicated temporal query parameters should use those columns, not raw `YEAR` strings.

### Raster bands

A multi-temporal raster is a `granularity: "band"` source. Each band has a `TemporalValue`. For GMW-style annual cubes, `series` is enough and `mapping.bands[].id` should be the reduced-precision ISO year (`"1985"`, …) so a `raster-array` style can set `raster-array-band` from the map clock without an extra lookup. Irregular or CF-derived times (CRW from NetCDF) list `members` / `mapping.bands` explicitly.

Layer-level single-date rasters (`granularity: "layer"`) do not need band mapping. Visibility is a style show/hide against `coverage`, same as a vector layer with no per-feature time.

### Remote sources (GFW)

GFW does not get `_when_*` columns or a stored cube. Its `TemporalInfo` is a capability descriptor:

```ts
{
  version: 1,
  granularity: "remote",
  coverage: { kind: "interval", start: "2012-01-01", end: null, precision: "day" },
  nativeResolution: "hour",
  defaultViewResolution: "day",
  supportedViewResolutions: ["hour", "day", "month", "year"],
  providesSliderStats: true,
  mapping: { type: "remote", driver: "gfw-4wings" },
}
```

The map clock is translated into 4Wings request params. Report metrics (`gfw_report` and the like) take the same range and aggregation from widget config, defaulting to this descriptor.

### Map clock (client state, not stored on the source)

One clock for the map, as in Cesium/QGIS. Layers subscribe; there is not a slider per source.

```ts
type TemporalClock = {
  /** Derived from visible sources; user can override (range vs instant). */
  mode: "instant" | "window" | "cumulative";
  start: TemporalIso; // inclusive
  end: TemporalIso;   // exclusive; equals start+step in `instant` mode
  viewResolution: TemporalPrecision;
};
```

This is session UI state. It is not part of `TemporalInfo`.

### Worked examples

**Layer-level annual raster** (“Mangroves 2018” as its own upload):

```json
{
  "version": 1,
  "granularity": "layer",
  "coverage": { "kind": "interval", "start": "2018", "end": "2019", "precision": "year" },
  "nativeResolution": "year",
  "defaultViewResolution": "year",
  "authoredBy": "admin"
}
```

**42-band Global Mangrove Watch cube:**

```json
{
  "version": 1,
  "granularity": "band",
  "coverage": { "kind": "interval", "start": "1985", "end": "2026", "precision": "year" },
  "nativeResolution": "year",
  "defaultViewResolution": "year",
  "series": { "start": "1985", "end": "2026", "step": { "count": 1, "unit": "year" } },
  "mapping": {
    "type": "band",
    "bands": [
      { "id": "1985", "index": 1, "when": { "kind": "interval", "start": "1985", "end": "1986", "precision": "year" } }
    ]
  },
  "authoredBy": "ingest"
}
```

(`mapping.bands` can be omitted when `series` plus “band 1 = series.start” is unambiguous. List them when CF/NetCDF times are irregular.)

**Vector track** (tagged shark, per-feature instants):

```json
{
  "version": 1,
  "granularity": "feature",
  "coverage": { "kind": "interval", "start": "2019-03-12T06:14:00Z", "end": "2019-11-02T18:03:01Z", "precision": "second" },
  "nativeResolution": "hour",
  "defaultViewResolution": "day",
  "mapping": {
    "type": "feature",
    "startColumn": "_when_start",
    "endColumn": "_when_end",
    "sourceColumns": { "instant": "timestamp" }
  },
  "authoredBy": "ingest"
}
```

**Data Table** (daily samples, compared by year):

```json
{
  "version": 1,
  "granularity": "row",
  "coverage": { "kind": "interval", "start": "2008", "end": "2025", "precision": "year" },
  "nativeResolution": "day",
  "defaultViewResolution": "year",
  "supportedViewResolutions": ["day", "month", "year"],
  "providesSliderStats": true,
  "mapping": {
    "type": "row",
    "startColumn": "_when_start",
    "endColumn": "_when_end",
    "sourceColumns": { "instant": "DATE" }
  },
  "authoredBy": "admin"
}
```

### What ingest writes vs what admin edits

Ingest fills `TemporalInfo` from native time when it exists (KML `TimeStamp`/`TimeSpan`, netCDF-CF `time`, STAC `datetime` / `start_datetime`/`end_datetime`, Esri `timeInfo`, FGDC/ISO sidecars, per-band GDAL tags) and, for features/rows, materializes `_when_start` / `_when_end`. Filename and title heuristics may *propose* a layer-level year; they are not stored unless confirmed.

Admin can set or correct `coverage`, precision, granularity, and the column/band mapping, then reprocess to rewrite the physical columns. `authoredBy: "admin"` means a later automatic ingest must not overwrite those fields.

### Open questions

- Exact Postgres shape (`temporal jsonb` vs generated columns for `coverage` start/end, to match how `geostats` already fans out `raster_band_count`). JSONB is enough to start.
- Whether MVT also carries a `_when` label string. Useful for popups; not required to render.
- Whether a Data Library product that grows a new GMW year updates `series.end` in place (so report widgets pick up the year) or publishes a new source version. The latter matches current source replace; the former is the “automatic annual updates” hope in Reporting.
- Inclusive-end leftovers after ingest (a STAC end of `2018-12-31T23:59:59Z` must become exclusive `2019-01-01`). Worth a single conversion helper and tests; do not leak mixed conventions into stored JSON.

## Rendering and Analysis Strategies, Constraints

### Map Rendering

- Vector
  - SeaSketch uses MVT & GeoJSON for visualization.
  - Sources with layer-level temporal constraints would have visibility controlled via dynamic style updates. Could be direct modification by the MapContext or a whole getCalculatedStyle cycle.
  - Sources with feature-level time constraints would need to have their visibility controlled by dynamic updates to the mapbox-gl-style. Features must carry the canonical `_when_start` / `_when_end` JSON numbers from [Temporal Metadata and Data Schemas](#temporal-metadata-and-data-schemas) (UTC seconds since epoch, expanded half-open interval). Those are filterable with Mapbox GL expressions; GeoJSON-T and mixed-width ISO 8601 are not. Do not store a single epoch instant — a year-precision value would collapse to midnight 1 January and miss the rest of the year. Do not let tippecanoe encode these as int32 or float32.
- Raster
  - SeaSketch visualizes rasters using PMTile archives of image tiles
  - Like with vectors, layer-level temporal constraints are easy.
  - If we want to support multiple years within the same source, say the 42-band mangrove example with annual coverages, it would probably mean storing a COG and putting and extending pmtiles-server to support some sort of timestamp route-param or querystring, which it then uses to reference the correct band in the cog. Or, instead, we could use an encoding like MRT to directly address the bands from the gl-style. More research needs to be done here. It could yeild huge performance benefits vs creating and view 42 different tilesets for one animation. `raster-array` [Research notes](https://chatgpt.com/share/6a8385cc-0684-83e8-8cc9-c87032f1d86b)
- Data Tables
  - While data tables have a whole-table temporal range, managing visibility on that is not the target. Rather it is visualizing data/observation rows for a given instant, or aggregating data for a time span.
  - Currently, data table rendering relies on a "sites" or features mvt layer, which is then enriched with data queried from data tables via pmtiles-server. Data returned as json is applied to features via `feature-state` as supported by the mapbox-gl-js api. We just visualize by date with a generic dropdown that filters on columns like `YEAR`.
  - Upon upload, csv table data won't have structured temporal data. There may be a "when" column with ISO 8601 dates, or they could just be a YEAR column with a numeric year (or even strings). It could really be anything (or nothing).
  - Like vector features, rows will need to be enriched with `_when_start` and `_when_end` columns that normalize temporal data into the standard half-open interval (UTC seconds). Parquet/Arrow `timestamp[s, UTC]` should be used for the physical instants; the query engine on pmtiles-server should accept dedicated temporal parameters that apply `TemporalInfo` precision and those columns, not raw `YEAR` strings.
  - Admins will need to be provided some sort of "wizard" to identify temporal column(s) and provide needed information necessary to coerce them into normalized data. The tables would then be reprocessed and a new version created with these standard columns populated.
- GFW
  - GFW integration with SeaSketch is a special case that doesn't build on much of the SeaSketch temporal support, other than the timeslider and client temporal context
  - SeaSketch will pull MVT directly from the GFW 4Wings API
  - The "Temporal Context" of the map will be driven by the timeslider, and that context will drive which options are sent to the 4Wings API when fetching tiles.

### Reporting

- Vector
  - Reporting widgets will need to keep track of what data source(s) contribute to a time series
  - For single-temporal range sources (e.g. "Mangroves 2019"), the overlay engine and metrics suffice as-is and it's just a matter of book-keeping on the widget side to organize the data.
  - For sources with per-feature temporal data, the overlay-engine will need to aggregate stats in a single metric by `_when_start` / `_when_end` (or by the expanded interval bucketed at the widget’s view resolution). It is unclear if existing metrics can support this with their types and structure, or if dedicated new metrics need to be created (e.g. `overlay-area-by-when` , `column-stats-by-when`).
  - For these sources with per-feature temporal data, widgets should probably provide the means to set a range of dates they want in the time series, if it is to be a subset of the full dataset. These should probably flow through to the overlay-engine and metrics so that huge metrics aren't slowly calculated on large data sources when not necessary.
- Raster
  - Pretty much all the details related to vector layers apply to rasters, with the difference being that multi-temporal layers are defined by having bands which apply to an instant/timespan instead of individual vector features.
- Data Tables
  - These aren't yet integrating into the reporting system, but it is likely that new metrics will be added to support them, and these will have analogous concerns as Vector and Raster sources with regards to requiring standardized temporal metadata/data, and filtering and aggregation support in the overlay engine and metric parameterization and output types
- GFW
  - GFW integration will likely end up directly pointing SeaSketch to the GFW API, instead of pulling data out of GFW and storing it directly in SeaSketch.
  - The map will pull tiles directly from GFW
  - The reporting system will likely be augmented with new metric types like `gfw_report`
  - Report metric dependencies will be configured with appropriate temporal range and aggregation options that feed through to the GFW 4wings api.

## Data Upload and Ingest

Whenever a supported data source is uploaded to SeaSketch, the system transforms that data into a canonical form (e.g. FGB or COG) and produces a pmtile package for visualization. This system also looks for metadata that can be used to populate the interface, and optionally runs the AI cartographer.

An additional step in this process will need to be added that inspects the data source for native temporal information. So extract TimeSpan or TimeStamp elements from KML, or Esri or FGDC temporal metadata from shapefile xml sidecars for example. This information would be interpreted and transformed into `TemporalInfo` plus `_when_start` / `_when_end` as described above, saving admins the time of manually entering information in the SeaSketch admin interface. We could also use a combination of heuristics and LLM APIs to identify timestamp or time span columns in vector features and use them to populate those standardized columns.

## Administrative Interface

Temporal coverage information should be exposed in the layer admin interface and where possible be editable. There may be mistakes in the source or import process that assigns temporal information, we may have layers that were uploaded before the introduction of the system, or the uploaded layer may just be lacking this information in the uploaded format. For those uploaded rasters of annual mangrove cover, the administrator sets a **year interval** (`2018` → stored as `{ start: "2018", end: "2019", precision: "year" }`), not a timestamp. Instant vs interval is a control in that form; annual coverage defaults to interval.

Beyond just assigning source-level temporal coverage, it may be possible to give admins the ability to identify temporal columns that weren't processed during upload (either due to ai being disabled, heuristics not matching, or an unknown format). Admins could walk thru a "wizard" where they pin down the exact timestamp format, then send the source through the processing workflow once more to create a revision that has populated feature-level temporal columns.
