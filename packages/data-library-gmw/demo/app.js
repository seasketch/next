/* GMW globe helpers. Expects window.MAPBOX_TOKEN from /config.js */

export function showError(err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(err);
  let el = document.getElementById("demo-error");
  if (!el) {
    el = document.createElement("pre");
    el.id = "demo-error";
    document.body.appendChild(el);
  }
  el.textContent = message;
}

function waitForMapLoad(map) {
  return new Promise((resolve, reject) => {
    const finish = () => resolve(map);
    const onError = (e) => {
      const err = e?.error || e;
      reject(err instanceof Error ? err : new Error(err?.message || "Map failed to load"));
    };
    map.once("error", onError);
    map.once("load", finish);
    if (map.loaded() || map.isStyleLoaded()) finish();
  });
}

export async function createMap(center, zoom) {
  if (!window.MAPBOX_TOKEN) {
    throw new Error("MAPBOX_TOKEN missing — is /config.js loaded?");
  }
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/satellite-streets-v12",
    center,
    zoom,
    hash: true,
    projection: "mercator",
  });
  map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
  map.on("error", (e) => {
    const msg = e?.error?.message || e?.message;
    if (msg && !/404|tile not found|not a valid MRT/i.test(msg)) {
      showError(new Error(msg));
    }
  });
  await waitForMapLoad(map);
  return map;
}

export const REMOTE_TILEJSON =
  "https://tiles.seasketch.org/dataLibrary/gmw-global.json?v=2";

export async function loadTileset(source) {
  const tilejsonUrl =
    source === "remote"
      ? REMOTE_TILEJSON
      : `${location.origin}/tiles/display/tilejson.json`;
  const res = await fetch(tilejsonUrl);
  if (!res.ok) {
    const where =
      source === "remote"
        ? `${tilejsonUrl} — deploy pmtiles-server from this branch if you have not yet`
        : "local gmw-global.pmtiles (run npm run pack, then npm run demo)";
    throw new Error(`Could not load tileset (${res.status}). ${where}`);
  }
  const json = await res.json();
  if (!json.raster_layers && json.rasterLayers) {
    json.raster_layers = json.rasterLayers;
  }
  json._tilejsonUrl = tilejsonUrl;
  json._source = source === "remote" ? "remote" : "local";
  return json;
}

export function mangrovePaint(band) {
  return {
    "raster-array-band": band,
    "raster-color-range": [0, 1],
    "raster-color": [
      "case",
      ["==", ["raster-value"], 1],
      "#3dd68c",
      "rgba(0,0,0,0)",
    ],
    "raster-resampling": "nearest",
    "raster-fade-duration": 0,
    "raster-opacity": 0.92,
  };
}

export async function addRasterArrayLayer(map, { sourceId, layerId, tilejson, paint }) {
  const layer = tilejson.raster_layers?.[0] || tilejson.rasterLayers?.[0];
  if (!layer) throw new Error("TileJSON is missing raster_layers[0]");
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  map.addSource(sourceId, {
    type: "raster-array",
    url: tilejson._tilejsonUrl,
    tileSize: layer.fields.tilesize,
    minzoom: tilejson.minzoom,
    maxzoom: tilejson.maxzoom,
    bounds: tilejson.bounds,
  });

  await waitForSourceMetadata(map, sourceId);

  map.addLayer({
    id: layerId,
    type: "raster",
    source: sourceId,
    "source-layer": layer.id,
    paint,
  });
  return layer;
}

function sourceHasRasterLayers(map, sourceId) {
  const src = map.getSource(sourceId);
  return Boolean(src && (src.rasterLayers || src.raster_layers));
}

function waitForSourceMetadata(map, sourceId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      map.off("sourcedata", onData);
      reject(new Error(`Timed out waiting for raster-array source "${sourceId}"`));
    }, 12000);
    const onData = (e) => {
      if (e.sourceId !== sourceId) return;
      if (sourceHasRasterLayers(map, sourceId)) {
        clearTimeout(timeout);
        map.off("sourcedata", onData);
        resolve();
      }
    };
    map.on("sourcedata", onData);
    if (sourceHasRasterLayers(map, sourceId)) {
      clearTimeout(timeout);
      map.off("sourcedata", onData);
      resolve();
    }
  });
}

function replaceNode(el) {
  const clone = el.cloneNode(true);
  el.parentNode.replaceChild(clone, el);
  return clone;
}

export function bindSlider({ bands, onBand, playMs = 280 }) {
  const slider = replaceNode(document.getElementById("band"));
  const play = replaceNode(document.getElementById("play"));
  const label = document.getElementById("year");
  const ticks = document.getElementById("ticks");
  slider.min = 0;
  slider.max = Math.max(0, bands.length - 1);
  slider.value = bands.length - 1;
  slider.removeAttribute("readonly");

  if (ticks && bands.length) {
    const pick = [
      bands[0],
      bands[Math.floor((bands.length - 1) / 2)],
      bands[bands.length - 1],
    ];
    const uniq = [...new Set(pick)];
    ticks.replaceChildren(
      ...uniq.map((text) => {
        const span = document.createElement("span");
        span.textContent = text;
        return span;
      }),
    );
  }

  function setIndex(i) {
    const idx = Math.max(0, Math.min(bands.length - 1, i));
    slider.value = String(idx);
    label.textContent = bands[idx];
    onBand(bands[idx], idx);
  }
  slider.oninput = () => setIndex(Number(slider.value));
  play.onclick = () => {
    if (slider._mrtTimer) {
      clearInterval(slider._mrtTimer);
      slider._mrtTimer = null;
      play.textContent = "▶";
      return;
    }
    play.textContent = "❚❚";
    slider._mrtTimer = setInterval(() => {
      const next = (Number(slider.value) + 1) % bands.length;
      setIndex(next);
    }, playMs);
  };
  setIndex(Number(slider.value));
  return { setIndex };
}
