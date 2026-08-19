/* Shared demo helpers. Expects window.MAPBOX_TOKEN from /config.js */

export function nav(active) {
  const links = [
    ["index.html", "Home"],
    ["mangrove.html", "GMW"],
    ["gmw-global.html", "GMW globe"],
    ["sst.html", "SST / NetCDF"],
    ["blocks.html", "MRT blocks"],
    ["official.html", "Mapbox control"],
  ];
  return links
    .map(
      ([href, label]) =>
        `<a href="${href}" class="${label === active || href.startsWith(active) ? "active" : ""}">${label}</a>`,
    )
    .join("");
}

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

export async function createMap(center, zoom, extra = {}) {
  if (!window.MAPBOX_TOKEN) {
    throw new Error("MAPBOX_TOKEN missing — is /config.js loaded?");
  }
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  const map = new mapboxgl.Map({
    container: "map",
    style: extra.style || "mapbox://styles/mapbox/satellite-streets-v12",
    center,
    zoom,
    hash: extra.hash ?? true,
    projection: extra.projection || "mercator",
  });
  map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
  map.on("error", (e) => {
    const msg = e?.error?.message || e?.message;
    if (msg && !/404|tile not found/i.test(msg)) showError(new Error(msg));
  });
  await waitForMapLoad(map);
  window.demoMap = map;
  return map;
}

export async function loadTileset(id) {
  const res = await fetch(`/tiles/${id}/tilejson.json`);
  if (!res.ok) throw new Error(`Tileset ${id} not found. Run npm run fixtures.`);
  return res.json();
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

export function continuousPaint(band, range, stops) {
  return {
    "raster-array-band": band,
    "raster-color-range": range,
    "raster-color": ["interpolate", ["linear"], ["raster-value"], ...stops],
    "raster-resampling": "linear",
    "raster-fade-duration": 0,
    "raster-opacity": 0.85,
  };
}

export async function addRasterArrayLayer(map, options) {
  const { sourceId, layerId, tilesetId, tilejson, paint } = options;
  const layer = tilejson.raster_layers[0];
  if (!layer) throw new Error("TileJSON is missing raster_layers[0]");
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  const tilejsonUrl = `${location.origin}/tiles/${tilesetId}/tilejson.json`;
  map.addSource(sourceId, {
    type: "raster-array",
    url: tilejsonUrl,
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

function waitForSourceMetadata(map, sourceId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      map.off("sourcedata", onData);
      reject(new Error(`Timed out waiting for raster-array source "${sourceId}"`));
    }, 12000);
    const onData = (e) => {
      if (e.sourceId !== sourceId) return;
      if (e.sourceDataType === "metadata" || e.isSourceLoaded) {
        clearTimeout(timeout);
        map.off("sourcedata", onData);
        resolve();
      }
    };
    map.on("sourcedata", onData);
    const src = map.getSource(sourceId);
    if (src && (src.rasterLayers || src.raster_layers)) {
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
