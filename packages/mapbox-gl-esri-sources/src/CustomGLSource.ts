import { AnyLayer, AnySourceData, Map } from "mapbox-gl";
import { ArcGISRESTServiceRequestManager } from "./ArcGISRESTServiceRequestManager";

export interface CustomGLSourceOptions {
  /** Optional. If not provided a uuid will be used. */
  sourceId?: string;
}

export interface LegendItem {
  /** Use for jsx key, no more */
  id: string;
  label: string;
  imageUrl: string;
}

export interface SingleImageLegend {
  url: string;
}

export interface DynamicRenderingSupportOptions {
  layerOrder: boolean;
  layerOpacity: boolean;
}

export interface ComputedMetadata {
  /** xmin, ymin, xmax, ymax */
  bounds?: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
  attribution?: string;
  /** Metadata as prosemirror document */
  metadata: {
    type: string;
    content: ({ type: string } & any)[];
  };
}

/**
 * CustomGLSources are used to add custom data sources to a Mapbox GL JS map.
 * Used to support ArcGIS, WMS, (and other?) sources using SeaSketch's
 * MapContextManager.
 */
export interface CustomGLSource<
  T extends CustomGLSourceOptions,
  LegendType = LegendItem[] | SingleImageLegend
> {
  sourceId: string;
  /**
   * CustomGLSources should trigger data and dataload events on the Map, but
   * it won't be possible to call Map.isSourceLoaded(sourceId) on some custom
   * types (such as those that rely on geojson layers). This property should
   * be used instead.
   */
  loading: boolean;

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
  // /**
  //  * Get metadata for the source. Requests should be de-duped and cached.
  //  * @returns Metadata for the source
  //  */
  // getMetadata(): Promise<MetadataType>;
  /**
   * Whether the source supports dynamic rendering. If true, clients can use
   * the updateLayers method to update source data.
   */
  getSupportsDynamicRendering(): Promise<DynamicRenderingSupportOptions>;
  /** Removes the source from the map and removes any event listeners */
  destroy(): void;
  getLegend(): Promise<LegendType>;
  getLayers(): Promise<AnyLayer[]>;
  getComputedMetadata(): Promise<ComputedMetadata>;
}
