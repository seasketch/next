import { TileJSON } from "./tileset";

// Borrowed from https://github.com/mapbox/mbview/blob/master/views/vector.ejs#L75

var lightColors = [
  'FC49A3', // pink
  'CC66FF', // purple-ish
  '66CCFF', // sky blue
  '66FFCC', // teal
  '00FF00', // lime green
  'FFCC66', // light orange
  'FF6666', // salmon
  'FF0000', // red
  'FF8000', // orange
  'FFFF66', // yellow
  '00FFFF'  // turquoise
];


function getColor(colors:string[], i:number) {
  if (i >= lightColors.length) {
    i = i - lightColors.length
  }
  return colors[i];
}


export default function renderPreview(
  tilejson: TileJSON,
  name: string,
  mapboxAccessToken: string
) {
  let zoom = 5;
  const isVector = tilejson.vector_layers && tilejson.vector_layers.length > 0;
  if (tilejson.maxzoom) {
    const minzoom = tilejson.minzoom || 0;
    zoom = tilejson.maxzoom - ((tilejson.maxzoom - minzoom) / 2);
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
    </style>
  </head>
  
  <body>
    <div id="map"></div>
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
        ${(tilejson.vector_layers || []).map((layer) => `
          <li style="padding: 5px; margin:0px; display:flex;align-items:center;"><input type="checkbox" style="margin-right:4px;" checked onclick="window.toggleLayer('${layer.id}')" />${layer.id}</li>
        `).join("\n")}
      </ul>
      <div style="padding:5px;">
        <button onclick="toggleAll()">toggle all</button>
      </div>

    </div>
    <script>
      mapboxgl.accessToken = ${JSON.stringify(mapboxAccessToken)};
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/seasketch/cl892c7ia001e14qpbr4gnf4k',
        zoom: ${zoom},
        center: ${JSON.stringify(center.slice(0,2))},
      });

      map.on('load', function() {
        ${isVector ? `
        map.addSource('tileset', {
          'type': 'vector',
          'url': "/${name}.json"
        });      
        ` : `
        map.addSource('tileset', {
          'type': 'raster',
          'url': "/${name}.json"
        });
        `}

        ${isVector ? `` :
        `
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
        `}

        ${tilejson.vector_layers.map((layer, i) => `
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
        `).join("\n")}
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
  `
}
