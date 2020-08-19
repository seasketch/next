Easily add Esri map services or vector layers to MapBox GL JS, maintaining a faithful reproduction of cartographic style. In many cases services can render with greater graphical fidelity and performance than in the Esri JS API or ArcGIS Online.

<img src="https://user-images.githubusercontent.com/511063/90651726-3b36be00-e1f2-11ea-891a-aa39bd24f28c.png" alt="vector layers demonstration in mapbox" width="512"/>

## Examples

- [Dynamic MapService](https://seasketch.github.io/mapbox-gl-esri-sources/examples/arcgisDynamic.html)
- [Vector Layers](https://seasketch.github.io/mapbox-gl-esri-sources/examples/arcgisVectorLayers.html)

## ArcGIS Tiled Map Services

Tiled services host pre-seeded sets of image tiles referenced using z/y/z urls similar to WMTS or TMS layers. You actually don't need this module to load tiled services, but since you are here I'll show you how to do it!

[Anacapa Island Tiled Service Example](https://seasketch.github.io/mapbox-gl-esri-sources/examples/arcgisTiled.html)

```javascript
map.on("load", () => {
  // add the image source
  map.addSource("tile-layer", {
    type: "raster",
    tiles: [
      // Be sure to reference the /tile/ endpoint with appropriate template vars
      "https://tiles.arcgis.com/tiles/4TXrdeWh0RyCqPgB/arcgis/rest/services/Anacapa_Island/MapServer/tile/{z}/{y}/{x}",
    ],
    // Most services have tile sizes of 256. You may use this division trick to
    // support higher resolution screens, though watch out for missing tile
    // images at higher zoom levels.
    tileSize: 256 / window.devicePixelRatio,
    // min/max zoom can be based on service metadata
    minZoom: 0,
    maxZoom: 23,
    // MapService metadata also has a "Full Extent", which you can convert to
    // degrees and avoid 404 errors from out of bounds requests
    bounds: [
      -119.45627340923632,
      33.9923034787097,
      -119.33632759039419,
      34.028212713477615,
    ],
    // More options are detailed in:
    // https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#raster-tiles
  });
  // now add a layer that references this source
  map.addLayer({
    id: "esri-tiles",
    source: "tile-layer",
    type: "raster",
    // see https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#raster
    // you can control opacity, saturation, and other rendering aspects
  });
});
```

## ArcGIS Dynamic Map Services

Dynamic Map Services are more difficult to support without this module. These services work similar to older WMS where it's expected that images representing the entire viewport are requested. `mapbox-gl-esri-sources` provides an [ArcGISDynamicService](https://seasketch.github.io/mapbox-gl-esri-sources/docs/classes/arcgisdynamicmapservice.html) class which will listen to map viewport change events and update this image. It also provides [methods](https://seasketch.github.io/mapbox-gl-esri-sources/docs/classes/arcgisdynamicmapservice.html#updatelayers) to update sublayer visibility, order and opacity.

By default images will be requested in a resolution that matches the client's [devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) for higher quality maps on high-dpi devices.

```javascript
import { ArcGISDynamicMapService } from "mapbox-gl-esri-sources";

 // ... setup your map
 map.on("load", () => {
   const populatedPlaces = new ArcGISDynamicMapService(
    map,
    "populated-places-source",
    "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer", {
      supportsDynamicLayers: true,
      sublayers: [
        { sublayer: 0, opacity: 1 },
        { sublayer: 1, opacity: 1 },
        { sublayer: 2, opacity: 0.5 },
      ],
      queryParameters: {
        format: 'png32'
      }
    }
  });
  // Don't forget to add a layer to reference your source
  map.addLayer({
    id: "ags-layer",
    type: "raster",
    source: populatedPlaces.id,
    paint: {
      // fading looks weird on non-tiled images
      "raster-fade-duration": 0,
    },
  });
  // turn off the third sublayer and update opacity
  populatedPlaces.updateLayers([
    { sublayer: 0, opacity: 0.5 },
    { sublayer: 1, opacity: 1 },
  ]);
});
```

[API Documentation](https://seasketch.github.io/mapbox-gl-esri-sources/docs/classes/arcgisdynamicmapservice.html)

[Dynamic Map Service Examples](https://seasketch.github.io/mapbox-gl-esri-sources/examples/arcgisDynamic.html)

## ArcGIS Feature Layers

Both Esri map and feature services typically support querying vector data through a "feature layer" endpoint and most often this is the best way to display data from ArcGIS in MapBox GL. This module provides both an [ArcGISVectorSource](https://seasketch.github.io/mapbox-gl-esri-sources/docs/classes/arcgisvectorsource.html) class for loading the entire dataset as a GeoJSON source, and the [styleForFeatureLayer](https://seasketch.github.io/mapbox-gl-esri-sources/docs/globals.html#styleforfeaturelayer) function which will faithfully translate renderer information from the ArcGIS REST API into GL Style.

```javascript
import {
  ArcGISVectorSource,
  styleForFeatureLayer,
} from "mapbox-gl-esri-sources";

// setup map...

map.on("load", () => {

  const { imageList, layers } = styleForFeatureLayer(
    "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0",
    "cities-source-id"
  );

  const esriSource = new ArcGISVectorSource(
    map,
    'cities-source-id',
    "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0"),
    {
      bytesLimit: 1000 * 1000 * 2, // 2mb
    }
  );

  imageList.addToMap(map);

  for (const layer of layers) {
    map.addLayer(layer);
  }
});
```

The process of generating images and styles is seperate from loading the vector source to provide more flexibility. Rather than just dynamically loading style and data together, you might generate and cache style information so that it doesn't have to be created on each map load. You could also adjust layers as needed, or even generate vector tiles from complex services using tippecanoe and use the same layers with this new derivative source.

[Vector Layer Examples](https://seasketch.github.io/mapbox-gl-esri-sources/examples/arcgisVectorLayers.html)

[ArcGISVectorSource API](https://seasketch.github.io/mapbox-gl-esri-sources/docs/classes/arcgisvectorsource.html) | [styleForFeatureLayer API](https://seasketch.github.io/mapbox-gl-esri-sources/docs/globals.html#styleforfeaturelayer)
