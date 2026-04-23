import {
  CompatibleSpatialMetricDetailsFragment,
  SpatialMetricState,
} from "../../../generated/graphql";

/**
 * Match {@link combineMetricsBySource}: dedupe metric ids and keep latest complete.
 */
export function dedupeCompleteSpatialMetrics(
  metrics: CompatibleSpatialMetricDetailsFragment[],
): CompatibleSpatialMetricDetailsFragment[] {
  const metricIds = new Set(metrics.map((m) => m.id));
  const completed = metrics.filter((m) => m.state === SpatialMetricState.Complete);
  return Array.from(metricIds)
    .map((id) => completed.find((m) => m.id === id))
    .filter(Boolean) as CompatibleSpatialMetricDetailsFragment[];
}
