# @seasketch/mapbox-gl-wms-source

Easily add OGC WMS services to Mapbox GL JS maps. This package provides two `CustomGLSource` implementations (tiled and dynamic viewport image), a WMS GetCapabilities parser, and framework-agnostic helpers for catalog browsing, legends, metadata, and GetFeatureInfo.

## Examples

Run the interactive playground:

```bash
cd packages/mapbox-gl-wms-source
cp .env.example .env   # add VITE_MAPBOX_TOKEN
npm run playground
```

## WMS Tiled

Mapbox GL JS can render WMS as a native raster source using the `{bbox-epsg-3857}` tile placeholder:

```js
map.addSource("wms", {
  type: "raster",
  tiles: [
    "https://example.com/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=layer1&STYLES=&CRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}"
  ],
  tileSize: 256,
});
map.addLayer({ id: "wms", type: "raster", source: "wms" });
```

For sublayer visibility/order updates and HiDPI support, use `WMSTiledSource`:

```ts
import { WMSTiledSource } from "@seasketch/mapbox-gl-wms-source";

const source = new WMSTiledSource({
  url: "https://geo.vliz.be/geoserver/MarineRegions/wms",
  supportHighDpiDisplays: true,
  tileSize: 256,
});
await source.prepare();
source.updateLayers([
  { id: "eez", opacity: 1 },
]);
await source.addToMap(map);
const { layers } = await source.getGLStyleLayers();
map.addLayer(layers[0]);
```

With `supportHighDpiDisplays: true`, each GetMap uses higher `WIDTH`/`HEIGHT` while
the Mapbox tile grid stays at `tileSize` (256 by default).

Tiled sources use Mapbox's **custom raster source** so in-flight GetMap requests are
**aborted** when tiles scroll off-screen, and by default **no new GetMap requests
are sent while panning or zooming** — parent tiles stay visible until `moveend`.
Set `deferTilesWhileMoving: false` to request tiles continuously during movement
(more responsive while dragging, but much heavier on the WMS server).

## Dynamic WMS

Dynamic mode requests a single viewport image on `moveend` (default for SeaSketch). This is more robust for services with poor tile caching or label clipping issues.

```ts
import { WMSDynamicSource } from "@seasketch/mapbox-gl-wms-source";

const source = new WMSDynamicSource({
  url: "https://ows.emodnet-bathymetry.eu/wms",
  supportHighDpiDisplays: true,
});
await source.prepare();
source.updateLayers([
  { id: "mean_atlas_land", opacity: 1 },
  { id: "multicolour", opacity: 1 },
]);
await source.addToMap(map);
const { layers } = await source.getGLStyleLayers();
map.addLayer(layers[0]);
```

`updateLayers()` sets the ordered `LAYERS=` / `STYLES=` lists composited into one GetMap request. WMS does not support per-layer opacity in a single request; use `setGroupOpacity()` for whole-image opacity.

## Catalog & protocol helpers

The module exports pure/fetch-injectable helpers for use in admin UIs:

- `normalizeWMSUrl`, `fetchCapabilities`, `parseCapabilities`, `flattenLayers`, `getNamedLayers`, `getSupportedWebMercatorCrs`
- `buildLayerMetadata`, `fetchAndParseMetadataUrl`
- `getLegendItems`, `getLegendGraphicUrl`, `buildGetLegendGraphicUrl`
- `getFeatureInfoUrl`, `parseFeatureInfo`, `identify`

## Testing

Three complementary tiers:

**1. Unit tests (Vitest)** — fast, no network. Cover capabilities parsing, URL
builders (including the mandatory-`STYLES` spec rule), CORS/error handling, and
source-class logic against fixtures.

```bash
npm test
npm run test:coverage
```

**2. Browser integration — mocked (Playwright, blocking-safe)** — drives the real
`WMSDynamicSource` / `WMSTiledSource` classes inside Mapbox GL, with all WMS
traffic mocked from fixtures. No live services.

```bash
npm run test:e2e            # headless (mocked project only)
npm run test:e2e:ui         # Playwright UI for mocked tests
npm run test:e2e:typecheck
```

**3. Browser integration — live (Playwright, opt-in)** — same source classes,
but hits the real example WMS services. Screenshots are attached to each test
report for visual verification. Serial execution to be gentle on external servers.

```bash
npm run test:e2e:live              # headless automation
npm run test:e2e:live:headed       # visible browser — great for manual QA
npm run test:e2e:live:ui           # Playwright UI — step through / inspect
npm run test:e2e:live:debug         # headed + pause after each service (PW_LIVE_PAUSE=1)
```

These are **not** part of the default `npm run test:e2e` run.

**CI (`unit-tests.yml`):** when `packages/mapbox-gl-wms-source/**` (or
`metadata-parser`) changes, the Unit Tests workflow runs Vitest + mocked
Playwright as **required** steps. Live Vitest + live Playwright run in the same
job with `continue-on-error: true` (indicative only — failures do not fail the
workflow). This job is independent of deployment (`deploy.yml` is manual and
does not wait on WMS tests).

**Verify locally before pushing** (mirrors CI without lerna bootstrap):

```bash
cd packages/mapbox-gl-wms-source
cp .env.example .env   # once — add VITE_MAPBOX_TOKEN (pk.* from client/.env)
npm run verify:ci      # build metadata-parser + build + unit + e2e (CI=true)
```

To reproduce the exact CI failure mode (no `.env`, token from env only):

```bash
CI=true VITE_MAPBOX_TOKEN=pk.your_token npm run test:e2e
```

**4. Live protocol smoke (Vitest, opt-in)** — lightweight fetch-only checks
(capabilities parse + GetMap content-type) without a browser.

```bash
WMS_LIVE=1 npm run test:live
npm run capture-fixtures   # refresh live service capabilities fixtures
```

> All browser tiers require `VITE_MAPBOX_TOKEN` in `.env` (copy from
> `packages/client/.env`). Mocked tests block Mapbox telemetry; live tests only
> block telemetry — WMS requests go to real servers.

## Build

```bash
npm run build
```

Ships compiled JS + `.d.ts` in `dist/` for consumption by the SeaSketch client (Phase 2 integration).
