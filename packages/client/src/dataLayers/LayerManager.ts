import {
  Layer as MapBoxLayer,
  Map,
  MapDataEvent,
  ErrorEvent,
  Source,
  RasterDemSource,
  AnyLayer,
  MapMouseEvent,
  Popup,
} from "mapbox-gl";
import Mustache from "mustache";
import { Feature } from "geojson";
import {
  createContext,
  Dispatch,
  useEffect,
  useState,
  SetStateAction,
} from "react";
import {
  ArcGISDynamicMapServiceSource,
  isArcGISDynamicServiceLoading,
  updateDynamicMapService,
} from "./sourceTypes/ArcGISDynamicMapServiceSource";
import {
  ArcGISVectorSource,
  updateArcGISVectorSource,
  isArcGISVectorSourceLoading,
} from "./sourceTypes/ArcGISVectorSource";
import { MapBoxSource, updateGeoJSONSource } from "./sourceTypes/MapBoxSource";
import { WMSSource } from "./sourceTypes/WMSSource";
import {
  ArcGISDynamicMapService,
  ArcGISDynamicMapService as ArcGISDynamicMapServiceInstance,
  ArcGISVectorSource as ArcGISVectorSourceInstance,
  ImageList,
  styleForFeatureLayer,
} from "@seasketch/mapbox-gl-esri-sources";
import {
  CursorType,
  DataLayer,
  DataSource as GeneratedDataSource,
  DataSourceTypes,
  InteractivitySetting,
  InteractivityType,
  RenderUnderType,
  Sprite,
  SpriteImage,
} from "../generated/graphql";
import { rejects } from "assert";
import { identifyLayers } from "../admin/data/arcgis/arcgis";
import { fetchGlStyle } from "../useMapboxStyle";

interface LayerState {
  visible: true;
  loading: boolean;
  error?: Error;
}

// export interface SeaSketchLayer {
//   id: string;
//   sourceId: string;
//   renderUnder: "land" | "labels" | "none";
//   mapboxLayers?: MapBoxLayer[];
//   sublayerId?: string;
// }

export type SourceInstance =
  | MapBoxSource
  | ArcGISDynamicMapServiceSource
  | ArcGISVectorSource
  | WMSSource;

export type ClientDataSource = Pick<
  GeneratedDataSource,
  | "attribution"
  | "bounds"
  | "bucketId"
  | "buffer"
  | "byteLength"
  | "cluster"
  | "clusterMaxZoom"
  | "clusterProperties"
  | "clusterRadius"
  | "coordinates"
  | "encoding"
  | "enhancedSecurity"
  | "importType"
  | "lineMetrics"
  | "maxzoom"
  | "minzoom"
  | "objectKey"
  | "originalSourceUrl"
  | "queryParameters"
  | "scheme"
  | "tiles"
  | "tileSize"
  | "tolerance"
  | "type"
  | "url"
  | "urls"
  | "useDevicePixelRatio"
  | "supportsDynamicLayers"
> & {
  /** IDs from the server are Int. Temporary client IDs are UUID v4 */
  id: string | number;
  /** Can be used for arcgis vector services */
  bytesLimit?: number;
};

const UNDER_LABELS_POSITION = "admin-0-boundary-disputed";

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

export type ClientSprite = {
  spriteImages: ({ dataUri?: string; url?: string } & Pick<
    SpriteImage,
    "height" | "width" | "pixelRatio"
  >)[];
  id: string | number;
} & Pick<Sprite, "type">;

export type ClientDataLayer = Pick<
  DataLayer,
  "mapboxGlStyles" | "renderUnder" | "sourceLayer" | "sublayer" | "zIndex"
> & {
  /** IDs from the server are Int. Temporary client IDs are UUID v4 */
  id: string | number;
  /** IDs from the server are Int. Temporary client IDs are UUID v4 */
  dataSourceId: string | number;
  sprites?: ClientSprite[];
  interactivitySettings?: Pick<
    InteractivitySetting,
    "cursor" | "id" | "longTemplate" | "shortTemplate" | "type"
  >;
};

class LayerManager {
  private clientDataSources: ClientDataSource[] = [];
  private layersByZIndex: (number | string)[] = [];
  private layers: { [layerId: string]: ClientDataLayer } = {};
  private layersBySourceId: { [sourceId: string]: ClientDataLayer[] } = {};
  private visibleLayers: { [id: string]: LayerState } = {};
  private basemapLandLayerId: string = "land";
  private basemapLabelsLayerId: string = "road-label";
  private previousInteractionTarget?: string;
  private setState: Dispatch<SetStateAction<LayerManagerContext>>;
  map?: Map;
  private updateStateDebouncerReference?: NodeJS.Timeout;
  private sourceCache: {
    [id: string]: ArcGISDynamicMapServiceInstance | ArcGISVectorSourceInstance;
  } = {};
  private dirtyMapServices: string[] = [];
  private updateMapServicesDebouncerReference?: NodeJS.Timeout;
  private updateSourcesStateDebouncerReference?: NodeJS.Timeout;
  private updateInteractivitySettingsDebouncerReference?: NodeJS.Timeout;
  private debouncedMouseMoveListenerReference?: NodeJS.Timeout;
  private interactiveVectorLayerIds: string[] = [];
  private interactiveImageLayerIds: string[] = [];
  private dynamicArcGISStyles: {
    [sourceId: string]: Promise<{
      imageList: ImageList;
      layers: mapboxgl.Layer[];
    }>;
  } = {};

  constructor(setState: Dispatch<SetStateAction<LayerManagerContext>>) {
    this.setState = setState;
    // @ts-ignore
    window.layerManager = this;
  }

  setMap(map: Map) {
    // let changingMap = false;
    if (this.map) {
      // remove event listeners
      this.map.off("error", this.onMapError);
      this.map.off("data", this.onMapDataEvent);
      this.map.off("dataloading", this.onMapDataEvent);
      this.map.off("mouseout", this.onMouseOut);
      this.map.off("click", this.onMouseClick);
      // changingMap = true;
    }
    // add event listeners
    this.map = map;
    this.map.on("error", this.onMapError);
    this.map.on("data", this.onMapDataEvent);
    this.map.on("dataloading", this.onMapDataEvent);
    this.map.on("mouseout", this.onMouseOut);
    this.map.on("click", this.onMouseClick);
    // This doesn't seem to work. It's not a big deal, but getting it to work right
    // could help maintain layer state during hot-reloads while developing. Not an
    // end-user problem
    // if (changingMap) {
    //   // console.log("changing map");
    //   this.reset(this.clientDataSources, Object.values(this.layers));
    // } else {
    //   // console.log("set map");
    // }
  }

  private async getLayerIdsForClientLayer(layer: ClientDataLayer) {
    if (layer.sublayer) {
      return [`${layer.dataSourceId}-image`];
    } else {
      if (layer.mapboxGlStyles && Array.isArray(layer.mapboxGlStyles)) {
        return layer.mapboxGlStyles.map((s, i) => `${layer.id}-${i}`);
      } else {
        const source = this.clientDataSources.find(
          (s) => s.id === layer.dataSourceId
        );
        if (!source) {
          throw new Error(`Could not find source for layer ${layer.id}`);
        }
        if (source?.type === DataSourceTypes.ArcgisVector) {
          const { layers, imageList } = await this.getDynamicArcGISStyle(
            source.url!,
            source.id.toString()
          );
          return layers.map((s, i) => `${layer.id}-${i}`);
        } else {
          throw new Error(
            `Could not find mapbox layer ids for client layer id=${layer.id}`
          );
        }
      }
    }
  }

  onMouseOut = () => {
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

  onMapDataEvent = (
    event: MapDataEvent & { source: Source; sourceId: string }
  ) => {
    // let anyChanges = false;
    if (event.sourceId === "composite") {
      // ignore
      return;
    }
    // Filter out events that are related to styles, or about turning geojson
    // or image data into tiles. We don't care about stuff that isn't related to
    // network activity
    if (
      event.dataType === "source" &&
      ((event.source.type !== "geojson" && event.source.type !== "image") ||
        !event.tile)
    ) {
      this.debouncedUpdateSourceStates();
    }
  };

  onMouseClick = async (e: MapMouseEvent) => {
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
      const dataLayer = this.layers[top.layer.id.split("-")[0]];
      if (!dataLayer) {
        console.warn(
          `Could not find interactive dataLayer with id=${
            top.layer.id.split("-")[0]
          }`
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

  popupAbortController: AbortController | undefined;

  async openImageServicePopups(
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
        const source = this.clientDataSources.find(
          (s) => s.id === layer.dataSourceId
        );
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

  onMapError = (event: ErrorEvent & { sourceId?: string }) => {
    if (event.sourceId && event.sourceId !== "composite") {
      let anySet = false;
      for (const layerId of Object.keys(this.visibleLayers)) {
        if (event.sourceId === this.layers[layerId].dataSourceId.toString()) {
          this.visibleLayers[layerId].error = event.error;
          this.visibleLayers[layerId].loading = false;
          anySet = true;
        }
      }
      if (anySet) {
        this.debouncedUpdateState();
      }
    }
  };

  async updateInteractivitySettings() {
    const sourceIds: (number | string)[] = [];
    let interactiveVectorLayerIds: string[] = [];
    let interactiveImageLayerIds: string[] = [];
    // for each visible source, collect interactivitySettings
    for (const id in this.visibleLayers) {
      const layer = this.layers[id];
      if (
        layer?.interactivitySettings &&
        layer.interactivitySettings.type !== InteractivityType.None
      ) {
        if (!layer.sublayer) {
          const mapboxLayerIds = await this.getLayerIdsForClientLayer(layer);
          for (const layerId of mapboxLayerIds) {
            interactiveVectorLayerIds.push(layerId);
          }
        } else {
          interactiveImageLayerIds.push(id);
        }
      }
    }
    this.interactiveVectorLayerIds = interactiveVectorLayerIds;
    this.interactiveImageLayerIds = interactiveImageLayerIds;
    if (this.interactiveVectorLayerIds.length) {
      this.map?.on("mousemove", this.debouncedMouseMoveListener);
    } else {
      this.map?.off("mousemove", this.debouncedMouseMoveListener);
    }
  }

  debouncedMouseMoveListener = (e: MapMouseEvent, backoff = 4) => {
    if (this.debouncedMouseMoveListenerReference) {
      clearTimeout(this.debouncedMouseMoveListenerReference);
    }
    this.debouncedMouseMoveListenerReference = setTimeout(() => {
      delete this.debouncedMouseMoveListenerReference;
      this.mouseMoveListener(e);
    }, backoff);
  };

  mouseMoveListener = (e: MapMouseEvent) => {
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
      const dataLayer = this.layers[top.layer.id.split("-")[0]];
      if (!dataLayer) {
        console.warn(
          `Could not find interactive dataLayer with id=${
            top.layer.id.split("-")[0]
          }`
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

  debouncedUpdateInteractivitySettings(backoff = 8) {
    if (this.updateInteractivitySettingsDebouncerReference) {
      clearTimeout(this.updateInteractivitySettingsDebouncerReference);
    }
    this.updateInteractivitySettingsDebouncerReference = setTimeout(() => {
      delete this.updateInteractivitySettingsDebouncerReference;
      this.updateInteractivitySettings();
    }, backoff);
  }

  debouncedUpdateSourceStates(backoff = 10) {
    if (this.updateSourcesStateDebouncerReference) {
      clearTimeout(this.updateSourcesStateDebouncerReference);
    }
    this.updateSourcesStateDebouncerReference = setTimeout(() => {
      delete this.updateSourcesStateDebouncerReference;
      this.updateSourceStates();
    }, backoff);
  }

  updateSourceStates() {
    let anyChanges = false;
    let anyLoading = false;
    if (!this.map) {
      throw new Error("LayerManager.map not set");
    }
    let sources: { [sourceId: string]: ClientDataLayer[] } = {};
    for (const layerId of Object.keys(this.visibleLayers)) {
      const layer = this.layers[layerId];
      if (!sources[layer.dataSourceId]) {
        sources[layer.dataSourceId] = [];
      }
      sources[layer.dataSourceId].push(layer);
    }
    for (const sourceId in sources) {
      let loading = this.isSourceLoading(sourceId);
      if (loading) {
        anyLoading = true;
      }
      const isDynamicService =
        this.sourceCache[sourceId] &&
        this.sourceCache[sourceId] instanceof ArcGISDynamicMapServiceInstance;
      for (const layer of sources[sourceId]) {
        if (this.visibleLayers[layer.id].loading !== loading) {
          this.visibleLayers[layer.id].loading = loading;
          anyChanges = true;
        }
        if (this.visibleLayers[layer.id].error && loading) {
          delete this.visibleLayers[layer.id].error;
          anyChanges = true;
        }
      }
    }
    if (anyChanges) {
      this.debouncedUpdateState();
    }
    // This is needed for geojson sources
    if (anyLoading) {
      setTimeout(() => {
        this.debouncedUpdateSourceStates();
      }, 100);
    }
  }

  isSourceLoading(id: string) {
    // let loaded = this.map.isSourceLoaded(id);
    let loading = false;
    const instance = this.sourceCache[id];
    if (instance) {
      if (instance instanceof ArcGISVectorSourceInstance) {
        return isArcGISVectorSourceLoading(instance);
      } else if (instance instanceof ArcGISDynamicMapServiceInstance) {
        return isArcGISDynamicServiceLoading(instance, this.map!);
      }
    } else {
      loading = !this.map!.isSourceLoaded(id);
    }
    return loading;
  }

  updateLayer(layer: ClientDataLayer) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const existingLayer = this.layers[layer.id];
    if (!existingLayer) {
      throw new Error(`Layer with id ${layer.id} not found`);
    }
    this.layers[layer.id] = layer;
    const sourceLayers = this.layersBySourceId[existingLayer.dataSourceId];
    this.layersBySourceId[existingLayer.dataSourceId] = [
      ...sourceLayers.filter((l) => l.id !== layer.id),
      layer,
    ];
    if (existingLayer.renderUnder !== layer.renderUnder) {
      this.resetLayersByZIndex();
    }
    if (this.visibleLayers[layer.id]) {
      if (
        !existingLayer.mapboxGlStyles ||
        !existingLayer.mapboxGlStyles.length
      ) {
        throw new Error(`Existing layer had no mapboxGlStyles property`);
      }
      for (var i = 0; i < existingLayer.mapboxGlStyles?.length; i++) {
        this.map.removeLayer(`${existingLayer.id}-${i}`);
      }
      if (!layer.mapboxGlStyles || !layer.mapboxGlStyles.length) {
        throw new Error(`Replacement layer had no mapboxLayer property`);
      }
      const glLayers = layer.mapboxGlStyles;
      if (!Array.isArray(glLayers) || glLayers.length === 0) {
        throw new Error("mapboxGlStyles contains no layers");
      }
      for (var i = 0; i < glLayers.length; i++) {
        this.map.addLayer(
          {
            ...glLayers[i],
            id: `${layer.id}-${i}`,
            source: layer.dataSourceId,
          },
          this.getZPosition(layer)
        );
      }
    } else {
      // do nothing
    }
  }

  highlightLayer(layerId: string) {}

  private resetPromise: Promise<any> | undefined;
  // prevent reset from being called multiple times before completion
  async reset(sources: ClientDataSource[], layers: ClientDataLayer[]) {
    if (this.resetPromise) {
      return this.resetPromise;
      // this._reset(sources, layers);
    } else {
      this.resetPromise = this._reset(sources, layers);
      await this.resetPromise;
      delete this.resetPromise;
    }
  }

  private async _reset(sources: ClientDataSource[], layers: ClientDataLayer[]) {
    const oldVisibleLayers = Object.keys(this.visibleLayers);
    // Remove any visible overlay layers and their sources
    await Promise.all(
      Object.values(this.layers).map((layer) => this.removeLayer(layer))
    );
    // replace internal sources list with the new one
    const oldClientDataSources = this.clientDataSources;
    this.clientDataSources = sources.map((source) => {
      return {
        ...source,
        queryParameters:
          source.queryParameters && typeof source.queryParameters === "string"
            ? JSON.parse(source.queryParameters)
            : source.queryParameters,
      };
    });

    // for each source on the map, check for updates
    for (const oldConfig of oldClientDataSources) {
      const newConfig = this.clientDataSources.find(
        (config) => config.id === oldConfig.id
      );
      if (
        newConfig &&
        this.map?.getSource(oldConfig.id.toString()) &&
        areEqualShallow(newConfig, oldConfig) === false
      ) {
        // need to update
        if (
          newConfig.type === DataSourceTypes.Geojson ||
          newConfig.type === DataSourceTypes.SeasketchVector
        ) {
          updateGeoJSONSource(oldConfig, newConfig, this.map!);
        } else if (newConfig.type === DataSourceTypes.ArcgisVector) {
          // this.updateSource(newConfig);
          const updatedInstance = updateArcGISVectorSource(
            oldConfig,
            newConfig,
            this.sourceCache[newConfig.id] as ArcGISVectorSourceInstance,
            layers,
            this.map
          );
          this.sourceCache[newConfig.id] = updatedInstance;
        } else if (newConfig.type === DataSourceTypes.ArcgisDynamicMapserver) {
          this.updateArcGISDynamicMapServiceSource(newConfig);
        }
      }
    }

    // this.clearSourceCache();
    // replace internal layers list
    this.layers = {};
    this.layersBySourceId = {};
    for (const layer of layers) {
      this.layers[layer.id] = layer;
      if (!this.layersBySourceId[layer.dataSourceId]) {
        this.layersBySourceId[layer.dataSourceId] = [];
      }
      this.layersBySourceId[layer.dataSourceId].push(layer);
    }
    // add visible layers and associated sources to map
    this.resetLayersByZIndex();
    this.setVisibleLayers(oldVisibleLayers.filter((id) => id in this.layers));
  }

  private resetLayersByZIndex() {
    const sortedLayers = [...Object.values(this.layers)];
    // sortedLayers.sort((a, b) => b.zIndex - a.zIndex);
    sortedLayers.sort((a, b) => {
      if (
        a.renderUnder === RenderUnderType.Labels &&
        b.renderUnder !== RenderUnderType.Labels
      ) {
        return 1;
      } else if (
        b.renderUnder === RenderUnderType.Labels &&
        a.renderUnder !== RenderUnderType.Labels
      ) {
        return -1;
      } else {
        return a.zIndex - b.zIndex;
      }
    });
    // Need to make sure these are layer ids and not ids of layers to accomadate sublayers
    const layerIds = [];

    let labelsLayerInserted = false;
    for (const layer of sortedLayers) {
      if (
        !labelsLayerInserted &&
        layer.renderUnder === RenderUnderType.Labels
      ) {
        labelsLayerInserted = true;
        layerIds.push(UNDER_LABELS_POSITION);
      }
      if (layer.sublayer) {
        const specialId = idForSublayer(layer);
        if (layerIds.indexOf(specialId) === -1) {
          layerIds.push(specialId);
        }
      } else {
        layerIds.push(`${layer.id}-0`);
      }
    }
    this.layersByZIndex = layerIds;
  }

  async setVisibleLayers(layerIds: string[]) {
    if (this.map) {
      for (const layerId of layerIds) {
        const layer = this.layers[layerId];
        if (layer) {
          this.addLayer(layer);
        }
      }

      for (const id in this.visibleLayers) {
        if (layerIds.indexOf(id) === -1) {
          if (this.layers[id]) {
            this.removeLayer(this.layers[id]);
          }
        }
      }
    }
  }

  hideLayers(layerIds: string[]) {
    for (const id of layerIds) {
      this.removeLayer(this.layers[id]);
    }
  }

  updateArcGISDynamicMapServiceSource(source: ClientDataSource) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    if (source.type !== DataSourceTypes.ArcgisDynamicMapserver) {
      throw new Error(`Called with source of type ${source.type}`);
    }
    const existingSource = this.clientDataSources.find(
      (s) => s.id === source.id
    );
    if (!existingSource) {
      throw new Error(`Existing source with id ${source.id} not found.`);
    }
    this.resetLayersByZIndex();
    let instance = this.sourceCache[source.id];
    if (!instance) {
      // not visible, just replace
      this.clientDataSources = [
        ...this.clientDataSources.filter((s) => s.id !== source.id),
        source,
      ];
    } else {
      if (source.type !== existingSource.type) {
        throw new Error(
          "Replacing source with a different type not yet supported"
        );
      } else {
        const layers = Object.values(this.layers).filter(
          (l) => l.dataSourceId === source.id && this.visibleLayers[l.id]
        );
        // update source
        instance = updateDynamicMapService(
          existingSource,
          source,
          instance as ArcGISDynamicMapServiceInstance,
          layers,
          this.map
        );
        this.sourceCache[source.id] = instance;

        this.clientDataSources = [
          ...this.clientDataSources.filter((s) => s.id !== source.id),
          source,
        ];
      }
    }
  }

  showLayers(layerIds: string[]) {
    for (const id of layerIds) {
      const layer = this.layers[id];
      if (layer) {
        this.addLayer(this.layers[id]);
      } else {
        // maybe not loaded yet? Not sure whether to show an exception here
        console.warn(
          `Layer information not available for loading yet. id=${id}`
        );
      }
    }
  }

  private async addLayer(layer: ClientDataLayer) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    if (layer.sublayer) {
      this.visibleLayers[layer.id] = {
        loading: false,
        visible: true,
      };
      this.debouncedUpdateState();
      this.markMapServiceDirty(layer.dataSourceId.toString());
    } else {
      const source = this.getOrInitializeSource(layer.dataSourceId.toString());
      const dataSourceConfig = this.clientDataSources.find(
        (s) => s.id === layer.dataSourceId
      );
      if (!dataSourceConfig) {
        throw new Error(
          `Could not find data source with id = ${dataSourceConfig}`
        );
      }
      if (dataSourceConfig.type === DataSourceTypes.ArcgisVector) {
        this.visibleLayers[layer.id] = {
          loading: true,
          visible: true,
        };
        this.getDynamicArcGISStyle(
          dataSourceConfig.url!,
          dataSourceConfig.id.toString()
        ).then(({ layers, imageList }) => {
          // check if still visible
          imageList.addToMap(this.map!);
          let zPosition = this.getZPosition(layer);
          if (this.visibleLayers[layer.id]?.visible) {
            for (var i = 0; i < layers.length; i++) {
              this.map!.addLayer(
                {
                  ...layers[i],
                  id: `${layer.id}-${i}`,
                  source: layer.dataSourceId.toString(),
                } as AnyLayer,
                zPosition
              );
            }
            this.visibleLayers[layer.id] = {
              ...this.visibleLayers[layer.id],
            };
          }
        });
        this.debouncedUpdateState();
      } else {
        if (layer.sprites && layer.sprites.length) {
          await this.addSprites(layer.sprites);
        }
        const mapboxLayers = layer.mapboxGlStyles || [];
        let zPosition = this.getZPosition(layer);
        if (mapboxLayers.length) {
          for (var i = 0; i < mapboxLayers?.length; i++) {
            this.map.addLayer(
              {
                ...mapboxLayers[i],
                id: `${layer.id}-${i}`,
                source: layer.dataSourceId.toString(),
              },
              zPosition
            );
          }
        } else {
          throw new Error(
            `mapboxGlStyles prop not present on layer ${layer.id}`
          );
        }
      }
      this.visibleLayers[layer.id] = {
        loading: false,
        visible: true,
      };
      this.debouncedUpdateState();
    }
    this.debouncedUpdateInteractivitySettings();
  }

  private getZPosition(layer: ClientDataLayer): string | undefined {
    const layerId = layer.sublayer
      ? `${layer.dataSourceId}-image`
      : `${layer.id}-0`;
    let layerPosition = this.layersByZIndex.indexOf(layerId);
    // Find the next visible layer that this layer should appear under
    while (layerPosition-- > -1) {
      const layerAbove = this.layersByZIndex[layerPosition];
      if (layerAbove) {
        let visibleLayer = this.map!.getLayer(layerAbove.toString());
        if (!!visibleLayer) {
          return layerAbove.toString();
        }
      }
    }
    // RenderUnderLand is not supported at this time as it isn't compatible with the way mapbox baselayers typically are set up.
    if (
      false &&
      (layer.renderUnder === RenderUnderType.Labels ||
        layer.renderUnder === RenderUnderType.Land)
    ) {
      return UNDER_LABELS_POSITION;
    } else {
      return undefined;
    }
  }

  private async addSprites(sprites: ClientSprite[]) {
    // get unique sprite ids

    for (const sprite of sprites) {
      if (!this.map!.hasImage(`seasketch://sprites/${sprite.id}`)) {
        this.addSprite(sprite);
      }
    }
  }

  async addSprite(sprite: ClientSprite) {
    let spriteImage = sprite.spriteImages.find(
      (i) => window.devicePixelRatio === i.pixelRatio
    );
    if (!spriteImage) {
      spriteImage = sprite.spriteImages[0];
    }
    if (spriteImage.dataUri) {
      const image = await createImage(
        spriteImage.width,
        spriteImage.height,
        spriteImage.dataUri
      );
      this.map?.addImage(`seasketch://sprites/${sprite.id}`, image, {
        pixelRatio: spriteImage.pixelRatio,
      });
    } else if (spriteImage.url) {
      const image = await loadImage(
        spriteImage.width,
        spriteImage.height,
        spriteImage.url,
        this.map!
      );
      this.map!.addImage(`seasketch://sprites/${sprite.id}`, image, {
        pixelRatio: spriteImage.pixelRatio,
      });
    } else {
      throw new Error(`Sprite id=${sprite.id} missing both dataUri and url`);
    }
  }

  private async getDynamicArcGISStyle(url: string, sourceId: string) {
    const layers: MapBoxLayer[] = [];
    if (this.dynamicArcGISStyles[sourceId]) {
      // already working
      return this.dynamicArcGISStyles[sourceId];
    } else {
      this.dynamicArcGISStyles[sourceId] = styleForFeatureLayer(url, sourceId);
    }
    return this.dynamicArcGISStyles[sourceId];
  }

  private async removeLayer(layer: ClientDataLayer) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    if (layer.sublayer) {
      this.markMapServiceDirty(layer.dataSourceId.toString());
    } else {
      let mapboxLayers: MapBoxLayer[];
      if (layer.mapboxGlStyles) {
        mapboxLayers = layer.mapboxGlStyles;
      } else {
        if (this.dynamicArcGISStyles[layer.dataSourceId]) {
          const style = await this.dynamicArcGISStyles[layer.dataSourceId];
          mapboxLayers = style.layers;
        } else {
          mapboxLayers = [];
        }
      }
      if (this.visibleLayers[layer.id] && mapboxLayers.length) {
        for (var i = 0; i < mapboxLayers?.length; i++) {
          this.map.removeLayer(`${layer.id}-${i}`);
        }
      }
      const sourceInstance = this.sourceCache[layer.dataSourceId];
      if (
        this.visibleLayers[layer.id] &&
        sourceInstance &&
        sourceInstance instanceof ArcGISVectorSourceInstance &&
        this.visibleLayers[layer.id].error
      ) {
        delete this.sourceCache[layer.dataSourceId];
        this.map.removeSource(layer.dataSourceId.toString());
      }
    }
    delete this.visibleLayers[layer.id];
    this.debouncedUpdateState();
    this.debouncedUpdateInteractivitySettings();
  }

  private debouncedUpdateState() {
    if (this.updateStateDebouncerReference) {
      clearTimeout(this.updateStateDebouncerReference);
    }
    this.updateStateDebouncerReference = setTimeout(this.updateState, 5);
  }

  private updateState = () => {
    delete this.updateStateDebouncerReference;
    this.setState((oldState) => ({
      ...oldState,
      layerStates: { ...this.visibleLayers },
    }));
  };

  private getOrInitializeSource(id: string, initialSublayers?: string[]) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const instance = this.sourceCache[id];
    if (instance) {
      return instance;
    } else {
      const config = this.map.getSource(id);
      if (config) {
        return config;
      } else {
        // Need to add source to the map
        const sourceConfig = this.clientDataSources.find(
          (s) => s.id.toString() === id
        );
        if (!sourceConfig) {
          throw new Error(`Could not find source with id ${id}`);
        }
        if (sourceConfig.type === DataSourceTypes.ArcgisVector) {
          const instance = new ArcGISVectorSourceInstance(
            this.map,
            sourceConfig.id.toString(),
            sourceConfig.url!,
            sourceConfig.queryParameters
          );

          // TODO: put imageSets back in

          // if (sourceConfig.imageSets && sourceConfig.imageSets.length) {
          //   const imageList = new ImageList(undefined, sourceConfig.imageSets);
          //   imageList.addToMap(this.map);
          // }
          this.sourceCache[sourceConfig.id] = instance;
          return instance;
        } else if (
          sourceConfig.type === DataSourceTypes.ArcgisDynamicMapserver
        ) {
          if (!initialSublayers) {
            throw new Error(
              "ArcGISDynamicMapServices must be initialized with initial sublayers"
            );
          }
          const instance = new ArcGISDynamicMapServiceInstance(
            this.map,
            sourceConfig.id.toString(),
            sourceConfig.url!,
            {
              queryParameters: {
                ...sourceConfig.queryParameters,
              },
              useDevicePixelRatio: !!sourceConfig.useDevicePixelRatio,
              layers: initialSublayers.map((s) => ({ sublayer: parseInt(s) })),
              supportsDynamicLayers: sourceConfig.supportsDynamicLayers,
            }
          );
          this.sourceCache[sourceConfig.id] = instance;
          return instance;
        } else if (sourceConfig.type === DataSourceTypes.SeasketchVector) {
          const source = {
            type: "geojson",
            data: `https://${sourceConfig.bucketId}/${sourceConfig.objectKey}`,
            attribution: sourceConfig.attribution,
          };
          // @ts-ignore
          this.map.addSource(sourceConfig.id.toString(), source);
          return source;
        } else {
          throw new Error("not ready for this type");
        }
      }
    }
  }

  private markMapServiceDirty(id: string) {
    if (this.dirtyMapServices.indexOf(id) === -1) {
      this.dirtyMapServices.push(id);
    }
    if (this.updateMapServicesDebouncerReference) {
      clearTimeout(this.updateMapServicesDebouncerReference);
    }
    this.updateMapServicesDebouncerReference = setTimeout(() => {
      delete this.updateMapServicesDebouncerReference;
      this.updateMapServices();
    }, 2);
  }

  async updateZIndexForImageSource(sourceId: string) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const layerId = `${sourceId}-image`;
    const layer = this.map.getLayer(layerId);
    if (layer) {
      await this.map.removeLayer(layerId);
      // if (!layer) {
      // get layer with lowest z index
      const top = this.layersBySourceId[sourceId].sort(
        (a, b) => a.zIndex - b.zIndex
      )[0];

      this.map.addLayer(layer, this.getZPosition(top));
    }
  }

  private updateMapServices() {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const sublayersBySource: { [sourceId: string]: string[] } = {};
    for (const dirty of this.dirtyMapServices) {
      sublayersBySource[dirty] = [];
    }
    this.dirtyMapServices = [];
    for (const layer of Object.values(this.layers).sort(
      (a, b) => a.zIndex - b.zIndex
    )) {
      if (
        sublayersBySource[layer.dataSourceId] &&
        this.visibleLayers[layer.id]
      ) {
        sublayersBySource[layer.dataSourceId].push(layer.sublayer!);
      }
    }
    for (const sourceId in sublayersBySource) {
      const layerId = `${sourceId}-image`;
      if (sublayersBySource[sourceId].length === 0) {
        // remove the source
        const layer = this.map.getLayer(layerId);
        if (layer) {
          this.map.removeLayer(layerId);
          const source = this.sourceCache[sourceId] as
            | ArcGISDynamicMapServiceInstance
            | undefined;
          if (source) {
            // remove the source. TODO: in the future maybe just pause it?
            source.destroy();
            this.map.removeSource(sourceId);
            delete this.sourceCache[sourceId];
          }
        }
      } else {
        // Add or update the source
        let source = this.sourceCache[sourceId] as
          | ArcGISDynamicMapServiceInstance
          | undefined;
        if (source) {
          source.updateLayers(
            sublayersBySource[sourceId].map((id) => ({
              sublayer: parseInt(id),
              opacity: 1,
            }))
          );
        } else {
          source = this.getOrInitializeSource(
            sourceId,
            sublayersBySource[sourceId]
          ) as ArcGISDynamicMapServiceInstance;
        }
        // const layer = this.map.getLayer(layerId);
        this.map.removeLayer(layerId);
        // if (!layer) {
        // get layer with lowest z index
        const top = this.layersBySourceId[sourceId].sort(
          (a, b) => a.zIndex - b.zIndex
        )[0];

        this.map.addLayer(
          {
            id: sourceId + "-image",
            source: sourceId,
            type: "raster",
            paint: {
              "raster-fade-duration": 0,
            },
          },
          this.getZPosition(top)
        );
        // }
      }
    }
  }

  changeBasemapTimeout: NodeJS.Timeout | null = null;

  async changeBasemap(url: string) {
    if (!this.map) {
      throw new Error("Map not set");
    }
    const style = await fetchGlStyle(url);
    if (this.changeBasemapTimeout) {
      clearTimeout(this.changeBasemapTimeout);
      this.changeBasemapTimeout = null;
    }
    this.map.setStyle({ ...style });

    const reset = () => {
      if (!this.map!.loaded) {
        this.changeBasemapTimeout = setTimeout(reset, 5);
      } else {
        this._reset(this.clientDataSources, Object.values(this.layers));
        this.changeBasemapTimeout = null;
      }
    };
    this.changeBasemapTimeout = setTimeout(reset, 5);
  }
}

export default LayerManager;

interface Tooltip {
  x: number;
  y: number;
  messages: string[];
}

interface LayerManagerContext {
  layerStates: { [id: string]: LayerState };
  manager?: LayerManager;
  bannerMessages: string[];
  tooltip?: Tooltip;
  fixedBlocks: string[];
}

export function useLayerManager() {
  const [state, setState] = useState<LayerManagerContext>({
    layerStates: {},
    bannerMessages: [],
    fixedBlocks: [],
  });
  useEffect(() => {
    const manager = new LayerManager(setState);
    const newState = {
      manager,
      layerStates: {},
      bannerMessages: [],
      fixedBlocks: [],
    };
    setState(newState);
  }, []);
  return state;
}

export const LayerManagerContext = createContext<LayerManagerContext>({
  layerStates: {},
  manager: new LayerManager((state) => {}),
  bannerMessages: [],
  fixedBlocks: [],
});

function areEqualShallow(a: any, b: any) {
  for (var key in a) {
    if (!(key in b) || a[key] !== b[key]) {
      return false;
    }
  }
  for (var key in b) {
    if (!(key in a) || a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

async function createImage(
  width: number,
  height: number,
  dataURI: string
): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image(width, height);
    image.src = dataURI;
    image.onload = () => {
      resolve(image);
    };
  });
}

async function loadImage(
  width: number,
  height: number,
  url: string,
  map: mapboxgl.Map
): Promise<any> {
  return new Promise((resolve, reject) => {
    map.loadImage(url, (error: Error | undefined, image: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(image);
      }
    });
  });
}

function idForSublayer(layer: ClientDataLayer) {
  if (layer.sublayer === null || layer.sublayer === undefined) {
    throw new Error(`Layer is not a sublayer. id=${layer.id}`);
  } else {
    return `${layer.dataSourceId}-image`;
  }
}

function isArcGISDynamicService(
  source: any
): source is ArcGISDynamicMapService {
  return typeof source.updateUseDevicePixelRatio === "function";
}
