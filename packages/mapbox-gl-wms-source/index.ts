export {
  CustomGLSource,
  CustomGLSourceOptions,
  ComputedMetadata,
  DataTableOfContentsItem,
  FolderTableOfContentsItem,
  DynamicRenderingSupportOptions,
  LegendItem,
  SingleImageLegend,
  OrderedLayerSettings,
  LayerSettings,
  CustomSourceType,
} from "./src/CustomGLSource";

export {
  WMSDynamicSource,
  WMSDynamicSourceOptions,
} from "./src/WMSDynamicSource";
export { WMSTiledSource, WMSTiledSourceOptions } from "./src/WMSTiledSource";
export { WMSBaseSource, WMSCommonOptions } from "./src/WMSBaseSource";

export {
  normalizeWMSUrl,
  fetchCapabilities,
  validateCORS,
  parseCapabilities,
  flattenLayers,
  getNamedLayers,
  getSupportedWebMercatorCrs,
  getLayerBounds,
} from "./src/catalog";

export {
  buildGetMapUrl,
  buildGetFeatureInfoUrl,
  buildGetLegendGraphicUrl,
  buildTiledGetMapUrlTemplate,
} from "./src/urls";

export { getLegendItems, getLegendGraphicUrl } from "./src/legends";
export {
  buildLayerMetadata,
  fetchAndParseMetadataUrl,
} from "./src/metadata";

export {
  parseFeatureInfo,
  identify,
  getFeatureInfoUrl,
} from "./src/interactivity";

export { EXAMPLE_WMS_SERVICES, ExampleWMSService } from "./src/exampleServices";

export type {
  WMSVersion,
  WMSLayer,
  WMSServiceMetadata,
  WMSStyle,
  WMSBoundingBox,
  WMSFeatureInfoResult,
  WMSFeatureInfoFeature,
  WMSLayerMetadataDocument,
  GetMapUrlParams,
  GetFeatureInfoUrlParams,
  GetLegendGraphicUrlParams,
} from "./src/types";

export { blankDataUri } from "./src/util";
