import mapboxgl from "mapbox-gl";
// Bundle the Mapbox CSS locally (via the npm package) so the harness makes no
// CDN/network requests — all WMS + Mapbox traffic is either local or mocked.
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchCapabilities, getNamedLayers } from "../src/catalog";
import { identify } from "../src/interactivity";
import { WMSDynamicSource } from "../src/WMSDynamicSource";
import { WMSTiledSource } from "../src/WMSTiledSource";
import { getWebMercatorBboxFromMap } from "../src/util";
import { WMSServiceMetadata } from "../src/types";

/**
 * Minimal, deterministic test harness for driving the WMS source classes from
 * Playwright. It builds a real Mapbox GL map with an EMPTY style (no Mapbox
 * token required) and exposes an imperative API on `window.harness`. All WMS
 * network traffic is intended to be mocked by the test via page.route().
 */

// Fixed URL all WMS requests resolve to; tests intercept `https://example.com/**`.
const WMS_URL = "https://example.com/wms";
const LAYER_ID = "wms-overlay-layer";
const SOURCE_ID = "wms-overlay";

// Mapbox GL JS v3 refuses to render without a valid token, even for a custom
// (non mapbox://) style. The token is supplied via VITE_MAPBOX_TOKEN (loaded
// from packages/mapbox-gl-wms-source/.env, or the CI environment). The map
// style is an inline object, so no Mapbox style/tile requests are made.
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const map = new mapboxgl.Map({
  container: "map",
  // Empty style: no Mapbox token needed and nothing external loads.
  style: { version: 8, sources: {}, layers: [] },
  center: [0, 0],
  zoom: 1,
  // WMS is a flat-projection protocol; mercator keeps pixel<->geo linear.
  projection: { name: "mercator" },
  // Required so we can read pixels back off the WebGL canvas for render checks.
  preserveDrawingBuffer: true,
  fadeDuration: 0,
  attributionControl: false,
});

(window as unknown as { __map: mapboxgl.Map }).__map = map;

const errors: string[] = [];
map.on("error", (e: unknown) => {
  const err = e as { error?: { message?: string } };
  errors.push(String(err?.error?.message || err?.error || e));
});

let metadata: WMSServiceMetadata | undefined;
let source: WMSDynamicSource | WMSTiledSource | undefined;
let selectedLayers: string[] = [];

function ready(): Promise<void> {
  return map.loaded()
    ? Promise.resolve()
    : new Promise((res) => map.on("load", () => res()));
}

function waitIdle(timeout = 5000): Promise<void> {
  return new Promise((res) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        res();
      }
    };
    const t = setTimeout(finish, timeout);
    map.once("idle", () => {
      clearTimeout(t);
      finish();
    });
  });
}

interface LoadOptions {
  mode?: "dynamic" | "tiled";
  layers?: string[];
  hidpi?: boolean;
  opacity?: number;
}

async function load(opts: LoadOptions = {}) {
  await ready();
  const result = await fetchCapabilities(WMS_URL);
  metadata = result.metadata;
  const named = getNamedLayers(metadata.layers);
  selectedLayers =
    opts.layers && opts.layers.length
      ? opts.layers
      : named.slice(0, 1).map((l) => l.name!);

  if (source) {
    source.removeFromMap(map);
    source.destroy();
    source = undefined;
  }
  if (map.getLayer(LAYER_ID)) {
    map.removeLayer(LAYER_ID);
  }

  const sourceOpts = {
    sourceId: SOURCE_ID,
    url: metadata.serviceUrl,
    metadata,
    supportHighDpiDisplays: opts.hidpi ?? false,
  };
  source =
    opts.mode === "tiled"
      ? new WMSTiledSource(sourceOpts)
      : new WMSDynamicSource(sourceOpts);

  await source.prepare();
  source.updateLayers(
    selectedLayers.map((id) => ({ id, opacity: opts.opacity ?? 1 }))
  );
  source.setGroupOpacity(opts.opacity ?? 1);
  await source.addToMap(map);
  const styleLayers = await source.getGLStyleLayers();
  for (const layer of styleLayers.layers) {
    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({ ...layer, id: LAYER_ID });
    }
  }
  await waitIdle();

  const glSource = map.getStyle().sources[SOURCE_ID] as
    | { type?: string; tiles?: string[] }
    | undefined;

  return {
    layerCount: named.length,
    queryableLayers: named.filter((l) => l.queryable).map((l) => l.name),
    selectedLayers,
    sourceType: glSource?.type,
    tileTemplate: glSource?.tiles?.[0],
    styleLayerType: map.getLayer(LAYER_ID)?.type,
  };
}

async function identifyAt(lng: number, lat: number) {
  if (!metadata) {
    throw new Error("Service not loaded");
  }
  const canvas = map.getCanvas();
  const bbox = getWebMercatorBboxFromMap(map);
  const pt = map.project([lng, lat]);
  const named = getNamedLayers(metadata.layers);
  return identify(
    metadata,
    [lng, lat],
    {
      bbox,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      x: Math.round(pt.x),
      y: Math.round(pt.y),
    },
    {
      queryLayers: selectedLayers.filter(
        (n) => named.find((l) => l.name === n)?.queryable
      ),
      layers: selectedLayers,
    }
  );
}

async function loadCapabilities() {
  await ready();
  const result = await fetchCapabilities(WMS_URL);
  return {
    title: result.metadata.title,
    layerCount: getNamedLayers(result.metadata.layers).length,
    getMapUrl: result.metadata.getMap?.url,
  };
}

(window as unknown as { harness: unknown }).harness = {
  ready,
  errors,
  load,
  loadCapabilities,
  identifyAt,
  WMS_URL,
};
