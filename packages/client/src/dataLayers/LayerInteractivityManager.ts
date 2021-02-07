import { Layer, Map, MapMouseEvent, Popup } from "mapbox-gl";
import {
  ClientDataLayer,
  ClientDataSource,
  idForLayer,
  layerIdFromStyleLayerId,
  MapContextInterface,
  Tooltip,
} from "./MapContextManager";
import Mustache from "mustache";
import { Dispatch, SetStateAction } from "react";
import { DataSourceTypes, InteractivityType } from "../generated/graphql";
import {
  getDynamicArcGISStyle,
  identifyLayers,
} from "../admin/data/arcgis/arcgis";

/**
 * LayerInteractivityManager works in tandem with the MapContextManager to react
 * to user interaction which clicks, hovers, or otherwise interacts with map content
 * to show popups and other extra information. It operates on both vector layers and
 * image layers for which it is necessary to call an external service to retrieve
 * attribute information.
 */
export default class LayerInteractivityManager {
  private map: Map;
  private setState: Dispatch<SetStateAction<MapContextInterface>>;

  /** List of interactive layers that are currently shown on the map. Update with setVisibleLayers() */
  private layers: { [layerId: string]: ClientDataLayer } = {};
  /**
   * List of image sources related to visible layers. Note only sources that
   * require api requests to display popups need to be stored
   */
  private imageSources: { [sourceId: string]: ClientDataSource } = {};
  private previousInteractionTarget?: string;
  private debouncedMouseMoveListenerReference?: NodeJS.Timeout;
  private popupAbortController: AbortController | undefined;
  private interactiveVectorLayerIds: string[] = [];
  private interactiveImageLayerIds: string[] = [];

  /**
   *
   * @param map Map that should support user interaction. Use #setMap to update
   * @param setState The state of banner and tooltip messages is held in the
   * MapContext. Use this function to set it.
   */
  constructor(
    map: Map,
    setState: Dispatch<SetStateAction<MapContextInterface>>
  ) {
    this.map = map;
    this.registerEventListeners(map);
    this.setState = setState;
  }

  /**
   * Update the map that supports user interaction. Will update all event listeners
   * @param map
   */
  setMap(map: Map) {
    if (this.map) {
      this.unregisterEventListeners(this.map);
    }
    this.map = map;
    this.registerEventListeners(map);
  }

  /**
   * Should be called by the MapContextManager whenever visible layers change so
   * that this module can update it's internal list of visible interactive layers.
   * @param dataLayers
   */
  async setVisibleLayers(
    dataLayers: ClientDataLayer[],
    dataSources: { [dataSourceId: string]: ClientDataSource }
  ) {
    const newActiveLayers: { [layerId: string]: ClientDataLayer } = {};
    const newActiveImageSources: { [sourceId: string]: ClientDataSource } = {};
    const newInteractiveImageLayerIds: string[] = [];
    let newInteractiveVectorLayerIds: string[] = [];
    for (const layer of dataLayers) {
      const source = dataSources[layer.dataSourceId];
      if (source) {
        if (
          layer.interactivitySettings &&
          layer.interactivitySettings.type !== InteractivityType.None
        ) {
          if (layer.sublayer) {
            newInteractiveImageLayerIds.push(layer.id.toString());
            newActiveImageSources[source.id] = source;
            newActiveLayers[layer.id] = layer;
          } else {
            let GLStyles: Layer[];
            if (layer.mapboxGlStyles && Array.isArray(layer.mapboxGlStyles)) {
              GLStyles = layer.mapboxGlStyles;
            } else {
              if (source.type === DataSourceTypes.ArcgisVector) {
                const { layers } = await getDynamicArcGISStyle(
                  source.url!,
                  source.id.toString()
                );
                GLStyles = layers;
              } else {
                throw new Error(
                  `Could not find mapbox layer ids for client layer id=${layer.id}`
                );
              }
            }
            newInteractiveVectorLayerIds = [
              ...newInteractiveVectorLayerIds,
              ...GLStyles.map((s, i) => idForLayer(layer, i)),
            ];
            newActiveLayers[layer.id] = layer;
          }
        }
      }
    }
    this.interactiveImageLayerIds = newInteractiveImageLayerIds;
    this.interactiveVectorLayerIds = newInteractiveVectorLayerIds;
    this.layers = newActiveLayers;
    this.imageSources = newActiveImageSources;
    this.map.off("mousemove", this.debouncedMouseMoveListener);
    if (this.interactiveVectorLayerIds.length > 0) {
      this.map.on("mousemove", this.debouncedMouseMoveListener);
    }
  }

  /**
   * Call to remove all event listeners from a map.
   */
  destroy() {
    this.unregisterEventListeners(this.map);
  }

  private unregisterEventListeners(map: Map) {
    map.off("mouseout", this.onMouseOut);
    map.off("mousemove", this.debouncedMouseMoveListener);
    map.off("click", this.onMouseClick);
  }

  private registerEventListeners(map: Map) {
    map.on("mouseout", this.onMouseOut);
    map.on("click", this.onMouseClick);
  }

  private onMouseOut = () => {
    setTimeout(() => {
      delete this.previousInteractionTarget;
      this.setState((prev) => ({
        ...prev,
        tooltip: undefined,
        bannerMessages: [],
        fixedBlocks: [],
      }));
    }, 7);
  };

  private onMouseClick = async (e: MapMouseEvent) => {
    if (this.popupAbortController) {
      this.popupAbortController.abort();
      delete this.popupAbortController;
    }
    const features = this.map!.queryRenderedFeatures(e.point, {
      layers: this.interactiveVectorLayerIds,
    });
    const top = features[0];
    let vectorPopupOpened: ClientDataLayer | undefined;
    if (top) {
      const dataLayer = this.layers[layerIdFromStyleLayerId(top.layer.id)];
      if (!dataLayer) {
        console.warn(
          `Could not find interactive dataLayer with id=${layerIdFromStyleLayerId(
            top.layer.id
          )}`
        );
        return;
      }
      const interactivitySetting = dataLayer.interactivitySettings;
      if (
        interactivitySetting &&
        interactivitySetting.type === InteractivityType.Popup
      ) {
        var popup = new Popup({ closeOnClick: true, closeButton: false })
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .setHTML(
            Mustache.render(interactivitySetting.longTemplate || "", {
              ...mustacheHelpers,
              ...top.properties,
            })
          )
          .addTo(this.map!);
        vectorPopupOpened = dataLayer;
      }
    }
    if (!vectorPopupOpened) {
      // Are any image layers active that support identify tools?
      const interactiveImageLayers = this.interactiveImageLayerIds.map(
        (id) => this.layers[id]
      );
      interactiveImageLayers.sort((a, b) => a.zIndex - b.zIndex);
      if (interactiveImageLayers.length) {
        this.openImageServicePopups(
          [e.lngLat.lng, e.lngLat.lat],
          interactiveImageLayers
        );
      }
    }
  };

  private async openImageServicePopups(
    position: [number, number],
    layers: ClientDataLayer[]
  ) {
    if (this.popupAbortController) {
      this.popupAbortController.abort();
      delete this.popupAbortController;
    }
    this.popupAbortController = new AbortController();
    const requests: { sublayers: string[]; source: ClientDataSource }[] = [];
    for (const layer of layers) {
      let existingRequest = requests.find(
        (r) => r.source.id === layer.dataSourceId
      );
      if (!existingRequest) {
        const source = this.imageSources[layer.dataSourceId];
        if (!source) {
          throw new Error(`Could not find source id=${layer.dataSourceId}`);
        }
        existingRequest = {
          sublayers: [],
          source: source,
        };
        requests.push(existingRequest);
      }
      existingRequest.sublayers.push(layer.sublayer!);
    }
    const bounds = this.map!.getBounds();
    const extent = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ] as [number, number, number, number];
    const width = this.map!.getCanvas().width;
    const height = this.map!.getCanvas().height;
    const dpi = window.devicePixelRatio * 96;
    this.map!.getCanvas().style.cursor = "progress";
    const data = await Promise.all(
      requests.map((request) => {
        return identifyLayers(
          position,
          request.source,
          request.sublayers,
          extent,
          width,
          height,
          dpi,
          this.popupAbortController
        );
      })
    );
    this.map!.getCanvas().style.cursor = "";
    if (!this.popupAbortController.signal.aborted) {
      for (const sublayerData of data) {
        if (sublayerData.length) {
          const interactivitySetting = layers.find(
            (l) =>
              l.sublayer?.toString() === sublayerData[0].sublayer.toString() &&
              l.dataSourceId === sublayerData[0].sourceId
          )?.interactivitySettings;
          var popup = new Popup({ closeOnClick: true, closeButton: false })
            .setLngLat(position)
            .setHTML(
              Mustache.render(interactivitySetting!.longTemplate || "", {
                ...mustacheHelpers,
                ...sublayerData[0].attributes,
              })
            )
            .addTo(this.map!);
          break;
        }
      }
    }
  }

  private debouncedMouseMoveListener = (e: MapMouseEvent, backoff = 4) => {
    if (this.debouncedMouseMoveListenerReference) {
      clearTimeout(this.debouncedMouseMoveListenerReference);
    }
    this.debouncedMouseMoveListenerReference = setTimeout(() => {
      delete this.debouncedMouseMoveListenerReference;
      this.mouseMoveListener(e);
    }, backoff);
  };

  private mouseMoveListener = (e: MapMouseEvent) => {
    const features = this.map!.queryRenderedFeatures(e.point, {
      layers: this.interactiveVectorLayerIds,
    });

    const clear = () => {
      this.map!.getCanvas().style.cursor = "";
      this.setState((prev) => ({
        ...prev,
        bannerMessages: [],
        tooltip: undefined,
        fixedBlocks: [],
      }));
      delete this.previousInteractionTarget;
    };
    if (features.length) {
      const top = features[0];
      const dataLayer = this.layers[layerIdFromStyleLayerId(top.layer.id)];
      if (!dataLayer) {
        console.warn(
          `Could not find interactive dataLayer with id=${layerIdFromStyleLayerId(
            top.layer.id
          )}`
        );
        return;
      }
      const interactivitySetting = dataLayer.interactivitySettings;
      if (interactivitySetting) {
        let cursor = "";
        this.map!.getCanvas().style.cursor = cursor;
        let bannerMessages: string[] = [];
        let tooltip: Tooltip | undefined = undefined;
        let fixedBlocks: string[] = [];
        switch (interactivitySetting.type) {
          case InteractivityType.Banner:
            cursor = "default";
            bannerMessages = [
              Mustache.render(interactivitySetting.shortTemplate || "", {
                ...mustacheHelpers,
                ...(top.properties || {}),
              }),
            ];
            break;
          case InteractivityType.Tooltip:
            cursor = "default";
            tooltip = {
              x: e.originalEvent.x,
              y: e.originalEvent.y,
              messages: [
                Mustache.render(interactivitySetting.shortTemplate || "", {
                  ...mustacheHelpers,
                  ...(top.properties || {}),
                }),
              ],
            };
            break;
          case InteractivityType.Popup:
            cursor = "pointer";
            break;
          case InteractivityType.FixedBlock:
            cursor = "pointer";
            fixedBlocks = [
              Mustache.render(interactivitySetting.longTemplate || "", {
                ...mustacheHelpers,
                ...(top.properties || {}),
              }),
            ];
            break;
          default:
            break;
        }
        if (interactivitySetting.cursor !== "AUTO") {
          cursor = interactivitySetting.cursor.toString().toLowerCase();
        }
        this.map!.getCanvas().style.cursor = cursor;
        const currentInteractionTarget = `${top.id}-${interactivitySetting.id}`;
        if (
          this.previousInteractionTarget === currentInteractionTarget &&
          (interactivitySetting.type === InteractivityType.Banner ||
            interactivitySetting.type === InteractivityType.FixedBlock ||
            interactivitySetting.type === InteractivityType.Popup)
        ) {
          // Don't waste cycles on a state update
        } else {
          this.previousInteractionTarget = currentInteractionTarget;
          this.setState((prev) => {
            return {
              ...prev,
              bannerMessages,
              tooltip,
              fixedBlocks,
            };
          });
        }
      } else {
        clear();
      }
    } else {
      clear();
    }
  };
}

const mustacheHelpers = {
  round: () => (text: string, render: (str: string) => string) => {
    return `${Math.round(parseFloat(render(text)))}`;
  },
  round1Digit: () => (text: string, render: (str: string) => string) => {
    return `${Math.round(parseFloat(render(text)) * 10) / 10}`;
  },
  round2Digits: () => (text: string, render: (str: string) => string) => {
    return `${Math.round(parseFloat(render(text)) * 100) / 100}`;
  },
};
