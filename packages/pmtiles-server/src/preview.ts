import { TileJSON } from "./tileset";

// Borrowed from https://github.com/mapbox/mbview/blob/master/views/vector.ejs#L75

var lightColors = [
  "FC49A3", // pink
  "CC66FF", // purple-ish
  "66CCFF", // sky blue
  "66FFCC", // teal
  "00FF00", // lime green
  "FFCC66", // light orange
  "FF6666", // salmon
  "FF0000", // red
  "FF8000", // orange
  "FFFF66", // yellow
  "00FFFF", // turquoise
];

function getColor(colors: string[], i: number) {
  if (i >= lightColors.length) {
    i = i - lightColors.length;
  }
  return colors[i];
}

/**
 * HTML Mapbox GL preview page for a tileset (legacy and /v2 paths).
 * On /v2, reads/applies `access_token` via query or a token dialog.
 */
export default function renderPreview(
  tilejson: TileJSON,
  name: string,
  mapboxAccessToken: string
) {
  let zoom = 5;
  const isVector = tilejson.vector_layers && tilejson.vector_layers.length > 0;
  if (tilejson.maxzoom) {
    const minzoom = tilejson.minzoom || 0;
    zoom = tilejson.maxzoom - (tilejson.maxzoom - minzoom) / 2;
  }
  let center = tilejson.center || [-140, 20];
  return `
  <!DOCTYPE html>
  <html>
  
  <head>
    <meta charset="utf-8">
    <title>${tilejson.name || "Tileset Preview"}</title>
    <meta name="description" content="${tilejson.description}">
    <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no">
    <link href="https://api.mapbox.com/mapbox-gl-js/v2.10.0/mapbox-gl.css" rel="stylesheet">
    <script src="https://api.mapbox.com/mapbox-gl-js/v2.10.0/mapbox-gl.js"></script>
    <style>
      body {
        margin: 0;
        padding: 0;
      }
  
      #map {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 100%;
      }

      #token-dialog {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 20;
        background: rgba(15, 23, 42, 0.72);
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      }
      #token-dialog.open { display: flex; }
      #token-dialog .card {
        width: min(440px, 100%);
        background: #1e293b;
        color: #e2e8f0;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 24px;
      }
      #token-dialog h2 { margin: 0 0 8px; font-size: 1.1rem; }
      #token-dialog p { margin: 0 0 12px; font-size: 0.9rem; color: #94a3b8; line-height: 1.4; }
      #token-dialog .error {
        display: none; margin: 0 0 12px; padding: 10px 12px; border-radius: 8px;
        background: #450a0a; color: #fecaca; font-size: 0.85rem;
      }
      #token-dialog .error.show { display: block; }
      #token-dialog textarea {
        width: 100%; box-sizing: border-box; min-height: 100px; resize: vertical;
        border-radius: 8px; border: 1px solid #475569; background: #0f172a;
        color: #f8fafc; padding: 10px 12px; font: 12px/1.4 ui-monospace, Menlo, monospace;
      }
      #token-dialog button {
        margin-top: 12px; width: 100%; border: 0; border-radius: 8px;
        padding: 10px 14px; font-weight: 600; cursor: pointer;
        background: #0ea5e9; color: #0f172a;
      }
      #token-btn {
        position: absolute; right: 10px; top: 10px; z-index: 5;
        border: solid rgba(100, 100, 255, 0.8) 2px; border-radius: 8px;
        background: rgba(50, 0, 200, 0.8); color: white; padding: 8px 12px;
        font: 12px/1 sans-serif; cursor: pointer;
      }
    </style>
  </head>
  
  <body>
    <div id="map"></div>
    <button type="button" id="token-btn" title="Set map access token">Token</button>
    <div id="token-dialog" role="dialog" aria-modal="true" aria-labelledby="token-dialog-title">
      <div class="card">
        <h2 id="token-dialog-title">Map access token</h2>
        <p>Protected <code>/v2/</code> tile URLs need a SeaSketch <code>mapAccessToken</code>. You can also pass <code>?access_token=…</code> in the URL.</p>
        <div id="token-error" class="error"></div>
        <form id="token-form">
          <textarea id="token-input" required spellcheck="false" placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9…"></textarea>
          <button type="submit">Apply token</button>
        </form>
      </div>
    </div>
    <button onclick="showMenu()" id="show-menu" style="position: absolute; left:10px; top: 10px; background-color: rgba(50, 0, 200, 0.8); color: white; border-radius: 200px; border:none; width: 50px; height: 50px; border: solid rgba(100, 100, 255, 0.8) 2px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>
    <div id="layers" style="display:none;position: absolute; left: 10px; top: 10px; background-color: rgba(50, 0, 200, 0.8); font-size: 13px; color:white; padding: 10px; font-family: sans-serif;">
    <button onclick="hideMenu()" id="show-menu" style="margin-bottom: 10px; background: transparent; color: white; border-radius: 200px; border:none; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
  
    </button>
      <ul style="padding:0px; list-style: none; margin:0px;margin-bottom: 10px;">
        ${(tilejson.vector_layers || [])
          .map(
            (layer) => `
          <li style="padding: 5px; margin:0px; display:flex;align-items:center;"><input type="checkbox" style="margin-right:4px;" checked onclick="window.toggleLayer('${layer.id}')" />${layer.id}</li>
        `
          )
          .join("\n")}
      </ul>
      <div style="padding:5px;">
        <button onclick="toggleAll()">toggle all</button>
      </div>

    </div>
    <script>
      mapboxgl.accessToken = ${JSON.stringify(mapboxAccessToken)};
      const FALLBACK_NAME = ${JSON.stringify(name)};
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

      function isV2Path() {
        return location.pathname.indexOf("/v2/") === 0;
      }

      function tileJsonUrl() {
        if (isV2Path()) {
          return location.pathname.replace(/\\/$/, "") + ".json";
        }
        return "/" + FALLBACK_NAME + ".json";
      }

      function showTokenDialog(message) {
        var dialog = document.getElementById("token-dialog");
        var err = document.getElementById("token-error");
        var input = document.getElementById("token-input");
        if (message) {
          err.textContent = message;
          err.classList.add("show");
        } else {
          err.textContent = "";
          err.classList.remove("show");
        }
        input.value = accessToken || "";
        dialog.classList.add("open");
        input.focus();
      }

      function hideTokenDialog() {
        document.getElementById("token-dialog").classList.remove("open");
      }

      document.getElementById("token-btn").addEventListener("click", function () {
        showTokenDialog(null);
      });

      document.getElementById("token-form").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var token = (document.getElementById("token-input").value || "").trim();
        if (!token) return;
        accessToken = token;
        try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) {}
        var u = new URL(location.href);
        u.searchParams.set("access_token", token);
        location.replace(u.toString());
      });

      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/seasketch/cl892c7ia001e14qpbr4gnf4k',
        zoom: ${zoom},
        center: ${JSON.stringify(center.slice(0, 2))},
        transformRequest: function (url, resourceType) {
          if (!accessToken) return { url: url };
          try {
            var u = new URL(url, location.origin);
            if (u.pathname.indexOf("/v2/") === 0 && !u.searchParams.has("access_token")) {
              u.searchParams.set("access_token", accessToken);
              return { url: u.toString() };
            }
          } catch (e) {}
          return { url: url };
        }
      });

      map.on('error', function (e) {
        var status = e && e.error && e.error.status;
        if (status === 401 || status === 403) {
          showTokenDialog(
            status === 401
              ? "Unauthorized — provide a valid map access token."
              : "Forbidden — this token does not grant access."
          );
        }
      });

      map.on('load', function() {
        ${
          isVector
            ? `
        map.addSource('tileset', {
          'type': 'vector',
          'url': tileJsonUrl()
        });      
        `
            : `
        map.addSource('tileset', {
          'type': 'raster',
          'url': tileJsonUrl()
        });
        `
        }

        ${
          isVector
            ? ``
            : `
        map.addLayer({
          'id': 'tileset',
          'type': 'raster',
          'source': 'tileset',
          'minzoom': ${tilejson.minzoom || 0},
          'layout': {
            'visibility': 'visible'
          },
          'paint': {
            'raster-opacity': 0.75,
            "raster-resampling": "nearest",
          }
        });
        `
        }

        ${tilejson.vector_layers
          .map(
            (layer, i) => `
          var layerColor = '#' + "${getColor(lightColors, i)}";
          map.addLayer({
            'id': '${layer.id}-polygons',
            'type': 'fill',
            'source': 'tileset',
            'source-layer': '${layer.id}',
            'filter': ["==", "$type", "Polygon"],
            'layout': {
              'visibility': 'visible'
            },
            'paint': {
              'fill-opacity': 0.1,
              'fill-color': layerColor,
            }
          });
          map.addLayer({
            'id': '${layer.id}-polygons-outline',
            'type': 'line',
            'source': 'tileset',
            'source-layer': '${layer.id}',
            'filter': ["==", "$type", "Polygon"],
            'layout': {
              'line-join': 'round',
              'line-cap': 'round',
              'visibility': 'visible'
            },
            'paint': {
              'line-color': layerColor,
              'line-width': 1,
              'line-opacity': 0.75
            }
          });
          map.addLayer({
            'id': '${layer.id}-lines',
            'type': 'line',
            'source': 'tileset',
            'source-layer': '${layer.id}',
            'filter': ["==", "$type", "LineString"],
            'layout': {
              'line-join': 'round',
              'line-cap': 'round',
              'visibility': 'visible'
            },
            'paint': {
              'line-color': layerColor,
              'line-width': 1,
              'line-opacity': 0.75
            }
          });
          map.addLayer({
            'id': '${layer.id}-pts',
            'type': 'circle',
            'source': 'tileset',
            'source-layer': '${layer.id}',
            'filter': ["==", "$type", "Point"],
            'layout': {
              'visibility': 'visible'
            },
            'paint': {
              'circle-color': layerColor,
              'circle-radius': 2.5,
              'circle-opacity': 0.75
            }
          });
        `
          )
          .join("\n")}
      });

      window.toggleLayer = (layerId) => {
        const visibility = map.getLayoutProperty(
          layerId + "-polygons",
          'visibility'
          );
        const setting = visibility === "visible" ? 'none' : 'visible';
        map.setLayoutProperty(layerId + '-polygons', 'visibility', setting);
        map.setLayoutProperty(layerId + '-polygons-outline', 'visibility', setting);
        map.setLayoutProperty(layerId + '-lines', 'visibility', setting);
        map.setLayoutProperty(layerId + '-pts', 'visibility', setting);
      }

      function toggleAll() {
        const anyVisible = document.querySelectorAll('input[checked]').length > 0;
        if (anyVisible) {
          document.querySelectorAll('input[checked]').forEach((el) => {
            el.onclick();
            el.removeAttribute('checked');
          });
        } else {
          document.querySelectorAll('input').forEach((el) => {
            el.onclick();
            el.setAttribute('checked', 'true');
          });
        }
      }

      function showMenu() {
        document.getElementById("layers").style.display = "block";
        document.getElementById("show-menu").style.display = "none";
      }

      function hideMenu() {
        document.getElementById("layers").style.display = "none";
        document.getElementById("show-menu").style.display = "block";
      }
  
    </script>
  
  </body>
  
  </html>
  `;
}
