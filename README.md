## Example Usage, ArcGISDynamicMapService

```js
const { ArcGISDynamicMapService } = require("mapbox-gl-dynamic-image-sources");

// setup map ...

const esriSource = new ArcGISDynamicMapService(
  map,
  "hurricanes-ags",
  "https://sampleserver6.arcgisonline.com/arcgis/rest/services/Hurricanes/MapServer",
  {
    layers: [1],
    queryParameters: {
      dpi: 96 * window.devicePixelRatio,
    },
  }
);

// you will need to specify how to render this service with a layer
map.addLayer({
  id: esriSource.id,
  type: "image",
  source: "hurricanes",
  paint: {
    // paint can adjust opacity, saturation, hue, and other properties
    "raster-opacity": 0.85,
  },
});

// toggle a sublayer
esriSource.showLayers([0, 1]);
// you can update any query parameter and the source image will be updated
esriSource.updateQueryParams({ format: "png24" });

// ArcGIS-specific functions
// set sublayer opacity to 50%
esriSource.setSublayerOpacity(0, 0.5);
// reorder sublayers
esriSource.setSublayerOrder([1, 0]);
// the previous two methods require fetching drawingInfo once for each sublayer.
// you may speed up this process on initialization by fetching this early
esriSource.fetchDrawingInfo();

// remove from map entirely
esriSource.destroy();
```
