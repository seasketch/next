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
} from "./geographies/geographies";
export {
  calculateArea,
  CalculateAreaOptions,
  DebuggingCallback,
} from "./geographies/calculateArea";
export { Cql2Query } from "./cql2";
export {
  createFragments,
  eliminateOverlap,
  FragmentResult,
  SketchFragment,
  GeographySettings,
  mergeTouchingFragments,
} from "./fragments";

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
  MetricSubjectFragment,
} from "./metrics/metrics";
