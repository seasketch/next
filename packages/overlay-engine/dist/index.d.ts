export { prepareSketch, PreparedSketch } from "./utils/prepareSketch";
export { unionAtAntimeridian } from "./utils/unionAtAntimeridian";
export { clipToGeography, ClippingFn, ClippingOperation, ClippingLayerOption, clipSketchToPolygons, PolygonClipResult, clipToGeographies, calculateGeographyOverlap, } from "./geographies/geographies";
export { calculateArea } from "./geographies/calculateArea";
export { Cql2Query } from "./cql2";
export { createFragments, eliminateOverlap, FragmentResult, SketchFragment, GeographySettings, mergeTouchingFragments, } from "./fragments";
export { calculateFragmentOverlap } from "./calculateFragmentOverlap";
export { Metric, MetricType, TotalAreaMetric, OverlayAreaMetric, OverlayAreaMetricValue, OverlayAreaOverlapInfo, OverlayAreaOverlapCombineResult, CountMetric, PresenceMetric, PresenceTableMetric, ColumnValuesMetric, ColumnValuesEntry, ValuesForColumns, NumberColumnValueStats, StringOrBooleanColumnValueStats, combineNumberColumnValueStats, combineStringOrBooleanColumnValueStats, combineOverlayAreaMetrics, classifyOverlayAreaOverlapScope, isOverlayAreaClassKey, isOverlayAreaOverlapInfo, isOverlayAreaOverlapCombineResult, getOverlayAreaOverlapInfo, getOverlayAreaOverlapCombineResult, getOverlayAreaClassTotals, getOverlayAreaDisplayedClassValue, getOverlayAreaClassValueRange, isColumnValuesEntry, hasReliableColumnValueEntries, numberColumnStatsFromEntries, stringOrBooleanColumnStatsFromEntries, capColumnValueEntries, MAX_COLUMN_VALUE_ENTRIES, MAX_OVERLAY_AREA_OVERLAP_ENTRIES, MetricTypeMap, subjectIsFragment, subjectIsGeography, MetricSubjectFragment, MetricSubjectGeography, SourceType, UniqueIdIndex, DistanceToShoreMetric, RasterBandStats, combineRasterBandStats, combineMetricsForFragments, RasterStats, MetricDependency, isNumberColumnValueStats, MetricDependencySubjectType, MetricDependencyParameters, hashMetricDependency, extractMetricDependenciesFromReportBody, } from "./metrics/metrics";
export { createUniqueIdIndex, countUniqueIds, mergeUniqueIdIndexes, } from "./utils/uniqueIdIndex";
export { initializeGeographySources } from "./geographies/geographies";
export { calculateRasterStats } from "./rasterStats";
export { calculateDistanceToShore } from "./calculateDistanceToShore";
export { computeBufferedSubjectAndCollar } from "./metrics/computeSubjectCollar";
//# sourceMappingURL=index.d.ts.map