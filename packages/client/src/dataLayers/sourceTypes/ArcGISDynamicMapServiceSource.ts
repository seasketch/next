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
      `Changing type of ArcGISDynamicMapServiceSource is not supported`
    );
  }
  if (prev.url !== state.url) {
    throw new Error(
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
  sublayers: string[]
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
  url.searchParams.set("layers", `show:${sublayers.join(",")}`);
  // url.searchParams.set("bbox", "{bbox-epsg-3857}");
  url.searchParams.set("size", [size, size].join(","));
  url.searchParams.set("transparent", "true");
  url.searchParams.set("f", "image");
  return { url: url.toString() + "&bbox={bbox-epsg-3857}", tileSize };
  // getUrl() {
  //   const bounds = this.map.getBounds();
  //   // create bbox in web mercator
  //   let bbox = [
  //     lon2meters(bounds.getWest()),
  //     lat2meters(bounds.getSouth()),
  //     lon2meters(bounds.getEast()),
  //     lat2meters(bounds.getNorth()),
  //   ];
  //   const groundResolution = getGroundResolution(
  //     this.map.getZoom() +
  //       (this.supportDevicePixelRatio ? window.devicePixelRatio - 1 : 0)
  //   );
  //   // Width and height can't be based on container width if the map is rotated
  //   const width = Math.round((bbox[2] - bbox[0]) / groundResolution);
  //   const height = Math.round((bbox[3] - bbox[1]) / groundResolution);
  //   this.url.searchParams.set("format", "png");
  //   this.url.searchParams.set("size", [width, height].join(","));
  //   // Default to epsg:3857
  //   this.url.searchParams.set("imageSR", "102100");
  //   this.url.searchParams.set("bboxSR", "102100");
  //   // If the map extent crosses the meridian, we need to create a new
  //   // projection and map the x coordinates to that space. The Esri JS API
  //   // exhibits this same behavior. Solution was inspired by:
  //   // * https://github.com/Esri/esri-leaflet/issues/672#issuecomment-160691149
  //   // * https://gist.github.com/perrygeo/4478844
  //   if (Math.abs(bbox[0]) > 20037508.34 || Math.abs(bbox[2]) > 20037508.34) {
  //     const centralMeridian = bounds.getCenter().lng;
  //     if (this.supportDevicePixelRatio && window.devicePixelRatio > 1) {
  //       bbox[0] = -(width * groundResolution) / (window.devicePixelRatio * 2);
  //       bbox[2] = (width * groundResolution) / (window.devicePixelRatio * 2);
  //     } else {
  //       bbox[0] = -(width * groundResolution) / 2;
  //       bbox[2] = (width * groundResolution) / 2;
  //     }
  //     const sr = JSON.stringify({
  //       wkt: `PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",${centralMeridian}],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]`,
  //     });
  //     this.url.searchParams.set("imageSR", sr);
  //     this.url.searchParams.set("bboxSR", sr);
  //   }
  //   if (Array.isArray(this.layers)) {
  //     if (this.layers.length === 0) {
  //       return blankDataUri;
  //     } else {
  //       this.url.searchParams.set(
  //         "layers",
  //         `show:${this.layers.map((lyr) => lyr.sublayer).join(",")}`
  //       );
  //     }
  //   }
  //   this.url.searchParams.set("bbox", bbox.join(","));
  //   this.url.searchParams.delete("dynamicLayers");
  //   let layersInOrder = true;
  //   let hasOpacityUpdates = false;
  //   if (this.supportsDynamicLayers && this.layers) {
  //     for (var i = 0; i < this.layers.length; i++) {
  //       if (
  //         this.layers[i - 1] &&
  //         this.layers[i].sublayer < this.layers[i - 1].sublayer
  //       ) {
  //         layersInOrder = false;
  //       }
  //       const opacity = this.layers[i].opacity;
  //       if (opacity !== undefined && opacity < 1) {
  //         hasOpacityUpdates = true;
  //       }
  //     }
  //   }
  //   if (this.layers && (!layersInOrder || hasOpacityUpdates)) {
  //     // need to provide renderInfo
  //     const dynamicLayers = this.layers.map((lyr) => {
  //       return {
  //         id: lyr.sublayer,
  //         source: {
  //           mapLayerId: lyr.sublayer,
  //           type: "mapLayer",
  //         },
  //         drawingInfo: {
  //           transparency:
  //             lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
  //         },
  //       };
  //     });
  //     this.url.searchParams.set("dynamicLayers", JSON.stringify(dynamicLayers));
  //   }
  //   for (const key in this.queryParameters) {
  //     this.url.searchParams.set(key, this.queryParameters[key].toString());
  //   }
  //   return this.url.toString();
  // }
}
