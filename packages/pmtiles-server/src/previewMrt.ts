import { TileJSON } from "./tileset";

type RasterLayer = {
  id: string;
  fields?: {
    bands?: string[];
    range?: [number, number];
    name?: string;
  };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defaultPaint(layer: RasterLayer): Record<string, unknown> {
  const bands = layer.fields?.bands ?? [];
  const band = bands[bands.length - 1] ?? "1";
  const range = layer.fields?.range;
  const categorical =
    range && range[0] === 0 && range[1] === 1 && bands.length > 1;
  if (categorical || !range) {
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
      "raster-opacity": 0.85,
    };
  }
  return {
    "raster-array-band": band,
    "raster-color-range": range,
    "raster-color": [
      "interpolate",
      ["linear"],
      ["raster-value"],
      range[0],
      "#0d0887",
      (range[0] + range[1]) / 2,
      "#cc4778",
      range[1],
      "#f0f921",
    ],
    "raster-resampling": "nearest",
    "raster-opacity": 0.85,
  };
}

/**
 * Mapbox GL JS 3.4 raster-array preview for an MRT PMTiles archive.
 */
export default function renderMrtPreview(
  tilejson: TileJSON,
  mapboxAccessToken: string,
  tilejsonUrl: string,
) {
  const layer = (tilejson.raster_layers?.[0] ?? {
    id: "data",
    fields: { bands: ["1"] },
  }) as RasterLayer;
  const bands = layer.fields?.bands ?? ["1"];
  const paint = defaultPaint(layer);
  const minzoom = tilejson.minzoom ?? 0;
  const maxzoom = tilejson.maxzoom ?? 12;
  const zoom = tilejson.center?.[2] ?? Math.max(minzoom, Math.min(maxzoom, minzoom + 2));
  const center = tilejson.center?.slice(0, 2) ?? [-140, 20];
  const title = escapeHtml(tilejson.name || "MRT preview");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { position: absolute; inset: 0; }
    #slider {
      display: ${bands.length > 1 ? "flex" : "none"};
      position: absolute; left: 12px; bottom: 16px; z-index: 5;
      background: rgba(15,23,42,0.88); color: #e2e8f0; border-radius: 10px;
      padding: 10px 14px; font: 13px/1.3 ui-sans-serif, system-ui, sans-serif;
      align-items: center; gap: 10px; min-width: 280px;
    }
    #slider input { flex: 1; }
    #token-btn {
      position: absolute; right: 10px; top: 10px; z-index: 5;
      border: solid rgba(100,100,255,0.8) 2px; border-radius: 8px;
      background: rgba(50,0,200,0.8); color: white; padding: 8px 12px;
      font: 12px/1 sans-serif; cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button type="button" id="token-btn">Token</button>
  <div id="slider">
    <span id="band-label">${escapeHtml(String(bands[bands.length - 1] ?? ""))}</span>
    <input id="band" type="range" min="0" max="${bands.length - 1}" value="${bands.length - 1}" />
  </div>
  <script>
    mapboxgl.accessToken = ${JSON.stringify(mapboxAccessToken)};
    const bands = ${JSON.stringify(bands)};
    const paint = ${JSON.stringify(paint)};
    const TOKEN_KEY = "ss_map_access_token";
    function readAccessToken() {
      var params = new URLSearchParams(location.search);
      var fromQuery = params.get("access_token");
      if (fromQuery) {
        try { sessionStorage.setItem(TOKEN_KEY, fromQuery); } catch (e) {}
        return fromQuery;
      }
      try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
    }
    var accessToken = readAccessToken();
    function tileJsonUrl() {
      var u = new URL(${JSON.stringify(tilejsonUrl)}, location.origin);
      var page = new URLSearchParams(location.search);
      if (page.get("ns")) u.searchParams.set("ns", page.get("ns"));
      if (accessToken) u.searchParams.set("access_token", accessToken);
      return u.pathname + u.search;
    }
    document.getElementById("token-btn").onclick = function () {
      var token = prompt("Map access token", accessToken || "");
      if (!token) return;
      var u = new URL(location.href);
      u.searchParams.set("access_token", token.trim());
      location.replace(u.toString());
    };
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/seasketch/cl892c7ia001e14qpbr4gnf4k",
      zoom: ${zoom},
      center: ${JSON.stringify(center)},
      transformRequest: function (url) {
        if (!accessToken) return { url: url };
        try {
          var u = new URL(url, location.origin);
          if (u.origin === location.origin && !u.searchParams.has("access_token")) {
            u.searchParams.set("access_token", accessToken);
            var ns = new URLSearchParams(location.search).get("ns");
            if (ns) u.searchParams.set("ns", ns);
            return { url: u.toString() };
          }
        } catch (e) {}
        return { url: url };
      }
    });
    map.on("load", function () {
      map.addSource("tileset", { type: "raster-array", url: tileJsonUrl() });
      map.addLayer({
        id: "tileset",
        type: "raster",
        source: "tileset",
        "source-layer": ${JSON.stringify(layer.id)},
        minzoom: ${minzoom},
        paint: paint
      });
    });
    var slider = document.getElementById("band");
    var label = document.getElementById("band-label");
    slider.oninput = function () {
      var band = bands[Number(slider.value)];
      label.textContent = band;
      if (map.getLayer("tileset")) {
        map.setPaintProperty("tileset", "raster-array-band", band);
      }
    };
  </script>
</body>
</html>`;
}
