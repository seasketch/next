export type WMSVersion = "1.1.1" | "1.3.0";

export interface WMSBoundingBox {
  crs: string;
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
}

export interface WMSStyle {
  name: string;
  title?: string;
  abstract?: string;
  legendUrl?: string;
  legendWidth?: number;
  legendHeight?: number;
  legendFormat?: string;
}

export interface WMSDimension {
  name: string;
  units?: string;
  unitSymbol?: string;
  default?: string;
  values?: string[];
}

export interface WMSMetadataUrl {
  type: string;
  format: string;
  url: string;
}

export interface WMSLayer {
  name?: string;
  title?: string;
  abstract?: string;
  queryable?: boolean;
  opaque?: boolean;
  crs: string[];
  boundingBoxes: WMSBoundingBox[];
  geographicBoundingBox?: [number, number, number, number];
  styles: WMSStyle[];
  children: WMSLayer[];
  metadataUrls: WMSMetadataUrl[];
  minScaleDenominator?: number;
  maxScaleDenominator?: number;
  dimensions: WMSDimension[];
}

export interface WMSOperation {
  url: string;
  formats: string[];
}

export interface WMSServiceMetadata {
  version: WMSVersion;
  title?: string;
  abstract?: string;
  fees?: string;
  accessConstraints?: string;
  contact?: {
    person?: string;
    organization?: string;
    email?: string;
  };
  getMap: WMSOperation;
  getFeatureInfo?: WMSOperation;
  getLegendGraphic?: WMSOperation;
  layers: WMSLayer[];
  maxWidth?: number;
  maxHeight?: number;
  /** Base service URL used for GetCapabilities */
  serviceUrl: string;
}

export interface NormalizedWMSUrl {
  baseUrl: string;
  getCapabilitiesUrl: string;
}

export interface GetMapUrlParams {
  baseUrl: string;
  version: WMSVersion;
  layers: string[];
  styles?: string[];
  crs: string;
  bbox: [number, number, number, number];
  width: number;
  height: number;
  format?: string;
  transparent?: boolean;
  time?: string;
  elevation?: string;
  vendorParams?: Record<string, string | number | boolean>;
}

export interface GetFeatureInfoUrlParams {
  baseUrl: string;
  version: WMSVersion;
  layers: string[];
  queryLayers: string[];
  crs: string;
  bbox: [number, number, number, number];
  width: number;
  height: number;
  /** Pixel x (1.1.1) or column i (1.3.0) */
  x: number;
  /** Pixel y (1.1.1) or row j (1.3.0) */
  y: number;
  infoFormat?: string;
  featureCount?: number;
  vendorParams?: Record<string, string | number | boolean>;
}

export interface GetLegendGraphicUrlParams {
  baseUrl: string;
  version: WMSVersion;
  layer: string;
  style?: string;
  format?: string;
  width?: number;
  height?: number;
  crs?: string;
  vendorParams?: Record<string, string | number | boolean>;
}

export interface WMSFeatureInfoResult {
  format: string;
  features: WMSFeatureInfoFeature[];
  raw?: string;
  html?: string;
}

export interface WMSFeatureInfoFeature {
  layer?: string;
  properties: Record<string, string | number | boolean | null>;
}

export interface WMSLayerMetadataDocument {
  title: string;
  prosemirror: {
    type: string;
    content: ({ type: string } & Record<string, unknown>)[];
  };
}

export interface WMSRequestMode {
  mode: "dynamic" | "tiled";
}

export const WEB_MERCATOR_CRS = [
  "EPSG:3857",
  "EPSG:900913",
  "CRS:84",
  "EPSG:4326",
];

export const DEFAULT_IMAGE_FORMAT = "image/png";

export const DEFAULT_INFO_FORMATS = [
  "application/json",
  "text/html",
  "application/vnd.ogc.gml",
  "text/xml",
];
