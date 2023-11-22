import { AnyLayer, AnySourceData, Layer, Map } from "mapbox-gl";
import { ImageList } from "./ImageList";

export interface CustomGLSourceOptions {
  /** Optional. If not provided a uuid will be used. */
  sourceId?: string;
}

/**
 * LegendItems are assumed to be static and need not be refreshed after updating
 * layer visibility.
 */
export interface LegendItem {
  /** Use for jsx key, no more */
  id: string;
  label: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
}

/**
 * SingleImage legends should be updated whenever layer visibility changes
 */
export interface SingleImageLegend {
  url: string;
}

export interface DynamicRenderingSupportOptions {
  layerOrder: boolean;
  layerOpacity: boolean;
  layerVisibility: boolean;
}

export interface FolderTableOfContentsItem {
  type: "folder";
  id: string;
  label: string;
  defaultVisibility: boolean;
  parentId?: string;
}

export interface DataTableOfContentsItem {
  type: "data";
  id: string;
  label: string;
  defaultVisibility: boolean;
  /** Metadata as prosemirror document */
  metadata: {
    type: string;
    content: ({ type: string } & any)[];
  };
  legend?: LegendItem[];
  glStyle?: { layers: Layer[]; imageList?: ImageList };
  parentId?: string;
}
export interface ComputedMetadata {
  /** xmin, ymin, xmax, ymax */
  bounds?: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
  attribution?: string;
  tableOfContentsItems: (FolderTableOfContentsItem | DataTableOfContentsItem)[];
  supportsDynamicRendering: DynamicRenderingSupportOptions;
}

export interface LayerSettings {
  id: string;
  opacity: number;
}

export type CustomSourceType =
  | "ArcGISFeatureLayer"
  | "ArcGISTiledMapService"
  | "ArcGISDynamicMapService";

export type OrderedLayerSettings = LayerSettings[];
/**
 * CustomGLSources are used to add custom data sources to a Mapbox GL JS map.
 * Used to support ArcGIS, WMS, (and other?) sources using SeaSketch's
 * MapContextManager.
 */
export interface CustomGLSource<
  T extends CustomGLSourceOptions,
  LegendType = LegendItem[] | SingleImageLegend
> {
  url: string;
  sourceId: string;
  type: CustomSourceType;
  /**
   * CustomGLSources should trigger data and dataload events on the Map, but
   * it won't be possible to call Map.isSourceLoaded(sourceId) on some custom
   * types (such as those that rely on geojson layers). This property should
   * be used instead.
   */
  loading: boolean;

  /**
   * Present if there was a problem loading the source.
   */
  error?: string;

  // new (
  //   requestManager: ArcGISRESTServiceRequestManager,
  //   options?: T
  // ): CustomGLSource<T, LegendType>;
  /**
   * Add source to map. Does not add any layers to the map.
   * @returns Source ID
   * @param map Mapbox GL JS Map
   */
  addToMap(map: Map): Promise<string>;
  /**
   * Remove source from map, including any related layers.
   * @param map Mapbox GL JS Map
   * @throws If the source is not on the map
   */
  removeFromMap(map: Map): void;
  /** Removes the source from the map and removes any event listeners */
  destroy(): void;
  /**
   * If provided, this source uses a single image to represent all sublayers in
   * the legend. It will need to be updated with a new image each time rendering
   * options are changed.
   * */
  getLegend?(): Promise<SingleImageLegend>;
  getGLSource(map: Map): Promise<AnySourceData>;
  getGLStyleLayers(): Promise<{ layers: Layer[]; imageList?: ImageList }>;
  // handling on the server now
  getComputedMetadata(): Promise<ComputedMetadata>;
  updateLayers(layers: OrderedLayerSettings): void;
  /**
   * Whether computed metadata and layers are cached and ready to be used
   * immediately.
   * Used by SeaSketch's MapContextManager to determine whether to add
   * layers to the map style immediately or wait for the source to be ready.
   */
  ready: boolean;
  /**
   * Make any necessary requests to gather metadata needed to add layers to the
   * map. When this promise returns source.ready should be true.
   */
  prepare: () => Promise<void>;
  addEventListeners: (map: Map) => void;
  removeEventListeners: (map: Map) => void;
}
