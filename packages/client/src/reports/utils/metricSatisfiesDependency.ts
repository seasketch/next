import {
  MetricDependency,
  subjectIsFragment,
  subjectIsGeography,
} from "overlay-engine";
import { CompatibleSpatialMetric } from "../../generated/graphql";
import _ from "lodash";

export function metricSatisfiesDependency(
  metric: CompatibleSpatialMetric,
  dependency: MetricDependency,
  overlaySourceUrls: { [tableOfContentsItemId: number]: string }
): boolean {
  let overlaySourceUrl: string | undefined;
  if (dependency.tableOfContentsItemId) {
    overlaySourceUrl = overlaySourceUrls[dependency.tableOfContentsItemId];
    if (!overlaySourceUrl) {
      throw new Error(
        `Overlay source URL not provided for table of contents item ID: ${dependency.tableOfContentsItemId}`
      );
    }
  }
  if (metric.type !== dependency.type) {
    return false;
  }
  if (metric.sourceUrl?.length && metric.sourceUrl !== overlaySourceUrl) {
    return false;
  }
  if (dependency.subjectType === "geographies") {
    if (!subjectIsGeography(metric.subject)) {
      return false;
    }
  } else if (dependency.subjectType === "fragments") {
    if (!subjectIsFragment(metric.subject)) {
      return false;
    }
  } else {
    throw new Error(`Invalid subject type: ${dependency.subjectType}`);
  }
  if (dependency.parameters) {
    if (!_.isEqual(metric.parameters, dependency.parameters)) {
      return false;
    }
  }

  return true;
}

export function filterMetricsByDependencies(
  metrics: CompatibleSpatialMetric[],
  dependencies: MetricDependency[],
  overlaySourceUrls: { [tableOfContentsItemId: number]: string }
): CompatibleSpatialMetric[] {
  return metrics.filter((metric) => {
    return dependencies.some((dependency) => {
      return metricSatisfiesDependency(metric, dependency, overlaySourceUrls);
    });
  });
}
