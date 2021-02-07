import mapboxgl, {
  Layer as MapBoxLayer,
  Map,
  MapDataEvent,
  ErrorEvent,
  Source,
  AnyLayer,
  Style,
} from "mapbox-gl";
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
} from "@seasketch/mapbox-gl-esri-sources";
import {
  Basemap,
  DataLayer,
  DataSource as GeneratedDataSource,
  DataSourceTypes,
  InteractivitySetting,
  RenderUnderType,
  Sprite,
  SpriteImage,
} from "../generated/graphql";
import { fetchGlStyle } from "../useMapboxStyle";
import { getDynamicArcGISStyle } from "../admin/data/arcgis/arcgis";
import LayerInteractivityManager from "./LayerInteractivityManager";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;

interface LayerState {
  visible: true;
  loading: boolean;
  error?: Error;
}

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

export type ClientBasemaps = Pick<
  Basemap,
  | "id"
  | "attribution"
  | "type"
  | "description"
  | "name"
  | "projectId"
  | "labelsLayerId"
  | "terrainExaggeration"
  | "terrainMaxZoom"
  | "terrainOptional"
  | "terrainTileSize"
  | "terrainUrl"
  | "terrainVisibilityDefault"
  | "thumbnail"
  | "tileSize"
  | "url"
>;

class MapContextManager {
  map?: Map;
  private interactivityManager?: LayerInteractivityManager;
  private preferencesKey?: string;
  private ignoreLayerVisibilityState = false;
  private clientDataSources: { [dataSourceId: string]: ClientDataSource } = {};
  private layersByZIndex: (number | string)[] = [];
  private layers: { [layerId: string]: ClientDataLayer } = {};
  private layersBySourceId: { [sourceId: string]: ClientDataLayer[] } = {};
  private visibleLayers: { [id: string]: LayerState } = {};
  private selectedBasemapId?: string;
  private basemaps: { [id: string]: ClientBasemaps } = {};
  private setState: Dispatch<SetStateAction<MapContextInterface>>;
  private updateStateDebouncerReference?: NodeJS.Timeout;
  private sourceCache: {
    [id: string]: ArcGISDynamicMapServiceInstance | ArcGISVectorSourceInstance;
  } = {};
  private dirtyMapServices: string[] = [];
  private updateMapServicesDebouncerReference?: NodeJS.Timeout;
  private updateSourcesStateDebouncerReference?: NodeJS.Timeout;
  private isReady = false;
  private initialBounds?: [number, number, number, number];

  constructor(
    initialState: MapContextInterface,
    setState: Dispatch<SetStateAction<MapContextInterface>>,
    preferencesKey?: string,
    ignoreLayerVisibilityState?: boolean
  ) {
    this.setState = setState;
    // @ts-ignore
    window.mapContext = this;
    this.preferencesKey = preferencesKey;
    this.ignoreLayerVisibilityState = !!ignoreLayerVisibilityState;
    this.selectedBasemapId = initialState.selectedBasemap;
    this.visibleLayers = initialState.layerStates;
    this.initialBounds = initialState.bounds;
    // # Initialization steps
    // 1. Retrieve list of basemaps for the project
    // 2. Determine which basemap should be displayed (TODO: implement in useMapContext)
    // 3. Set that basemap as selected so UI can update
    // 4. Fetch that basemap's style
    // 5. Calculate style that should be displayed based on basemap, visible layers, etc
    // 6. Set that computed style and indicate to the map that it may render
  }

  /**
   * Create a Mapbox GL JS instance. Should be called by <MapBoxMap /> component.
   * Wait until MapContext.ready = true
   * @param container html div where the map should be rendered
   * @param bounds optionally provide an initial extent
   */
  async createMap(
    container: HTMLDivElement,
    bounds?: [number, number, number, number]
  ) {
    if (this.map) {
      // throw new Error("Map already created in this context");
      if (this.interactivityManager) {
        this.interactivityManager.destroy();
        delete this.interactivityManager;
        this.map.off("error", this.onMapError);
        this.map.off("data", this.onMapDataEvent);
        this.map.off("dataloading", this.onMapDataEvent);
      }
    }
    if (!this.isReady) {
      throw new Error(
        "Wait to call createMap until after MapContext.ready = true"
      );
    }
    const style = await this.getComputedStyle();
    this.map = new Map({
      container,
      style,
      bounds: this.initialBounds || bounds,
      center: [1.9, 18.7],
      zoom: 0.09527381899319892,
    });

    this.interactivityManager = new LayerInteractivityManager(
      this.map,
      this.setState
    );
    const visibleLayers: ClientDataLayer[] = [];
    for (const id in this.visibleLayers) {
      const state = this.visibleLayers[id];
      if (state.visible && this.layers[id]) {
        visibleLayers.push(this.layers[id]);
      }
    }
    this.interactivityManager.setVisibleLayers(
      visibleLayers,
      this.clientDataSources
    );

    this.map.on("error", this.onMapError);
    this.map.on("data", this.onMapDataEvent);
    this.map.on("dataloading", this.onMapDataEvent);

    return this.map;
  }

  setViewport(center: [number, number], zoom: number) {}

  /**
   * A component somewhere in the MapContext will need to set the list of basemaps
   * before a MapboxMap will be initialized. It can be re-set whenever the list is
   * updated.
   * @param basemaps List of Basemap objects
   */
  setBasemaps(basemaps: ClientBasemaps[]) {
    console.log("set basemaps");
    this.basemaps = {};
    for (const basemap of basemaps) {
      this.basemaps[basemap.id.toString()] = basemap;
    }
    if (!this.selectedBasemapId || !this.basemaps[this.selectedBasemapId]) {
      this.setSelectedBasemap(basemaps[0].id.toString());
    }
    if (!this.isReady) {
      this.isReady = true;
      this.setState((prev) => ({
        ...prev,
        ready: true,
      }));
    }
  }

  /**
   * Set the basemap that should be displayed on the map. Updates MapContext.selectedBasemap
   * @param id String ID for the basemap to select
   */
  setSelectedBasemap(id: string) {
    this.selectedBasemapId = id;
    this.setState((prev) => ({
      ...prev,
      selectedBasemap: this.selectedBasemapId,
    }));
    this.updatePreferences();
    this.updateStyle();
  }

  private updatePreferences() {
    if (this.preferencesKey) {
      const bounds = this.map!.getBounds();
      window.localStorage.setItem(
        this.preferencesKey,
        JSON.stringify({
          basemap: this.selectedBasemapId,
          layers: this.visibleLayers,
          ...(this.map
            ? {
                bounds: bounds.toArray(),
              }
            : {}),
        })
      );
    }
  }

  private async updateStyle() {
    if (this.map && this.selectedBasemapId) {
      const style = await this.getComputedStyle();
      this.map.setStyle(style);
    }
  }

  async setVisibleLayers(layerIds: string[]) {
    for (const id in this.visibleLayers) {
      if (layerIds.indexOf(id) === -1) {
        delete this.visibleLayers[id];
      }
    }
    for (const id of layerIds) {
      if (layerIds.indexOf(id) === -1) {
        this.visibleLayers[id] = {
          loading: true,
          visible: true,
        };
      }
    }
    this.updateStyle();
  }

  async getComputedStyle(): Promise<Style> {
    if (!this.selectedBasemapId) {
      throw new Error("Cannot call getComputedStyle before basemaps are set");
    }
    const url = this.basemaps[this.selectedBasemapId].url;
    const baseStyle = {
      ...(await fetchGlStyle(url)),
    };
    baseStyle.sources = baseStyle.sources || {};
    baseStyle.layers = baseStyle.layers || [];
    for (const layerId in this.visibleLayers) {
      if (this.visibleLayers[layerId].visible) {
        const layer = this.layers[layerId];
        if (layer) {
          const source = this.clientDataSources[layer.dataSourceId];
          if (source && !baseStyle.sources[source.id.toString()]) {
            if (source.type === DataSourceTypes.SeasketchVector) {
              baseStyle.sources[source.id.toString()] = {
                type: "geojson",
                data: `https://${source.bucketId}/${source.objectKey}`,
                attribution: source.attribution || "",
              };
            }
          }
          if (
            source.type === DataSourceTypes.SeasketchVector &&
            layer.mapboxGlStyles?.length
          ) {
            for (let i = 0; i < layer.mapboxGlStyles.length; i++) {
              baseStyle.layers.push({
                ...layer.mapboxGlStyles[i],
                source: source.id.toString(),
                id: idForLayer(layer, i),
              });
            }
          }
        }
      }
    }
    return baseStyle;
  }

  private onMapDataEvent = (
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

  private onMapError = (event: ErrorEvent & { sourceId?: string }) => {
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
    if (this.interactivityManager) {
      const visibleLayers: ClientDataLayer[] = [];
      for (const id in this.visibleLayers) {
        const state = this.visibleLayers[id];
        if (state.visible) {
          visibleLayers.push(this.layers[id]);
        }
      }
      this.interactivityManager.setVisibleLayers(
        visibleLayers,
        this.clientDataSources
      );
    }
  }

  private debouncedUpdateSourceStates(backoff = 10) {
    if (this.updateSourcesStateDebouncerReference) {
      clearTimeout(this.updateSourcesStateDebouncerReference);
    }
    this.updateSourcesStateDebouncerReference = setTimeout(() => {
      delete this.updateSourcesStateDebouncerReference;
      this.updateSourceStates();
    }, backoff);
  }

  private updateSourceStates() {
    let anyChanges = false;
    let anyLoading = false;
    if (!this.map) {
      throw new Error("MapContextManager.map not set");
    }
    let sources: { [sourceId: string]: ClientDataLayer[] } = {};
    for (const layerId of Object.keys(this.visibleLayers)) {
      const layer = this.layers[layerId];
      if (layer) {
        if (!sources[layer.dataSourceId]) {
          sources[layer.dataSourceId] = [];
        }
        sources[layer.dataSourceId].push(layer);
      }
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

  private isSourceLoading(id: string) {
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
        this.map.removeLayer(idForLayer(existingLayer, i));
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
            id: idForLayer(layer, i),
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
    this.clientDataSources = {};
    for (const source of sources) {
      this.clientDataSources[source.id] = source;
    }
    this.layers = {};
    for (const layer of layers) {
      this.layers[layer.id] = layer;
    }
    this.updateStyle();
    return;
    // const oldVisibleLayers = Object.keys(this.visibleLayers);
    // // Remove any visible overlay layers and their sources
    // await Promise.all(
    //   Object.values(this.layers).map((layer) => this.removeLayer(layer))
    // );
    // // replace internal sources list with the new one
    // const oldClientDataSources = this.clientDataSources;
    // this.clientDataSources = {};
    // for (const source of sources) {
    //   this.clientDataSources[source.id] = source;
    // }

    // // for each source on the map, check for updates
    // for (const oldConfig of Object.values(oldClientDataSources)) {
    //   const newConfig = this.clientDataSources[oldConfig.id];
    //   if (
    //     newConfig &&
    //     this.map?.getSource(oldConfig.id.toString()) &&
    //     areEqualShallow(newConfig, oldConfig) === false
    //   ) {
    //     // need to update
    //     if (
    //       newConfig.type === DataSourceTypes.Geojson ||
    //       newConfig.type === DataSourceTypes.SeasketchVector
    //     ) {
    //       updateGeoJSONSource(oldConfig, newConfig, this.map!);
    //     } else if (newConfig.type === DataSourceTypes.ArcgisVector) {
    //       // this.updateSource(newConfig);
    //       const updatedInstance = updateArcGISVectorSource(
    //         oldConfig,
    //         newConfig,
    //         this.sourceCache[newConfig.id] as ArcGISVectorSourceInstance,
    //         layers,
    //         this.map
    //       );
    //       this.sourceCache[newConfig.id] = updatedInstance;
    //     } else if (newConfig.type === DataSourceTypes.ArcgisDynamicMapserver) {
    //       this.updateArcGISDynamicMapServiceSource(newConfig);
    //     }
    //   }
    // }

    // // this.clearSourceCache();
    // // replace internal layers list
    // this.layers = {};
    // this.layersBySourceId = {};
    // for (const layer of layers) {
    //   this.layers[layer.id] = layer;
    //   if (!this.layersBySourceId[layer.dataSourceId]) {
    //     this.layersBySourceId[layer.dataSourceId] = [];
    //   }
    //   this.layersBySourceId[layer.dataSourceId].push(layer);
    // }
    // // add visible layers and associated sources to map
    // this.resetLayersByZIndex();
    // this.setVisibleLayers(oldVisibleLayers.filter((id) => id in this.layers));
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
    const existingSource = this.clientDataSources[source.id];
    if (!existingSource) {
      throw new Error(`Existing source with id ${source.id} not found.`);
    }
    this.resetLayersByZIndex();
    let instance = this.sourceCache[source.id];
    if (!instance) {
      // not visible, just replace
      this.clientDataSources[source.id] = source;
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
        this.clientDataSources[source.id] = source;
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
      const dataSourceConfig = this.clientDataSources[layer.dataSourceId];
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
        getDynamicArcGISStyle(
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
                  id: idForLayer(layer, i),
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
                id: idForLayer(layer, i),
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
    this.updateInteractivitySettings();
  }

  private getZPosition(layer: ClientDataLayer): string | undefined {
    const layerId = idForLayer(layer, 0);
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

  private async addSprite(sprite: ClientSprite) {
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
        const style = await getDynamicArcGISStyle(
          this.clientDataSources[layer.dataSourceId]!.url!,
          layer.dataSourceId.toString()
        );
        mapboxLayers = style.layers || [];
      }
      if (this.visibleLayers[layer.id] && mapboxLayers.length) {
        for (var i = 0; i < mapboxLayers?.length; i++) {
          this.map.removeLayer(idForLayer(layer, i));
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
    this.updateInteractivitySettings();
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
    this.updatePreferences();
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
        const sourceConfig = this.clientDataSources[id];
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

  private async updateZIndexForImageSource(sourceId: string) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const layerId = idForImageSource(sourceId);
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
      const layerId = idForImageSource(sourceId);
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
            id: idForImageSource(sourceId),
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
      return;
      // throw new Error("Map not set");
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
        this._reset(
          Object.values(this.clientDataSources),
          Object.values(this.layers)
        );
        this.changeBasemapTimeout = null;
      }
    };
    this.changeBasemapTimeout = setTimeout(reset, 5);
  }
}

export default MapContextManager;

export interface Tooltip {
  x: number;
  y: number;
  messages: string[];
}

export interface MapContextInterface {
  layerStates: { [id: string]: LayerState };
  manager?: MapContextManager;
  bannerMessages: string[];
  tooltip?: Tooltip;
  fixedBlocks: string[];
  selectedBasemap?: string;
  bounds?: [number, number, number, number];
  /* Indicates the map state is ready to render a map */
  ready: boolean;
}

/**
 * Returns a MapContextManager instance that can be used to store state used by
 * instances of Mapbox GL, Layer lists, Basemap selectors, and layer interactivity
 * indicators.
 *
 * @param preferencesKey If provided, map state will be restored upon return to the map by storing state in localStorage
 * @param ignoreLayerVisibilityState Don't store layer visibility state in localStorage
 */
export function useMapContext(
  preferencesKey?: string,
  ignoreLayerVisibilityState?: boolean
) {
  let initialState: MapContextInterface = {
    layerStates: {},
    bannerMessages: [],
    fixedBlocks: [],
    ready: false,
  };
  if (preferencesKey) {
    const preferencesString = window.localStorage.getItem(preferencesKey);
    if (preferencesString) {
      const prefs = JSON.parse(preferencesString);
      if (prefs.basemap) {
        initialState.selectedBasemap = prefs.basemap as string;
      }
      if (prefs.layers) {
        initialState.layerStates = prefs.layers;
      }
      if (prefs.bounds) {
        initialState.bounds = prefs.bounds;
      }
    }
  }
  const [state, setState] = useState<MapContextInterface>(initialState);
  useEffect(() => {
    const manager = new MapContextManager(
      initialState,
      setState,
      preferencesKey
    );
    const newState = {
      ...state,
      manager,
    };
    setState(newState);
  }, []);
  return state;
}

export const MapContext = createContext<MapContextInterface>({
  layerStates: {},
  manager: new MapContextManager(
    { layerStates: {}, bannerMessages: [], fixedBlocks: [], ready: false },
    (state) => {}
  ),
  bannerMessages: [],
  fixedBlocks: [],
  ready: false,
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
    return idForImageSource(layer.dataSourceId);
  }
}

function isArcGISDynamicService(
  source: any
): source is ArcGISDynamicMapService {
  return typeof source.updateUseDevicePixelRatio === "function";
}

/**
 * Generate an ID for a given layer in a ClientDataLayer. Note that SeaSketch DataLayers are not the same as Mapbox GL Style layers.
 * @param layer ClientDataLayer
 * @param styleLayerIndex ClientDataLayers' gl style contains multiple layers. You must specify the index of the layer to generate an ID
 */
export function idForLayer(layer: ClientDataLayer, styleLayerIndex?: number) {
  if (layer.sublayer === null || layer.sublayer === undefined) {
    if (styleLayerIndex === undefined) {
      throw new Error(
        "styleLayerIndex must be provided to determine ID for a vector DataLayer"
      );
    } else {
      return `seasketch/${layer.id}/${styleLayerIndex}`;
    }
  } else {
    return idForImageSource(layer.dataSourceId);
  }
}

/**
 * Extract the DataLayer id from a given GL Style layer's ID.
 * @param id
 */
export function layerIdFromStyleLayerId(id: string) {
  const re = /seasketch\/(\w+)\/\d+/;
  if (/seasketch\/\w+\/image/.test(id)) {
    throw new Error("Sublayer-type layer.");
  } else if (re.test(id)) {
    return re.exec(id)![1];
  } else {
    throw new Error("Does not appear to be a SeaSketch DataLayer. ID=" + id);
  }
}

function idForImageSource(sourceId: number | string) {
  return `seasketch/${sourceId}/image`;
}
