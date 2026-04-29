import { hashMetricDependency, type MetricDependency } from "overlay-engine";
import type {
  CompatibleSpatialMetricDetailsFragment,
  CompatibleSpatialMetricSlimFragment,
  FragmentSubjectDetailsFragment,
  OverlaySourceDetailsFragment,
} from "../../generated/graphql";

export type OverlaySourceUrlMap = Record<string, string>;

export type FragmentSubjectCatalogRow = Pick<
  FragmentSubjectDetailsFragment,
  "__typename" | "hash" | "sketches" | "geographies"
>;

/** Stable fallbacks — do not use `?? []` / `|| []` in render; a fresh [] each pass breaks useMemo deps. */
export const EMPTY_SLIM_METRICS: CompatibleSpatialMetricSlimFragment[] = [];
export const EMPTY_FRAGMENT_SUBJECT_CATALOG: FragmentSubjectCatalogRow[] =
  [];
export const EMPTY_OVERLAY_SOURCES: OverlaySourceDetailsFragment[] = [];
export const EMPTY_HYDRATED_METRICS_DETAILS: CompatibleSpatialMetricDetailsFragment[] =
  [];

export function buildOverlayStableIdToSourceUrlMap(
  sources: Pick<OverlaySourceDetailsFragment, "stableId" | "sourceUrl">[],
): OverlaySourceUrlMap {
  const acc: OverlaySourceUrlMap = {};
  for (const s of sources) {
    if (s.stableId && s.sourceUrl) {
      acc[s.stableId] = s.sourceUrl;
    }
  }
  return acc;
}

function metricParametersFromDependency(
  dep: MetricDependency | undefined,
): CompatibleSpatialMetricDetailsFragment["parameters"] {
  const p = dep?.parameters;
  return {
    __typename: "MetricParameters",
    groupBy: p?.groupBy ?? null,
    includedColumns: p?.includedColumns ?? null,
    valueColumn: p?.valueColumn ?? null,
    bufferDistanceKm: p?.bufferDistanceKm ?? null,
    maxResults: p?.maxResults ?? null,
    maxDistanceKm: p?.maxDistanceKm ?? null,
    sourceHasOverlappingFeatures: p?.sourceHasOverlappingFeatures ?? null,
  };
}

/**
 * Restores `subject` from compressed `g` (geography id) and/or `f` (catalog index),
 * then removes `g` and `f` from the metric object.
 */
export function hydrateMetricSubjectRefs(
  metric: Record<string, unknown>,
  fragmentSubjectCatalog: FragmentSubjectCatalogRow[],
): void {
  if (metric.subject != null) {
    delete metric.g;
    delete metric.f;
    return;
  }
  if (typeof metric.g === "number") {
    metric.subject = { __typename: "GeographySubject", id: metric.g };
  } else if (typeof metric.f === "number") {
    const entry = fragmentSubjectCatalog[metric.f];
    if (entry) {
      metric.subject = {
        __typename: "FragmentSubject",
        hash: entry.hash,
        sketches: [...entry.sketches],
        geographies: [...entry.geographies],
      };
    }
  }
  delete metric.g;
  delete metric.f;
}

export type HydrateSpatialMetricsArgs = {
  slimMetrics: CompatibleSpatialMetricSlimFragment[];
  dependencies: MetricDependency[];
  overlaySourceUrlByStableId: OverlaySourceUrlMap;
  fragmentSubjectCatalog?: FragmentSubjectCatalogRow[];
};

/**
 * Drop metrics not referenced by the current report doc (unknown dependencyHash),
 * then merge parameters + sourceUrl from embedded MetricDependency definitions,
 * then hydrate `subject` from `g` / `f` + fragmentSubjectCatalog when needed.
 */
export function hydrateSpatialMetrics({
  slimMetrics,
  dependencies,
  overlaySourceUrlByStableId,
  fragmentSubjectCatalog = [],
}: HydrateSpatialMetricsArgs): CompatibleSpatialMetricDetailsFragment[] {
  const depByHash = new Map<string, MetricDependency>();
  for (const dep of dependencies) {
    const h = hashMetricDependency(dep, overlaySourceUrlByStableId);
    if (!depByHash.has(h)) {
      depByHash.set(h, dep);
    }
  }
  const knownHashes = new Set(depByHash.keys());

  const rows: Record<string, unknown>[] = [];
  for (const m of slimMetrics) {
    if (!knownHashes.has(m.dependencyHash)) {
      continue;
    }
    const dep = depByHash.get(m.dependencyHash)!;
    const sourceUrl = dep.stableId
      ? overlaySourceUrlByStableId[dep.stableId] ?? null
      : null;

    rows.push({
      __typename: "CompatibleSpatialMetric",
      ...m,
      parameters: metricParametersFromDependency(dep),
      sourceUrl: sourceUrl ?? undefined,
      jobKey: undefined,
      updatedAt: undefined,
      sourceProcessingJobDependency: undefined,
    } as Record<string, unknown>);
  }

  for (const row of rows) {
    hydrateMetricSubjectRefs(row, fragmentSubjectCatalog);
  }

  return rows as CompatibleSpatialMetricDetailsFragment[];
}
