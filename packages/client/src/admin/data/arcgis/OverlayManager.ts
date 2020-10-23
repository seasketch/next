import {
  ArcGISDynamicMapService,
  ArcGISDynamicMapServiceOptions,
  ArcGISVectorSource,
  ArcGISVectorSourceOptions,
} from "@seasketch/mapbox-gl-esri-sources";
import { ImageList } from "@seasketch/mapbox-gl-esri-sources/dist/src/ImageList";
import { ImageSource, Layer, Map } from "mapbox-gl";
import { v4 as uuid } from "uuid";

interface Overlay {
  id: string;
  type: "ArcGISDynamicMapService" | "ArcGISVectorSource";
}

interface ArcGISDynamicMapServiceOverlay extends Overlay {
  url: string;
  options: ArcGISDynamicMapServiceOptions;
  fadeDuration?: number;
}

interface ArcGISDynamicMapServiceOverlayInstance
  extends ArcGISDynamicMapServiceOverlay {
  instance: ArcGISDynamicMapService;
  layer: Layer;
}

interface ArcGISVectorSourceOverlay extends Overlay {
  url: string;
  options: ArcGISVectorSourceOptions;
  imageList: ImageList;
  layers: Layer[];
  finalAddedLayers?: Layer[];
}

interface ArcGISVectorSourceOverlayInstance extends ArcGISVectorSourceOverlay {
  instance: ArcGISVectorSource;
}

export type OverlayConfig = (
  | ArcGISDynamicMapServiceOverlay
  | ArcGISVectorSourceOverlay
)[];

export default class OverlayManager {
  private map: Map;
  private visibleOverlays: (
    | ArcGISDynamicMapServiceOverlayInstance
    | ArcGISVectorSourceOverlayInstance
  )[];
  private visibleLayersIds: { [overlayId: string]: string[] } = {};

  constructor(
    map: Map,
    overlays?: (ArcGISDynamicMapServiceOverlay | ArcGISVectorSourceOverlay)[]
  ) {
    this.visibleOverlays = [];
    this.map = map;
    if (overlays) {
      this.updateOverlays(overlays);
    }
  }

  updateOverlays(
    newOverlays: (ArcGISDynamicMapServiceOverlay | ArcGISVectorSourceOverlay)[]
  ) {
    // // update or remove existing overlays depending on new configuration
    // for (const existingOverlay of [...this.visibleOverlays]) {
    //   const newOverlayProps = newOverlays.find(
    //     ({ id }) => id === existingOverlay.id
    //   );
    //   if (!newOverlayProps) {
    //     // remove any overlays that should no longer be visible
    //     this.removeOverlay(existingOverlay);
    //   } else {
    //     // update any that already exist
    //     this.updateOverlay(existingOverlay, newOverlayProps);
    //   }
    // }
    // // add the rest
    // for (const overlay of newOverlays) {
    //   const match = this.visibleOverlays.find(({ id }) => id === overlay.id);
    //   if (!match) {
    //     this.addOverlay(overlay);
    //   }
    // }
  }

  private removeOverlay(
    overlay:
      | ArcGISVectorSourceOverlayInstance
      | ArcGISDynamicMapServiceOverlayInstance
  ) {
    if (isArcGISDynamicMapServiceOverlayInstance(overlay)) {
      overlay.instance.destroy();
      this.map.removeLayer(overlay.layer.id);
      this.map.removeSource(overlay.id);
    } else if (isArcGISVectorSourceOverlayInstance(overlay)) {
      this.removeLayersForOverlay(overlay.id);
      this.map.removeSource(overlay.id);
    } else {
      throw new Error("Unrecognized overlay type");
    }
    this.visibleOverlays = this.visibleOverlays.filter((o) => o !== overlay);
  }

  private async updateOverlay(
    existingOverlay:
      | ArcGISVectorSourceOverlayInstance
      | ArcGISDynamicMapServiceOverlayInstance,
    newProperties: ArcGISVectorSourceOverlay | ArcGISDynamicMapServiceOverlay
  ) {
    if (existingOverlay.id !== newProperties.id) {
      throw new Error("Cannot update overlay with different ID than original");
    }
    if (isArcGISDynamicMapServiceOverlayInstance(existingOverlay)) {
      // ArcGISDynamicMapService instances will compare new options and prevent
      // unnecessary re-renders
      const props = newProperties as ArcGISDynamicMapServiceOverlay;
      if (props.options.useDevicePixelRatio !== undefined) {
        existingOverlay.instance.updateUseDevicePixelRatio(
          props.options.useDevicePixelRatio
        );
      }
      if (props.options.queryParameters) {
        existingOverlay.instance.updateQueryParameters(
          props.options.queryParameters
        );
      }
      if (props.options.layers) {
        existingOverlay.instance.updateLayers(props.options.layers);
      }
      if (props.url !== existingOverlay.url) {
        throw new Error("Cannot update the url of an overlay");
      }
      existingOverlay.options = props.options;
    } else if (isArcGISVectorSourceOverlayInstance(existingOverlay)) {
      const props = newProperties as ArcGISVectorSourceOverlay;
      if (props.url !== existingOverlay.url) {
        throw new Error("Cannot update the url of an overlay");
      }
      // ArcGISVectorSource instances aren't designed to be updated. Any changes
      // to options will require removing any layers and reloading the source
      const optionsChanges =
        props.options.bytesLimit != existingOverlay.options.bytesLimit ||
        props.options.geometryPrecision !=
          existingOverlay.options.geometryPrecision ||
        props.options.outFields != existingOverlay.options.outFields ||
        props.options.supportsPagination !=
          existingOverlay.options.supportsPagination;
      // TODO: may need to improve layer and imageList comparison here
      if (
        optionsChanges ||
        props.layers !== existingOverlay.layers ||
        props.imageList !== existingOverlay.imageList
      ) {
        this.removeLayersForOverlay(existingOverlay.id);
        if (props.imageList !== existingOverlay.imageList) {
          await existingOverlay.imageList.removeFromMap(this.map);
          existingOverlay.imageList = props.imageList;
          await existingOverlay.imageList.addToMap(this.map);
        }
        if (optionsChanges) {
          this.map.removeSource(existingOverlay.id);
          const newSource = new ArcGISVectorSource(
            this.map,
            props.id,
            props.url,
            props.options
          );
          existingOverlay.options = props.options;
        }
        this.addLayersForOverlay(existingOverlay.id, props.layers);
      }
    } else {
      throw new Error("Unrecognized overlay type");
    }
  }

  private removeLayersForOverlay(overlayId: string) {
    for (const id of this.visibleLayersIds[overlayId]) {
      this.map.removeLayer(id);
    }
    this.visibleLayersIds[overlayId] = [];
  }

  private addLayersForOverlay(overlayId: string, layers: Layer[]) {
    this.visibleLayersIds[overlayId] = this.visibleLayersIds[overlayId] || [];
    for (var i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const id = overlayId + "-layer-" + i;
      this.map.addLayer({
        ...layer,
        source: overlayId,
        id,
      });
      this.visibleLayersIds[overlayId].push(id);
    }
  }

  private addOverlay(
    overlay: ArcGISDynamicMapServiceOverlay | ArcGISVectorSourceOverlay
  ) {
    if (overlay.type === "ArcGISDynamicMapService") {
      overlay = overlay as ArcGISDynamicMapServiceOverlay;
      const instance = new ArcGISDynamicMapService(
        this.map,
        overlay.id,
        overlay.url,
        overlay.options as ArcGISDynamicMapServiceOptions
      );
      const layer: Layer = {
        source: instance.id,
        id: instance.id + "-raster-layer",
        type: "raster",
        paint: {
          "raster-fade-duration": overlay.fadeDuration || 0,
        },
      };
      this.map.addLayer(layer);
      this.visibleOverlays.push({
        ...(overlay as ArcGISDynamicMapServiceOverlay),
        instance,
        layer: layer,
      });
    } else if (overlay.type === "ArcGISVectorSource") {
      overlay = overlay as ArcGISVectorSourceOverlay;
      const instance = new ArcGISVectorSource(
        this.map,
        overlay.id,
        overlay.url,
        {
          ...overlay.options,
          onError: (e) => console.error(e),
          cacheStrategy: "default",
        } as ArcGISVectorSourceOptions
      );
      if (overlay.imageList) {
        overlay.imageList.addToMap(this.map);
      }
      this.addLayersForOverlay(overlay.id, overlay.layers);
      this.visibleOverlays.push({
        ...overlay,
        instance,
      });
    } else {
      throw new Error("Unrecognized overlay type");
    }
  }

  destroy() {
    this.updateOverlays([]);
  }
}

function isArcGISDynamicMapServiceOverlayInstance(
  overlay: Overlay
): overlay is ArcGISDynamicMapServiceOverlayInstance {
  return overlay.type === "ArcGISDynamicMapService";
}

function isArcGISVectorSourceOverlayInstance(
  overlay: Overlay
): overlay is ArcGISVectorSourceOverlayInstance {
  return overlay.type === "ArcGISVectorSource";
}
