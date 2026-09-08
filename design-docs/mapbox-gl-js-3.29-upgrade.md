# Upgrading SeaSketch from mapbox-gl-js 3.4.0 to 3.29.0

SeaSketch’s client is pinned to **mapbox-gl 3.4.0** (May 2024). The CRW MRT demo runs **3.29.0** from the Mapbox CDN because timeslider scrubbing over many-band raster-array tiles is substantially better on post-3.4 GL JS (MRT decoder rewrite, decode-task dedup, better cancellation). See [MRT / raster-array § Timeslider scrubbing performance](temporal-data/mrt-and-raster-array.md#timeslider-scrubbing-performance-2026-09).

This note reviews the official changelog from **3.5.0 through 3.29.0**, then checks those items against the SeaSketch codebase. Target for an upgrade is **3.29.0**, matching the CRW demo — not 3.30.0.

| Package | Current | Target |
| --- | --- | --- |
| `packages/client` `mapbox-gl` | `3.4` → lockfile **3.4.0** | **3.29.0** |
| CRW demo (`packages/data-library-crw/demo/index.html`) | **3.29.0** (CDN) | already there |
| GMW demo (`packages/data-library-gmw/demo/index.html`) | **3.4.0** (CDN) | should follow |
| `packages/pmtiles-server` MRT preview | comments say 3.4 | should follow |
| `packages/api` `mapbox-gl` | **3.3.0** (types only: `Style`, `AnyLayer`, sources) | 3.29.0 + drop `@types/mapbox-gl` |
| `packages/mapbox-gl-esri-sources` | `^3.3.0` + `@types/mapbox-gl` | peer 3.29 + first-party types |
| `packages/gl-style-builder` | `@types/mapbox-gl` 3.1.0 | first-party types |
| `packages/client` `@types/mapbox-gl` | **3.1.0** | **remove** (GL JS ships types from 3.5.0) |
| Client CSS | Tailwind `@import "mapbox-gl/dist/mapbox-gl.css"` compiled into `src/index.css` | rebuild after bump |

Source: [mapbox-gl-js CHANGELOG](https://github.com/mapbox/mapbox-gl-js/blob/main/CHANGELOG.md). 3.7.0 exists in the file as `v3.7.0`; there is no 3.7.x patch line. 3.30.0 is already published but is out of scope here.

---

## What it would take

This is not a one-line dependency bump. The runtime API SeaSketch actually calls is mostly stable; the **build, types, CSS, and plugins** are the work.

1. **Prove the CRA/webpack 4 toolchain can load 3.29’s UMD bundle.** The client is `react-scripts@4` / webpack 4 / Jest 26. 3.29’s `package.json` is `"type": "module"` with an `exports` map; `main` is still `dist/mapbox-gl.js`. Stay on that UMD file. Do **not** switch to `mapbox-gl/esm` (webpack 4 will not handle `import.meta`, lazy raster-array chunks, or named-export ESM). Keep the existing babel ignore of `./node_modules/mapbox-gl/dist/mapbox-gl.js` in `packages/client/craco.config.js`. First gate: `craco start` and a production `craco build`, plus Jest. If webpack’s parser chokes on the UMD file or the worker blob fails at runtime (`An error occurred while parsing the WebWorker bundle` — seen with webpack 4 on 3.8), the fallback is the CSP + `worker-loader` path Mapbox documents, not the ESM entry.

2. **Drop `@types/mapbox-gl` and migrate to first-party typings (3.5.0).** This is the largest code change. Community names SeaSketch uses everywhere (`AnyLayer`, `AnySourceData`, `AnySourceImpl`, `FillLayer`, `FillPaint`, `Expression`, `Style` as a JSON document, `GeoJSONSourceRaw`, `VectorSource` as a *spec*) do not match GL JS’s `*Specification` naming. `skipLibCheck: true` does not save us — our own imports will fail `tsc`. See [Migrating from `@types/mapbox-gl`](https://github.com/mapbox/mapbox-gl-js/issues/13203). Do this in client, api, gl-style-builder, and mapbox-gl-esri-sources together so published `.d.ts` files agree.

3. **Rebuild map CSS.** `packages/client/src/tailwind.css` imports `mapbox-gl/dist/mapbox-gl.css`; `npm run css:build` dumps it into `src/index.css`. A JS bump without that rebuild leaves 3.4 control chrome on a 3.29 map (compass, attribution, new control positions from 3.7).

4. **Keep `mapboxgl.accessToken` and `prewarm()` on the UMD/default import.** 3.25’s “replace `mapboxgl.accessToken` with the Map `accessToken` option” applies to the **ESM** entry. SeaSketch sets the global in `MapContextManager.ts`, `MapboxMap.tsx` (`prewarm()`), and several admin maps. Leave that pattern unless we later move to ESM.

5. **Retarget the style-spec deep import.** `ExpressionEvaluator.ts` and `compileLegend.ts` import `mapbox-gl/dist/style-spec/index.es.js` (Jest aliases it to `.cjs`). 3.29 still ships `dist/style-spec/`. Safer long-term: import `createExpression` from the already-depended `@mapbox/mapbox-gl-style-spec` so we are not coupled to GL JS package internals.

6. **Re-test plugins, not just `new mapboxgl.Map`:**
   - `@mapbox/mapbox-gl-draw` (SeaSketch fork) — digitizing, surveys, geography admin, sketch editor.
   - `@seasketch/mapbox-gl-esri-sources` — image `updateImage`, GeoJSON `setData`, `addImage`.
   - `@mapbox/mapbox-gl-framerate`.
   - Custom `IControl` (`CoordinatesControl`).

7. **QA the map surfaces that share style/state:** project overlay map, sketch editor, surveys, homepage maps (`cooperativeGestures`), basemap editor / cartography split view, MeasureControl, data-table `setFeatureState`, raster `raster-color` layers, heatmaps, ArcGIS dynamic/feature, popups, offline simulator (`api.mapbox-offline.com`).

8. **Do not take the ESM/modular architecture in this pass.** 3.23–3.28 extract raster-array, indoor, models, etc. into lazy ESM chunks. The CRW demo uses the **CDN UMD** `mapbox-gl.js`, which still includes raster-array. Matching that is the point of the upgrade.

Estimate: a day to get a green build if webpack cooperates; a few days of type migration; then a focused QA pass. The type rename is mechanical but touches on the order of 100 files.

---

## Changelog items that matter (3.5.0 → 3.29.0)

Items below are the subset that could affect SeaSketch. Omitted on purpose: indoor maps, procedural buildings, landmark models, precipitation, HD roads, meshopt, appearances (except where they change existing APIs), and other 3D product work SeaSketch does not use.

### Breaking (changelog ⚠️)

| Version | Change | Why it might matter |
| --- | --- | --- |
| **3.5.0** | First-party TypeScript; `@types/mapbox-gl` is incompatible. | SeaSketch imports community types in client, api, gl-style-builder, and esri-sources. |
| **3.9.0** | `featureset` renamed to `target` in `addInteraction` / `queryRenderedFeatures` options. | Only if we pass a `featureset` key. We pass `{ layers: string[] }`. |
| **3.11.0** | `at` no longer interpolates; use `at-interpolated` for the old behavior. | Interactivity outlines index `to-rgba` with `["at", 0\|1\|2\|3, …]` (integers). User-authored styles could use a float index. |
| **3.13.0** | `interpolate` uses non-premultiplied colors; `rgb` returns non-premultiplied-alpha. Called out for `heatmap-color`, `line-gradient`, `raster-particle-color`. | Heatmap editor + gl-style-builder emit `heatmap-color` interpolations. Overlay `raster-color` ramps may shift slightly. |
| **3.14.0** | Imported styles use the **root** style’s `glyphs` URL. | Only if a basemap uses style `imports` (Mapbox Standard / fragments). Typical SeaSketch basemaps are a single style URL or a raster template we assemble. |
| **3.21.0** | Removed `mapbox-gl-unminified.js`. Removed `spriteFormat` map option: **Mapbox styles always use vector icons**; non-Mapbox styles keep raster sprites. | We import `mapbox-gl.js` (fine). We do not set `spriteFormat`. Mapbox-hosted basemaps may look different; SeaSketch overlay sprites should stay raster. |
| **3.25.0** | ESM entry is named exports; `mapboxgl.accessToken` → Map `accessToken` option. | Applies if we import `mapbox-gl/esm`. UMD/default import should keep the global. |
| **3.26.0** | Removed invalid `transition` / `interpolated` flags from `camera-projection`. | We do not set that property. |
| **3.28.0** | `text-variable-anchor` disabled when appearances are present. | We do not use appearances. |
| **3.29.0** | Removed undocumented `Map#addSourceType`. Handler `isEnabled` changes from AND to OR on keyboard / dragRotate / touchZoomRotate. | We never call `addSourceType` (custom sources are image/geojson/vector via `addSource`). We do not call `isEnabled`. |

### Raster-array / MRT (the reason to upgrade)

| Version | Change |
| --- | --- |
| **3.5.2** | Raster-particle decode fixes (internal MRT decoder work immediately after 3.4). |
| **3.6.0** | Fix raster-array flicker from stale tile cache. |
| **3.8.0** | Fix raster-array on some Android devices. |
| **3.14.0** | Multiple `raster` layers from one `raster-array` source; MRT reload errors. |
| **3.15.0** | **`queryRasterValue`**; expired raster-array tile refresh; MRT reload throw. |
| **3.17.0** | Raster-array **broken on iOS &lt; 18.4** — fixed here. Staying on 3.4 would ship that bug when we wire CRW. |
| **3.18.0 / 3.18.1** | `raster-color` interpolation with `nearest`; precision for fine value ranges. |
| **3.19.0** | `RasterArrayTileSource#reload()` fix. |
| **3.27.0** | Raster-array OOB assert on non-mercator projections (we stay mercator). |
| **3.28.0** | Raster-array extracted as a **separate ESM module** (UMD still includes it). |
| **3.29.0** | `raster-color-scale: "log"`; `raster-allow-draping`. |

The client does not add `raster-array` sources yet. These are benefits/risks for the upcoming timeslider binding, not current overlay layers. Current raster interactivity samples PNG tiles in `rasterPixelQuery.ts`, not `queryRasterValue`.

### Types, bundling, package shape

| Version | Change |
| --- | --- |
| **3.5.0 / 3.5.2** | First-party `.d.ts`; stronger event listener types. |
| **3.9.2** | Vite/ESBuild broken-build fix. |
| **3.17.0** | Experimental ESM. |
| **3.19.0** | Native `async/await` in model loading — **exclude GL JS from Babel** (we already do). `browserslist` now states minimum browsers. |
| **3.19.1** | Removed unused `@types/mapbox__point-geometry` that broke some TS builds. |
| **3.21.0** | Official PMTiles `TileProvider` plugin (on-demand). Unminified bundle removed. |
| **3.23.0** | ESM bundle at `mapbox-gl/esm`; `TileProvider` for raster / raster-dem (PMTiles rasters). |
| **3.25.0** | **All runtime deps removed from `package.json`** (bundled). Async `transformRequest` allowed. |
| **3.26.0** | TypeScript declarations made self-contained (`skipLibCheck: false` consumers). |
| **3.27.0** | `import.meta` crash under modern bundlers fixed; wrong access token in **multi-map** environments fixed. |
| **3.28.0** | Dev/debug code extracted from ESM; raster-array extracted. |

### Rendering / style evaluation SeaSketch actually uses

| Version | Change |
| --- | --- |
| **3.5.1** | Reverted default symbol occlusion behind terrain (opt-in via `*-occlusion-opacity`). |
| **3.6.0** | `isSourceLoaded` on `sourcedata` for already-loaded sources; `load` fires when all tiles fail; GeoJSON `dynamic` mode perf; `getLayer` + custom layers. |
| **3.9.1 / 3.9.3** | `queryRenderedFeatures` on custom layers; feature-state on symbols; canvas source after resize. |
| **3.10.0** | Firefox 136+ Mac mouse gestures; popup close button screen-reader. |
| **3.12.0** | `setData` flicker on symbol layers; `styleimagemissing` not firing in some cases. |
| **3.14.0** | GeoJSON memory; `setData` memory spike on large datasets. |
| **3.15.0** | Feature-state expression **performance regression** fixed; transparent color interpolation. |
| **3.17.0** | Dynamic GeoJSON polygon rendering; AttributionControl **sanitizes** HTML. |
| **3.18.0** | Attribution sanitization (again); `dynamic: true` multipolygon query. |
| **3.19.0** | **Incremental `setFeatureState`**; recalculate layers with `visibility: none` when properties change. |
| **3.23.0** | Client-side **fontstack compositing by default**. |
| **3.24.0** | Map destroy memory leak. |
| **3.28.0** | Stop overwriting marker `pointerEvents`; `map.resetFeatureStates()`. |
| **3.29.0** | `resetFeatureStates` in scoped styles. |

### Controls / camera / events

| Version | Change |
| --- | --- |
| **3.5.0** | `style.load` was missing `style` (fixed). |
| **3.6.0** | Compact attribution a11y; `Map#idle()` method (event still exists). |
| **3.7.0** | Control positions `top` / `right` / `bottom` / `left`; `retainPadding` on camera methods (default keeps v3.4 padding). |
| **3.11.0** | `get/setCooperativeGestures` after init. |
| **3.16.0** | Response headers on `sourcedata`. |
| **3.18.0** | GeolocateControl extras (we barely use it). |
| **3.19.0** | NavigationControl regressions **fixed**. |
| **3.25.0** | Keyboard/dragRotate/touchZoomRotate enable/disable pitch, pan, tap-drag-zoom. |
| **3.29.0** | More handler granularity; `isEnabled` OR vs AND. |

---

## Investigation vs the SeaSketch codebase

### High likelihood of regressions

These will almost certainly fail the build, fail types, or change a primary user path unless we do extra work.

1. **First-party TypeScript types (3.5.0)**  
   `MapContextManager.ts` imports `MapboxOptions`, `AnySourceImpl`, `AnySourceData`, `AnyLayer`, `Sources`, `GeoJSONSource`, `Expression`, `VectorSource`, `LineLayer`. The style editor, legends, gl-style-builder, reports, and esri-sources repeat `FillLayer` / `FillPaint` / `HeatmapPaint` / `CircleLayer` / `GeoJSONSourceRaw`.  
   Mapping: `AnyLayer` → `LayerSpecification`, `AnySourceData` → `SourceSpecification`, `AnySourceImpl` → `Source`, `FillPaint` → `FillLayerSpecification['paint']`, JSON `Style` → `StyleSpecification`.  
   **Name collision:** community `VectorSource` is a source *spec*; first-party `VectorSource` is the live source object (`FilterLayerManager.ts`, `BasemapOfflineDetailsPlugin.ts`). Those specs must become `VectorSourceSpecification`.  
   `ExpressionEvaluator` still mentions `StyleFunction` (deprecated zoom/property functions). First-party types may drop that.

2. **CRA webpack 4 + Jest 26 loading a `"type": "module"` package (3.17–3.29)**  
   3.29 `package.json`: `"type": "module"`, `exports["."] → dist/mapbox-gl.js`, `files` still include UMD + `dist/style-spec/`. Webpack 4 does not implement `exports` the way webpack 5 does. Known failure mode on webpack 4 + GL JS 3.8: worker blob parse errors; webpack `Module parse failed: Unexpected token` if acorn hits modern syntax in `dist/mapbox-gl.js`. We already babel-ignore that file, which is necessary but may not be sufficient if webpack still parses it. **This is the first thing to try; it can block the whole upgrade.**

3. **`mapbox-gl/dist/style-spec` deep import**  
   Legend compilation and `ExpressionEvaluator` depend on a private path plus a Jest mapper to `.cjs`. Package `exports` now lists `./dist/*`, which webpack 4 may ignore. If the file moves or ESM-only `.js` is resolved as a module under `"type": "module"`, legends and tests break. Mitigation: switch to `@mapbox/mapbox-gl-style-spec` (already a client dependency at `^14.3.0`).

4. **mapbox-gl-draw (SeaSketch fork) as an `IControl`**  
   `useMapboxGLDraw.ts`, survey `BoundsInput`, `Settings.tsx`, iNaturalist modal, sketch editor. First-party `IControl.onAdd(map: Map)` has historically disagreed with Draw’s typings (`MapboxDraw` not assignable to `IControl`). Runtime: Draw injects GeoJSON sources/layers and custom images — 3.9.2 (user-rendered images), 3.12 (`setData` flicker), 3.21 (vector icons on Mapbox styles) are the versions most likely to interact. Digitizing is a core workflow; treat a green typecheck as insufficient.

5. **Vendored Mapbox CSS**  
   `src/index.css` is a compiled dump of mapbox-gl.css + Tailwind. 3.7 adds control positions; later versions tweak attribution/compass. Shipping 3.29 JS with 3.4 CSS is a guaranteed chrome regression if `css:build` is skipped.

### Medium likelihood of regressions

Plausible user-visible or behavioral changes in code we own. Worth a QA checklist, not a rewrite.

1. **Heatmap and color interpolation (3.13, 3.15, 3.18)**  
   `HeatmapEditor` / `visualizationTypes` / gl-style-builder `heatmap-color`. 3.13’s non-premultiplied `interpolate`/`rgb` is explicitly called out for `heatmap-color`. 3.15 fixes interpolations that include fully transparent stops. Continuous raster ramps use `raster-color` + `raster-resampling: nearest` (gl-style-builder, cartography GUI) — 3.18 changed nearest interpolation. Expect some ramps/heatmaps to look slightly different, especially at transparent ends and class boundaries.

2. **`raster-color` on hosted RGB-encoded rasters**  
   Not raster-array. Current overlays decode via `raster-color-mix` / `raster-value` (`visualizationTypes.ts`, `rasterValueEncoding.ts`, `ClassTableRows`). 3.18.1 “improve `raster-color` precision for fine-grained value ranges” can shift legend-vs-map matching on stretched rasters. Compare a known RGB-encoded layer before/after.

3. **Mapbox-hosted basemap icons (3.21 `spriteFormat` removal)**  
   Default basemap URLs are `mapbox://styles/underbluewaters/...` and user Mapbox styles. Those will always use vector icons now. Overlay sprites (`styleimagemissing` → `addImage` / SeaSketch sprite host) stay raster. Watch for missing icons, wrong sizes, or SDF coloring on **basemap** labels/POIs — not on user marker images, unless a Mapbox style and a custom sprite share an id.

4. **Client-side fontstack compositing (3.23)**  
   Raster-template basemaps set `glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf"`. Multiple fonts in `text-font` are fetched separately and composited on the client. Could change stacking or fail if a fontstack URL that used to be a single composite 404s. Overlay labels on Mapbox glyphs should be checked.

5. **Feature-state (3.15 perf fix, 3.19 incremental updates, 3.9.3 symbol feature-state)**  
   Heavy use: `DataTableQueryManager` (`setFeatureState` after queries), `LayerInteractivityManager` hover/select, geography feature picker, `glStyleUtils` hover/select paint using `["feature-state", "selected"|"hovered"]`. Incremental updates are likely a **win**, but timing vs `setStyle` (the manager already special-cases “not every setStyle clears feature-state”) could change. Data-table proportional symbols and click-highlight are the regression tests.

6. **`isSourceLoaded` / `sourcedata` (3.6)**  
   `LayerStateManager` and `MapContextManager` gate work on `event.isSourceLoaded` and `map.isSourceLoaded`. 3.6 fixed the flag for already-loaded sources — we are still on 3.4, so this is a real behavior change. Could fix races; could also fire listeners that previously no-op’d.

7. **GeoJSON `setData` (3.12 flicker, 3.14 memory, 3.17 dynamic polygons)**  
   ArcGIS feature layers, MeasureControl, sketches, iNaturalist bbox, admin search tiles all `setData`. Large ArcGIS layers are the risk (memory spike). Sketch vertex editing is the flicker risk.

8. **Attribution HTML sanitization (3.17 / 3.18)**  
   We pass HTML strings such as iNaturalist’s `<a href="https://www.inaturalist.org" …>` and Telegeography’s CC license link (`DataBucketSettings.tsx`). Sanitization might strip `target`/`rel` or the whole tag. Check the attrib control on iNaturalist layers and custom HTML attributions.

9. **Popups and markers (3.10 close-button a11y, 3.11 popup position on move, 3.28 marker `pointerEvents`)**  
   Popups are used for interactivity, sketches, iNaturalist, homepage. We do not use `Marker` much. Popup HTML inside `.mapboxgl-popup-content` has a custom click handler in `MapboxMap.tsx` — confirm close button and nested links still work.

10. **NavigationControl / Firefox gestures (3.10, 3.19)**  
    Project map optionally adds `NavigationControl`. Homepage maps set `cooperativeGestures: true`. Firefox-on-Mac users should try pan/pitch. 3.19 fixed NavigationControl regressions — hopefully net-neutral.

11. **Multi-map access token (3.27)**  
    Several maps can exist (project map, cartography split view, basemap editor, surveys, homepage). We set `mapboxgl.accessToken` globally. 3.27 fixed the wrong token being used; UMD should remain global. Split-view and survey maps are the check.

12. **`styleimagemissing` (3.12)**  
    `MapContextManager` listens and loads SeaSketch sprites. A fix for the event not firing is more likely to **help** than hurt, but extra events could mean extra fetches.

13. **Image sources / ArcGIS dynamic (3.9.3 canvas resize; 3.14 restore after context loss)**  
    `ArcGISDynamicMapService` uses `type: "image"` + `updateImage`. Not the removed `addSourceType` API. Still: viewport-sized images + style rebuilds + WebGL context loss are worth a pass.

14. **`queryRenderedFeatures` completeness (3.9.1)**  
    Interactivity and MeasureControl query by `layers`. 3.9.1 restored `source` / `sourceLayer` / `layer` on results. We read those. Unlikely to break; if anything, more complete hits.

### Low likelihood of regressions

Changelog breakages that do not line up with SeaSketch usage, or that are additive APIs.

- **`addSourceType` removal (3.29)** — unused. CustomGLSource adds normal image/geojson/vector sources.
- **`queryRenderedFeatures` `featureset` → `target` (3.9)** — we pass `layers` only; no Interactions API / featuresets.
- **Handler `isEnabled` AND → OR (3.29)** — we never read `isEnabled`. MeasureControl uses `dragPan.disable()` / `doubleClickZoom.disable()` directly.
- **`at` interpolation (3.11)** — production expressions use integer indices into `to-rgba`. Legend compiler understands `["at", i, ["get", prop]]`. Float indices in a user GL style would be exotic.
- **Style `imports` glyphs (3.14)** — assembled styles are a single root; raster templates set glyphs explicitly.
- **`camera-projection` flags (3.26)** — unused.
- **Appearances / `text-variable-anchor` (3.28)** — unused.
- **ESM `accessToken` / named exports (3.25)** — not used if we stay on UMD.
- **Globe, terrain occlusion defaults, clip layers, models, Standard slots, scaleFactor, precipitation, indoor** — we force mercator in spirit (CRW demo sets `projection: "mercator"`; the client never enables globe). Terrain exists as an optional basemap source (`terrain-source`) — 3.5.1 already restored pre-3.5 occlusion defaults, so labels-behind-terrain should match 3.4.
- **PMTiles `TileProvider` (3.21 / 3.23)** — tiles are HTTP(S) from pmtiles-server, not the official client plugin. Optional later; not required for CRW.
- **`queryRasterValue` (3.15)** — future replacement for MRT hover; current raster hover stays on `rasterPixelQuery.ts`.
- **`transformRequest` becoming async-capable (3.25)** — our transformer is sync; still valid.
- **`prewarm()`, `maxPitch: 70`, `logoPosition`** — still supported.
- **`Map#idle()` method (3.6)** — we do not call it (and do not subscribe to the `idle` event in the grep set).
- **Cooperative gestures runtime setters (3.11)** — homepage sets the constructor option only.
- **`retainPadding` (3.7)** — default preserves 3.4 padding; `fitBounds` callers do not opt out.
- **Removed unminified bundle (3.21)** — we never referenced it.
- **3.22 skip map-sessions when `baseApiUrl` is not Mapbox** — offline simulator rewrites `api.mapbox.com` → `api.mapbox-offline.com`; worth a glance, unlikely to throw.

---

## Suggested upgrade sequence

1. In a branch, bump **only** `packages/client` `mapbox-gl` to `3.29.0`. Leave types as-is. Run `craco start` / `craco build`. If the UMD file or worker fails, stop and solve bundling before any type work.
2. Remove `@types/mapbox-gl` from client, api, gl-style-builder, esri-sources. Fix `tsc` using `*Specification` names. Watch `VectorSource` vs `VectorSourceSpecification`.
3. Point `ExpressionEvaluator` at `@mapbox/mapbox-gl-style-spec`. Drop the Jest alias if unused.
4. `npm run css:build` in the client.
5. Leave `import mapboxgl from "mapbox-gl"` and `mapboxgl.accessToken` / `prewarm()` unchanged.
6. QA checklist: draw/digitize, ArcGIS dynamic + feature, data-table feature-state, RGB raster `raster-color`, heatmap, Mapbox basemap POIs/labels, popups, homepage cooperative gestures, split cartography maps, MeasureControl, iNaturalist attribution HTML, Firefox pan/pitch.
7. Bump GMW demo + pmtiles-server MRT preview to 3.29 so every MRT surface matches CRW.
8. Only after UMD 3.29 is in production, consider ESM / `queryRasterValue` / client PMTiles as separate projects.

---

## Out of scope for this bump

- Switching the client to `mapbox-gl/esm` (requires a bundler newer than webpack 4 to be worthwhile).
- Replacing `rasterPixelQuery.ts` with `queryRasterValue` for PNG rasters.
- Official `mapbox-gl-pmtiles-provider` (we already serve tiles over HTTP).
- 3.30.0 (independent pitch/rotation, raster-array client overzoom, 64-source limit). Revisit after 3.29 is stable.
