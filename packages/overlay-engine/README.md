# overlay-engine

Spatial metrics for SeaSketch reports. A sketch is clipped into fragments. Each metric is computed once per fragment (or once per geography) and stored. The client adds those rows back together for the sketch or collection on screen.

The [overlay worker](../overlay-worker) runs the calculations. The [API](../api) reads metric dependencies out of a report body and hashes them. The [client](../client) imports the metric types and `combineMetricsForFragments`. Report widgets are documented in [`packages/client/src/reports/widgets/README.md`](../client/src/reports/widgets/README.md).

`npm run build` compiles TypeScript and bundles the clipping worker (`dist/workers/clipBatch.standalone.js`). `npm test` runs Vitest.

## From a report to a stored row

A widget declares one or more `MetricDependency` values: a metric type, whether the subject is `fragments` or `geographies`, the data-library stable id, and parameters such as `groupBy` or `bufferDistanceKm`.

`extractMetricDependenciesFromReportBody` walks the report's ProseMirror document and collects those dependencies. `hashMetricDependency` turns a dependency into the id stored on the metric row. The hash uses the overlay source URL in place of the stable id, so replacing the file behind a layer misses the cache and the metric is recalculated.

The worker receives one subject at a time.

- A **fragment** subject arrives as geobuf: one polygon, already clipped.
- A **geography** subject arrives as clipping layers. `initializeGeographySources` opens those FlatGeobuf files. The intersection layers define the region. Difference layers are subtracted.

The result is JSON on the metric row. Fragment rows for one sketch are independent, so they can be shared across sketches and collections. `combineMetricsForFragments` is what a widget calls when it has every fragment row for the subject it is displaying.

## Sketches, geographies, and fragments

`prepareSketch` checks that the geometry is a polygon, makes it a MultiPolygon, cleans coordinates, splits it at the antimeridian, and returns the envelopes used to fetch features.

A geography is a list of clipping layers. At least one layer is `INTERSECT`. Further layers may be `DIFFERENCE`. An optional CQL2 filter (`cql2.ts`) limits which features in that file are used. The evaluator supports `=`, `!=`, `<`, `<=`, `>`, `>=`, `like`, `ilike`, `in`, and `and` / `or` / `not`.

`clipToGeography` runs those operations through a `ClippingFn` supplied by the caller. Tests clip in process. A deployment can put the same function on a worker thread. Boolean operations use `polygon-clipping`, and retry with `polyclip-ts` when that library throws "Unable to complete output ring". `OVERLAY_ENGINE_FORCE_POLYCLIP_TS=1` skips straight to the fallback. `setForcePolyclipTs` does the same in tests.

`createFragments` clips the sketch to every geography, splits multiparts, and decomposes overlaps until no two fragments share area. Each fragment is tagged with the geography ids it belongs to. Fragments smaller than 1 m² are dropped.

Sketch collections are held to the same rule. `eliminateOverlap` cuts overlapping sketches into extra fragments, and a fragment can list more than one sketch id. `clipToGeographies` is the entry that also reconciles a sketch with the fragments already stored for its neighbors, so editing one sketch does not multiply fragments forever. When a sketch meets more than one clipping geography, the geography with the larger area is the one the sketch is assigned to.

`unionAtAntimeridian` unions polygons that were split on the date line.

## Metric types

| Type | What it measures | Subject |
| --- | --- | --- |
| `total_area` | Area of a geography, from its clipping layers | Geography. The worker does not implement this for fragments. |
| `overlay_area` | Area of a vector layer inside the subject, in km², grouped by an attribute | Fragment or geography |
| `count` | Feature counts, with a `UniqueIdIndex` so the same id is counted once when fragments are combined | Fragment or geography |
| `presence` | Whether any feature meets the subject | Fragment or geography |
| `presence_table` | The features that meet the subject, up to `maxResults` | Fragment or geography |
| `column_values` | Per-column statistics, and per-feature entries when `includedColumns` is set | Fragment or geography |
| `raster_stats` | Band statistics for a raster window | Fragment or geography |
| `raster_overlay_area` | Area per raster class, in km² | Fragment or geography |
| `ous_demographics` | Ocean Use Survey respondent totals | Fragment or geography |
| `distance_to_shore` | Geodesic distance to the shoreline | Fragment |
| `distance_to_features_over_water` | Route through the water to the nearest point features | Fragment |

`groupBy` is the attribute name for vector metrics. For `raster_overlay_area`, `groupBy: "value"` means one class per rounded pixel value. Omitting it yields a single `"*"` total. More than `MAX_RASTER_OVERLAY_AREA_CLASSES` (32) distinct values throws. That limit is there because grouping a continuous raster by value is a misconfiguration.

`includedColumns` limits which properties `column_values` and `presence_table` keep. For `column_values`, a non-empty list also keeps per-feature entries so statistics combine exactly across fragments. Entries are capped at `MAX_COLUMN_VALUE_ENTRIES` (300). `valueColumn` is the older single-column form.

`sketchClasses` limits which fragments of a collection are included.

`sourceHasOverlappingFeatures` tells the vector clipper that polygons in the source may overlap. Leaving it false allows a faster path that is wrong for sources whose polygons overlap.

## Vector overlay

`overlay_area`, `count`, `presence`, `presence_table`, and `column_values` share `OverlayEngineBatchProcessor`. The worker constructs it directly (`overlay-engine/src/OverlayEngineBatchProcessor`). It is not re-exported from the package index.

The worker opens the source at 5 MB pages and passes it in. The processor builds a `ContainerIndex` on a simplified copy of the subject and streams features whose bounding boxes meet the subject. The index classifies each candidate as inside, outside, or mixed, using a Flatbush index of the boundary. Features that are fully inside or fully outside skip a polygon clip. Mixed features, and anything the classification cannot decide, go to `clipBatch`.

Batches flush once the accumulated feature weight crosses the threshold the worker passes (1 MB of FlatGeobuf bytes). Clipping runs on a pool of worker threads. `npm run build` writes `dist/workers/clipBatch.standalone.js` for that pool. `clipBatch` uses `polyclip-ts`.

`calculateFragmentOverlap` is the previous clipper. It is deprecated. New work goes through the batch processor.

Counts store ids in a `UniqueIdIndex`: sorted ranges plus leftover individuals. `mergeUniqueIdIndexes` combines them without double-counting.

### Buffers and double-counting

Unbuffered fragments of one sketch do not overlap, so their areas, counts, and raster totals add.

`bufferDistanceKm` expands each fragment on its own. Adjacent buffers then cover the same features twice. For `overlay_area` on a **fragment** with a buffer, the processor attaches overlap metadata under the reserved value key `__overlap`: the buffered bbox, collar area per class, and per-feature entries (capped at `MAX_OVERLAY_AREA_OVERLAP_ENTRIES`, 2000). `combineOverlayAreaMetrics` uses that to bound the overcount. The displayed value is the naive sum minus the smallest defensible overcount. A warning is for the cases where that correction is still a range.

The worker skips collar collection when there is no buffer, and for geography subjects. Rows written before this metadata existed combine as a plain sum. The field comments on `OverlayAreaOverlapInfo` in `src/metrics/metrics.ts` are the specification.

`raster_overlay_area` has the same gate and its own overlap type, `RasterOverlayAreaOverlapInfo`.

For a geography with difference layers (EEZ minus land, for example), buffering the intersection polygon alone would still treat the difference layers as holes and drop features that belong in the buffer. The worker materializes the geography, buffers that, and drops the difference sources before clipping.

## Rasters

`calculateRasterStats` summarizes bands with geoblaze: count, sum, min, max, and a histogram. `combineRasterBandStats` sums counts and sums, takes the extrema, and merges histograms. The worker reprojects the window before this function runs. This module does not reproject.

`calculateRasterOverlayArea` turns valid-pixel counts into km² using the geodesic size of one pixel at the window center (`pixelCountsToAreaKm2`). Class keys stay exact. They are not downsampled.

`vrm` is virtual resampling. `"auto"` aims for about 100 m cells and returns a factor of 1 when the native pixels are already finer. A number is used as `[n, n]`. `false` disables it. The default is `"auto"` for fragments and `false` for geographies. Per-axis and memory caps in `resolveVrm` keep geoblaze from allocating arrays it cannot hold.

## Distance to shore

Geodesic, not a route through water. `calculateDistanceToShore` searches the land FlatGeobuf from `src/h3/geodesicNearest.ts`.

- Offshore, the result is `meters` and a `geojsonLine` from the sketch to the nearest shoreline point.
- On land, or touching the shoreline, `meters` is 0 and `shorelineIntersection` is a simplified line of the shoreline inside the sketch. A sketch that sits fully inland has no shoreline in the fragment, so that field is null.
- `minimumDistanceMeters` still returns a short path when the nearest pair is within that distance. It does not return the intersection line.

The distance-to-shore widget does not name a data-library layer. The API fills `https://uploads.seasketch.org/land-big-2.fgb`, and the worker opens that file with 1 MB pages. The metric is implemented for fragments only.

## Distance to features over water

`calculateDistanceToFeaturesOverWater` calls `searchWaterPathNearest`. The route stays in the water. Land occupancy comes from [`@seasketch/h3-land`](../h3-land/README.md). Shoreline polygons from the same land FlatGeobuf carry a route out of a harbor the occupancy archive has filled in.

The default search is 300 km and the closest 3 features. The caps are 400 km and 25 features. `resolution` is `low` (0.02°), `medium` (0.01°), or `high` (0.005°). Omitted means `high`.

`searchWaterPathNearest` is the function the package exports, along with `DEFAULT_WATER_PATH_DISTANCE_KM`, `DEFAULT_WATER_PATH_MAX_RESULTS`, `MAX_DISTANCE_TO_FEATURES_KM`, and `MAX_WATER_PATH_RESULTS`. Older routers remain under `src/h3` (`waterPathTangent`, `waterPathNearestH3`, `waterPathHierarchy`, `waterPathOccupancy`, `waterPathRough`) and are not on the package index. The local viewer imports them by path.

The worker opens the point file and the land file at 1 MB pages with a 256 MB cache, so this metric and distance-to-shore share one land source. It is implemented for fragments only.

[`src/h3/water-path-performance.md`](src/h3/water-path-performance.md) records timings from October 2026. The status note at the top says which of those measurements still match the code.

## Ocean Use Survey demographics

`calculateOusDemographics` streams a survey FlatGeobuf. `OusDemographicsAggregator` keeps, per respondent, the maximum `represented_in_sector` seen and the participant count, then clamps represented people to the number of participants. The same respondent seen twice, or as subdivided parts of one feature, collapses with `Math.max`. Results include a within-subject tally and a dataset-wide total, grouped by the configured column, plus a rollup. `summarizeOusDemographicsValue` and `combineOusDemographicsMetrics` are what the client uses. Required columns and the default group-by are `OUS_DEMOGRAPHICS_REQUIRED_COLUMNS` and `OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY`.

## FlatGeobuf reads

Vector sources, geography clipping layers, and the land file are FlatGeobuf, read through [`fgb-source`](../fgb-source). That package does not cache feature pages. A caller that wants a cache passes its own `fetchRangeFn`. The overlay worker does that in its `SourceCache`, which also keeps an in-flight map so two metrics requesting the same range share one request.

Page size is an option on `createSource` and `SourceCache.get`. One URL is one source, whichever page size opened it first. Vector overlay and geography area use 5 MB pages. The two distance metrics use 1 MB pages so they can share the land source.

## Other exports

`src/index.ts` is the supported surface: sketch preparation, geography clipping, fragment construction, the metric types and their combine functions, `hashMetricDependency`, the calculation entry points, and the water-path constants above.

These stay internal, and the worker imports several of them by path:

- `OverlayEngineBatchProcessor` and `createClippingWorkerPool`
- `ContainerIndex` (`src/utils/containerIndex.ts`)
- `evaluateCql2JSONQuery`
- `src/utils/helpers.ts`, the progress and logging hooks the worker implements
- `src/h3/geodesicNearest.ts` and `src/h3/shorelineIntersection.ts`

`DebuggingFgbWriter` (`src/utils/debuggingFgbWriter.ts`) writes a FlatGeobuf while developing. Its API is in [`src/utils/README.md`](src/utils/README.md). It depends on `gdal-async`, which is a devDependency.

## Tests

`npm test` runs the suite under `__tests__/` plus the shoreline and worker-thread tests under `src/`.

| Area | Where |
| --- | --- |
| Fragment clipping and vector overlay, including distance to shore | `__tests__/overlapping-area-processor/sketchFragmentOverlap.test.ts` |
| Geography area and clipping | `__tests__/geographies.test.ts`, `__tests__/calculateArea.test.ts`, `__tests__/fragments.test.ts` |
| Buffered overlay-area combine | `__tests__/combineOverlayAreaOverlap.test.ts` |
| Column statistics | `__tests__/combineColumnValueStats.test.ts` |
| Raster stats and raster area | `__tests__/geoblazeBandStats.test.ts`, `__tests__/rasterOverlayArea.test.ts`, `__tests__/combineRasterBandStats.test.ts` |
| Ocean Use Survey | `__tests__/ousDemographics.test.ts` |
| Water-path routes | `__tests__/water-path/` |
| Shoreline intersection geometry | `src/h3/shorelineIntersection.test.ts` |

`sketchFragmentOverlap.test.ts` and the water-path tests fetch the published FlatGeobuf files, so they need a network.

## Viewer

`npm run water-path-viewer` serves `viewer/` for debugging routes on a local machine. It is not part of the client.
