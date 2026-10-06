import {
  extractMetricDependenciesFromReportBody,
  hashMetricDependency,
  MetricDependency,
} from "overlay-engine";

/**
 * Dependencies a widget should resolve.
 *
 * Saved card JSON is the source of truth for what the author picked, but
 * `extractMetricDependenciesFromReportBody` also adds metrics that existing
 * cards never stored. OUS demographics cards that leave `totalScope` unset
 * need a geography-subject metric beside the fragment metric. The report
 * dependency query already asks for that. The widget has to use the same
 * list, or it will ignore a calculation that is already complete.
 */
export function metricDependenciesForWidgetAttrs(
  nodeType: string,
  attrs:
    | {
        type?: string;
        componentSettings?: unknown;
        metrics?: unknown;
      }
    | null
    | undefined
): MetricDependency[] {
  const metrics = attrs?.metrics;
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return [];
  }
  if (metrics.some((metric) => metric == null || typeof metric !== "object")) {
    return metrics.filter(
      (metric): metric is MetricDependency =>
        metric != null &&
        typeof metric === "object" &&
        typeof (metric as MetricDependency).type === "string"
    );
  }
  return extractMetricDependenciesFromReportBody({
    type: nodeType,
    attrs: {
      type: attrs?.type,
      componentSettings: attrs?.componentSettings,
      metrics,
    },
  });
}

export type UnresolvedMetricDependency = {
  dependencyHash: string;
  type: string;
  subjectType: string;
  stableId?: string;
  message?: string;
};

/**
 * Card dependencies that have no metric row.
 *
 * Calculation details only lists metrics that exist. A widget can sit on its
 * loading state forever when it is waiting for one of these, while every row
 * in that list is already complete.
 */
export function listUnresolvedMetricDependencies(args: {
  body: unknown;
  metricDependencyHashes: string[];
  overlaySourceUrls: { [stableId: string]: string };
  resolutionFailuresByHash?: { [dependencyHash: string]: string };
  skipFragmentSubjects?: boolean;
}): UnresolvedMetricDependency[] {
  const body = args.body;
  if (!body || typeof body !== "object") {
    return [];
  }
  let dependencies: MetricDependency[];
  try {
    dependencies = extractMetricDependenciesFromReportBody(
      body as Parameters<typeof extractMetricDependenciesFromReportBody>[0]
    );
  } catch {
    return [];
  }
  const metricHashes = new Set(args.metricDependencyHashes);
  const failures = args.resolutionFailuresByHash || {};
  const seen = new Set<string>();
  const missing: UnresolvedMetricDependency[] = [];
  for (const dependency of dependencies) {
    if (args.skipFragmentSubjects && dependency.subjectType === "fragments") {
      continue;
    }
    const dependencyHash = hashMetricDependency(
      dependency,
      args.overlaySourceUrls
    );
    if (seen.has(dependencyHash) || metricHashes.has(dependencyHash)) {
      continue;
    }
    seen.add(dependencyHash);
    missing.push({
      dependencyHash,
      type: dependency.type,
      subjectType: dependency.subjectType,
      stableId: dependency.stableId,
      message: failures[dependencyHash],
    });
  }
  return missing;
}
