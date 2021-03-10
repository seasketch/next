import {
  ArcGISDynamicMapService,
  ArcGISDynamicMapServiceOptions,
} from "@seasketch/mapbox-gl-esri-sources";
import { Map } from "mapbox-gl";
import { ClientDataSource, ClientDataLayer } from "../MapContextManager";
import { SeaSketchSourceBaseOptions } from "./Base";

export type ArcGISDynamicMapServiceSource = {
  type: "ArcGISDynamicMapService";
  url: string;
  options: ArcGISDynamicMapServiceOptions;
} & SeaSketchSourceBaseOptions;

export function updateDynamicMapService(
  prev: ClientDataSource,
  state: ClientDataSource,
  instance: ArcGISDynamicMapService,
  layers: ClientDataLayer[],
  map: Map
) {
  if (prev.type !== state.type) {
    throw new Error(
      // eslint-disable-next-line
      `Changing type of ArcGISDynamicMapServiceSource is not supported`
    );
  }
  if (prev.url !== state.url) {
    throw new Error(
      // eslint-disable-next-line
      `Changing url of ArcGISDynamicMapServiceSource is not supported`
    );
  }
  // Don't need to remove the layers since these services can be updated dynamically
  // The library itself will check if there are any meaningful changes here
  instance.updateUseDevicePixelRatio(
    state.useDevicePixelRatio === false ? false : true
  );
  instance.updateQueryParameters(state.queryParameters || {});
  return instance;
}

export function isArcGISDynamicServiceLoading(
  instance: ArcGISDynamicMapService,
  map: Map
) {
  return instance.loading;
}

export function urlTemplateForArcGISDynamicSource(
  source: ClientDataSource,
  sublayers: { sublayer: string; opacity?: number }[]
) {
  const url = new URL(source.url! + "/export");
  const tileSize = 256;
  if (source.useDevicePixelRatio) {
    switch (window.devicePixelRatio) {
      case 1:
        // standard pixelRatio looks best at 96
        url.searchParams.set("dpi", "96");
        break;
      case 2:
        // for higher pixelRatios, esri's software seems to like the dpi
        // bumped up somewhat higher than a simple formula would suggest
        url.searchParams.set("dpi", "220");
        break;
      case 3:
        url.searchParams.set("dpi", "390");
        break;
      default:
        url.searchParams.set(
          "dpi",
          // Bumping pixel ratio a bit. see above
          (window.devicePixelRatio * 96 * 1.22).toString()
        );
        break;
    }
  } else {
    url.searchParams.set("dpi", "96");
  }
  url.searchParams.set("format", "png");
  for (const key in source.queryParameters || {}) {
    url.searchParams.set(key, source.queryParameters[key].toString());
  }
  const size = source.useDevicePixelRatio
    ? tileSize * window.devicePixelRatio
    : tileSize;
  // Default is epsg:3857
  url.searchParams.set("imageSR", "102100");
  url.searchParams.set("bboxSR", "102100");
  /* eslint-disable */
  url.searchParams.set(
    "layers",
    `show:${sublayers.map((l) => l.sublayer).join(",")}`
  );
  /* eslint-enable */
  // url.searchParams.set("bbox", "{bbox-epsg-3857}");
  url.searchParams.set("size", [size, size].join(","));
  url.searchParams.set("transparent", "true");
  url.searchParams.set("f", "image");
  let layersInOrder = true;
  let hasOpacityUpdates = false;
  if (source.supportsDynamicLayers) {
    for (var i = 0; i < sublayers.length; i++) {
      if (
        sublayers[i - 1] &&
        sublayers[i].sublayer < sublayers[i - 1].sublayer
      ) {
        layersInOrder = false;
        break;
      }
      const opacity = sublayers[i].opacity;
      if (opacity !== undefined && opacity < 1) {
        hasOpacityUpdates = true;
        break;
      }
    }
  }
  if (!layersInOrder || hasOpacityUpdates) {
    // need to provide renderInfo
    const dynamicLayers = sublayers.map((lyr) => {
      return {
        id: lyr.sublayer,
        source: {
          mapLayerId: lyr.sublayer,
          type: "mapLayer",
        },
        drawingInfo: {
          transparency: lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
        },
      };
    });
    url.searchParams.set("dynamicLayers", JSON.stringify(dynamicLayers));
  }
  return { url: url.toString() + "&bbox={bbox-epsg-3857}", tileSize };
}
