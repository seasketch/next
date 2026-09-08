/* CRW annual MRT helpers. Expects window.MAPBOX_TOKEN and window.CRW from /config.js */

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
  // More workers = more parallel MRT block decodes while scrubbing.
  mapboxgl.workerCount = Math.min(6, navigator.hardwareConcurrency || 4);
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

export function remoteTileJsonUrl(productId) {
  return `https://tiles.seasketch.org/dataLibrary/crw-${productId}-v1.json`;
}

export async function loadTileset(source, productId) {
  const tilejsonUrl =
    source === "remote"
      ? remoteTileJsonUrl(productId)
      : `${location.origin}/tiles/${productId}/tilejson.json`;
  const res = await fetch(tilejsonUrl);
  if (!res.ok) {
    const where =
      source === "remote"
        ? `${tilejsonUrl} — upload the archive to ssn-tiles if you have not yet`
        : `local crw-${productId}-v1.pmtiles (run npm run pack, then npm run demo)`;
    throw new Error(`Could not load tileset (${res.status}). ${where}`);
  }
  const json = await res.json();
  if (!json.raster_layers && json.rasterLayers) {
    json.raster_layers = json.rasterLayers;
  }
  json._tilejsonUrl = tilejsonUrl;
  json._source = source === "remote" ? "remote" : "local";
  json._productId = productId;
  return json;
}

export function dhwPaint(band) {
  return {
    "raster-array-band": band,
    "raster-color-range": [0, 20],
    "raster-color": [
      "interpolate",
      ["linear"],
      ["raster-value"],
      0, "rgba(0,0,0,0)",
      0.01, "#fff5b1",
      1, "#ffe14a",
      4, "#ff9f1c",
      8, "#e03131",
      12, "#9b1b30",
      16, "#6b2d8b",
      20, "#3b0a55",
    ],
    "raster-resampling": "nearest",
    "raster-fade-duration": 0,
    "raster-opacity": 0.88,
  };
}

export function baaPaint(band) {
  return {
    "raster-array-band": band,
    "raster-color-range": [0, 4],
    "raster-color": [
      "match",
      ["round", ["raster-value"]],
      0, "rgba(0,0,0,0)",
      1, "#ffe14a",
      2, "#ff9f1c",
      3, "#e03131",
      4, "#6b2d8b",
      "rgba(0,0,0,0)",
    ],
    "raster-resampling": "nearest",
    "raster-fade-duration": 0,
    "raster-opacity": 0.88,
  };
}

export function sstaPaint(band) {
  return {
    "raster-array-band": band,
    "raster-color-range": [-2, 3],
    "raster-color": [
      "interpolate",
      ["linear"],
      ["raster-value"],
      -2, "#2166ac",
      -1, "#67a9cf",
      0, "#f7f7f7",
      1, "#ef8a62",
      2, "#b2182b",
      3, "#67001f",
    ],
    "raster-resampling": "nearest",
    "raster-fade-duration": 0,
    "raster-opacity": 0.88,
  };
}

export function sstPaint(band) {
  return {
    "raster-array-band": band,
    "raster-color-range": [20, 32],
    "raster-color": [
      "interpolate",
      ["linear"],
      ["raster-value"],
      20, "#2166ac",
      24, "#67c1dc",
      27, "#ffffbf",
      29, "#fdae61",
      31, "#d73027",
      32, "#67001f",
    ],
    "raster-resampling": "nearest",
    "raster-fade-duration": 0,
    "raster-opacity": 0.88,
  };
}

function productFamily(productId) {
  if (productId.startsWith("baa-")) return "baa";
  if (productId.startsWith("ssta-")) return "ssta";
  if (productId.startsWith("sst-")) return "sst";
  return "dhw";
}

export function paintForProduct(productId, band) {
  const family = productFamily(productId);
  if (family === "baa") return baaPaint(band);
  if (family === "ssta") return sstaPaint(band);
  if (family === "sst") return sstPaint(band);
  return dhwPaint(band);
}

const BAA_LABELS = {
  0: "No Stress",
  1: "Watch",
  2: "Warning",
  3: "Alert 1",
  4: "Alert 2",
};

export function formatHover(productId, band, value) {
  if (value == null) return null;
  const family = productFamily(productId);
  if (family === "baa") {
    const level = Math.round(value);
    return `${band}: ${BAA_LABELS[level] ?? level}`;
  }
  if (family === "dhw") {
    const digits = productId === "dhw-max-q" ? 1 : 2;
    return `${band}: ${Number(value).toFixed(digits)} °C-weeks`;
  }
  const signed = Number(value) >= 0 && family === "ssta" ? "+" : "";
  return `${band}: ${signed}${Number(value).toFixed(2)} °C`;
}

export function legendForProduct(productId) {
  const family = productFamily(productId);
  if (family === "baa") {
    return {
      title: "Alert level",
      swatches: [
        ["#ffe14a", "Watch"],
        ["#ff9f1c", "Warning"],
        ["#e03131", "Alert 1"],
        ["#6b2d8b", "Alert 2"],
      ],
    };
  }
  if (family === "ssta") {
    return {
      title: "SST anomaly (°C)",
      ramp: "linear-gradient(90deg,#2166ac,#f7f7f7,#b2182b)",
      labels: ["−2", "0", "+3"],
    };
  }
  if (family === "sst") {
    return {
      title: "SST (°C)",
      ramp: "linear-gradient(90deg,#2166ac,#ffffbf,#d73027)",
      labels: ["20", "27", "32"],
    };
  }
  return {
    title: "DHW (°C-weeks)",
    ramp: "linear-gradient(90deg,#fff5b1,#ff9f1c,#e03131,#6b2d8b)",
    labels: ["0", "4", "8", "20"],
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
  const prevSlider = document.getElementById("band");
  if (typeof prevSlider?._mrtStop === "function") prevSlider._mrtStop();
  if (prevSlider?._mrtTimer) {
    clearInterval(prevSlider._mrtTimer);
    prevSlider._mrtTimer = null;
  }
  const slider = replaceNode(prevSlider);
  const play = replaceNode(document.getElementById("play"));
  play.textContent = "▶";
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

  let bandRaf = 0;
  let pendingIdx = null;
  let playing = false;
  let playRaf = 0;
  let lastPlay = 0;

  function cancelBandRaf() {
    if (bandRaf) cancelAnimationFrame(bandRaf);
    bandRaf = 0;
  }

  function stopPlayback() {
    playing = false;
    if (playRaf) cancelAnimationFrame(playRaf);
    playRaf = 0;
    play.textContent = "▶";
  }

  function flushBand() {
    bandRaf = 0;
    if (pendingIdx == null) return;
    const idx = pendingIdx;
    pendingIdx = null;
    onBand(bands[idx], idx);
  }

  function setIndex(i) {
    const idx = Math.max(0, Math.min(bands.length - 1, i));
    slider.value = String(idx);
    label.textContent = bands[idx];
    pendingIdx = idx;
    if (!bandRaf) bandRaf = requestAnimationFrame(flushBand);
  }

  function playbackSpeed() {
    const speed = Number(document.getElementById("speed")?.value);
    return speed > 0 ? speed : 1;
  }

  function playTick(now) {
    if (!playing) return;
    playRaf = requestAnimationFrame(playTick);
    const interval = playMs / playbackSpeed();
    const elapsed = now - lastPlay;
    if (elapsed < interval) return;
    // Advance by however many intervals elapsed so high speeds are not
    // quantized down to the display refresh rate.
    const steps = Math.min(bands.length, Math.floor(elapsed / interval));
    lastPlay = now - (elapsed % interval);
    setIndex((Number(slider.value) + steps) % bands.length);
  }

  slider.oninput = () => setIndex(Number(slider.value));
  play.onclick = () => {
    if (playing) {
      stopPlayback();
      return;
    }
    playing = true;
    play.textContent = "❚❚";
    lastPlay = performance.now();
    playRaf = requestAnimationFrame(playTick);
  };
  slider._mrtStop = () => {
    cancelBandRaf();
    stopPlayback();
  };
  setIndex(Number(slider.value));
  return { setIndex };
}
