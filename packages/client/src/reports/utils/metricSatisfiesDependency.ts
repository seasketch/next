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
  let debugging = false;
  // if (
  //   metric.type === "distance_to_shore" &&
  //   dependency.type === "distance_to_shore"
  // ) {
  //   debugging = true;
  // }
  let overlaySourceUrl: string | undefined;
  if (dependency.tableOfContentsItemId) {
    overlaySourceUrl = overlaySourceUrls[dependency.tableOfContentsItemId];
    // if (!overlaySourceUrl) {
    //   throw new Error(
    //     `Overlay source URL not provided for table of contents item ID: ${dependency.tableOfContentsItemId}`
    //   );
    // }
  }
  if (metric.type !== dependency.type) {
    // if (debugging) {
    //   console.log(
    //     "metric.type !== dependency.type",
    //     metric.type,
    //     dependency.type
    //   );
    // }
    return false;
  }
  if (
    metric.type !== "distance_to_shore" &&
    metric.sourceUrl?.length &&
    metric.sourceUrl !== overlaySourceUrl
  ) {
    // if (debugging) {
    //   console.log(
    //     "metric.sourceUrl?.length && metric.sourceUrl !== overlaySourceUrl",
    //     metric.sourceUrl,
    //     overlaySourceUrl
    //   );
    // }
    return false;
  }
  if (dependency.subjectType === "geographies") {
    if (!subjectIsGeography(metric.subject)) {
      // if (debugging) {
      //   console.log("!subjectIsGeography(metric.subject)", metric.subject);
      // }
      return false;
    }
  } else if (dependency.subjectType === "fragments") {
    if (!subjectIsFragment(metric.subject)) {
      // if (debugging) {
      //   console.log("!subjectIsFragment(metric.subject)", metric.subject);
      // }
      return false;
    }
  } else {
    throw new Error(`Invalid subject type: ${dependency.subjectType}`);
  }
  if (dependency.parameters) {
    if (!_.isEqual(metric.parameters, dependency.parameters)) {
      // if (debugging) {
      //   console.log(
      //     "!_.isEqual(metric.parameters, dependency.parameters)",
      //     metric.parameters,
      //     dependency.parameters
      //   );
      // }
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
