import {
  ArcGISDynamicMapService,
  ArcGISDynamicMapServiceOptions,
} from "@seasketch/mapbox-gl-esri-sources";
import { Map } from "mapbox-gl";
import { SeaSketchLayer } from "../LayerManager";
import { SeaSketchSourceBaseOptions } from "./Base";

export type ArcGISDynamicMapServiceSource = {
  type: "ArcGISDynamicMapService";
  url: string;
  options: ArcGISDynamicMapServiceOptions;
} & SeaSketchSourceBaseOptions;

export function updateDynamicMapService(
  prev: ArcGISDynamicMapServiceSource,
  state: ArcGISDynamicMapServiceSource,
  instance: ArcGISDynamicMapService,
  layers: SeaSketchLayer[],
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
    state.options.useDevicePixelRatio === undefined
      ? true
      : state.options.useDevicePixelRatio
  );
  instance.updateQueryParameters(state.options.queryParameters || {});
  return instance;
}

export function isArcGISDynamicServiceLoading(
  instance: ArcGISDynamicMapService,
  map: Map
) {
  return instance.loading;
}
