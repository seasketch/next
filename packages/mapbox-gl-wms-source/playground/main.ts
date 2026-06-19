import mapboxgl from "mapbox-gl";
import { EXAMPLE_WMS_SERVICES } from "../src/exampleServices";
import { fetchCapabilities, getNamedLayers } from "../src/catalog";
import { getLegendItems } from "../src/legends";
import { identify } from "../src/interactivity";
import { WMSDynamicSource } from "../src/WMSDynamicSource";
import { WMSTiledSource } from "../src/WMSTiledSource";
import { WMSServiceMetadata } from "../src/types";
import { getWebMercatorBboxFromMap } from "../src/util";

const serviceSelect = document.getElementById("service-select") as HTMLSelectElement;
const customUrl = document.getElementById("custom-url") as HTMLInputElement;
const loadBtn = document.getElementById("load-btn") as HTMLButtonElement;
const modeSelect = document.getElementById("mode-select") as HTMLSelectElement;
const hidpi = document.getElementById("hidpi") as HTMLInputElement;
const opacity = document.getElementById("opacity") as HTMLInputElement;
const layerTree = document.getElementById("layer-tree") as HTMLDivElement;
const legendPanel = document.getElementById("legend-panel") as HTMLDivElement;
const requestLog = document.getElementById("request-log") as HTMLPreElement;
const featureInfo = document.getElementById("feature-info") as HTMLDivElement;
const statusBanner = document.getElementById("status-banner") as HTMLDivElement;

// Populate service list immediately (before any async / token checks)
for (const svc of EXAMPLE_WMS_SERVICES) {
  const opt = document.createElement("option");
  opt.value = svc.url;
  opt.textContent = `${svc.name} (${svc.serverType})`;
  opt.title = svc.description;
  serviceSelect.appendChild(opt);
}

const token = import.meta.env.VITE_MAPBOX_TOKEN;
if (!token) {
  statusBanner.textContent =
    "Set VITE_MAPBOX_TOKEN in packages/mapbox-gl-wms-source/.env (copy from packages/client/.env). The map will not load until then, but you can still use Load capabilities to exercise the WMS client.";
  statusBanner.className = "status-banner error";
} else {
  mapboxgl.accessToken = token;
  statusBanner.textContent = "";
  statusBanner.className = "status-banner";
}

let metadata: WMSServiceMetadata | undefined;
let currentSource: WMSDynamicSource | WMSTiledSource | undefined;
let selectedLayers: string[] = [];
const logEntries: string[] = [];
let map: mapboxgl.Map | undefined;

function ensureMap(): mapboxgl.Map {
  if (!token) {
    throw new Error("Mapbox token required");
  }
  if (!map) {
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      center: [0, 20],
      zoom: 2,
      // WMS is a flat-projection protocol: GetMap/GetFeatureInfo map pixels to
      // a Web Mercator BBOX linearly. Globe projection produces a non-mercator
      // viewport, breaking the pixel->geo mapping (GetFeatureInfo misses).
      projection: { name: "mercator" },
    });
    map.on("click", onMapClick);
    (window as unknown as { __map: mapboxgl.Map }).__map = map;
    map.on("load", () => {
      loadService(serviceSelect.value).catch((e) =>
        log(`Initial load failed: ${e}`)
      );
    });
  }
  return map;
}

function log(message: string) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${message}`;
  logEntries.unshift(line);
  requestLog.textContent = logEntries.slice(0, 30).join("\n");
}

async function fetchWithLog(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const start = performance.now();
  try {
    const response = await fetch(input, init);
    log(
      `${response.status} ${Math.round(performance.now() - start)}ms ${url.slice(0, 120)}`
    );
    return response;
  } catch (e) {
    log(
      `ERR ${Math.round(performance.now() - start)}ms ${url.slice(0, 120)} — ${e}`
    );
    throw e;
  }
}

function pickDefaultLayers(
  url: string,
  serviceMetadata: WMSServiceMetadata
): string[] {
  const named = getNamedLayers(serviceMetadata.layers);
  const example = EXAMPLE_WMS_SERVICES.find((s) => s.url === url);
  const fromExample =
    example?.defaultLayers?.filter((n) => named.some((l) => l.name === n)) ||
    [];
  if (fromExample.length) {
    return fromExample;
  }
  return named.slice(0, 1).map((l) => l.name!);
}

function renderLayerTree() {
  layerTree.innerHTML = "";
  if (!metadata) return;
  for (const layer of getNamedLayers(metadata.layers)) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedLayers.includes(layer.name!);
    cb.addEventListener("change", () => {
      if (cb.checked) {
        selectedLayers.push(layer.name!);
      } else {
        selectedLayers = selectedLayers.filter((n) => n !== layer.name);
      }
      updateMapSource().catch((e) => log(String(e)));
    });
    label.appendChild(cb);
    label.appendChild(
      document.createTextNode(layer.title || layer.name!)
    );
    if (layer.queryable) {
      label.appendChild(document.createTextNode(" (queryable)"));
    }
    layerTree.appendChild(label);
  }
}

function renderLegend() {
  legendPanel.innerHTML = "";
  if (!metadata || !selectedLayers.length) return;
  for (const name of selectedLayers) {
    const items = getLegendItems(metadata, name);
    for (const item of items) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.label;
      legendPanel.appendChild(img);
    }
  }
}

async function updateMapSource() {
  if (!metadata) return;
  const layerId = "wms-overlay-layer";
  const mapInstance = token ? ensureMap() : undefined;
  if (currentSource && mapInstance) {
    currentSource.removeFromMap(mapInstance);
    currentSource.destroy();
    currentSource = undefined;
  }
  if (!selectedLayers.length || !mapInstance) return;

  const opts = {
    sourceId: "wms-overlay",
    url: metadata.serviceUrl,
    metadata,
    supportHighDpiDisplays: hidpi.checked,
    fetch: fetchWithLog as typeof fetch,
  };

  currentSource =
    modeSelect.value === "tiled"
      ? new WMSTiledSource(opts)
      : new WMSDynamicSource(opts);

  await currentSource.prepare();
  currentSource.updateLayers(
    selectedLayers.map((id) => ({ id, opacity: parseFloat(opacity.value) }))
  );
  currentSource.setGroupOpacity(parseFloat(opacity.value));
  await currentSource.addToMap(mapInstance);
  const styleLayers = await currentSource.getGLStyleLayers();
  for (const layer of styleLayers.layers) {
    if (!mapInstance.getLayer(layerId)) {
      mapInstance.addLayer({ ...layer, id: layerId });
    }
  }
  renderLegend();
}

async function loadService(url: string) {
  log(`Loading capabilities: ${url}`);
  statusBanner.textContent = "Loading capabilities…";
  statusBanner.className = "status-banner loading";
  featureInfo.style.display = "none";
  featureInfo.textContent = "";
  try {
    const result = await fetchCapabilities(url, { fetch: fetchWithLog });
    metadata = result.metadata;
    selectedLayers = pickDefaultLayers(url, metadata);
    const example = EXAMPLE_WMS_SERVICES.find((s) => s.url === url);
    if (example?.mapCenter && token) {
      const mapInstance = ensureMap();
      mapInstance.setCenter(example.mapCenter);
      mapInstance.setZoom(example.mapZoom || 2);
    }
    renderLayerTree();
    await updateMapSource();
    statusBanner.textContent = `Loaded ${getNamedLayers(metadata.layers).length} layers from ${metadata.title || url}`;
    statusBanner.className = "status-banner success";
  } catch (e) {
    statusBanner.textContent = `Load failed: ${e}`;
    statusBanner.className = "status-banner error";
    throw e;
  }
}

loadBtn.addEventListener("click", () => {
  const url = customUrl.value.trim() || serviceSelect.value;
  loadService(url).catch((e) => log(`Load failed: ${e}`));
});

serviceSelect.addEventListener("change", () => {
  customUrl.value = "";
  loadService(serviceSelect.value).catch((e) => log(`Load failed: ${e}`));
});

modeSelect.addEventListener("change", () => {
  updateMapSource().catch((e) => log(String(e)));
});
hidpi.addEventListener("change", () => {
  updateMapSource().catch((e) => log(String(e)));
});
opacity.addEventListener("input", () => {
  if (currentSource) {
    const v = parseFloat(opacity.value);
    currentSource.setGroupOpacity(v);
    currentSource.updateLayers(
      selectedLayers.map((id) => ({ id, opacity: v }))
    );
    if (map?.getLayer("wms-overlay-layer")) {
      map.setPaintProperty("wms-overlay-layer", "raster-opacity", v);
    }
  }
});

async function onMapClick(e: mapboxgl.MapMouseEvent) {
  if (!metadata || !selectedLayers.length || !map) return;
  featureInfo.style.display = "block";
  featureInfo.textContent = "Querying GetFeatureInfo...";
  try {
    const canvas = map.getCanvas();
    // Reuse the library's clamped Web Mercator bbox so the pixel->geo mapping
    // stays valid (matches what GetMap requests).
    const bbox = getWebMercatorBboxFromMap(map);
    const result = await identify(
      metadata,
      [e.lngLat.lng, e.lngLat.lat],
      {
        bbox,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        x: Math.round(e.point.x),
        y: Math.round(e.point.y),
      },
      {
        fetch: fetchWithLog,
        queryLayers: selectedLayers.filter((name) => {
          const layer = getNamedLayers(metadata!.layers).find(
            (l) => l.name === name
          );
          return layer?.queryable;
        }),
        layers: selectedLayers,
      }
    );
    if (result.html) {
      featureInfo.innerHTML = result.html;
    } else if (result.features.length) {
      featureInfo.textContent = JSON.stringify(result.features, null, 2);
    } else {
      featureInfo.textContent = "No features returned.";
    }
  } catch (err) {
    featureInfo.textContent = String(err);
  }
}

// Capabilities-only mode: load first service even without Mapbox token
if (token) {
  ensureMap();
} else {
  loadService(serviceSelect.value).catch((e) => log(`Initial load failed: ${e}`));
}
