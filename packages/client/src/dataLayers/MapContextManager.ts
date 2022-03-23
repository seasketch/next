import mapboxgl, {
  Map,
  MapDataEvent,
  ErrorEvent,
  Source,
  Style,
  Layer,
  CameraOptions,
  LngLatBoundsLike,
  MapboxOptions,
  AnySourceImpl,
} from "mapbox-gl";
// @ts-ignore
import * as spec from "@mapbox/mapbox-gl-style-spec";
import {
  createContext,
  Dispatch,
  useEffect,
  useState,
  SetStateAction,
} from "react";
import { BBox, Feature, Polygon } from "geojson";
import {
  Basemap,
  BasemapDetailsFragment,
  DataLayer,
  DataSource as GeneratedDataSource,
  DataSourceTypes,
  InteractivitySetting,
  OptionalBasemapLayer,
  OptionalBasemapLayersGroupType,
  RenderUnderType,
  Sprite,
  SpriteImage,
  useProjectRegionQuery,
} from "../generated/graphql";
import { fetchGlStyle } from "../useMapboxStyle";
import LayerInteractivityManager from "./LayerInteractivityManager";
import ArcGISVectorSourceCache, {
  ArcGISVectorSourceCacheEvent,
} from "./ArcGISVectorSourceCache";
import bytes from "bytes";
import { urlTemplateForArcGISDynamicSource } from "./sourceTypes/ArcGISDynamicMapServiceSource";
import bbox from "@turf/bbox";
import { useParams } from "react-router";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;

interface LayerState {
  visible: true;
  loading: boolean;
  error?: Error;
}

// export type SourceInstance =
//   | MapBoxSource
//   | ArcGISVectorSource
//   | WMSSource;

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

export type ClientBasemap = BasemapDetailsFragment;
// Pick<
//   Basemap,
//   | "id"
//   | "attribution"
//   | "type"
//   | "description"
//   | "name"
//   | "projectId"
//   | "labelsLayerId"
//   | "terrainExaggeration"
//   | "terrainMaxZoom"
//   | "terrainOptional"
//   | "terrainTileSize"
//   | "terrainUrl"
//   | "terrainVisibilityDefault"
//   | "thumbnail"
//   | "tileSize"
//   | "url"
// > & {
//   optionalBasemapLayers: Pick<
//     OptionalBasemapLayer,
//     | "basemapId"
//     | "id"
//     | "options"
//     | "name"
//     | "groupType"
//     | "defaultVisibility"
//     | "description"
//     | "layers"
//     | "metadata"
//   >[];
// } & {
//   interactivitySettings?: Pick<
//     InteractivitySetting,
//     "id" | "cursor" | "layers" | "longTemplate" | "shortTemplate" | "type"
//   >;
// };

class MapContextManager {
  map?: Map;
  private interactivityManager?: LayerInteractivityManager;
  private preferencesKey?: string;
  private clientDataSources: { [dataSourceId: string]: ClientDataSource } = {};
  private layersByZIndex: string[] = [];
  private layers: { [layerId: string]: ClientDataLayer } = {};
  private visibleLayers: { [id: string]: LayerState } = {};
  private basemaps: { [id: string]: ClientBasemap } = {};
  private _setState: Dispatch<SetStateAction<MapContextInterface>>;
  private updateStateDebouncerReference?: NodeJS.Timeout;
  private updateSourcesStateDebouncerReference?: NodeJS.Timeout;
  private initialCameraOptions?: CameraOptions;
  private initialBounds?: LngLatBoundsLike;
  private internalState: MapContextInterface;
  arcgisVectorSourceCache: ArcGISVectorSourceCache;
  private mapIsLoaded = false;
  private mapContainer?: HTMLDivElement;
  private scaleControl = new mapboxgl.ScaleControl();

  constructor(
    initialState: MapContextInterface,
    setState: Dispatch<SetStateAction<MapContextInterface>>,
    initialCameraOptions?: CameraOptions,
    preferencesKey?: string,
    cacheSize?: number,
    initialBounds?: LngLatBoundsLike
  ) {
    cacheSize = cacheSize || bytes("50mb");
    this._setState = setState;
    // @ts-ignore
    window.mapContext = this;
    this.preferencesKey = preferencesKey;
    this.internalState = initialState;
    this.initialCameraOptions = initialCameraOptions;
    this.initialBounds = initialBounds;
    this.visibleLayers = initialState.layerStates;
    this.arcgisVectorSourceCache = new ArcGISVectorSourceCache(
      cacheSize,
      (key, item) => {
        const state = this.visibleLayers[key];
        if (state && state.visible) {
          /* eslint-disable */
          const error = new Error(
            `Active source was evicted from cache due to memory limit. Limit is ${bytes(
              cacheSize || 0
            )}, layer is ${bytes(item.bytes || 0)}`
          ); /* eslint-enable */
          state.error = error;
          item.error = error;
          delete item.bytes;
          delete item.value;
          this.debouncedUpdateLayerState(1);
          this.debouncedUpdateStyle();
          return item;
        }
      }
    );
    this.arcgisVectorSourceCache.on(
      "error",
      this.onArcGISVectorSourceCacheError
    );
  }

  private onArcGISVectorSourceCacheError = (
    event: ArcGISVectorSourceCacheEvent
  ) => {
    for (const layerId of Object.keys(this.visibleLayers)) {
      if (this.layers[layerId]?.dataSourceId?.toString() === event.key) {
        this.visibleLayers[layerId].error = event.item.error;
        this.visibleLayers[layerId].loading = false;
      }
    }
    this.debouncedUpdateLayerState();
  };

  private setState = (action: SetStateAction<MapContextInterface>) => {
    // console.warn("setState", action, this.internalState);
    if (typeof action === "function") {
      this.internalState = action(this.internalState);
    } else {
      this.internalState = action;
    }
    this._setState((prev) => ({
      ...prev,
      ...this.internalState,
    }));
  };

  /**
   * Call whenever the context will be replaced or no longer used
   */
  destroy() {
    this.arcgisVectorSourceCache.off(
      "error",
      this.onArcGISVectorSourceCacheError
    );
  }

  /**
   * Create a Mapbox GL JS instance. Should be called by <MapBoxMap /> component.
   * Wait until MapContext.ready = true
   * @param container html div where the map should be rendered
   * @param bounds optionally provide an initial extent
   */
  async createMap(
    container: HTMLDivElement,
    bounds?: [number, number, number, number],
    options?: Partial<MapboxOptions>
  ) {
    if (this.mapContainer === container) {
      console.warn("Already initializing map");
      return;
    }
    if (this.map) {
      // throw new Error("Map already created in this context");
      console.warn("Map already created in this context");
      if (this.interactivityManager) {
        this.interactivityManager.destroy();
        delete this.interactivityManager;
        this.map.off("error", this.onMapError);
        this.map.off("data", this.onMapDataEvent);
        this.map.off("dataloading", this.onMapDataEvent);
        this.map.off("moveend", this.onMapMove);
        this.map.remove();
      }
    }
    if (!this.internalState.ready) {
      throw new Error(
        "Wait to call createMap until after MapContext.ready = true"
      );
    }
    const { style, sprites } = await this.getComputedStyle();

    let mapOptions: MapboxOptions = {
      container,
      style,
      center: this.initialCameraOptions?.center || [1.9, 18.7],
      zoom: this.initialCameraOptions?.zoom || 0.09527381899319892,
      pitch: this.initialCameraOptions?.pitch || 0,
      bearing: this.initialCameraOptions?.bearing || 0,
      maxPitch: 70,
      optimizeForTerrain: true,
      logoPosition: "bottom-right",
    };
    if (this.initialCameraOptions) {
      mapOptions = {
        ...mapOptions,
        center: this.initialCameraOptions.center,
        zoom: this.initialCameraOptions.zoom,
        pitch: this.initialCameraOptions.pitch,
        bearing: this.initialCameraOptions.bearing,
        ...options,
      };
    } else if (this.initialBounds) {
      mapOptions = {
        ...mapOptions,
        bounds: this.initialBounds,
        ...options,
      };
    } else {
      throw new Error("Both initialBounds and initialCameraOptions are empty");
    }
    this.map = new Map(mapOptions);
    this.addSprites(sprites);

    this.interactivityManager = new LayerInteractivityManager(
      this.map,
      this.setState
    );
    this.interactivityManager.setVisibleLayers(
      Object.keys(this.visibleLayers)
        .filter((id) => this.visibleLayers[id]?.visible && this.layers[id])
        .map((id) => this.layers[id]),
      this.clientDataSources,
      this.getSelectedBasemap()!
    );

    if (this.internalState.showScale) {
      this.map.addControl(this.scaleControl);
    }

    this.map.on("error", this.onMapError);
    this.map.on("data", this.onMapDataEvent);
    this.map.on("dataloading", this.onMapDataEvent);
    this.map.on("moveend", this.onMapMove);
    this.map.on("load", () => {
      this.mapIsLoaded = true;
      // Use to trigger changes to mapContextManager.map
      this.setState((prev) => ({ ...prev }));
    });

    return this.map;
  }

  toggleTerrain() {
    let on = true;
    if (this.internalState.terrainEnabled) {
      on = false;
    }
    this.setState((prev) => ({
      ...prev,
      terrainEnabled: on,
      prefersTerrainEnabled: on,
    }));
    this.debouncedUpdateStyle();
    if (!on) {
      this.force2dView();
    }
  }

  toggleScale(show: boolean) {
    this.setState((prev) => ({
      ...prev,
      showScale: show,
    }));

    if (this.map) {
      if (show) {
        if (!this.map.hasControl(this.scaleControl)) {
          this.map.addControl(this.scaleControl);
        }
      } else {
        if (this.map.hasControl(this.scaleControl)) {
          this.map.removeControl(this.scaleControl);
        }
      }
    }
  }

  get scaleVisible() {
    return !!this.internalState.showScale;
  }

  private force2dView() {
    if (this.map && this.map.getPitch() > 0) {
      this.map.easeTo({
        pitch: 0,
        bearing: 0,
      });
    }
  }

  onMapMoveDebouncerReference: NodeJS.Timeout | undefined;

  onMapMove = (event: MouseEvent) => {
    if (this.onMapMoveDebouncerReference) {
      clearTimeout(this.onMapMoveDebouncerReference);
    }
    this.onMapMoveDebouncerReference = setTimeout(() => {
      delete this.onMapMoveDebouncerReference;
      this.updatePreferences();
    }, 1000);
  };

  setViewport(center: [number, number], zoom: number) {}

  /**
   * A component somewhere in the MapContext will need to set the list of basemaps
   * before a MapboxMap will be initialized. It can be re-set whenever the list is
   * updated.
   * @param basemaps List of Basemap objects
   */
  setBasemaps(basemaps: BasemapDetailsFragment[]) {
    this.basemaps = {};
    for (const basemap of basemaps) {
      if (basemap) {
        this.basemaps[basemap.id.toString()] = basemap;
      }
    }
    if (
      !this.internalState.selectedBasemap ||
      !this.basemaps[this.internalState.selectedBasemap]
    ) {
      if (basemaps.length && basemaps[0]) {
        this.setSelectedBasemap(basemaps[0].id.toString());
      }
    }
    this.setState((prev) => ({
      ...prev,
      ready: !!(this.initialCameraOptions || this.initialBounds),
      terrainEnabled: this.shouldEnableTerrain(),
      basemapOptionalLayerStates: this.computeBasemapOptionalLayerStates(
        this.internalState.selectedBasemap
          ? this.basemaps[this.internalState.selectedBasemap] || basemaps[0]
          : basemaps[0],
        this.internalState.basemapOptionalLayerStatePreferences
      ),
    }));
    this.debouncedUpdateStyle();
    this.updateInteractivitySettings();
  }

  setProjectBounds(feature: Feature<Polygon>) {
    const box = bbox(feature);
    this.initialBounds = box.slice(0, 4) as [number, number, number, number];
    this.setState((prev) => ({
      ...prev,
      ready: !!(this.initialCameraOptions || this.initialBounds),
    }));
  }

  private computeBasemapOptionalLayerStates(
    basemap: ClientBasemap | null,
    preferences?: { [layerName: string]: any }
  ) {
    const states: { [layerName: string]: any } = {};
    if (basemap) {
      for (const layer of basemap.optionalBasemapLayers) {
        const preference =
          preferences && layer.name in preferences
            ? preferences[layer.name]
            : undefined;
        if (layer.groupType === OptionalBasemapLayersGroupType.None) {
          states[layer.id] = preference ?? layer.defaultVisibility;
        } else if (layer.groupType === OptionalBasemapLayersGroupType.Select) {
          states[layer.id] = preference ?? (layer.options || [])[0]?.name;
        } else {
          states[layer.id] = preference ?? (layer.options || [])[0]?.name;
        }
      }
    }
    return states;
  }

  /**
   * Set the basemap that should be displayed on the map. Updates MapContext.selectedBasemap
   * @param id String ID for the basemap to select
   */
  setSelectedBasemap(id: string) {
    const previousBasemap =
      this.internalState.selectedBasemap &&
      this.basemaps[this.internalState.selectedBasemap];
    this.internalState.selectedBasemap = id;
    const terrainWasEnabled = this.internalState.terrainEnabled;
    const terrainEnabled = this.shouldEnableTerrain();
    const basemap = this.basemaps[id];
    this.setState((prev) => ({
      ...prev,
      selectedBasemap: this.internalState.selectedBasemap,
      basemapOptionalLayerStates: this.computeBasemapOptionalLayerStates(
        basemap,
        this.internalState.basemapOptionalLayerStatePreferences
      ),
      terrainEnabled,
    }));
    this.updatePreferences();
    // this.updateState();
    this.debouncedUpdateStyle();
    if (previousBasemap && basemap) {
      if (!this.internalState.terrainEnabled) {
        this.force2dView();
      }
    }
    this.updateInteractivitySettings();
  }

  clearTerrainSettings() {
    const selectedBasemap = this.getSelectedBasemap();
    this.setState((prev) => ({
      ...prev,
      prefersTerrainEnabled: undefined,
      terrainEnabled:
        !!selectedBasemap?.terrainUrl &&
        (!selectedBasemap?.terrainOptional ||
          selectedBasemap?.terrainVisibilityDefault === true),
    }));
    this.updatePreferences();
  }

  private shouldEnableTerrain() {
    const state = this.internalState;
    if (this.basemaps && state.selectedBasemap) {
      const basemap = this.basemaps[state.selectedBasemap];
      if (basemap && basemap.terrainUrl) {
        if (basemap.terrainOptional) {
          if (this.internalState.prefersTerrainEnabled === true) {
            return true;
          } else if (this.internalState.prefersTerrainEnabled === false) {
            return false;
          } else {
            return basemap.terrainVisibilityDefault || false;
          }
        } else {
          return true;
        }
      } else {
        return false;
      }
    }
    return false;
  }

  private updatePreferences() {
    if (this.preferencesKey) {
      const prefs = {
        basemap: this.internalState.selectedBasemap,
        layers: this.visibleLayers,
        ...(this.map
          ? {
              cameraOptions: {
                center: this.map.getCenter().toArray(),
                zoom: this.map.getZoom(),
                bearing: this.map.getBearing(),
                pitch: this.map.getPitch(),
              },
            }
          : {}),
        prefersTerrainEnabled: this.internalState.prefersTerrainEnabled,
        basemapOptionalLayerStatePreferences: this.internalState
          .basemapOptionalLayerStatePreferences,
      };
      window.localStorage.setItem(this.preferencesKey, JSON.stringify(prefs));
    }
  }

  private updateStyleDebouncerReference: NodeJS.Timeout | undefined;

  private async debouncedUpdateStyle(backoff = 2) {
    if (this.updateStyleDebouncerReference) {
      clearTimeout(this.updateStyleDebouncerReference);
    }
    this.updateStyleDebouncerReference = setTimeout(() => {
      delete this.updateStyleDebouncerReference;
      this.updateStyle();
    }, backoff);
  }

  private updateStyleInfinitLoopDetector = 0;

  private async updateStyle() {
    if (this.map && this.internalState.ready) {
      this.updateStyleInfinitLoopDetector = 0;
      const { style, sprites } = await this.getComputedStyle();
      this.addSprites(sprites);
      if (!this.mapIsLoaded) {
        setTimeout(() => {
          this.map!.setStyle(style);
        }, 20);
      } else {
        this.map.setStyle(style);
      }
    } else {
      this.updateStyleInfinitLoopDetector++;
      if (this.updateStyleInfinitLoopDetector > 10) {
        this.updateStyleInfinitLoopDetector = 0;
      } else {
        this.debouncedUpdateStyle();
      }
    }
  }

  async setVisibleLayers(layerIds: string[]) {
    for (const id in this.visibleLayers) {
      if (layerIds.indexOf(id) === -1) {
        this.hideLayerId(id);
      }
    }
    for (const id of layerIds) {
      if (!this.visibleLayers[id]) {
        this.showLayerId(id);
      }
    }
    this.debouncedUpdateLayerState(1);
    this.debouncedUpdateStyle();
  }

  private hideLayerId(id: string) {
    delete this.visibleLayers[id];
    const key = this.layers[id]?.dataSourceId?.toString();
    if (key) {
      this.arcgisVectorSourceCache.clearErrorsForKey(key);
    }
  }

  private showLayerId(id: string) {
    if (this.visibleLayers[id]) {
      const state = this.visibleLayers[id];
      if (state.error) {
        // do nothing
      } else {
        if (!state.visible) {
          state.visible = true;
          state.loading = true;
        }
      }
    } else {
      this.visibleLayers[id] = {
        loading: true,
        visible: true,
      };
    }
  }

  async getComputedStyle(): Promise<{ style: Style; sprites: ClientSprite[] }> {
    this.resetLayersByZIndex();
    let sprites: ClientSprite[] = [];
    // if (!this.internalState.selectedBasemap) {
    //   throw new Error("Cannot call getComputedStyle before basemaps are set");
    // }
    const basemap = this.basemaps[this.internalState.selectedBasemap || ""] as
      | ClientBasemap
      | undefined;
    const labelsID = basemap?.labelsLayerId;
    const url =
      basemap?.url ||
      "mapbox://styles/underbluewaters/cklb3vusx2dvs17pay6jp5q7e";
    let baseStyle: Style;
    try {
      baseStyle = await fetchGlStyle(url);
      if (this.internalState.basemapError) {
        this.setState((prev) => ({
          ...prev,
          basemapError: undefined,
        }));
      }
    } catch (e) {
      this.setState((prev) => ({
        ...prev,
        basemapError: e,
      }));
      console.warn(e);
      baseStyle = await fetchGlStyle(
        "mapbox://styles/underbluewaters/cklb5eho20sb817qhmzltsrpf"
      );
    }
    baseStyle = {
      ...baseStyle,
      layers: [...(baseStyle.layers || [])],
      sources: { ...(baseStyle.sources || {}) },
      // @ts-ignore
      terrain: undefined,
    };
    if (this.internalState.terrainEnabled && basemap) {
      const newSource = {
        type: "raster-dem",
        url: basemap.terrainUrl,
      };
      /**
       * This extra check for an existing source is required because the terrain tilejson
       * may be loaded already by mapbox gl. Calling setStyle with the un-initialized source
       * will trigger a repaint of the entire style. This seems to be a bug with mapbox-gl
       * because other source types do not have this problem
       */
      let existingSource: AnySourceImpl | null = null;
      try {
        existingSource = this.map?.getSource("terrain-source") || null;
      } catch (e) {
        // Do nothing. Sometimes the map will be set but calling getSource will
        // throw an error from deep in the mapbox-gl code.
        // Attempts to fix bug reported by sentry:
        // https://sentry.io/organizations/wwwseasketchorg/issues/2988858003/events/4f007357f24245989c1bc267d04f485c
      }
      if (
        existingSource &&
        existingSource.type === "raster-dem" &&
        existingSource.url === newSource.url &&
        existingSource.encoding &&
        existingSource.tiles
      ) {
        baseStyle.sources!["terrain-source"] = {
          type: existingSource.type,
          url: existingSource.url,
          bounds: existingSource.bounds,
          tiles: existingSource.tiles,
          encoding: existingSource.encoding,
          tileSize: existingSource.tileSize,
        };
      } else {
        // @ts-ignore
        baseStyle.sources![
          baseStyle.terrain?.source || "terrain-source"
        ] = newSource;
      }

      // @ts-ignore
      baseStyle.terrain = {
        source: "terrain-source",
        exaggeration: parseFloat(basemap.terrainExaggeration || 1.2),
      };

      if (!(baseStyle.layers || []).find((l) => l.type === "sky")) {
        baseStyle.layers?.push({
          id: "sky",
          type: "sky",
          paint: {
            // set up the sky layer to use a color gradient
            "sky-type": "gradient",
            // the sky will be lightest in the center and get darker moving radially outward
            // this simulates the look of the sun just below the horizon
            "sky-gradient": [
              "interpolate",
              ["linear"],
              ["sky-radial-progress"],
              0.8,
              "rgba(135, 206, 235, 1.0)",
              1,
              "rgba(0,0,0,0.1)",
            ],
            "sky-gradient-center": [0, 0],
            "sky-gradient-radius": 90,
            "sky-opacity": [
              "interpolate",
              ["exponential", 0.1],
              ["zoom"],
              5,
              0,
              22,
              1,
            ],
          },
        });
      }
    }
    // } else if (!this.internalState.terrainEnabled) {
    //   console.log("delete terrain");
    //   delete baseStyle.terrain;
    // }

    let labelsLayerIndex = baseStyle.layers?.findIndex(
      (layer) => layer.id === labelsID
    );
    baseStyle.sources = baseStyle.sources || {};
    baseStyle.layers = baseStyle.layers || [];
    if (labelsLayerIndex === -1) {
      labelsLayerIndex = baseStyle.layers.length;
    }
    let underLabels: any[] = baseStyle.layers.slice(0, labelsLayerIndex);
    let overLabels: any[] = baseStyle.layers.slice(labelsLayerIndex);
    let isUnderLabels = true;
    let i = this.layersByZIndex.length;
    while (i--) {
      const layerId = this.layersByZIndex[i];
      if (layerId === "LABELS") {
        isUnderLabels = false;
      } else {
        if (this.visibleLayers[layerId]?.visible) {
          const layer = this.layers[layerId];
          // If layer or source are not set yet, they will be ignored
          if (layer) {
            const source = this.clientDataSources[layer.dataSourceId];
            let sourceWasAdded = false;
            if (source) {
              // Add the source
              if (!baseStyle.sources[source.id.toString()]) {
                switch (source.type) {
                  case DataSourceTypes.Vector:
                    baseStyle.sources[source.id.toString()] = {
                      type: "vector",
                      // attribution: source.attribution || "",
                      tiles: source.tiles as string[],
                    };
                    sourceWasAdded = true;
                    break;
                  case DataSourceTypes.SeasketchVector:
                  case DataSourceTypes.Geojson:
                    baseStyle.sources[source.id.toString()] = {
                      type: "geojson",
                      data:
                        source.type === DataSourceTypes.SeasketchVector
                          ? // eslint-disable-next-line
                            `${source.bucketId}/${source.objectKey}`
                          : source.url!,
                      attribution: source.attribution || "",
                    };
                    sourceWasAdded = true;
                    break;
                  case DataSourceTypes.ArcgisVector:
                    const request = this.arcgisVectorSourceCache.get(source);
                    if (request.value) {
                      baseStyle.sources[source.id.toString()] = {
                        type: "geojson",
                        data: request.value,
                        attribution: source.attribution || "",
                      };
                      sourceWasAdded = true;
                    } else if (request.error) {
                      // User will need to toggle the layer off
                      // to clear the error and try again.
                    } else {
                      request.promise
                        .then((data) => {
                          this.debouncedUpdateStyle();
                        })
                        .catch((e) => {
                          // do nothing, this will be handled elsewhere
                        });
                    }
                    break;
                  default:
                    break;
                }
              }
              // Add the sprites if needed
              if (layer.sprites?.length) {
                sprites = [...sprites, ...layer.sprites];
              }
              // Add the layer(s)
              if (sourceWasAdded) {
                if (
                  (source.type === DataSourceTypes.SeasketchVector ||
                    source.type === DataSourceTypes.Geojson ||
                    source.type === DataSourceTypes.Vector ||
                    source.type === DataSourceTypes.ArcgisVector) &&
                  layer.mapboxGlStyles?.length
                ) {
                  for (let i = 0; i < layer.mapboxGlStyles.length; i++) {
                    (isUnderLabels ? underLabels : overLabels).push({
                      ...layer.mapboxGlStyles[i],
                      source: source.id.toString(),
                      id: idForLayer(layer, i),
                    });
                  }
                }
              }
            }
          }
        } else {
          // Handle image sources with multiple sublayers baked in
          if (/seasketch\/[\w\d-]+\/image/.test(layerId)) {
            const sourceId = layerId.match(/seasketch\/([\w\d-]+)\/image/)![1];
            if (sourceId) {
              const source = this.clientDataSources[sourceId];
              if (
                source &&
                source.type === DataSourceTypes.ArcgisDynamicMapserver
              ) {
                let visibleSublayers: ClientDataLayer[] = [];
                for (const layerId in this.visibleLayers) {
                  if (
                    this.visibleLayers[layerId].visible &&
                    this.layers[layerId]?.dataSourceId.toString() === sourceId
                  ) {
                    visibleSublayers.push(this.layers[layerId]);
                  }
                }
                if (visibleSublayers.length) {
                  visibleSublayers = visibleSublayers.sort(
                    (a, b) => a.zIndex - b.zIndex
                  );
                  const { url, tileSize } = urlTemplateForArcGISDynamicSource(
                    source,
                    visibleSublayers.map((l) => ({ sublayer: l.sublayer! }))
                  );
                  baseStyle.sources[source.id.toString()] = {
                    type: "raster",
                    tiles: [url],
                    tileSize: tileSize,
                    attribution: source.attribution || "",
                    // Doesn't like these...
                    // maxzoom: source.maxzoom || undefined,
                    // minzoom: source.minzoom || undefined,
                    // bounds: source.bounds || undefined,
                  };
                  const styleLayer = {
                    id: layerId,
                    type: "raster",
                    source: source.id.toString(),
                  } as Layer;
                  (isUnderLabels ? underLabels : overLabels).push(styleLayer);

                  // sourceWasAdded = true;
                  // break;
                }
              }
            }
          }
        }
      }
    }
    baseStyle.layers = [...underLabels, ...overLabels];

    // Evaluate any basemap optional layers
    // value is whether to toggle
    // const stylesSubjectToToggle: { [id: string]: boolean } = {};
    const optionalBasemapLayerStates = this.computeBasemapOptionalLayerStates(
      this.getSelectedBasemap(),
      this.internalState.basemapOptionalLayerStatePreferences
    );

    // If set to true, display the optional layer, else filter out
    const optionalLayersToggleState: { [layerId: string]: boolean } = {};
    for (const layer of basemap?.optionalBasemapLayers || []) {
      if (layer.groupType === OptionalBasemapLayersGroupType.None) {
        for (const id of layer.layers) {
          if (id) {
            optionalLayersToggleState[id] =
              optionalLayersToggleState[id] ||
              optionalBasemapLayerStates[layer.id];
          }
        }
      } else {
        // Select or Radio-type basemap
        for (const option of (layer.options || []) as {
          name: string;
          description?: string;
          layers?: string[];
        }[]) {
          // if (optionalBasemapLayerStates[layer.id] !== option.name) {
          // hide all layers associated with this option
          for (const id of option.layers || []) {
            if (id) {
              optionalLayersToggleState[id] =
                optionalLayersToggleState[id] ||
                optionalBasemapLayerStates[layer.id] === option.name;
            }
          }
          // }
        }
      }
    }

    baseStyle.layers = baseStyle.layers.map((layer) => {
      const state = optionalLayersToggleState[layer.id];
      // @ts-ignore
      const hasSource = !!layer.source;
      if (hasSource && state === false) {
        return {
          ...layer,
          ...{
            layout: {
              // @ts-ignore
              ...(layer.layout || {}),
              visibility: "none",
            },
          },
        };
      } else {
        return layer;
      }
    });

    return { style: baseStyle, sprites };
  }

  getSelectedBasemap() {
    if (this.basemaps && this.internalState.selectedBasemap) {
      return this.basemaps[this.internalState.selectedBasemap];
    } else {
      return null;
    }
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
        if (event.sourceId === this.layers[layerId]?.dataSourceId.toString()) {
          this.visibleLayers[layerId].error = event.error;
          this.visibleLayers[layerId].loading = false;
          anySet = true;
        }
      }
      if (anySet) {
        this.debouncedUpdateLayerState();
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
        this.clientDataSources,
        this.getSelectedBasemap()!
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
      let loading = !this.map!.isSourceLoaded(sourceId);
      if (loading) {
        anyLoading = true;
      }
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
      this.debouncedUpdateLayerState();
    }
    // This is needed for geojson sources
    if (anyLoading) {
      setTimeout(() => {
        this.debouncedUpdateSourceStates();
      }, 100);
    }
  }

  // private isSourceLoading(id: string) {
  //   // let loaded = this.map.isSourceLoaded(id);
  //   let loading = false;
  //   const instance = this.sourceCache[id];
  //   // if (instance) {
  //   //   return this.arcgisVectorSourceCache.isSourceLoading(id);
  //   // } else {
  //     loading = !this.map!.isSourceLoaded(id);
  //   }
  //   return loading;
  // }

  highlightLayer(layerId: string) {}

  // private resetPromise: Promise<any> | undefined;
  // // prevent reset from being called multiple times before completion
  // async reset(sources: ClientDataSource[], layers: ClientDataLayer[]) {
  //   if (this.resetPromise) {
  //     return this.resetPromise;
  //     // this._reset(sources, layers);
  //   } else {
  //     this.resetPromise = this._reset(sources, layers);
  //     await this.resetPromise;
  //     delete this.resetPromise;
  //   }
  // }

  reset(sources: ClientDataSource[], layers: ClientDataLayer[]) {
    this.clientDataSources = {};
    for (const source of sources) {
      this.clientDataSources[source.id] = source;
    }
    this.layers = {};
    for (const layer of layers) {
      this.layers[layer.id] = layer;
    }
    this.debouncedUpdateStyle();
    this.updateInteractivitySettings();
    return;
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
        layerIds.push("LABELS");
      }
      if (layer.sublayer) {
        const specialId = idForSublayer(layer);
        if (layerIds.indexOf(specialId) === -1) {
          layerIds.push(specialId);
        }
      } else {
        layerIds.push(layer.id.toString());
      }
    }
    this.layersByZIndex = layerIds;
  }

  hideLayers(layerIds: string[]) {
    for (const id of layerIds) {
      this.hideLayerId(id);
    }
    this.debouncedUpdateLayerState(1);
    this.debouncedUpdateStyle();
  }

  showLayers(layerIds: string[]) {
    for (const id of layerIds) {
      this.showLayerId(id);
    }
    this.debouncedUpdateLayerState(1);
    this.debouncedUpdateStyle();
  }

  private async addSprites(sprites: ClientSprite[]) {
    // get unique sprite ids
    for (const sprite of sprites) {
      const spriteId =
        typeof sprite.id === "string"
          ? sprite.id
          : // eslint-disable-next-line
            `seasketch://sprites/${sprite.id}`;
      if (!this.map!.hasImage(spriteId)) {
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
    const spriteId =
      typeof sprite.id === "string"
        ? sprite.id
        : // eslint-disable-next-line
          `seasketch://sprites/${sprite.id}`;

    if (spriteImage.dataUri) {
      const image = await createImage(
        spriteImage.width,
        spriteImage.height,
        spriteImage.dataUri
      );
      this.map?.addImage(spriteId, image, {
        pixelRatio: spriteImage.pixelRatio,
      });
    } else if (spriteImage.url) {
      const image = await loadImage(
        spriteImage.width,
        spriteImage.height,
        spriteImage.url,
        this.map!
      );
      this.map!.addImage(spriteId, image, {
        pixelRatio: spriteImage.pixelRatio,
      });
    } else {
      /* eslint-disable-next-line */
      throw new Error(`Sprite id=${sprite.id} missing both dataUri and url`);
    }
  }

  private debouncedUpdateLayerState(backoff = 5) {
    if (this.updateStateDebouncerReference) {
      clearTimeout(this.updateStateDebouncerReference);
    }
    this.updateStateDebouncerReference = setTimeout(
      this.updateLayerState,
      backoff
    );
  }

  private updateLayerState = () => {
    delete this.updateStateDebouncerReference;
    this.setState((oldState) => ({
      ...oldState,
      layerStates: { ...this.visibleLayers },
    }));
    this.updatePreferences();
    this.updateInteractivitySettings();
  };

  updateOptionalBasemapSetting(
    layer: Pick<OptionalBasemapLayer, "id" | "options" | "groupType" | "name">,
    value: any
  ) {
    const key = layer.name;
    this.setState((prev) => ({
      ...prev,
      basemapOptionalLayerStatePreferences: {
        ...prev.basemapOptionalLayerStatePreferences,
        [key]: value,
      },
      basemapOptionalLayerStates: this.computeBasemapOptionalLayerStates(
        this.getSelectedBasemap(),
        {
          ...this.internalState.basemapOptionalLayerStatePreferences,
          [key]: value,
        }
      ),
    }));
    this.updatePreferences();
    this.debouncedUpdateStyle();
  }

  clearOptionalBasemapSettings() {
    this.setState((prev) => ({
      ...prev,
      basemapOptionalLayerStatePreferences: undefined,
      basemapOptionalLayerStates: this.computeBasemapOptionalLayerStates(
        this.getSelectedBasemap(),
        {}
      ),
    }));
    this.updatePreferences();
    this.debouncedUpdateStyle();
  }

  setCamera(camera: CameraOptions) {
    if (this.map) {
      if (camera.center) {
        this.map.setCenter(camera.center);
      }
      if (camera.zoom) {
        this.map.setZoom(camera.zoom);
      }
      if (camera.pitch) {
        this.map.setPitch(camera.pitch);
      }
      if (camera.bearing) {
        this.map.setBearing(camera.bearing);
      }
    }
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
  cameraOptions?: CameraOptions;
  /* Indicates the map state is ready to render a map */
  ready: boolean;
  terrainEnabled: boolean;
  prefersTerrainEnabled?: boolean;
  basemapError?: Error;
  basemapOptionalLayerStates: { [layerName: string]: any };
  basemapOptionalLayerStatePreferences?: { [layerName: string]: any };
  showScale?: boolean;
}

interface MapContextOptions {
  /** If provided, map state will be restored upon return to the map by storing state in localStorage */
  preferencesKey?: string;
  /** For arcgis vector sources. defaults to 50mb */
  cacheSize?: number;
  /** Starting bounds of map. If camera option is set, it will take priority */
  bounds?: BBox;
  /** Starting camera of map. Will override bounds if both are provided */
  camera?: CameraOptions;
}

/**
 * Returns a MapContextManager instance that can be used to store state used by
 * instances of Mapbox GL, Layer lists, Basemap selectors, and layer interactivity
 * indicators.
 *
 * @param preferencesKey If provided, map state will be restored upon return to the map by storing state in localStorage
 * @param ignoreLayerVisibilityState Don't store layer visibility state in localStorage
 */
export function useMapContext(options?: MapContextOptions) {
  const { preferencesKey, cacheSize, bounds, camera } = options || {};
  let initialState: MapContextInterface = {
    layerStates: {},
    bannerMessages: [],
    fixedBlocks: [],
    ready: false,
    terrainEnabled: false,
    basemapOptionalLayerStates: {},
  };
  let initialCameraOptions: CameraOptions | undefined = camera;
  const { slug } = useParams<{ slug: string }>();
  if (preferencesKey) {
    const preferencesString = window.localStorage.getItem(
      `${slug}-${preferencesKey}`
    );
    if (preferencesString) {
      const prefs = JSON.parse(preferencesString);
      if (prefs.basemap) {
        initialState.selectedBasemap = prefs.basemap as string;
      }
      if (prefs.layers) {
        initialState.layerStates = prefs.layers;
      }
      if (prefs.cameraOptions) {
        initialCameraOptions = prefs.cameraOptions;
      }
      if (prefs.basemapOptionalLayerStatePreferences) {
        initialState.basemapOptionalLayerStatePreferences = {
          ...prefs.basemapOptionalLayerStatePreferences,
        };
        initialState.basemapOptionalLayerStates = {
          ...prefs.basemapOptionalLayerStates,
        };
      }
      if ("prefersTerrainEnabled" in prefs) {
        initialState.prefersTerrainEnabled = prefs.prefersTerrainEnabled;
      }
    }
  }
  const [state, setState] = useState<MapContextInterface>(initialState);
  const { data, loading, error } = useProjectRegionQuery({
    variables: {
      slug,
    },
  });
  useEffect(() => {
    const manager = new MapContextManager(
      initialState,
      setState,
      initialCameraOptions,
      preferencesKey ? `${slug}-${preferencesKey}` : undefined,
      cacheSize,
      bounds as LngLatBoundsLike
    );
    const newState = {
      ...state,
      manager,
    };
    setState(newState);
  }, []);

  useEffect(() => {
    if (error) {
      throw error;
    }
    if (data?.projectBySlug?.region.geojson && state.manager) {
      state.manager.setProjectBounds(data.projectBySlug.region.geojson);
    }
  }, [data?.projectBySlug, state.manager]);
  return state;
}

export const MapContext = createContext<MapContextInterface>({
  layerStates: {},
  manager: new MapContextManager(
    {
      layerStates: {},
      bannerMessages: [],
      fixedBlocks: [],
      ready: false,
      terrainEnabled: false,
      basemapOptionalLayerStates: {},
    },
    (state) => {}
  ),
  bannerMessages: [],
  fixedBlocks: [],
  ready: false,
  terrainEnabled: false,
  basemapOptionalLayerStates: {},
});

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
    /* eslint-disable-next-line */
    throw new Error(`Layer is not a sublayer. id=${layer.id}`);
  } else {
    return idForImageSource(layer.dataSourceId);
  }
}

/**
 * Generate an ID for a given layer in a ClientDataLayer. Note that SeaSketch DataLayers are not the same as Mapbox GL Style layers.
 * @param layer ClientDataLayer
 * @param styleLayerIndex ClientDataLayers' gl style contains multiple layers. You must specify the index of the layer to generate an ID
 */
export function idForLayer(
  layer: Pick<ClientDataLayer, "id" | "sublayer" | "dataSourceId">,
  styleLayerIndex?: number
) {
  if (layer.sublayer === null || layer.sublayer === undefined) {
    if (styleLayerIndex === undefined) {
      throw new Error(
        "styleLayerIndex must be provided to determine ID for a vector DataLayer"
      );
    } else {
      /* eslint-disable-next-line */
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
  /* eslint-disable-next-line */
  return `seasketch/${sourceId}/image`;
}

const layerIdRE = /^seasketch\//;
export function isSeaSketchLayerId(id: string) {
  return layerIdRE.test(id);
}
