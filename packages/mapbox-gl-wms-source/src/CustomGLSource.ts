import { AnyLayer, AnySourceData, Layer, Map } from "mapbox-gl";

export interface CustomGLSourceOptions {
  sourceId?: string;
  attributionOverride?: string;
}

export interface LegendItem {
  id: string;
  label: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
}

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
  metadata: {
    type: string;
    content: ({ type: string } & Record<string, unknown>)[];
  };
  legend?: LegendItem[];
  glStyle?: { layers: Layer[] };
  parentId?: string;
}

export interface ComputedMetadata {
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

export type CustomSourceType = "WMSTiledSource" | "WMSDynamicSource";

export type OrderedLayerSettings = LayerSettings[];

/**
 * CustomGLSources are used to add custom data sources to a Mapbox GL JS map.
 */
export interface CustomGLSource<
  T extends CustomGLSourceOptions,
  LegendType = LegendItem[] | SingleImageLegend
> {
  url: string;
  sourceId: string;
  type: CustomSourceType;
  loading: boolean;
  error?: string;
  addToMap(map: Map): Promise<string>;
  removeFromMap(map: Map): void;
  destroy(): void;
  getLegend?(): Promise<SingleImageLegend>;
  getGLSource(map: Map): Promise<AnySourceData>;
  getGLStyleLayers(): Promise<{ layers: AnyLayer[] }>;
  getComputedMetadata(): Promise<ComputedMetadata>;
  updateLayers(layers: OrderedLayerSettings): void;
  ready: boolean;
  prepare(): Promise<void>;
  addEventListeners(map: Map): void;
  removeEventListeners(map: Map): void;
}
