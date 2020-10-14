import {
  ArcGISDynamicMapService,
  ArcGISDynamicMapServiceOptions,
  ArcGISVectorSource,
  ArcGISVectorSourceOptions,
} from "@seasketch/mapbox-gl-esri-sources";
import { ImageList } from "@seasketch/mapbox-gl-esri-sources/dist/src/ImageList";
import { ImageSource, Layer, Map } from "mapbox-gl";

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
    overlays: (ArcGISDynamicMapServiceOverlay | ArcGISVectorSourceOverlay)[]
  ) {
    // update or remove existing overlays depending on new configuration
    for (const overlay of [...this.visibleOverlays]) {
      const match = overlays.find(({ id }) => id === overlay.id);
      if (!match) {
        // remove any overlays that should no longer be visible
        this.removeOverlay(overlay);
      } else {
        // update any that already exist
        this.updateOverlay(overlay, match);
      }
    }
    // add the rest
    for (const overlay of overlays) {
      const match = this.visibleOverlays.find(({ id }) => id === overlay.id);
      if (!match) {
        this.addOverlay(overlay);
      }
    }
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
      for (const layer of overlay.layers) {
        this.map.removeLayer(layer.id);
      }
      this.map.removeSource(overlay.id);
    } else {
      throw new Error("Unrecognized overlay type");
    }
    this.visibleOverlays = this.visibleOverlays.filter((o) => o !== overlay);
  }

  private async updateOverlay(
    overlay:
      | ArcGISVectorSourceOverlayInstance
      | ArcGISDynamicMapServiceOverlayInstance,
    newProperties: ArcGISVectorSourceOverlay | ArcGISDynamicMapServiceOverlay
  ) {
    if (overlay.id !== newProperties.id) {
      throw new Error("Cannot update overlay with different ID than original");
    }
    if (isArcGISDynamicMapServiceOverlayInstance(overlay)) {
      // ArcGISDynamicMapService instances will compare new options and prevent
      // unnecessary re-renders
      const props = newProperties as ArcGISDynamicMapServiceOverlay;
      if (props.options.useDevicePixelRatio !== undefined) {
        overlay.instance.updateUseDevicePixelRatio(
          props.options.useDevicePixelRatio
        );
      }
      if (props.options.queryParameters) {
        overlay.instance.updateQueryParameters(props.options.queryParameters);
      }
      if (props.options.layers) {
        overlay.instance.updateLayers(props.options.layers);
      }
      if (props.url !== overlay.url) {
        throw new Error("Cannot update the url of an overlay");
      }
      overlay.options = props.options;
    } else if (isArcGISVectorSourceOverlayInstance(overlay)) {
      const props = newProperties as ArcGISVectorSourceOverlay;
      if (props.url !== overlay.url) {
        throw new Error("Cannot update the url of an overlay");
      }
      // ArcGISVectorSource instances aren't designed to be updated. Any changes
      // to options will require removing any layers and reloading the source
      const optionsChanges =
        props.options.displayIncompleteFeatureCollections !=
          overlay.options.displayIncompleteFeatureCollections ||
        props.options.geometryPrecision != overlay.options.geometryPrecision ||
        props.options.outFields != overlay.options.outFields ||
        props.options.supportsPagination != overlay.options.supportsPagination;
      // TODO: may need to improve layer and imageList comparison here
      if (
        optionsChanges ||
        props.layers !== overlay.layers ||
        props.imageList !== overlay.imageList
      ) {
        for (const layer of props.layers) {
          this.map.removeLayer(layer.id);
        }
        if (props.imageList !== overlay.imageList) {
          await overlay.imageList.removeFromMap(this.map);
          overlay.imageList = props.imageList;
          await overlay.imageList.addToMap(this.map);
        }
        if (optionsChanges) {
          this.map.removeSource(overlay.id);
          const newSource = new ArcGISVectorSource(
            this.map,
            props.id,
            props.url,
            props.options
          );
          overlay.options = props.options;
        }
        overlay.layers = props.layers;
        for (const layer of overlay.layers) {
          this.map.addLayer(layer);
        }
      }
    } else {
      throw new Error("Unrecognized overlay type");
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
      for (const layer of overlay.layers) {
        this.map.addLayer(layer);
      }
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
