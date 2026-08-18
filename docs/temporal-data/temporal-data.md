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

## Rendering and Analysis Strategies, Constraints

### Map Rendering

- Vector
  - SeaSketch uses MVT & GeoJSON for visualization.
  - Sources with layer-level temporal constraints would have visibility controlled via dynamic style updates. Could be direct modification by the MapContext or a whole getCalculatedStyle cycle.
  - Sources with feature-level time constraints would need to have their visibility controlled by dynamic updates to the mapbox-gl-style. This means a standard prop must be present like `_when`, or `_when_start` and `_when_end`. It also implies the prop **must be easily filterable via mapbox-gl-style expressions**. A full ISO 8601 string won't work. GeoJSON-T won't work. Likely we'll need to use something like epoch (but probably not that, due to 2038 problem and a host of others...).
- Raster
  - SeaSketch visualizes rasters using PMTile archives of image tiles
  - Like with vectors, layer-level temporal constraints are easy.
  - If we want to support multiple years within the same source, say the 42-band mangrove example with annual coverages, it would probably mean storing a COG and putting and extending pmtiles-server to support some sort of timestamp route-param or querystring, which it then uses to reference the correct band in the cog. Or, instead, we could use an encoding like MRT to directly address the bands from the gl-style. More research needs to be done here. It could yeild huge performance benefits vs creating and view 42 different tilesets for one animation. `raster-array` [Research notes](https://chatgpt.com/share/6a8385cc-0684-83e8-8cc9-c87032f1d86b)
- Data Tables
  - While data tables have a whole-table temporal range, managing visibility on that is not the target. Rather it is visualizing data/observation rows for a given instant, or aggregating data for a time span.
  - Currently, data table rendering relies on a "sites" or features mvt layer, which is then enriched with data queried from data tables via pmtiles-server. Data returned as json is applied to features via `feature-state` as supported by the mapbox-gl-js api. We just visualize by date with a generic dropdown that filters on columns like `YEAR`.
  - Upon upload, csv table data won't have structured temporal data. There may be a "when" column with ISO 8601 dates, or they could just be a YEAR column with a numeric year (or even strings). It could really be anything (or nothing).
  - Like vector features, rows will need to be enriched with `_when`, or `_when_start` and `_when_end` columns that normalize provide temporal data into a standard form. Parquet encodings and the broader ecosystem may have standard ways of storing this sort of temporal information. It should be leveraged, and dedicated temporal query parameters should be added to the query engine hosted on pmtiles-server that leverage this information.
  - Admins will need to be provided some sort of "wizard" to identify temporal column(s) and provide neded information necessary to coerce them into normalized data. The tables would then be reprocessed and a new version created with these standard columns populated.
- GFW
  - GFW integration with SeaSketch is a special case that doesn't build on much of the SeaSketch temporal support, other than the timeslider and client temporal context
  - SeaSketch will pull MVT directly from the GFW 4Wings API
  - The "Temporal Context" of the map will be driven by the timeslider, and that context will drive which options are sent to the 4Wings API when fetching tiles.

### Reporting

- Vector
  - Reporting widgets will need to keep track of what data source(s) contribute to a time series
  - For single-temporal range sources (e.g. "Mangroves 2019"), the overlay engine and metrics suffice as-is and it's just a matter of book-keeping on the widget side to organize the data.
  - For sources with per-feature temporal data, the overlay-engine will need to aggregate stats in a single metric by standard properties (e.g. `_when`, `_when_start`, `_when_end`). It is unclear if existing metrics can support this with their types and structure, or if dedicated new metrics need to be created (e.g. `overlay-area-by-when` , `column-stats-by-when`).
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

*Whene*ver a supported data source is uploaded to SeaSketch, the system transforms that data into a canonical form (e.g. FGB or COG) and produces a pmtile package for visualization. This system also looks for metadata that can be used to populate the interface, and optionally runs the AI cartographer.

An additional step in this process will need to be added that inspects the data source for native temporal information. So extract TimeSpan or TimeStamp elements from KML, or Esri or FGDC temporal metadata from shapefile xml sidecars for example. This information would be interpretted and transformed into the system of record for temporal information in SeaSketch, saving admins the time of manually entering information in the SeaSketch admin interface. We could also use a combination of heuristics and LLM APIs to identify timestamp or time span columns in vector features and use them to populate standardized temporal columns like when, when_start, when_end.

## Administrative Interface

Temporal coverage information should be exposed in the layer admin interface and where possible be editable. There may be mistakes in the source or import process that assigns temporal information, we may have layers that were uploaded before the introduction of the system, or the uploaded layer may just be lacking this information in the uploaded format. For example, if I have those uploaded rasters of annual mangrove cover, I should be able as an administrator to set the layer _timestamp_ as YYYY- (or is it a timespan?).

Beyond just assigning source-level temporal coverage, it may be possible to give admins the ability to identify temporal columns that weren't processed during upload (either due to ai being disabled, heuristics not matching, or an unknown format). Admins could walk thru a "wizard" where they pin down the exact timestamp format, then send the source through the processing workflow once more to create a revision that has populated feature-level temporal columns.
