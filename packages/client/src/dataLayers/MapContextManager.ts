import mapboxgl, {
  Map,
  MapDataEvent,
  ErrorEvent,
  Source,
  Style,
  CameraOptions,
  LngLatBoundsLike,
  MapboxOptions,
  AnySourceImpl,
  AnySourceData,
  AnyLayer,
  Sources,
  GeoJSONSource,
  Expression,
} from "mapbox-gl";
import {
  createContext,
  Dispatch,
  useEffect,
  useState,
  SetStateAction,
} from "react";
import { BBox, Feature, Polygon } from "geojson";
import {
  ArcgisFeatureLayerFetchStrategy,
  BasemapDetailsFragment,
  BasemapType,
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  DataSourceTypes,
  InteractivityType,
  MapBookmarkDetailsFragment,
  OptionalBasemapLayer,
  OptionalBasemapLayersGroupType,
  OverlayFragment,
  RenderUnderType,
  SketchPresentFragmentDoc,
  SpriteDetailsFragment,
  useProjectRegionQuery,
} from "../generated/graphql";
import { fetchGlStyle } from "../useMapboxStyle";
import LayerInteractivityManager from "./LayerInteractivityManager";
import bytes from "bytes";
import bbox from "@turf/bbox";
import { useParams } from "react-router";
import ServiceWorkerWindow from "../offline/ServiceWorkerWindow";
import { OfflineTileSettings } from "../offline/OfflineTileSettings";
import md5 from "md5";
import useAccessToken from "../useAccessToken";
import LRU from "lru-cache";
import debounce from "lodash.debounce";
import { currentSidebarState } from "../projects/ProjectAppSidebar";
import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { compileLegendFromGLStyleLayers } from "./legends/compileLegend";
import { LegendItem } from "./Legend";
import { EventEmitter } from "eventemitter3";
import { MeasureControlState } from "../MeasureControl";
import cloneDeep from "lodash.clonedeep";
import {
  ArcGISDynamicMapService,
  ArcGISFeatureLayerSource,
  ArcGISRESTServiceRequestManager,
  ArcGISTiledMapService,
  CustomGLSource,
} from "@seasketch/mapbox-gl-esri-sources";
import { OrderedLayerSettings } from "@seasketch/mapbox-gl-esri-sources/dist/src/CustomGLSource";
import { isArcGISDynamicMapService } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISDynamicMapService";
import { isArcgisFeatureLayerSource } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISFeatureLayerSource";
import { addInteractivityExpressions } from "../admin/data/glStyleUtils";
import { createBoundsRecursive } from "../projects/OverlayLayers";
import { TocMenuItemType } from "../admin/data/TableOfContentsItemMenu";
import { isExpression } from "./legends/utils";

export const MeasureEventTypes = {
  Started: "measure_started",
  Stopped: "measure_stopped",
};

const rejectAfter = (duration: number) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Timeout"));
    }, duration);
  });

export const withTimeout = (
  duration: number,
  callback: (...args: any) => Promise<any>
) => {
  return (...args: any) => {
    return Promise.race([rejectAfter(duration), callback(...args)]);
  };
};

const graphqlURL = new URL(
  process.env.REACT_APP_GRAPHQL_ENDPOINT || "http://localhost:3857/graphql"
);

const STALE_CUSTOM_SOURCE_SIZE = 3;

export const BASE_SERVER_ENDPOINT = `${graphqlURL.protocol}//${graphqlURL.host}`;

const LocalSketchGeometryCache = new LRU<
  number,
  { timestamp: string; feature: Feature<any> }
>({
  max: 10,
});

/**
 * Multiple "digitizing" tools active at once would compete for the same cursor
 * events and conflict with each other. This enum is used to track the state of
 * the digitizing tools and prevent conflicts.
 */
export enum DigitizingLockState {
  /**
   * No digitizing tools are active. Popups and other interactivity is enabled.
   */
  Free,
  /**
   * A digitizing tool is active and has locked the map. Popups and other
   * interactivity is disabled. This is the most active state, with the
   * mousemove events directly moving a "cursor" vertex until it is dropped.
   */
  CursorActive,
  /**
   * A digitizing tool is partially active, with a geometry ready to be edited
   * when the user drags a vertex. Popups and other interactivity may be
   * enabled, though this would require careful coordination with the digitizing
   * tool.
   */
  Editing,
}

export const DigitizingLockStateChangeEventType =
  "DigitizingLockStateChangeEvent";

export type DigitizingLockStateChangeEventPayload = {
  digitizingLockState: DigitizingLockState;
  digitizingLockedBy: string | undefined;
};

// TODO: we're not using project settings for this yet
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;

export interface LayerState {
  visible: boolean;
  opacity?: number;
  zOrderOverride?: number;
  loading: boolean;
  error?: Error;
  /**
   * If true, it means that while the layer may be "visible" as selected from
   * the table of contents, the user may have temporarily hidden it in the
   * legend.
   */
  hidden?: boolean;
}

export interface SketchLayerState extends LayerState {
  sketchClassId?: number;
}
class MapContextManager extends EventEmitter {
  map?: Map;
  interactivityManager?: LayerInteractivityManager;
  private preferencesKey?: string;
  private clientDataSources: {
    [dataSourceId: string]: DataSourceDetailsFragment;
  } = {};
  private layers: {
    [tocStableId: string]: {
      tocId: string;
    } & DataLayerDetailsFragment;
  } = {};
  // TODO: it probably makes sense to "garbage collect" visibleLayers at some
  // point since it is stored in localstorage. If there's a lot of churn in
  // layers there will be stale entries, and eventually there could even be a
  // problem with really long layer lists if the user toggles all the layers
  private visibleLayers: { [id: string]: LayerState } = {};
  private basemaps: { [id: string]: BasemapDetailsFragment } = {};
  private _setState: Dispatch<SetStateAction<MapContextInterface>>;
  private updateStateDebouncerReference?: any;
  private initialCameraOptions?: CameraOptions;
  private initialBounds?: LngLatBoundsLike;
  private internalState: MapContextInterface;
  private mapIsLoaded = false;
  private mapContainer?: HTMLDivElement;
  private scaleControl = new mapboxgl.ScaleControl({ maxWidth: 250 });
  private basemapsWereSet = false;
  private userAccessToken?: string | null;
  private editableSketchId?: number;
  private selectedSketches?: number[];
  private sketchTimestamps = new global.Map<number, string>();
  private hideEditableSketchId?: number;
  private arcgisRequestManager: ArcGISRESTServiceRequestManager =
    new ArcGISRESTServiceRequestManager();
  // Used to track previous map state before the application of a map bookmark
  // so that the map state change may be undone.
  private previousMapState:
    | undefined
    | Pick<
        MapBookmarkDetailsFragment,
        | "cameraOptions"
        | "basemapOptionalLayerStates"
        | "visibleDataLayers"
        | "selectedBasemap"
      > = undefined;
  /**
   * The manager needs an up-to-date list of geoprocessing reference ids so that
   * clients can toggle the appropriate TableOfContentsItem. The manager will
   * keep this list up to date whenever reset() is called, but it should also
   * be updated by the client using setGeoprocessingReferenceId() if it is
   * changed.
   */
  private geoprocessingReferenceIds: { [referenceId: string]: string } = {};
  private customSources: {
    [sourceId: number]: {
      customSource: CustomGLSource<any>;
      visible: boolean;
      lastUsedTimestamp: number;
      listenersAdded: boolean;
      sublayers?: OrderedLayerSettings;
    };
  } = {};

  constructor(
    initialState: MapContextInterface,
    setState: Dispatch<SetStateAction<MapContextInterface>>,
    initialCameraOptions?: CameraOptions,
    preferencesKey?: string,
    cacheSize?: number,
    initialBounds?: LngLatBoundsLike
  ) {
    super();
    cacheSize = cacheSize || bytes("50mb");
    this._setState = setState;
    // @ts-ignore
    window.mapContext = this;
    this.preferencesKey = preferencesKey;
    this.internalState = initialState;
    this.initialCameraOptions = initialCameraOptions;
    this.initialBounds = initialBounds;
    this.visibleLayers = { ...initialState.layerStatesByTocStaticId };
  }

  getCustomGLSource(sourceId: number) {
    return this.customSources[sourceId]?.customSource;
  }

  private setState = (action: SetStateAction<MapContextInterface>) => {
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

  setToken(token: string | null | undefined) {
    this.userAccessToken = token;
  }

  /**
   * Called by reset() and should be called in the client whenever modifying
   * the geoprocessingReferenceId of a TableOfContentsItem so that the manager
   * has up to date information.
   *
   * @param referenceId TableOfContents.geoprocessingReferenceId
   * @param stableId TableOfContents.stableId
   */
  setGeoprocessingReferenceId(referenceId: string, stableId: string) {
    this.geoprocessingReferenceIds[referenceId] = stableId;
  }

  /**
   * Retrieve a list of visible layers. This "reference id" list can be passed
   * to reporting tools as it will first provide the geoprocessingReferenceId of
   * a layer if available, or fall back to the TableOfContents.stableId.
   */
  getVisibleLayerReferenceIds() {
    return Object.keys(this.visibleLayers)
      .filter((id) => this.visibleLayers[id].visible)
      .map((id) => {
        const reference = this.geoprocessingReferenceIds[id];
        if (reference) {
          return reference;
        } else {
          return id;
        }
      });
  }

  setLoadingOverlay(loadingOverlay: string | null) {
    this.setState((prev) => {
      if (loadingOverlay !== null) {
        return {
          ...prev,
          loadingOverlay,
          showLoadingOverlay: true,
        };
      } else {
        return {
          ...prev,
          showLoadingOverlay: false,
        };
      }
    });
  }

  /**
   * Queries sketch layers to identify ids of sketches visible in the current
   * map viewport. Used by map bookmarks to avoid saving views with private
   * sketches.
   */
  getVisibleSketchIds() {
    if (!this.map) {
      throw new Error("Map not initialized");
    }
    const { layers } = this.computeSketchLayers();
    const features = this.map.queryRenderedFeatures({
      // @ts-ignore
      layers: layers.map((l) => l.id),
    });
    const ids: { id: number; sharedInForum: boolean }[] = [];
    for (const feature of features) {
      if (feature.properties?.id) {
        const id = parseInt(feature.properties.id);
        if (!ids.find((r) => r.id === id)) {
          ids.push({
            id,
            sharedInForum: Boolean(feature.properties.sharedInForum),
          });
        }
      }
    }
    return ids;
  }

  /**
   * Call whenever the context will be replaced or no longer used
   */
  destroy() {
    for (const key in this.customSources) {
      this.customSources[key].customSource.destroy();
      delete this.customSources[key];
    }
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
      for (const key in this.customSources) {
        this.customSources[key].customSource.destroy();
        delete this.customSources[key];
      }
    }
    if (!this.internalState.ready) {
      throw new Error(
        "Wait to call createMap until after MapContext.ready = true"
      );
    }
    const { style, sprites } = await this.getComputedStyle();
    const styleHash = md5(JSON.stringify(style));
    this.setState((prev) => ({ ...prev, styleHash }));

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
      transformRequest: this.requestTransformer,
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

    this.addSprites(sprites, this.map);

    this.interactivityManager = new LayerInteractivityManager(
      this.map,
      this.setState
    );

    this.interactivityManager.setVisibleLayers(
      Object.keys(this.visibleLayers)
        .filter((id) => this.visibleLayers[id]?.visible && this.layers[id])
        .map((id) => this.layers[id]),
      this.clientDataSources,
      this.getSelectedBasemap()!,
      this.tocItems
    );

    if (this.internalState.showScale) {
      this.map.addControl(this.scaleControl, "bottom-right");
    }

    this.map.on("error", this.onMapError);
    this.map.on("data", this.onMapDataEvent);
    this.map.on("dataloading", this.onMapDataEvent);
    this.map.on("moveend", this.onMapMove);
    this.map.on("styleimagemissing", this.onStyleImageMissing);
    this.map.on("load", () => {
      this.mapIsLoaded = true;
      // Use to trigger changes to mapContextManager.map
      this.setState((prev) => ({ ...prev }));
    });

    return this.map;
  }

  requestTransformer = (url: string, resourceType: mapboxgl.ResourceType) => {
    if (/^\/sprites\//.test(url)) {
      const { host, protocol } = window.location;
      if (process.env.NODE_ENV === "development") {
        // Access cloudfront directly. May exhibit CORS issues.
        return {
          // eslint-disable-next-line i18next/no-literal-string
          url: `https://${process.env.REACT_APP_CLOUDFRONT_DOCS_DISTRO}.cloudfront.net${url}?ssn-tr=true`,
        };
      } else {
        // Forward requests to the same origin, which will be routed to the
        // s3 bucket via cloudfront
        return {
          // eslint-disable-next-line i18next/no-literal-string
          url: `${protocol}//${host}${url}?ssn-tr=true`,
        };
      }
    }
    try {
      const Url = new URL(url);
      if (
        this.internalState.offlineTileSimulatorActive &&
        /api\.mapbox\./.test(url)
      ) {
        url = url.replace("api.mapbox.com", "api.mapbox-offline.com");
      } else if (
        this.userAccessToken &&
        Url.host === graphqlURL.host &&
        /\/sketches\/\d+\.geojson.json/.test(url)
      ) {
        const id = url.match(/sketches\/(\d+)\.geojson/)![1];
        const timestamp = this.sketchTimestamps.get(parseInt(id));
        if (timestamp) {
          Url.searchParams.set("timestamp", timestamp);
        }
        return {
          url: Url.toString(),
          // eslint-disable-next-line i18next/no-literal-string
          headers: { authorization: `Bearer ${this.userAccessToken}` },
        };
      } else if (!/^data:/.test(url)) {
        if (!/gateway.api.globalfishingwatch.org/.test(url)) {
          Url.searchParams.set("ssn-tr", "true");
        }
        url = Url.toString();
      }
      return { url };
    } catch (e) {
      console.error(e);
      return { url };
    }
  };
  /**
   * Adds a local Feature to cache so that the map client need not request
   * GeoJSON or MVT representations of a Sketch. This is useful when editing
   * sketches. The client will already have potentially very large geometries
   * handy from visualizing the preprocessing step. Rather than submitting
   * edits, then waiting for new requests for GeoJSON or vector tiles to update
   * the map, we can make use of this geometry that is already available. This
   * prevents a flash (or long pause) where the map is blank after editing.
   *
   * The cache is not boundless, and items will age out. When they do and the
   * map style is recalculated, they may disappear while requesting new map
   * tiles or GeoJSON content.
   *
   * @param id Sketch ID
   * @param feature Complete GeoJSON feature for representation on the map. Will
   * need to match the same struture and properties of that returned by the
   * GeoJSON & MVT endpoints. To do so, use the Sketch.geojsonProperties GraphQL
   * field to reconstruct from local geometry.
   * @param timestamp Latest timestamp of the sketch. This acts as part of the
   * cache key, so if not matching the latest timestamp in the ToC/GraphQL
   * client cache it will not be used.
   */
  pushLocalSketchGeometryCopy(
    id: number,
    feature: Feature<any>,
    timestamp: string
  ) {
    LocalSketchGeometryCache.set(id, {
      timestamp,
      feature,
    });
  }

  updateLocalSketchGeometryProperties(
    id: number,
    timestamp: string,
    properties: any
  ) {
    const cached = LocalSketchGeometryCache.get(id);
    if (cached) {
      LocalSketchGeometryCache.set(id, {
        ...cached,
        timestamp,
        feature: {
          ...cached.feature,
          properties,
        },
      });
      this.debouncedUpdateStyle();
    } else {
      this.debouncedUpdateStyle();
    }
  }

  /**
   * @deprecated
   */
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
          this.map.addControl(this.scaleControl, "bottom-right");
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

  /**
   * @deprecated
   */
  private force2dView() {
    if (this.map && this.map.getPitch() > 0) {
      this.map.easeTo({
        pitch: 0,
        bearing: 0,
      });
    }
  }

  onMapMoveDebouncerReference: any | undefined;

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
    this.basemapsWereSet = true;
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
      ready:
        !!(this.initialCameraOptions || this.initialBounds) &&
        this.basemapsWereSet,
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

  /**
   * Map will not be rended (state.ready=false) until set.
   * @param feature Rectangulare box will be created from input polygon
   */
  setProjectBounds(feature: Feature<Polygon>) {
    const box = bbox(feature);
    this.initialBounds = box.slice(0, 4) as [number, number, number, number];
    this.setState((prev) => ({
      ...prev,
      ready:
        !!(this.initialCameraOptions || this.initialBounds) &&
        this.basemapsWereSet,
    }));
  }

  private computeBasemapOptionalLayerStates(
    basemap: BasemapDetailsFragment | null,
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

  private applyOptionalBasemapLayerStates(
    baseStyle: Style,
    basemap: BasemapDetailsFragment | undefined
  ) {
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
  }

  /**
   * Set the basemap that should be displayed on the map. Updates
   * MapContext.selectedBasemap
   * @param id String ID for the basemap to select
   */
  setSelectedBasemap(id: string) {
    const previousBasemap =
      this.internalState.selectedBasemap &&
      this.basemaps[this.internalState.selectedBasemap];
    this.internalState.selectedBasemap = id;
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

  /**
   * @deprecated
   */
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
        basemapOptionalLayerStatePreferences:
          this.internalState.basemapOptionalLayerStatePreferences,
      };
      window.localStorage.setItem(this.preferencesKey, JSON.stringify(prefs));
    }
  }

  resetLayers() {
    const visibleLayerIds = Object.keys(this.visibleLayers);
    this.hideTocItems(visibleLayerIds);
    this.visibleLayers = {};
    this.updatePreferences();
  }

  private updateStyleDebouncerReference: any | undefined;

  private async debouncedUpdateStyle(backoff = 2) {
    if (this.updateStyleDebouncerReference) {
      clearTimeout(this.updateStyleDebouncerReference);
    }
    this.updateStyleDebouncerReference = setTimeout(() => {
      delete this.updateStyleDebouncerReference;
      this.updateStyle();
    }, backoff);
  }

  private updateStyleInfiniteLoopDetector = 0;

  async updateStyle() {
    if (this.map && this.internalState.ready) {
      this.updateStyleInfiniteLoopDetector++;
      this.updateStyleInfiniteLoopDetector = 0;
      if (this.updateStyleInfiniteLoopDetector > 10) {
        this.updateStyleInfiniteLoopDetector = 0;
        throw new Error("Infinite loop");
      }
      const { style, sprites } = await this.getComputedStyle(() => {
        this.debouncedUpdateStyle();
      });
      const styleHash = md5(JSON.stringify(style));
      this.addSprites(sprites, this.map);
      const update = () => {
        if (!this.map) {
          return;
        }
        // add any custom sources event listeners
        this.map.setStyle(style);
        for (const id in this.customSources) {
          const { visible, listenersAdded, customSource, sublayers } =
            this.customSources[id];
          // Make sure event listeners are added
          if (visible && !listenersAdded) {
            customSource.addEventListeners(this.map);
            this.customSources[id].listenersAdded = true;
            this.customSources[id].lastUsedTimestamp = new Date().getTime();
          } else if (!visible && listenersAdded) {
            customSource.removeEventListeners(this.map);
            this.customSources[id].listenersAdded = false;
          }
        }
        this.pruneInactiveCustomSources();
        for (const id in this.customSources) {
          const sourceConfig = this.clientDataSources[id];
          const { customSource, visible } = this.customSources[id];
          if (visible) {
            if (isArcGISDynamicMapService(customSource)) {
              customSource.updateUseDevicePixelRatio(
                sourceConfig.useDevicePixelRatio || false
              );
              customSource.updateQueryParameters(
                sourceConfig.queryParameters || {}
              );
            } else if (isArcgisFeatureLayerSource(customSource)) {
              customSource.updateFetchStrategy(
                sourceConfig.arcgisFetchStrategy ===
                  ArcgisFeatureLayerFetchStrategy.Raw
                  ? "raw"
                  : sourceConfig.arcgisFetchStrategy ===
                    ArcgisFeatureLayerFetchStrategy.Tiled
                  ? "tiled"
                  : "auto"
              );
            }
          }
        }
        const sources: { [id: string]: CustomGLSource<any> } = {};
        for (const id in this.customSources) {
          const { customSource, visible } = this.customSources[id];
          if (visible) {
            sources[id] = customSource;
          }
        }
        this.interactivityManager?.setCustomSources(sources);
        this.setState((prev) => ({ ...prev, styleHash }));
      };
      if (!this.mapIsLoaded) {
        setTimeout(update, 20);
      } else {
        update();
      }
    } else {
      this.updateStyleInfiniteLoopDetector++;
      if (this.updateStyleInfiniteLoopDetector > 10) {
        this.updateStyleInfiniteLoopDetector = 0;
      } else {
        this.debouncedUpdateStyle();
      }
    }
  }

  private pruneInactiveCustomSources() {
    // prune customSources, removing non-active sources that haven't been used
    // in a while
    let inactiveSources: {
      id: string;
      customSource: CustomGLSource<any>;
      timestamp: number;
    }[] = [];
    // collect inactive sources
    for (const id in this.customSources) {
      const { visible, lastUsedTimestamp, customSource } =
        this.customSources[id];
      if (!visible) {
        inactiveSources.push({
          id,
          customSource,
          timestamp: lastUsedTimestamp,
        });
      }
    }

    if (inactiveSources.length > STALE_CUSTOM_SOURCE_SIZE) {
      // sort inactiveSources by lastUsedTimestamp, in descending order
      inactiveSources.sort((a, b) => b.timestamp - a.timestamp);
      inactiveSources = inactiveSources.slice(0, STALE_CUSTOM_SOURCE_SIZE);
      for (const id in this.customSources) {
        if (inactiveSources.find((s) => s.id === id)) {
          this.customSources[id].customSource.destroy();
          delete this.customSources[id];
        }
      }
    }
  }

  /**
   * Set the visible overlays associated with TableOfContentsItems
   * @param ids List of ids. Can be the TableOfContents.stableId or geoprocessingReferenceId
   */
  async setVisibleTocItems(ids: string[]) {
    const stableIds = ids.map((id) =>
      id in this.geoprocessingReferenceIds
        ? this.geoprocessingReferenceIds[id]
        : id
    );

    for (const id in this.visibleLayers) {
      if (stableIds.indexOf(id) === -1) {
        this.hideTocItem(id);
      }
    }
    for (const id of stableIds) {
      if (!this.visibleLayers[id]) {
        this.showTocItem(id);
      }
    }
    this.debouncedUpdateLayerState();
    this.debouncedUpdateStyle();
    this.updateLegends();
  }

  /**
   * Hide the overlay associated with a TableOfContentsItem
   * @param id Can be the TableOfContents.stableId or geoprocessingReferenceId
   */
  private hideTocItem(id: string) {
    const stableId =
      id in this.geoprocessingReferenceIds
        ? this.geoprocessingReferenceIds[id]
        : id;
    const state = this.visibleLayers[stableId];
    if (state?.visible) {
      if (
        (state.opacity !== undefined && state.opacity !== 1) ||
        state.zOrderOverride !== undefined
      ) {
        this.visibleLayers[stableId].visible = false;
      } else {
        delete this.visibleLayers[stableId];
      }
    }
    this.updateLegends();
  }

  /**
   * Show the overlay associated with a TableOfContentsItem
   * @param id Can be the TableOfContents.stableId or geoprocessingReferenceId
   */
  private showTocItem(id: string) {
    const stableId =
      id in this.geoprocessingReferenceIds
        ? this.geoprocessingReferenceIds[id]
        : id;
    if (this.visibleLayers[stableId]) {
      const state = this.visibleLayers[stableId];
      if (state.error) {
        // do nothing
      } else {
        if (!state.visible) {
          state.visible = true;
          state.loading = true;
          state.hidden = false;
        }
      }
    } else {
      this.visibleLayers[stableId] = {
        loading: true,
        visible: true,
        opacity:
          this.internalState.layerStatesByTocStaticId[stableId]?.opacity || 1,
        hidden: false,
        zOrderOverride:
          this.internalState.layerStatesByTocStaticId[stableId]?.zOrderOverride,
      };
    }
    this.updateLegends();
  }

  /**
   *
   * @param sketches
   */
  setVisibleSketches(
    sketches: { id: number; timestamp?: string; sketchClassId?: number }[]
  ) {
    const sketchIds = sketches.map(({ id }) => id);
    // remove missing ids from internal state
    for (const id in this.internalState.sketchLayerStates) {
      if (sketchIds.indexOf(parseInt(id)) === -1) {
        delete this.internalState.sketchLayerStates[parseInt(id)];
      }
    }
    // add new sketches to internal state
    for (const sketch of sketches) {
      if (!this.internalState.sketchLayerStates[sketch.id]?.visible) {
        this.internalState.sketchLayerStates[sketch.id] = {
          loading: true,
          visible: true,
          sketchClassId: sketch.sketchClassId,
        };
      }
    }
    // update public state
    this.setState((prev) => ({
      ...prev,
      sketchLayerStates: { ...this.internalState.sketchLayerStates },
    }));
    for (const sketch of sketches) {
      if (sketch.timestamp) {
        this.sketchTimestamps.set(sketch.id, sketch.timestamp);
      } else {
        this.sketchTimestamps.delete(sketch.id);
      }
    }
    // request a redraw
    this.debouncedUpdateStyle();
  }

  private sketchClassGLStyles: { [sketchClassId: number]: AnyLayer[] } = {};

  getSketchClassGLStyles(sketchClassId: number): AnyLayer[] {
    // Clone the style layers. Mapbox GL JS will freeze the objects after adding
    // to the map, which will prevent us from modifying the style later and
    // throw exceptions
    return cloneDeep(
      this.sketchClassGLStyles[sketchClassId] || this.defaultSketchLayers
    );
  }

  setSketchClassGlStyles(styles: { [sketchClassId: number]: AnyLayer[] }) {
    this.sketchClassGLStyles = styles;
    this.debouncedUpdateStyle();
  }

  setSelectedSketches(sketchIds: number[]) {
    this.selectedSketches = sketchIds;
    // request a redraw
    this.debouncedUpdateStyle();
  }

  markSketchAsEditable(sketchId: number) {
    this.editableSketchId = sketchId;
    this.interactivityManager?.setFocusedSketchId(sketchId);
    // request a redraw
    this.debouncedUpdateStyle();
  }

  unmarkSketchAsEditable() {
    delete this.editableSketchId;
    this.interactivityManager?.setFocusedSketchId(null);
    // request a redraw
    this.debouncedUpdateStyle();
  }

  hideEditableSketch(sketchId: number) {
    this.hideEditableSketchId = sketchId;
    // request a redraw
    this.debouncedUpdateStyle();
  }

  clearSketchEditingState() {
    delete this.hideEditableSketchId;
    this.unmarkSketchAsEditable();
    // request a redraw
    this.debouncedUpdateStyle();
  }

  async getComputedBaseStyle() {
    const basemap = this.basemaps[this.internalState.selectedBasemap || ""] as
      | BasemapDetailsFragment
      | undefined;
    const labelsID = basemap?.labelsLayerId;
    const url =
      basemap?.url ||
      "mapbox://styles/underbluewaters/cklb3vusx2dvs17pay6jp5q7e";
    let baseStyle: Style;
    if (basemap?.type === BasemapType.RasterUrlTemplate) {
      let url = basemap.url;
      if (
        url.indexOf("services.arcgisonline.com") > -1 &&
        process.env.REACT_APP_ARCGIS_DEVELOPER_API_KEY
      ) {
        // eslint-disable-next-line i18next/no-literal-string
        url += `?token=${process.env.REACT_APP_ARCGIS_DEVELOPER_API_KEY}`;
      }
      baseStyle = {
        version: 8,
        // TODO: choose a ip un-encumbered alternative for these
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sprite: "mapbox://sprites/mapbox/streets-v11",
        sources: {
          raster: {
            type: "raster",
            tiles: [url],
            tileSize: 256,
            ...(basemap.maxzoom ? { maxzoom: basemap.maxzoom } : {}),
          },
        },
        layers: [
          {
            id: "bg",
            type: "background",
            paint: {
              "background-color": "#efefef",
            },
          },
          {
            id: "raster-tiles",
            type: "raster",
            source: "raster",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      };
    } else {
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
        baseStyle.sources![baseStyle.terrain?.source || "terrain-source"] =
          newSource;
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

    let labelsLayerIndex = baseStyle.layers?.findIndex(
      (layer) => layer.id === labelsID
    );
    baseStyle.sources = baseStyle.sources || {};

    baseStyle.layers = baseStyle.layers || [];
    if (labelsLayerIndex === -1) {
      labelsLayerIndex = baseStyle.layers.length;
    }
    return { baseStyle, labelsLayerIndex, basemap };
  }

  async getComputedStyle(unfinishedCustomSourceCallback?: () => void): Promise<{
    style: Style;
    sprites: SpriteDetailsFragment[];
  }> {
    // this.resetLayersByZIndex();
    // get mapbox-gl-draw related layers and sources and make sure to include
    // them in the end. gl-draw has some magic to avoid their layers getting
    // removed but I'm seeing errors like this when the style is updated:
    //
    // Uncaught TypeError: Cannot read properties of undefined (reading 'get')
    //    at new Ut (mapbox-gl.js:36:1)
    let glDrawLayers: AnyLayer[] = [];
    let glDrawSources: { [id: string]: GeoJSONSource } = {};
    let existingStyle: mapboxgl.Style | undefined;
    try {
      existingStyle = this.map?.getStyle();
    } catch (e) {
      // do nothing
    }
    if (existingStyle) {
      glDrawLayers =
        existingStyle.layers?.filter((l) => l.id.indexOf("gl-draw") === 0) ||
        [];
      // @ts-ignore
      const relatedSourceIds = glDrawLayers.map((l) => l.source || "");
      for (const key in existingStyle.sources) {
        if (relatedSourceIds.indexOf(key) > -1) {
          glDrawSources[key] = existingStyle.sources[key] as GeoJSONSource;
        }
      }
    }

    const { baseStyle, labelsLayerIndex, basemap } =
      await this.getComputedBaseStyle();

    let sprites: SpriteDetailsFragment[] = [];
    let underLabels: any[] = baseStyle.layers.slice(0, labelsLayerIndex);
    let overLabels: any[] = baseStyle.layers.slice(labelsLayerIndex);
    let isUnderLabels = true;
    const layersByZIndex = this.getVisibleLayersByZIndex();
    let i = layersByZIndex.length;
    const insertedCustomSourceIds: number[] = [];
    // reset sublayer settings before proceeding
    while (i--) {
      const layerId = layersByZIndex[i].tocId;
      if (layerId === "LABELS") {
        isUnderLabels = false;
      } else {
        if (this.visibleLayers[layerId]?.visible) {
          const layer = this.layers[layerId];
          // If layer or source are not set yet, they will be ignored
          if (layer) {
            const source = this.clientDataSources[layer.dataSourceId];
            if (source) {
              // Add the source
              if (!baseStyle.sources[source.id.toString()]) {
                switch (source.type) {
                  case DataSourceTypes.Vector:
                    baseStyle.sources[source.id.toString()] = {
                      type: "vector",
                      attribution: source.attribution || "",
                      tiles: source.tiles as string[],
                      ...(source.bounds
                        ? { bounds: source.bounds.map((b) => parseFloat(b)) }
                        : {}),
                      // minzoom
                      ...(source.minzoom !== undefined
                        ? {
                            minzoom: parseInt(
                              source.minzoom?.toString() || "0"
                            ),
                          }
                        : {}),
                      // maxzoom
                      ...(source.maxzoom !== undefined
                        ? {
                            maxzoom: parseInt(
                              source.maxzoom?.toString() || "0"
                            ),
                          }
                        : {}),
                    };
                    break;
                  case DataSourceTypes.SeasketchMvt:
                    baseStyle.sources[source.id.toString()] = {
                      type: "vector",
                      url: source.url! + ".json",
                      attribution: source.attribution || "",
                    };
                    break;
                  case DataSourceTypes.SeasketchVector:
                  case DataSourceTypes.Geojson:
                    baseStyle.sources[source.id.toString()] = {
                      type: "geojson",
                      data: source.url!,
                      attribution: source.attribution || "",
                    };
                    break;
                  case DataSourceTypes.SeasketchRaster:
                    if (source.url) {
                      baseStyle.sources[source.id.toString()] = {
                        type: "raster",
                        url: source.url,
                        attribution: source.attribution || "",
                      };
                    } else {
                      throw new Error("Not implemented");
                    }
                    break;
                  case DataSourceTypes.ArcgisVector:
                  case DataSourceTypes.ArcgisRasterTiles:
                  case DataSourceTypes.ArcgisDynamicMapserver:
                    // Sublayers can be represented multiple times, so don't
                    // add the source if it's already there
                    if (!insertedCustomSourceIds.includes(source.id)) {
                      insertedCustomSourceIds.push(source.id);
                      if (!this.customSources[source.id]) {
                        switch (source.type) {
                          case DataSourceTypes.ArcgisVector:
                          case DataSourceTypes.ArcgisRasterTiles:
                          case DataSourceTypes.ArcgisDynamicMapserver:
                            this.customSources[source.id] = {
                              listenersAdded: false,
                              visible: true,
                              lastUsedTimestamp: new Date().getTime(),
                              customSource: createCustomSource(
                                source,
                                this.arcgisRequestManager
                              ),
                            };
                            break;
                          default:
                            throw new Error(
                              `CustomGLSource not yet supported for ${source.type}`
                            );
                        }
                        // Initialize the source
                        const { customSource } = this.customSources[source.id];
                        customSource.prepare().then(async () => {
                          if (unfinishedCustomSourceCallback) {
                            unfinishedCustomSourceCallback();
                          }
                        });
                      } else {
                        delete this.customSources[source.id].sublayers;
                      }
                      this.customSources[source.id].visible = true;
                      // add style if ready
                      const { customSource } = this.customSources[source.id];
                      // Adding the source is skipped until later when sublayers are setup
                      if (customSource.ready) {
                        const styleData = await customSource.getGLStyleLayers();
                        if (styleData.imageList && this.map) {
                          styleData.imageList.addToMap(this.map);
                        }
                        const layers = isUnderLabels ? underLabels : overLabels;
                        if (
                          !this.visibleLayers[layerId]?.hidden ||
                          source.type === DataSourceTypes.ArcgisDynamicMapserver
                        ) {
                          let layersToAdd = styleData.layers;
                          if (
                            source.type !==
                              DataSourceTypes.ArcgisDynamicMapserver &&
                            this.visibleLayers[layerId] &&
                            "opacity" in this.visibleLayers[layerId] &&
                            typeof this.visibleLayers[layerId].opacity ===
                              "number"
                          ) {
                            layersToAdd = adjustLayerOpacities(
                              layersToAdd as mapboxgl.AnyLayer[],
                              this.visibleLayers[layerId].opacity!
                            );
                          }
                          if (
                            layer.interactivitySettings &&
                            layer.interactivitySettings.type ===
                              InteractivityType.SidebarOverlay
                          ) {
                            layers.push(
                              ...addInteractivityExpressions(
                                layersToAdd as AnyLayer[]
                              )
                            );
                          } else {
                            layers.push(...layersToAdd);
                          }
                        }
                      } else {
                        setTimeout(() => {
                          this.debouncedUpdateStyle();
                        }, 50);
                      }
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

              // Add the layer(s) for static sources (non-CustomGLSource's)
              if (
                (source.type === DataSourceTypes.SeasketchVector ||
                  source.type === DataSourceTypes.Geojson ||
                  source.type === DataSourceTypes.Vector ||
                  source.type === DataSourceTypes.SeasketchRaster ||
                  // source.type === DataSourceTypes.ArcgisVector ||
                  source.type === DataSourceTypes.SeasketchMvt) &&
                layer.mapboxGlStyles?.length
              ) {
                const shouldHaveSourceLayer =
                  source.type === DataSourceTypes.SeasketchMvt ||
                  source.type === DataSourceTypes.Vector ||
                  source.type === DataSourceTypes.SeasketchRaster;
                let glLayers = (layer.mapboxGlStyles as any[]).map((lyr, i) => {
                  return {
                    ...lyr,
                    source: source.id.toString(),
                    id: idForLayer(layer, i),
                    ...(shouldHaveSourceLayer
                      ? { "source-layer": layer.sourceLayer }
                      : {}),
                  } as AnyLayer;
                });
                if (
                  this.visibleLayers[layerId] &&
                  "opacity" in this.visibleLayers[layerId] &&
                  typeof this.visibleLayers[layerId].opacity === "number"
                ) {
                  glLayers = adjustLayerOpacities(
                    glLayers,
                    this.visibleLayers[layerId].opacity!
                  );
                }
                const layers = isUnderLabels ? underLabels : overLabels;
                if (!this.visibleLayers[layerId]?.hidden) {
                  if (
                    layer.interactivitySettings?.type ===
                    InteractivityType.SidebarOverlay
                  ) {
                    glLayers = addInteractivityExpressions(glLayers);
                  }
                  layers.push(...glLayers);
                }
              } else if (isCustomSourceType(source.type) && layer.sublayer) {
                // Add sublayer info if needed
                if (!Array.isArray(this.customSources[source.id].sublayers)) {
                  this.customSources[source.id].sublayers = [];
                }
                const settings = this.visibleLayers[layerId];
                if (!settings) {
                  throw new Error("Visible layer settings missing");
                }
                if (!this.visibleLayers[layerId]?.hidden) {
                  this.customSources[source.id].sublayers!.unshift({
                    id: layer.sublayer,
                    opacity:
                      "opacity" in settings && settings.opacity !== undefined
                        ? settings.opacity
                        : 1,
                  });
                }
              }
            }
          }
        }
      }
    }

    // mark customSources that are not visible as inactive, and remove their
    // event listeners
    for (const id in this.customSources) {
      if (!insertedCustomSourceIds.includes(parseInt(id))) {
        this.customSources[id].visible = false;
      } else {
        const { customSource, sublayers } = this.customSources[id];
        if (customSource.ready) {
          // Update sublayers first so that sources that rely on a dynamically
          // updated raster url can be initialized with proper data.
          if (sublayers) {
            customSource.updateLayers(sublayers);
          }
          const glSource = await customSource.getGLSource(this.map!);
          baseStyle.sources[id] = glSource;
        }
      }
    }

    baseStyle.sources = {
      ...baseStyle.sources,
      ...this.dynamicDataSources,
      ...glDrawSources,
    };

    baseStyle.layers = [
      ...underLabels,
      ...overLabels,
      ...this.dynamicLayers,
      ...glDrawLayers,
    ];

    // Evaluate any basemap optional layers
    this.applyOptionalBasemapLayerStates(baseStyle, basemap);

    // Add sketches
    const sketchLayerIds: string[] = [];
    const sketchData = this.computeSketchLayers();
    baseStyle.layers.push(...sketchData.layers);
    sketchLayerIds.push(
      ...sketchData.layers.filter((l) => l.type !== "symbol").map((l) => l.id)
    );
    for (const sourceId in sketchData.sources) {
      baseStyle.sources[sourceId] = sketchData.sources[sourceId];
    }
    if (this.interactivityManager) {
      this.interactivityManager.setSketchLayerIds(sketchLayerIds);
    }

    return { style: baseStyle, sprites };
  }

  resetToProjectBounds = () => {
    if (this.initialBounds && this.map) {
      this.map.fitBounds(this.initialBounds as LngLatBoundsLike, {
        animate: true,
      });
    }
  };

  computeSketchLayers() {
    const allLayers: AnyLayer[] = [];
    const sources: Sources = {};
    for (const stringId of Object.keys(this.internalState.sketchLayerStates)) {
      const id = parseInt(stringId);
      const sketchClassId =
        this.internalState.sketchLayerStates[id].sketchClassId;
      if (id !== this.hideEditableSketchId) {
        const timestamp = this.sketchTimestamps.get(id);
        const cache = LocalSketchGeometryCache.get(id);
        sources[`sketch-${id}`] = {
          type: "geojson",
          data:
            cache && cache.timestamp === timestamp
              ? cache.feature
              : sketchGeoJSONUrl(id, timestamp),
        };
        const layers = this.getLayersForSketch(
          id,
          id === this.editableSketchId,
          sketchClassId
        );
        if (this.editableSketchId && id !== this.editableSketchId) {
          reduceOpacity(layers);
        }
        allLayers.push(...layers);
      }
    }
    return { layers: allLayers, sources };
  }

  defaultSketchLayers = [
    {
      type: "fill",
      // Filter to type Polygon or Multipolygon
      filter: [
        "any",
        ["==", ["geometry-type"], "Polygon"],
        ["==", ["geometry-type"], "MultiPolygon"],
      ],
      paint: {
        "fill-color": "orange",
        "fill-outline-color": "red",
        "fill-opacity": 0.5,
      },
      layout: {},
    },

    {
      type: "line",
      filter: ["any", ["==", ["geometry-type"], "LineString"]],
      paint: {
        "line-color": "black",
        "line-width": 4,
      },
      layout: {},
    },
    {
      type: "line",
      filter: ["any", ["==", ["geometry-type"], "LineString"]],
      paint: {
        "line-color": "orange",
        "line-width": 2,
      },
      layout: {},
    },
    {
      type: "circle",
      filter: ["any", ["==", ["geometry-type"], "Point"]],
      paint: {
        "circle-radius": 5,
        "circle-color": "orange",
      },
    },
    {
      type: "circle",
      filter: ["any", ["==", ["geometry-type"], "Point"]],
      paint: {
        "circle-radius": 3,
        "circle-color": "white",
        "circle-opacity": 0.75,
      },
    },
  ] as AnyLayer[];

  assignSketchLayersToSketch(id: number, sourceId: string, layers: AnyLayer[]) {
    let layerIdCount = 0;
    return layers.map((lyr) => {
      return {
        ...lyr,
        source: sourceId,
        // eslint-disable-next-line i18next/no-literal-string
        id: `sketch-${id}-${layerIdCount++}`,
      };
    }) as AnyLayer[];
  }

  getLayersForSketch(
    id: number,
    focusOfEditing?: boolean,
    sketchClassId?: number
  ): AnyLayer[] {
    // eslint-disable-next-line i18next/no-literal-string
    const source = `sketch-${id}`;
    const layers = this.assignSketchLayersToSketch(
      id,
      source,
      this.getSketchClassGLStyles(sketchClassId || 99999)
    );
    if (
      (this.selectedSketches && this.selectedSketches.indexOf(id) !== -1) ||
      focusOfEditing
    ) {
      layers.push(
        ...([
          {
            // eslint-disable-next-line i18next/no-literal-string
            id: `sketch-${id}-selection-second-outline`,
            type: "line",
            source,
            paint: {
              "line-color": "white",
              "line-opacity": 0.25,
              "line-width": 6,
              "line-blur": 0,
              "line-offset": -3,
            },
            // layout: { "line-join": "miter" },
          },
          {
            // eslint-disable-next-line i18next/no-literal-string
            id: `sketch-${id}-selection-outline`,
            type: "line",
            source,
            paint: {
              "line-color": "rgb(46, 115, 182)",
              "line-opacity": 1,
              "line-width": 2,
              "line-blur": 0,
              "line-offset": -1,
            },
            // layout: { "line-join": "miter" },
          },
        ] as AnyLayer[])
      );
    }
    return layers;
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
      event.dataType === "source"
      // this filtering might not be necessary, since we are debouncing updates
      // anyways. It looked to be skipping important events related to sketch
      // geojson loading
      //  &&
      // ((event.source.type !== "geojson" && event.source.type !== "image") ||
      //   !event.tile)
    ) {
      this.debouncedUpdateSourceStates();
    }
  };

  private onMapError = (event: ErrorEvent & { sourceId?: string }) => {
    if (event.sourceId && event.sourceId !== "composite") {
      let anySet = false;
      // Questionable behavior from mapbox-gl-js here
      // https://github.com/mapbox/mapbox-gl-js/issues/9304
      if (/source image could not be decoded/.test(event.error.message)) {
        return;
      }
      if (/sketch-\d+$/.test(event.sourceId)) {
        const id = parseInt(event.sourceId.split("-")[1]);
        const state = this.internalState.sketchLayerStates[id];
        if (state) {
          anySet = true;
          state.error = event.error;
          state.loading = false;
        }
      } else {
        for (const staticId of Object.keys(this.visibleLayers)) {
          const sourceId = this.layers[staticId]?.dataSourceId.toString();
          if (event.sourceId === sourceId) {
            this.visibleLayers[staticId].error = event.error;
            this.visibleLayers[staticId].loading = false;
            anySet = true;
          }
        }
      }
      if (anySet) {
        this.debouncedUpdateLayerState();
      }
    }
  };

  async updateInteractivitySettings() {
    if (this.interactivityManager) {
      const visibleLayers: DataLayerDetailsFragment[] = [];
      for (const id in this.visibleLayers) {
        const state = this.visibleLayers[id];
        if (state.visible) {
          visibleLayers.push(this.layers[id]);
        }
      }
      this.interactivityManager.setVisibleLayers(
        visibleLayers,
        this.clientDataSources,
        this.getSelectedBasemap()!,
        this.tocItems
      );
    }
  }

  _updateSourceStatesLoopDetector = 0;

  private updateSourceStates() {
    let anyChanges = false;
    let anyLoading = false;
    if (!this.map) {
      throw new Error("MapContextManager.map not set");
    }

    // For each layer/tocItem, check it's source

    let sources: { [sourceId: string]: string[] } = {};
    for (const id of Object.keys(this.visibleLayers)) {
      const layer = this.layers[id];
      if (layer) {
        if (!sources[layer.dataSourceId]) {
          sources[layer.dataSourceId] = [];
        }
        if (sources[layer.dataSourceId].indexOf(id) === -1) {
          sources[layer.dataSourceId].push(id);
        }
      }
    }
    for (const sourceId in sources) {
      let loading = !this.map!.isSourceLoaded(sourceId);
      if (sourceId in this.customSources) {
        const customSource =
          this.customSources[parseInt(sourceId)].customSource;
        if (customSource) {
          loading = customSource.loading;
        }
      }
      if (loading) {
        anyLoading = true;
      }
      for (const stableId of sources[sourceId]) {
        if (this.visibleLayers[stableId]?.loading !== loading) {
          this.visibleLayers[stableId].loading = loading;
          anyChanges = true;
        }
        if (this.visibleLayers[stableId]?.error && loading) {
          delete this.visibleLayers[stableId].error;
          anyChanges = true;
        }
      }
    }
    // update states of sketch layers
    for (const id in this.internalState.sketchLayerStates) {
      const state = this.internalState.sketchLayerStates[id];
      if (state.visible) {
        // eslint-disable-next-line i18next/no-literal-string
        const loading = !this.map!.isSourceLoaded(`sketch-${id}`);
        if (loading) {
          anyLoading = true;
        }
        if (state.loading !== loading) {
          this.internalState.sketchLayerStates[id].loading = loading;
          anyChanges = true;
        }
        if (state.error && loading) {
          delete this.internalState.sketchLayerStates[id].error;
          anyChanges = true;
        }
      }
    }
    if (anyChanges) {
      this.debouncedUpdateLayerState();
    }
    // This is needed for geojson sources
    if (anyLoading) {
      this._updateSourceStatesLoopDetector++;
      setTimeout(
        () => {
          this.debouncedUpdateSourceStates();
        },
        this._updateSourceStatesLoopDetector > 100 ? 1000 : 100
      );
    } else {
      this._updateSourceStatesLoopDetector = 0;
    }
  }

  private debouncedUpdateSourceStates = debounce(this.updateSourceStates, 10, {
    leading: true,
    trailing: true,
    maxWait: 100,
  });

  private tocItems: {
    [stableId: string]: {
      stableId: string;
      id: number;
      label?: string;
      bounds?: [number, number, number, number];
      dataLayerId?: number;
      isFolder: boolean;
      parentStableId?: string;
      enableDownload: boolean;
      primaryDownloadUrl?: string;
    };
  } = {};

  reset(
    sources: DataSourceDetailsFragment[],
    layers: DataLayerDetailsFragment[],
    tocItems: Pick<
      OverlayFragment,
      | "id"
      | "stableId"
      | "dataLayerId"
      | "geoprocessingReferenceId"
      | "title"
      | "bounds"
      | "isFolder"
      | "parentStableId"
      | "enableDownload"
      | "primaryDownloadUrl"
    >[]
  ) {
    this.clientDataSources = {};
    for (const source of sources) {
      this.clientDataSources[source.id] = source;
    }
    const layersById: { [id: number]: DataLayerDetailsFragment } = {};
    for (const layer of layers) {
      layersById[layer.id] = layer;
      // this.layers[layer.id] = layer;
    }
    for (const item of tocItems) {
      this.tocItems[item.stableId] = {
        label: item.title,
        dataLayerId: item.dataLayerId || undefined,
        bounds: (item.bounds as [number, number, number, number]) || undefined,
        isFolder: Boolean(item.isFolder),
        parentStableId: item.parentStableId || undefined,
        stableId: item.stableId,
        id: item.id,
        enableDownload: Boolean(item.enableDownload),
        primaryDownloadUrl: item.primaryDownloadUrl || undefined,
      };
      if (item.dataLayerId) {
        const layer = layersById[item.dataLayerId];
        if (layer) {
          this.layers[item.stableId] = {
            ...layer,
            tocId: item.stableId,
          };
        }
        if (item.geoprocessingReferenceId) {
          this.setGeoprocessingReferenceId(
            item.geoprocessingReferenceId,
            item.stableId
          );
        }
      }
    }
    if (Object.keys(layers).length) {
      // Cleanup entries in visibleLayers that no longer exist
      for (const key in this.visibleLayers) {
        if (!tocItems.find((i) => i.stableId === key)) {
          delete this.visibleLayers[key];
        }
      }
      this.updatePreferences();
    }
    this.debouncedUpdateStyle();
    this.updateInteractivitySettings();
    this.updateLegends();
    return;
  }

  hideTocItems(stableIds: string[]) {
    for (const id of stableIds) {
      this.hideTocItem(id);
    }
    this.debouncedUpdateLayerState();
    this.debouncedUpdateStyle();
  }

  showTocItems(stableIds: string[]) {
    for (const id of stableIds) {
      this.showTocItem(id);
    }
    this.debouncedUpdateLayerState();
    this.debouncedUpdateStyle();
  }

  private onLockReleaseRequested:
    | ((requester: string, state: DigitizingLockState) => Promise<Boolean>)
    | null = null;

  /**
   * Used to manage conflicts between different digitizing tools. Tools can
   * request a DigitizingLockState change. False is returned if the requested
   * state is not available. Tools should provide a callback function that can
   * release the lock if requested by other tools, cleaning up their internal
   * state before doing so.
   *
   * @param id Unique identifier for the tool requesting the lock, such as "Sketching" or "MeasureControl"
   * @param state CursorActive or Editing
   * @param onReleaseRequested Callback function that can release the lock
   */
  async requestDigitizingLock(
    id: string,
    state: DigitizingLockState.CursorActive | DigitizingLockState.Editing,
    onReleaseRequested: (
      requester: string,
      state: DigitizingLockState
    ) => Promise<Boolean>
  ) {
    if (this.internalState.digitizingLockState === DigitizingLockState.Free) {
      // can go ahead and activate tool
      this.setDigitizingLockState(state, id);
      this.onLockReleaseRequested = onReleaseRequested;
      return true;
    } else {
      // first, check if you can release the lock
      const released =
        this.onLockReleaseRequested === null ||
        id === this.internalState.digitizingLockedBy
          ? true
          : await this.onLockReleaseRequested(
              id,
              this.internalState.digitizingLockState
            );
      if (released) {
        this.onLockReleaseRequested = onReleaseRequested;
        this.setDigitizingLockState(state, id);
        // activate tool
        return true;
      } else {
        // notify tool that it can't be activated
        return false;
      }
    }
  }

  /**
   * Used to release a digitizing lock. If the lock is not held by the tool
   * requesting the release, nothing happens.
   * @param id Unique identifier for the tool requesting the release
   */
  releaseDigitizingLock(id: string) {
    if (this.internalState.digitizingLockState !== DigitizingLockState.Free) {
      if (this.internalState.digitizingLockedBy === id) {
        this.setDigitizingLockState(DigitizingLockState.Free);
        this.onLockReleaseRequested = null;
      } else {
        // TODO: Should I throw an error or do nothing here?
      }
    }
  }

  /**
   * Used to release a digitizing lock. If the lock is not held by the tool
   * requesting the release, nothing happens.
   * @param id Unique identifier for the tool requesting the release
   * @param state State to set the lock to
   */
  private setDigitizingLockState(state: DigitizingLockState, id?: string) {
    if (!id && state !== DigitizingLockState.Free) {
      throw new Error("Must provide id when setting non-free state");
    }
    this.setState((prev) => ({
      ...prev,
      digitizingLockState: state,
      digitizingLockedBy: id || undefined,
    }));
    this.emit(DigitizingLockStateChangeEventType, {
      digitizingLockState: state,
      digitizingLockedBy: id || undefined,
    });
    if (state === DigitizingLockState.CursorActive) {
      this.interactivityManager?.pause();
    } else {
      this.interactivityManager?.resume();
    }
  }

  hasLock(id: string) {
    return (
      this.internalState.digitizingLockState !== DigitizingLockState.Free &&
      this.internalState.digitizingLockedBy === id
    );
  }

  // measure = () => {
  //   if (this.interactivityManager) {
  //     this.interactivityManager.pause();
  //   }
  //   this.emit(MeasureEventTypes.Started);
  //   if (!this.map) {
  //     throw new Error("Map not initialized");
  //   }
  //   if (this.MeasureControl) {
  //     this.MeasureControl.destroy();
  //   }
  //   this.MeasureControl = new MeasureControl(this.map);
  //   this.MeasureControl.on("update", (measureControlState: any) => {
  //     this.setState((prev) => {
  //       return {
  //         ...prev,
  //         measureControlState,
  //       };
  //     });
  //   });
  //   this.MeasureControl.start();
  // };

  // resetMeasurement = () => {
  //   if (this.MeasureControl) {
  //     this.MeasureControl.reset();
  //   }
  // };

  // cancelMeasurement = () => {
  //   this.MeasureControl?.destroy();
  //   this.MeasureControl = undefined;
  //   this.emit(MeasureEventTypes.Stopped);
  //   this.setState((prev) => ({
  //     ...prev,
  //     measureControlState: undefined,
  //   }));
  //   if (this.interactivityManager) {
  //     this.interactivityManager.resume();
  //   }
  // };

  // pauseMeasurementTools = () => {
  //   if (this.MeasureControl) {
  //     this.MeasureControl.setPaused(true);
  //   }
  //   if (this.interactivityManager) {
  //     this.interactivityManager.resume();
  //   }
  // };

  // resumeMeasurementTools = () => {
  //   if (this.MeasureControl) {
  //     if (this.interactivityManager) {
  //       this.interactivityManager.pause();
  //     }
  //     this.MeasureControl.setPaused(false);
  //   }
  // };

  private spritesById: { [id: string]: SpriteDetailsFragment } = {};

  private async addSprites(
    sprites: SpriteDetailsFragment[],
    map: mapboxgl.Map
  ) {
    // get unique sprite ids
    for (const sprite of sprites) {
      const spriteId =
        typeof sprite.id === "string"
          ? sprite.id
          : // eslint-disable-next-line
            `seasketch://sprites/${sprite.id}`;
      this.spritesById[spriteId] = sprite;
      // if (!map!.hasImage(spriteId)) {
      //   this.addSprite(sprite, map);
      // }
    }
  }

  private async addSprite(sprite: SpriteDetailsFragment, map: mapboxgl.Map) {
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

    // TODO: Okay to remove?
    // if (spriteImage.dataUri) {
    //   const image = await createImage(
    //     spriteImage.width,
    //     spriteImage.height,
    //     spriteImage.dataUri
    //   );
    //   this.map?.addImage(spriteId, image, {
    //     pixelRatio: spriteImage.pixelRatio,
    //   });
    // } else if (spriteImage.url) {
    const image = await loadImage(
      spriteImage.width,
      spriteImage.height,
      spriteImage.url,
      map
    );
    map.addImage(spriteId, image, {
      pixelRatio: spriteImage.pixelRatio,
    });
    // } else {
    //   /* eslint-disable-next-line */
    //   throw new Error(`Sprite id=${sprite.id} missing both dataUri and url`);
    // }
  }

  onStyleImageMissing = (e: any) => {
    if (/seasketch:\/\/sprites\/\d+/.test(e.id)) {
      const spriteFragment = this.spritesById[e.id];
      if (spriteFragment) {
        this.addSprite(spriteFragment, this.map!);
      }
    }
  };

  private updateLayerState = () => {
    delete this.updateStateDebouncerReference;
    this.setState((oldState) => ({
      ...oldState,
      layerStatesByTocStaticId: { ...this.visibleLayers },
      sketchLayerStates: { ...this.internalState.sketchLayerStates },
    }));
    this.updatePreferences();
    this.updateInteractivitySettings();
  };

  private debouncedUpdateLayerState = debounce(this.updateLayerState, 5, {
    maxWait: 100,
    trailing: true,
  });

  updateOptionalBasemapSettings(settings: { [layerName: string]: any }) {
    this.setState((prev) => {
      const newState = {
        ...prev,
        basemapOptionalLayerStatePreferences: {
          ...prev.basemapOptionalLayerStatePreferences,
          ...settings,
        },
        basemapOptionalLayerStates: {
          ...this.computeBasemapOptionalLayerStates(this.getSelectedBasemap(), {
            ...this.internalState.basemapOptionalLayerStatePreferences,
          }),
          ...settings,
        },
      };
      return newState;
    });

    this.updatePreferences();
    this.debouncedUpdateStyle();
  }

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

  private dynamicDataSources: { [id: string]: AnySourceData } = {};
  private dynamicLayers: AnyLayer[] = [];

  /**
   * Add a data source directly to the map. Don't use the direct mapbox-gl
   * methods or your source will disappear whenever the manager resets the map
   * style using the product of getComputedStyle().
   * @param id
   * @param source
   */
  addSource(id: string, source: AnySourceData) {
    this.dynamicDataSources[id] = source;
    this.debouncedUpdateStyle();
  }

  removeSource(id: string) {
    delete this.dynamicDataSources[id];
    this.debouncedUpdateStyle();
  }

  /**
   * 
   * Add a layer directly to the map. Don't use the direct mapbox-gl 
   * methods or your source will disappear whenever the manager resets the map
   * style using the product of getComputedStyle().

   * @param layer 
   */
  addLayer(layer: AnyLayer) {
    const idx = this.dynamicLayers.findIndex((l) => l.id === layer.id);
    if (idx > -1) {
      this.dynamicLayers[idx] = layer;
    } else {
      this.dynamicLayers.push(layer);
    }
    this.debouncedUpdateStyle();
  }

  removeLayer(id: string) {
    this.dynamicLayers = this.dynamicLayers.filter((lyr) => lyr.id !== id);
    this.debouncedUpdateStyle();
  }

  async enableOfflineTileSimulator(settings: OfflineTileSettings) {
    const enabled = await ServiceWorkerWindow.enableOfflineTileSimulator(
      settings
    );
    if (!enabled) {
      throw new Error("Invalid response from service worker");
    }
    this.setState((prev) => ({
      ...prev,
      offlineTileSimulatorActive: true,
    }));
    this.updateStyle();
    // Using a bunch of undocumented private apis here to reset tile caches.
    // See:
    // https://github.com/mapbox/mapbox-gl-js/issues/2633#issuecomment-576050636
    // @ts-ignore
    const sourceCaches = this.map?.style?._sourceCaches;
    await window.caches.delete("mapbox-tiles");
    if (sourceCaches) {
      for (const cache of Object.values(sourceCaches) as any[]) {
        for (const id in cache._tiles) {
          cache._tiles[id].expirationTime = Date.now() - 1;
          cache._reloadTile(id, "reloading");
        }
        cache._cache.reset();
      }
      this.map?.triggerRepaint();
      this.map?.resize();
      this.map?.triggerRepaint();
      const center = this.map!.getCenter()!;
      center.lat = center.lat * 1.0000001;
      this.map!.setCenter(center);
      this.map?.triggerRepaint();
    }
  }

  async disableOfflineTileSimulator() {
    const enabled = await ServiceWorkerWindow.disableOfflineTileSimulator();
    if (enabled) {
      throw new Error("Invalid response from service worker");
    }
    this.setState((prev) => ({
      ...prev,
      offlineTileSimulatorActive: false,
    }));
    this.updateStyle();
  }

  async getMapBookmarkData(skipThumbnail = false) {
    if (!this.map) {
      throw new Error("Map not ready to create bookmark data");
    }
    const visibleDataLayers: string[] = [];
    for (const stableId in this.visibleLayers) {
      if (this.visibleLayers[stableId]?.visible && this.layers[stableId]) {
        visibleDataLayers.push(stableId);
      }
    }
    const visibleSketches: number[] = [];
    for (const key in this.internalState.sketchLayerStates) {
      if (this.internalState.sketchLayerStates[key].visible) {
        visibleSketches.push(parseInt(key));
      }
    }
    const canvas = this.map.getCanvas();
    const sidebarState = currentSidebarState();
    const style = this.map.getStyle();

    const clientGeneratedThumbnail = skipThumbnail
      ? undefined
      : await this.getMapThumbnail(sidebarState);
    return {
      cameraOptions: {
        center: this.map.getCenter().toArray(),
        zoom: this.map.getZoom(),
        bearing: this.map.getBearing(),
        pitch: this.map.getPitch(),
      },
      basemapOptionalLayerStates:
        this.internalState.basemapOptionalLayerStates || {},
      visibleDataLayers,
      selectedBasemap: parseInt(this.internalState.selectedBasemap!),
      style,
      mapDimensions: [canvas.clientWidth, canvas.clientHeight],
      sidebarState,
      visibleSketches,
      basemapName: this.basemaps[this.internalState.selectedBasemap!].name,
      clientGeneratedThumbnail,
    };
  }

  getMapThumbnail = withTimeout(
    15000,
    async (sidebarState: {
      isSmall: boolean;
      open: boolean;
      width: number;
    }) => {
      return new Promise(async (resolve, reject) => {
        try {
          if (!this.map) {
            throw new Error("Map not ready to create thumbnail");
          }
          const { sprites } = await this.getComputedStyle();
          const style = this.map.getStyle();
          const div = document.createElement("div");
          div.style.setProperty("position", "absolute");
          const width = this.map.getContainer().clientWidth;
          const height = this.map.getContainer().clientHeight;
          div.style.setProperty("left", width * -1.1 + "px");
          div.style.setProperty("top", "0px");
          // div.style.setProperty("z-index", "9999999");
          div.style.setProperty("width", width + "px");
          div.style.setProperty("height", height + "px");
          document.body.appendChild(div);
          const newMap = new mapboxgl.Map({
            style,
            container: div,
            preserveDrawingBuffer: true,
            center: this.map.getCenter(),
            zoom: this.map.getZoom(),
            transformRequest: this.requestTransformer,
          });
          this.addSprites(sprites, newMap);
          newMap.on("load", () => {
            let clip: null | { x: number; width: number } = null;
            if (sidebarState.open && width >= 1080) {
              clip = {
                width: width - sidebarState.width,
                x: sidebarState.width,
              };
            }
            const targetWidth = 240;
            const scalingFactor = targetWidth / width;
            const targetHeight = scalingFactor * height;
            const canvas = newMap.getCanvas();
            const resizedCanvas = document.createElement("canvas");
            const oc = document.createElement("canvas");
            const octx = oc.getContext("2d");
            if (!octx) {
              return reject(new Error("Could not create canvas context"));
            }
            oc.width = clip ? canvas.width - clip.x : canvas.width;
            oc.height = canvas.height;

            // step 2: pre-filter image using steps as radius
            const steps = (oc.width / targetWidth) >> 1;
            // eslint-disable-next-line i18next/no-literal-string
            octx.filter = `blur(${steps}px)`;
            octx.drawImage(canvas, clip ? clip.x * -1 : 0, 0);
            // Should be half the size of the thumbnail variant in cloudflare images
            resizedCanvas.width = targetWidth;
            resizedCanvas.height = targetHeight;
            const resizedContext = resizedCanvas.getContext("2d");
            if (!resizedContext) {
              return reject(new Error("Could not create canvas context"));
            }
            resizedContext.drawImage(oc, 0, 0, targetWidth, targetHeight);
            const data = resizedCanvas.toDataURL("image/jpeg", 0.7);
            newMap.remove();
            div.remove();
            return resolve(data);
          });
        } catch (e) {
          reject(e);
        }
      });
    }
  );

  async showMapBookmark(
    bookmark: Pick<
      MapBookmarkDetailsFragment,
      | "cameraOptions"
      | "basemapOptionalLayerStates"
      | "visibleDataLayers"
      | "selectedBasemap"
    > & { id?: string },
    savePreviousState = true,
    client?: ApolloClient<NormalizedCacheObject>
  ) {
    if (savePreviousState) {
      this.previousMapState = await this.getMapBookmarkData(true);
    }
    if (!this.map) {
      throw new Error("Map not ready to show bookmark");
    }
    this.setSelectedBasemap(bookmark.selectedBasemap.toString());
    if (bookmark.basemapOptionalLayerStates) {
      this.updateOptionalBasemapSettings(bookmark.basemapOptionalLayerStates);
    }
    this.setVisibleTocItems((bookmark.visibleDataLayers || []) as string[]);
    this.map.flyTo({
      ...bookmark.cameraOptions,
      animate: true,
    });
    if (savePreviousState && bookmark.id) {
      this.setState((prev) => ({
        ...prev,
        displayedMapBookmark: {
          id: bookmark.id!,
          errors: this.getErrorsForBookmark(bookmark, client),
          supportsUndo: true,
        },
      }));
      this.hideBookmarkBanner(6000);
    }
  }

  getErrorsForBookmark(
    bookmark: Pick<
      MapBookmarkDetailsFragment,
      "selectedBasemap" | "visibleSketches" | "visibleDataLayers"
    >,
    client?: ApolloClient<NormalizedCacheObject>
  ) {
    const missingSketches: number[] = [];
    for (const id of bookmark.visibleSketches || []) {
      if (
        id &&
        client &&
        !client.readFragment({
          fragment: SketchPresentFragmentDoc,
          // eslint-disable-next-line i18next/no-literal-string
          id: `Sketch:${id}`,
        })
      ) {
        missingSketches.push(id);
      }
    }
    return {
      missingLayers: this.getMissingLayers(
        (bookmark.visibleDataLayers || []) as string[]
      ),
      missingBasemap: this.basemaps[bookmark.selectedBasemap] ? false : true,
      missingSketches,
    };
  }

  async undoMapBookmark() {
    if (this.previousMapState) {
      this.showMapBookmark(this.previousMapState, false);
      this.hideBookmarkBanner();
      this.previousMapState = undefined;
    }
  }

  bookmarkBannerHideTimeout?: any;

  /**
   *
   * @param delay in milliseconds
   */
  hideBookmarkBanner(delay?: number) {
    if (this.bookmarkBannerHideTimeout) {
      clearTimeout(this.bookmarkBannerHideTimeout);
    }
    if (delay) {
      this.bookmarkBannerHideTimeout = setTimeout(() => {
        this.setState((prev) => ({
          ...prev,
          displayedMapBookmark: undefined,
        }));
        this.bookmarkBannerHideTimeout = undefined;
      }, delay);
    } else {
      this.setState((prev) => ({
        ...prev,
        displayedMapBookmark: undefined,
      }));
    }
  }

  cancelBookmarkBannerHiding() {
    if (this.bookmarkBannerHideTimeout) {
      clearTimeout(this.bookmarkBannerHideTimeout);
    }
  }

  /**
   * Given a list of layer ids, return how many are unknown to MapContextManager
   */
  getMissingLayers(layerIds: string[]) {
    const missing: string[] = [];
    const knownIds = Object.keys(this.layers);
    const knownStaticIds = Object.keys(this.layers).reduce((prev, key) => {
      const staticId = this.layers[key].staticId;
      if (staticId) {
        prev.push(staticId);
      }
      return prev;
    }, [] as string[]);
    for (const id of layerIds) {
      if (knownIds.indexOf(id) === -1 && knownStaticIds.indexOf(id) === -1) {
        missing.push(id);
      }
    }
    return missing;
  }

  getMissingSketches() {}

  isBasemapMissing() {}

  private async _updateLegends(clearCache = false) {
    const newLegendState: { [layerId: string]: LegendItem | null } = {};
    let changes = false;
    const layers = this.getVisibleLayersByZIndex();
    for (const layer of layers) {
      const id = layer.tocId;
      if (this.visibleLayers[id]?.visible) {
        if (clearCache === true && id in this.internalState.legends) {
          newLegendState[id] = this.internalState.legends[id];
        } else {
          const tableOfContentsItemDetails: TocMenuItemType = {
            stableId: id,
            enableDownload: Boolean(this.tocItems[id]?.enableDownload),
            isFolder: Boolean(this.tocItems[id]?.isFolder),
            id: this.tocItems[id].id,
            title: this.tocItems[id].label || "Unknown",
            primaryDownloadUrl: this.tocItems[id]?.primaryDownloadUrl,
          };
          const layer = this.layers[id];
          const source = this.clientDataSources[layer?.dataSourceId];
          if (layer && source && layer.mapboxGlStyles) {
            let sourceType:
              | undefined
              | "vector"
              | "raster"
              | "image"
              | "video"
              | "raster-dem"
              | "geojson" = undefined;
            switch (source.type) {
              case DataSourceTypes.Geojson:
              case DataSourceTypes.SeasketchVector:
                sourceType = "geojson";
                break;
              case DataSourceTypes.Raster:
              case DataSourceTypes.SeasketchRaster:
                sourceType = "raster";
                break;
              case DataSourceTypes.Vector:
              case DataSourceTypes.SeasketchMvt:
                sourceType = "vector";
                break;
              case DataSourceTypes.RasterDem:
                sourceType = "raster-dem";
                break;
              case DataSourceTypes.ArcgisDynamicMapserver:
              case DataSourceTypes.Image:
                sourceType = "image";
                break;
              case DataSourceTypes.Video:
                sourceType = "video";
                break;
            }

            if (sourceType) {
              try {
                const legend = compileLegendFromGLStyleLayers(
                  layer.mapboxGlStyles,
                  sourceType
                );
                if (legend) {
                  newLegendState[id] = {
                    id,
                    type: "GLStyleLegendItem",
                    legend: legend,
                    label: this.tocItems[layer.tocId]?.label || "",
                    tableOfContentsItemDetails,
                  };
                  changes = true;
                } else {
                  newLegendState[id] = null;
                  changes = true;
                }
              } catch (e) {
                console.error(e);
                newLegendState[id] = {
                  id,
                  type: "GLStyleLegendItem",
                  label: this.tocItems[layer.tocId]?.label || "",
                  tableOfContentsItemDetails,
                };
                changes = true;
              }
            }
          } else if (source && isCustomSourceType(source.type)) {
            const d = this.customSources[source.id];
            if (d && d.visible && d.customSource) {
              const { customSource } = d;
              const { tableOfContentsItems } =
                await customSource.getComputedMetadata();
              const item =
                tableOfContentsItems.length === 1
                  ? tableOfContentsItems[0]
                  : tableOfContentsItems.find(
                      (i) => i.id.toString() === layer?.sublayer?.toString()
                    );
              if (item && item.type === "data") {
                if (item.glStyle) {
                  newLegendState[id] = {
                    id,
                    type: "GLStyleLegendItem",
                    legend: compileLegendFromGLStyleLayers(
                      item.glStyle.layers,
                      "vector"
                    ),
                    label: this.tocItems[layer.tocId]?.label || "",
                    tableOfContentsItemDetails,
                  };
                } else if (item.legend) {
                  newLegendState[id] = {
                    type: "CustomGLSourceSymbolLegend",
                    label: item.label,
                    supportsDynamicRendering: {
                      layerOpacity: true,
                      layerOrder: true,
                      layerVisibility: true,
                    },
                    symbols: item.legend,
                    id,
                    tableOfContentsItemDetails,
                  };
                }
                changes = true;
              }
            }
          }
        }
      } else {
        if (id in this.internalState.legends) {
          delete newLegendState[id];
          changes = true;
        }
      }
    }
    if (changes) {
      this.setState((prev) => ({
        ...prev,
        legends: newLegendState,
      }));
    }
  }

  updateLegends = debounce(this._updateLegends, 20, {
    maxWait: 1000,
  });

  hideLayer(stableId: string) {
    const state = this.visibleLayers[stableId];
    if (state) {
      state.hidden = true;
    }
    this.setState((prev) => ({
      ...prev,
      layerStatesByTocStaticId: {
        ...prev.layerStatesByTocStaticId,
        [stableId]: {
          ...prev.layerStatesByTocStaticId[stableId],
          hidden: true,
        },
      },
    }));
    this.debouncedUpdateLayerState();
    this.updateStyle();
  }

  showHiddenLayer(stableId: string) {
    const state = this.visibleLayers[stableId];
    if (state) {
      state.hidden = false;
    }
    this.setState((prev) => ({
      ...prev,
      layerStatesByTocStaticId: {
        ...prev.layerStatesByTocStaticId,
        [stableId]: {
          ...prev.layerStatesByTocStaticId[stableId],
          hidden: false,
        },
      },
    }));
    this.debouncedUpdateLayerState();
    this.updateStyle();
  }

  private setZOrderOverride(stableId: string, zOrder: number) {
    const state = this.visibleLayers[stableId];
    if (state) {
      state.zOrderOverride = zOrder;
    }
    this.setState((prev) => ({
      ...prev,
      layerStatesByTocStaticId: {
        ...prev.layerStatesByTocStaticId,
        [stableId]: {
          ...prev.layerStatesByTocStaticId[stableId],
          zOrderOverride: zOrder,
        },
      },
    }));
    // this.resetLayersByZIndex();
    this.debouncedUpdateLayerState();
    this.updateStyle();
  }

  getVisibleLayersByZIndex() {
    const visible = Object.values(this.layers).filter(
      (l) => this.visibleLayers[l.tocId]?.visible === true
    );
    // First, create a lookup table of the lowest sublayer z-index for each
    // datasource. This way sublayers are grouped together in the listing
    const sublayerZIndexLookup: {
      [dataSourceId: number]: number;
    } = {};
    for (const layer of visible) {
      if (layer.sublayer !== undefined) {
        const dataSourceId = layer.dataSourceId;
        const zIndex =
          typeof this.visibleLayers[layer.tocId]?.zOrderOverride === "number"
            ? this.visibleLayers[layer.tocId].zOrderOverride!
            : layer.zIndex;
        if (
          !(dataSourceId in sublayerZIndexLookup) ||
          zIndex < sublayerZIndexLookup[dataSourceId]
        ) {
          sublayerZIndexLookup[dataSourceId] = zIndex;
        }
      }
    }
    const getZIndex = (layer: (typeof visible)[0], sameDataSource = false) => {
      if (!sameDataSource && layer.dataSourceId in sublayerZIndexLookup) {
        return sublayerZIndexLookup[layer.dataSourceId];
      } else if (
        typeof this.visibleLayers[layer.tocId]?.zOrderOverride === "number"
      ) {
        return this.visibleLayers[layer.tocId].zOrderOverride!;
      }
      return layer.zIndex;
    };

    return visible
      .sort((a, b) => {
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
        } else if (
          // comparing two sublayers under the same datasource
          a.dataSourceId === b.dataSourceId
        ) {
          return getZIndex(a, true) - getZIndex(b, true);
        } else {
          return getZIndex(a) - getZIndex(b);
        }
      })
      .map((l) => ({
        ...l,
        finalZIndex: getZIndex(l),
      }));
  }

  private getCurrentZOrder() {
    return this.getVisibleLayersByZIndex()
      .filter(
        (layer) =>
          layer.tocId in this.visibleLayers &&
          this.visibleLayers[layer.tocId].visible === true
      )
      .map((layer) => ({
        id: layer.tocId,
        label: this.tocItems[layer.tocId]?.label || "",
        zIndex: (typeof this.visibleLayers[layer.tocId].zOrderOverride ===
        "number"
          ? this.visibleLayers[layer.tocId].zOrderOverride
          : this.layers[layer.tocId].zIndex || 0) as number,
      }));
  }

  moveLayerToTop(stableId: string) {
    const currentOrder = this.getCurrentZOrder();
    if (currentOrder.length > 1) {
      const top = currentOrder[0];
      if (top.id !== stableId) {
        this.setZOrderOverride(stableId, top.zIndex - 1);
      }
    }
  }

  moveLayerToBottom(stableId: string) {
    const currentOrder = this.getCurrentZOrder();
    if (currentOrder.length > 1) {
      const bottom = currentOrder[currentOrder.length - 1];
      if (bottom.id !== stableId) {
        this.setZOrderOverride(stableId, bottom.zIndex + 1);
      }
    }
  }

  setLayerOpacity(stableId: string, opacity: number) {
    if (opacity > 1 || opacity < 0) {
      throw new Error("Opacity should be between 0 and 1");
    }
    const state = this.visibleLayers[stableId];
    if (state) {
      state.opacity = opacity;
    }
    this.setState((prev) => {
      const newState = {
        ...prev,
        layerStatesByTocStaticId: {
          ...prev.layerStatesByTocStaticId,
          [stableId]: {
            ...prev.layerStatesByTocStaticId[stableId],
            opacity,
          },
        },
      };
      return newState;
    });
    this.debouncedUpdateLayerState();
    const layer = this.layers[stableId];
    const source = this.clientDataSources[layer.dataSourceId];
    // TODO: consider customsource layer types
    const shouldHaveSourceLayer =
      source.type === DataSourceTypes.SeasketchMvt ||
      source.type === DataSourceTypes.Vector ||
      source.type === DataSourceTypes.SeasketchRaster;
    if (layer && source && this.map && layer.mapboxGlStyles?.length > 0) {
      // Do an update in place if possible
      let glLayers = (layer.mapboxGlStyles as any[]).map((lyr, i) => {
        return {
          ...lyr,
          source: source.id.toString(),
          id: idForLayer(layer, i),
          ...(shouldHaveSourceLayer
            ? { "source-layer": layer.sourceLayer }
            : {}),
        } as AnyLayer;
      });
      adjustLayerOpacities(glLayers, opacity, this.map);
    } else {
      // Otherwise, update the whole map style
      // TODO: could make this more optimal for custom sources
      this.debouncedUpdateStyle();
    }
  }

  async zoomToTocItem(stableId: string) {
    let bounds: [number, number, number, number] | undefined;
    const item = this.tocItems[stableId];
    if (item) {
      if (item.bounds) {
        bounds = item.bounds.map((coord: string | number) =>
          typeof coord === "string" ? parseFloat(coord) : coord
        ) as [number, number, number, number];
      } else if (item.isFolder) {
        bounds = createBoundsRecursive(item, Object.values(this.tocItems));
      } else {
        const layer = this.layers[stableId];
        const source = this.clientDataSources[layer?.dataSourceId];
        if (source && sourceTypeIsCustomGLSource(source.type)) {
          const existingSource = this.getCustomGLSource(source.id);
          if (existingSource) {
            const metadata = await existingSource?.getComputedMetadata();
            if (metadata?.bounds) {
              bounds = metadata.bounds;
            }
          } else {
            const customSource = createCustomSource(
              source,
              this.arcgisRequestManager
            );
            const metadata = await customSource.getComputedMetadata();
            if (metadata?.bounds) {
              bounds = metadata.bounds;
            }
            customSource.destroy();
          }
        }
      }
    }
    if (bounds && [180.0, 90.0, -180.0, -90.0].join(",") !== bounds.join(",")) {
      const sidebar = currentSidebarState();
      this.map?.fitBounds(bounds, {
        animate: true,
        padding: {
          bottom: 100,
          top: 100,
          left: sidebar.open ? sidebar.width + 100 : 100,
          right: 100,
        },
      });
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
  layerStatesByTocStaticId: { [id: string]: LayerState };
  sketchLayerStates: { [id: number]: SketchLayerState };
  manager?: MapContextManager;
  bannerMessages: string[];
  tooltip?: Tooltip;
  fixedBlocks: string[];
  sidebarPopupContent?: string;
  sidebarPopupTitle?: string;
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
  offlineTileSimulatorActive?: boolean;
  styleHash: string;
  containerPortal: HTMLDivElement | null;
  loadingOverlay?: string | null;
  showLoadingOverlay?: boolean;
  displayedMapBookmark?: {
    id: string;
    errors: {
      missingLayers: string[];
      missingBasemap: boolean;
      missingSketches: number[];
    };
    supportsUndo: boolean;
  };
  languageCode?: string;
  legends: {
    [layerId: string]: LegendItem | null;
  };
  measureControlState?: MeasureControlState;
  digitizingLockState: DigitizingLockState;
  digitizingLockedBy?: string;
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
  containerPortal?: HTMLDivElement | null;
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
  const { preferencesKey, cacheSize, bounds, camera, containerPortal } =
    options || {};
  let initialState: MapContextInterface = {
    sketchLayerStates: {},
    layerStatesByTocStaticId: {},
    bannerMessages: [],
    fixedBlocks: [],
    ready: false,
    terrainEnabled: false,
    basemapOptionalLayerStates: {},
    styleHash: "",
    containerPortal: containerPortal || null,
    legends: {},
    digitizingLockState: DigitizingLockState.Free,
  };
  const token = useAccessToken();
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
        initialState.layerStatesByTocStaticId = prefs.layers;
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
  const { data, error } = useProjectRegionQuery({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    state.manager?.setToken(token);
  }, [token, state.manager]);

  useEffect(() => {
    if (error) {
      throw error;
    }
    if (data?.projectBySlug?.region.geojson && state.manager) {
      state.manager.setProjectBounds(data.projectBySlug.region.geojson);
    }
  }, [data?.projectBySlug, error, state.manager]);

  return state;
}

export const MapContext = createContext<MapContextInterface>({
  layerStatesByTocStaticId: {},
  sketchLayerStates: {},
  styleHash: "",
  manager: new MapContextManager(
    {
      layerStatesByTocStaticId: {},
      sketchLayerStates: {},
      bannerMessages: [],
      fixedBlocks: [],
      ready: false,
      terrainEnabled: false,
      basemapOptionalLayerStates: {},
      styleHash: "",
      containerPortal: null,
      legends: {},
      digitizingLockState: DigitizingLockState.Free,
    },
    (state) => {}
  ),
  bannerMessages: [],
  fixedBlocks: [],
  ready: false,
  terrainEnabled: false,
  basemapOptionalLayerStates: {},
  containerPortal: null,
  legends: {},
  digitizingLockState: DigitizingLockState.Free,
});

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

/**
 * Generate an ID for a given layer in a ClientDataLayer. Note that SeaSketch DataLayers are not the same as Mapbox GL Style layers.
 * @param layer ClientDataLayer
 * @param styleLayerIndex ClientDataLayers' gl style contains multiple layers. You must specify the index of the layer to generate an ID
 */
export function idForLayer(
  layer: Pick<DataLayerDetailsFragment, "id" | "sublayer" | "dataSourceId">,
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

function reduceOpacity(layers: AnyLayer[], fraction = 0.5) {
  for (const layer of layers) {
    if ("paint" in layer) {
      switch (layer.type) {
        case "circle":
          reducePaintPropOpacity(layer, "circle-opacity", fraction);
          break;
        case "fill":
          reducePaintPropOpacity(layer, "fill-opacity", fraction);
          break;
        case "line":
          reducePaintPropOpacity(layer, "line-opacity", fraction);
          break;
        case "symbol":
          reducePaintPropOpacity(layer, "icon-opacity", fraction);
          reducePaintPropOpacity(layer, "text-opacity", fraction);
          break;
        default:
          break;
      }
    }
  }
}

function reducePaintPropOpacity(
  layer: any,
  propName: string,
  fraction: number
) {
  if ("paint" in layer) {
    if (layer.paint[propName]) {
      layer.paint[propName] = layer.paint[propName] * fraction;
    } else {
      layer.paint[propName] = fraction;
    }
  }
}

function sketchGeoJSONUrl(id: number, timestamp?: string | number) {
  return `${
    BASE_SERVER_ENDPOINT +
    // eslint-disable-next-line i18next/no-literal-string
    `/sketches/${id}.geojson.json?${
      // eslint-disable-next-line i18next/no-literal-string
      timestamp ? `?timestamp=${timestamp}` : ""
    }`
  }`;
}

export function sourceTypeIsCustomGLSource(type: DataSourceTypes) {
  return (
    type === DataSourceTypes.ArcgisVector ||
    type === DataSourceTypes.ArcgisRasterTiles ||
    type === DataSourceTypes.ArcgisDynamicMapserver
  );
}

type CustomSourceType =
  | DataSourceTypes.ArcgisVector
  | DataSourceTypes.ArcgisRasterTiles
  | DataSourceTypes.ArcgisDynamicMapserver;

function isCustomSourceType(type: DataSourceTypes): type is CustomSourceType {
  return (
    sourceTypeIsCustomGLSource(type) ||
    type === DataSourceTypes.ArcgisDynamicMapserver ||
    type === DataSourceTypes.ArcgisRasterTiles ||
    type === DataSourceTypes.ArcgisVector
  );
}

function createCustomSource(
  source: DataSourceDetailsFragment,
  requestManager: ArcGISRESTServiceRequestManager
) {
  if (!isCustomSourceType(source.type)) {
    throw new Error("Source type is not custom");
  } else {
    switch (source.type) {
      case DataSourceTypes.ArcgisVector:
        const fetchStrategy =
          source.arcgisFetchStrategy === ArcgisFeatureLayerFetchStrategy.Raw
            ? "raw"
            : source.arcgisFetchStrategy ===
              ArcgisFeatureLayerFetchStrategy.Tiled
            ? "tiled"
            : "auto";
        return new ArcGISFeatureLayerSource(requestManager, {
          url: source.url!,
          fetchStrategy,
          sourceId: source.id.toString(),
          attributionOverride:
            (source.attribution || "").trim().length > 0
              ? source.attribution!
              : undefined,
        });
      case DataSourceTypes.ArcgisRasterTiles:
        return new ArcGISTiledMapService(requestManager, {
          url: source.url!,
          sourceId: source.id.toString(),
          attributionOverride:
            (source.attribution || "").trim().length > 0
              ? source.attribution!
              : undefined,
          maxZoom: source.maxzoom ? source.maxzoom : undefined,
          developerApiKey: process.env.REACT_APP_ARCGIS_DEVELOPER_API_KEY,
        });
      case DataSourceTypes.ArcgisDynamicMapserver:
        return new ArcGISDynamicMapService(requestManager, {
          url: source.url!,
          sourceId: source.id.toString(),
          supportHighDpiDisplays: source.useDevicePixelRatio || false,
          queryParameters: source.queryParameters || {},
          attributionOverride:
            (source.attribution || "").trim().length > 0
              ? source.attribution!
              : undefined,
        });
      default:
        throw new Error("Source type is not custom");
    }
  }
}

export function adjustLayerOpacities(
  layers: AnyLayer[],
  opacity: number,
  map?: Map
) {
  return layers.map((l) => {
    const layer = { ...l };
    if ("paint" in layer) {
      switch (layer.type) {
        case "circle":
          adjustPaintOpacityProp(layer, "circle-opacity", opacity, map);
          adjustPaintOpacityProp(layer, "circle-stroke-opacity", opacity, map);
          break;
        case "fill":
          adjustPaintOpacityProp(layer, "fill-opacity", opacity, map);
          break;
        case "line":
          adjustPaintOpacityProp(layer, "line-opacity", opacity, map);
          break;
        case "symbol":
          adjustPaintOpacityProp(layer, "icon-opacity", opacity, map);
          adjustPaintOpacityProp(layer, "text-opacity", opacity, map);
          break;
        case "heatmap":
          adjustPaintOpacityProp(layer, "heatmap-opacity", opacity, map);
          break;
        case "raster":
          adjustPaintOpacityProp(layer, "raster-opacity", opacity, map);
          break;
        default:
          break;
      }
    }
    return layer;
  });
}

function adjustPaintOpacityProp(
  layer: AnyLayer,
  propName: string,
  opacity: number,
  map?: Map
) {
  if ("paint" in layer) {
    const currentValue = (layer.paint as any)[propName];
    let value: number | Expression = opacity;
    if (typeof currentValue === "number") {
      value = ["*", opacity, currentValue];
    } else if (isExpression(currentValue)) {
      // check to make sure it's not a zoom expression. For some reason these
      // cause mapbox-gl to stop updating the style if combined with a
      // multiplication expression.
      if (hasZoomExpression(currentValue)) {
        value = opacity;
      } else {
        value = ["*", opacity, currentValue];
      }
    }
    layer.paint = {
      ...layer.paint,
      [propName]: opacity === 1 && currentValue ? currentValue : value,
    };
    if (map) {
      if (opacity === 1 && currentValue) {
        map.setPaintProperty(layer.id, propName, currentValue);
      } else {
        map.setPaintProperty(layer.id, propName, value);
      }
    }
  }
}

function hasZoomExpression(expression: Expression) {
  const fnName = expression[0];
  if (fnName === "zoom") {
    return true;
  } else {
    for (const arg of expression.slice(1)) {
      if (isExpression(arg)) {
        if (hasZoomExpression(arg)) {
          return true;
        }
      }
    }
  }
  return false;
}
