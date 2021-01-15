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
  interactivitySettings?: Pick<
    InteractivitySetting,
    | "cursor"
    | "id"
    | "longTemplate"
    | "shortTemplate"
    | "dataSourceId"
    | "sourceLayer"
    | "type"
  >[];
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
  private interactiveLayerIds: string[] = [];
  private activeInteractivitySettings: Pick<
    InteractivitySetting,
    | "id"
    | "dataSourceId"
    | "type"
    | "cursor"
    | "longTemplate"
    | "shortTemplate"
    | "sourceLayer"
  >[] = [];
  private dynamicArcGISStyles: {
    [sourceId: string]: Promise<{
      imageList: ImageList;
      layers: mapboxgl.Layer[];
    }>;
  } = {};

  constructor(setState: Dispatch<SetStateAction<LayerManagerContext>>) {
    this.setState = setState;
  }

  setMap(map: Map) {
    if (this.map) {
      // remove event listeners
      this.map.off("error", this.onMapError);
      this.map.off("data", this.onMapDataEvent);
      this.map.off("dataloading", this.onMapDataEvent);
      this.map.off("mouseout", this.onMouseOut);
      this.map.off("click", this.onMouseClick);
    }
    // add event listeners
    this.map = map;
    this.map.on("error", this.onMapError);
    this.map.on("data", this.onMapDataEvent);
    this.map.on("dataloading", this.onMapDataEvent);
    this.map.on("mouseout", this.onMouseOut);
    this.map.on("click", this.onMouseClick);
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

  onMouseClick = (e: MapMouseEvent) => {
    const features = this.map!.queryRenderedFeatures(e.point, {
      layers: this.interactiveLayerIds,
    });
    const top = features[0];
    if (top) {
      const popupSetting = this.activeInteractivitySettings.find(
        (i) =>
          i.type === InteractivityType.Popup &&
          i.dataSourceId.toString() === top.source &&
          (!top.sourceLayer || top.sourceLayer === i.sourceLayer)
      );
      if (popupSetting) {
        var popup = new Popup({ closeOnClick: true, closeButton: false })
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .setHTML(
            Mustache.render(popupSetting.longTemplate || "", {
              ...mustacheHelpers,
              ...top.properties,
            })
          )
          .addTo(this.map!);
      }
    }
  };

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

  updateInteractivitySettings() {
    const sourceIds: (number | string)[] = [];
    let interactiveLayerIds: string[] = [];
    // for each visible source, collect interactivitySettings
    for (const id in this.visibleLayers) {
      const layer = this.layers[id];
      const source = this.clientDataSources.find(
        (s) => s.id === layer.dataSourceId
      );
      if (
        source?.interactivitySettings &&
        source.interactivitySettings.find(
          (i) => i.type !== InteractivityType.None
        )
      ) {
        for (var i = 0; i < (layer.mapboxGlStyles || []).length; i++) {
          interactiveLayerIds.push(`${layer.id}-${i}`);
        }
      }
      if (sourceIds.indexOf(layer.dataSourceId) === -1) {
        sourceIds.push(layer.dataSourceId);
      }
    }
    const interactivitySettings: Pick<
      InteractivitySetting,
      | "id"
      | "dataSourceId"
      | "cursor"
      | "longTemplate"
      | "shortTemplate"
      | "type"
      | "sourceLayer"
    >[] = [];
    for (const id of sourceIds) {
      const source = this.clientDataSources.find((source) => source.id === id);
      if (source && source.interactivitySettings?.length) {
        for (const setting of source.interactivitySettings) {
          if (setting.type !== InteractivityType.None) {
            interactivitySettings.push(setting);
          }
        }
      }
    }
    this.activeInteractivitySettings = interactivitySettings;
    this.interactiveLayerIds = interactiveLayerIds;
    if (this.activeInteractivitySettings.length) {
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
      layers: this.interactiveLayerIds,
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
      const interactivitySetting = this.activeInteractivitySettings.find(
        (s) => s.dataSourceId.toString() === top.source
      );
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
    this.layers[layer.id] = layer;
    const sourceLayers = this.layersBySourceId[existingLayer.dataSourceId];
    this.layersBySourceId[existingLayer.dataSourceId] = [
      ...sourceLayers.filter((l) => l.id !== layer.id),
      layer,
    ];
  }

  highlightLayer(layerId: string) {}

  reset(sources: ClientDataSource[], layers: ClientDataLayer[]) {
    const oldVisibleLayers = Object.keys(this.visibleLayers);
    // Remove any visible overlay layers and their sources
    for (const layer of Object.values(this.layers)) {
      this.removeLayer(layer);
    }
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
    this.setVisibleLayers(oldVisibleLayers.filter((id) => id in this.layers));

    const sortedLayers = [...layers];
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

  setVisibleLayers(layerIds: string[]) {
    const layers = layerIds.map((id) => this.layers[id]);
    const notVisible = layers.filter((l) => !this.visibleLayers[l.id]);
    const layersForRemoval = [];
    for (const id in this.visibleLayers) {
      if (layerIds.indexOf(id) === -1) {
        layersForRemoval.push(this.layers[id]);
      }
    }
    if (this.map) {
      for (const layer of notVisible) {
        this.addLayer(layer);
      }

      for (const layer of layersForRemoval) {
        this.removeLayer(layer);
      }
    }
  }

  hideLayers(layerIds: string[]) {
    for (const id of layerIds) {
      this.removeLayer(this.layers[id]);
    }
  }

  updateSource(source: ClientDataSource) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const existingSource = this.clientDataSources.find(
      (s) => s.id === source.id
    );
    if (!existingSource) {
      throw new Error(`Existing source with id ${source.id} not found.`);
    }
    if (
      source.type === DataSourceTypes.ArcgisDynamicMapserver ||
      source.type === DataSourceTypes.ArcgisVector
    ) {
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
          if (source.type === DataSourceTypes.ArcgisDynamicMapserver) {
            instance = updateDynamicMapService(
              existingSource,
              source,
              instance as ArcGISDynamicMapServiceInstance,
              layers,
              this.map
            );
            this.sourceCache[source.id] = instance;
          } else if (source.type === DataSourceTypes.ArcgisVector) {
            instance = updateArcGISVectorSource(
              existingSource,
              source,
              instance as ArcGISVectorSourceInstance,
              layers,
              this.map
            );
            this.sourceCache[source.id] = instance;
          } else {
            throw new Error(`Not able to update ${source!.type}`);
          }
          this.clientDataSources = [
            ...this.clientDataSources.filter((s) => s.id !== source.id),
            source,
          ];
        }
      }
    } else {
      throw new Error("Mapbox base sources not supported yet");
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
      layer.renderUnder === RenderUnderType.Labels ||
      layer.renderUnder === RenderUnderType.Land
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
