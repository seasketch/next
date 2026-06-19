import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { EXAMPLE_WMS_SERVICES } from "../src/exampleServices";
import { fetchCapabilities, getNamedLayers } from "../src/catalog";
import { identify } from "../src/interactivity";
import { WMSDynamicSource } from "../src/WMSDynamicSource";
import { WMSTiledSource } from "../src/WMSTiledSource";
import { getWebMercatorBboxFromMap } from "../src/util";
import { WMSServiceMetadata } from "../src/types";

/**
 * Live-service harness for Playwright. Unlike the mocked harness, all WMS
 * requests go to real servers. Used for visual verification and indicative
 * CI smoke tests (opt-in via WMS_LIVE=1 / the `live` Playwright project).
 */

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const statusEl = document.getElementById("status") as HTMLDivElement;
const LAYER_ID = "wms-overlay-layer";
const SOURCE_ID = "wms-overlay";

const map = new mapboxgl.Map({
  container: "map",
  style: { version: 8, sources: {}, layers: [] },
  center: [0, 20],
  zoom: 2,
  projection: { name: "mercator" },
  preserveDrawingBuffer: true,
  fadeDuration: 0,
  attributionControl: false,
});

(window as unknown as { __map: mapboxgl.Map }).__map = map;

const errors: string[] = [];
const wmsRequests: string[] = [];

map.on("error", (e: unknown) => {
  const err = e as { error?: { message?: string } };
  errors.push(String(err?.error?.message || err?.error || e));
});

function setStatus(text: string) {
  statusEl.textContent = text;
}

function ready(): Promise<void> {
  return map.loaded()
    ? Promise.resolve()
    : new Promise((res) => map.on("load", () => res()));
}

function waitIdle(timeout = 15000): Promise<void> {
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

/** Wrap fetch to record WMS request URLs for test assertions. */
async function fetchWithLog(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  if (/GetCapabilities|GetMap|GetFeatureInfo|GetLegendGraphic/i.test(url)) {
    wmsRequests.push(url);
  }
  return fetch(input, init);
}

function pickDefaultLayers(
  serviceUrl: string,
  metadata: WMSServiceMetadata
): string[] {
  const named = getNamedLayers(metadata.layers);
  const example = EXAMPLE_WMS_SERVICES.find((s) => s.url === serviceUrl);
  const fromExample =
    example?.defaultLayers?.filter((n) => named.some((l) => l.name === n)) ||
    [];
  if (fromExample.length) {
    return fromExample;
  }
  return named.slice(0, 1).map((l) => l.name!);
}

let metadata: WMSServiceMetadata | undefined;
let source: WMSDynamicSource | WMSTiledSource | undefined;
let selectedLayers: string[] = [];

interface LoadServiceOptions {
  mode?: "dynamic" | "tiled";
  layers?: string[];
  hidpi?: boolean;
}

async function loadService(serviceUrl: string, opts: LoadServiceOptions = {}) {
  await ready();
  wmsRequests.length = 0;
  errors.length = 0;
  setStatus(`Loading ${serviceUrl}…`);

  const result = await fetchCapabilities(serviceUrl, { fetch: fetchWithLog });
  metadata = result.metadata;
  selectedLayers = pickDefaultLayers(serviceUrl, metadata);

  if (opts.layers?.length) {
    const named = getNamedLayers(metadata.layers);
    selectedLayers = opts.layers.filter((n) =>
      named.some((l) => l.name === n)
    );
  }

  const example = EXAMPLE_WMS_SERVICES.find((s) => s.url === serviceUrl);
  if (example?.mapCenter) {
    map.setCenter(example.mapCenter);
    map.setZoom(example.mapZoom ?? 2);
  }

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
    fetch: fetchWithLog,
  };
  source =
    opts.mode === "tiled"
      ? new WMSTiledSource(sourceOpts)
      : new WMSDynamicSource(sourceOpts);

  await source.prepare();
  source.updateLayers(selectedLayers.map((id) => ({ id, opacity: 1 })));
  source.setGroupOpacity(1);
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

  setStatus(
    `Loaded ${getNamedLayers(metadata.layers).length} layers — ${selectedLayers.join(", ")}`
  );

  return {
    title: metadata.title,
    layerCount: getNamedLayers(metadata.layers).length,
    selectedLayers,
    queryableSelected: selectedLayers.filter((n) =>
      getNamedLayers(metadata!.layers).find((l) => l.name === n)?.queryable
    ),
    sourceType: glSource?.type,
    tileTemplate: glSource?.tiles?.[0],
    wmsRequestCount: wmsRequests.length,
    getMapUrls: wmsRequests.filter((u) => /REQUEST=GetMap/i.test(u)),
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
      fetch: fetchWithLog,
      queryLayers: selectedLayers.filter(
        (n) => named.find((l) => l.name === n)?.queryable
      ),
      layers: selectedLayers,
    }
  );
}

(window as unknown as { liveHarness: unknown }).liveHarness = {
  ready,
  errors,
  wmsRequests,
  services: EXAMPLE_WMS_SERVICES.map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    serverType: s.serverType,
    defaultLayers: s.defaultLayers,
    mapCenter: s.mapCenter,
    mapZoom: s.mapZoom,
  })),
  loadService,
  identifyAt,
};

setStatus("Ready");
