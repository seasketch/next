export { prepareSketch, PreparedSketch } from "./utils/prepareSketch";
export { unionAtAntimeridian } from "./utils/unionAtAntimeridian";
export {
  clipToGeography,
  ClippingFn,
  ClippingOperation,
  ClippingLayerOption,
  clipSketchToPolygons,
  PolygonClipResult,
  clipToGeographies,
  calculateGeographyOverlap,
} from "./geographies/geographies";
export { calculateArea } from "./geographies/calculateArea";
export { Cql2Query } from "./cql2";
export {
  createFragments,
  eliminateOverlap,
  FragmentResult,
  SketchFragment,
  GeographySettings,
  mergeTouchingFragments,
} from "./fragments";
export { calculateFragmentOverlap } from "./calculateFragmentOverlap";

export {
  Metric,
  MetricType,
  TotalAreaMetric,
  OverlayAreaMetric,
  CountMetric,
  PresenceMetric,
  PresenceTableMetric,
  ColumnValuesMetric,
  ColumnValueStats,
  MetricTypeMap,
  subjectIsFragment,
  subjectIsGeography,
  MetricSubjectFragment,
  MetricSubjectGeography,
  SourceType,
  UniqueIdIndex,
  DistanceToShoreMetric,
  RasterBandStats,
  combineRasterBandStats,
  combineColumnValueStats,
  combineMetricsForFragments,
  MetricDependency,
  MetricDependencySubjectType,
  MetricDependencyParameters,
} from "./metrics/metrics";
export {
  createUniqueIdIndex,
  countUniqueIds,
  mergeUniqueIdIndexes,
} from "./utils/uniqueIdIndex";
export { initializeGeographySources } from "./geographies/geographies";
export { calculateRasterStats } from "./rasterStats";
export { calculateDistanceToShore } from "./calculateDistanceToShore";
