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
  MetricTypeMap,
  subjectIsFragment,
  subjectIsGeography,
  MetricSubjectFragment,
  MetricSubjectGeography,
  SourceType,
  UniqueIdIndex,
} from "./metrics/metrics";
export {
  createUniqueIdIndex,
  countUniqueIds,
  mergeUniqueIdIndexes,
} from "./utils/uniqueIdIndex";
export { initializeGeographySources } from "./geographies/geographies";
