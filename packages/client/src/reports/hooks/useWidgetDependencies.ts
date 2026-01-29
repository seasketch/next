import { useContext, useMemo, useRef } from "react";
import { hashMetricDependency, MetricDependency } from "overlay-engine";
import {
  CompatibleSpatialMetricDetailsFragment,
  Geography,
  OverlaySourceDetailsFragment,
  ReportContextSketchClassDetailsFragment,
  SpatialMetricState,
  useProjectReportingLayersQuery,
} from "../../generated/graphql";
import { useReportContext } from "../ReportContext";
import { DraftReportContext } from "../DraftReportContext";
import { filterMetricsByDependencies } from "../utils/metricSatisfiesDependency";
import { useBaseReportContext } from "../context/BaseReportContext";
import getSlug from "../../getSlug";

export type WidgetDependenciesResult = {
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  loading: boolean;
  errors: string[];
  geographies: Pick<Geography, "id" | "name" | "translatedProps">[];
  sketchClass: ReportContextSketchClassDetailsFragment;
};

/**
 * Stable comparison for metrics array - only returns new array if content changes
 */
function useStableMetrics(
  metrics: CompatibleSpatialMetricDetailsFragment[]
): CompatibleSpatialMetricDetailsFragment[] {
  const ref = useRef<CompatibleSpatialMetricDetailsFragment[]>(metrics);
  const prevKey = useRef<string>("");

  // Create a key based on metric id, state, and value hash
  const key = metrics
    .map(
      (m) =>
        `${m.id}:${m.state}:${m.dependencyHash}:${JSON.stringify(
          m.value
        )?.slice(0, 100)}`
    )
    .sort()
    .join("|");

  if (key !== prevKey.current) {
    prevKey.current = key;
    ref.current = metrics;
  }

  return ref.current;
}

/**
 * Stable comparison for sources array - only returns new array if content changes
 */
function useStableSources(
  sources: OverlaySourceDetailsFragment[]
): OverlaySourceDetailsFragment[] {
  const ref = useRef<OverlaySourceDetailsFragment[]>(sources);
  const prevKey = useRef<string>("");

  const key = sources
    .map((s) => `${s.tableOfContentsItemId}:${s.sourceUrl}`)
    .sort()
    .join("|");

  if (key !== prevKey.current) {
    prevKey.current = key;
    ref.current = sources;
  }

  return ref.current;
}

/**
 * Hook that returns stable widget dependencies, only triggering re-renders
 * when the widget's specific metrics/sources actually change.
 */
export function useWidgetDependencies(
  dependencies: MetricDependency[] | undefined
): WidgetDependenciesResult {
  const { geographies: contextGeographies, sketchClass: contextSketchClass } =
    useBaseReportContext();

  const { data } = useProjectReportingLayersQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const adminSources = useMemo(() => {
    return data?.projectBySlug?.reportingLayers || [];
  }, [data]);

  const contextMetrics = [] as CompatibleSpatialMetricDetailsFragment[];
  const overlaySources = [] as OverlaySourceDetailsFragment[];
  // const {
  //   metrics: contextMetrics,
  //   overlaySources,
  //   // preprocessedOverlaySources: adminSources,
  //   // geographies: contextGeographies,
  //   // sketchClass: contextSketchClass,
  // } = useReportContext();

  const draftReportContext = useContext(DraftReportContext);

  // Compute source URL map for filtering
  const sourceUrlMap = useMemo(() => {
    return [
      ...overlaySources,
      ...adminSources,
      ...draftReportContext.draftOverlaySources,
    ].reduce((acc, s) => {
      if (s.tableOfContentsItemId && s.sourceUrl) {
        acc[s.tableOfContentsItemId] = s.sourceUrl;
      }
      return acc;
    }, {} as Record<number, string>);
  }, [overlaySources, adminSources, draftReportContext.draftOverlaySources]);

  // Filter metrics and sources for this widget
  const { rawMetrics, rawSources, loading, errors } = useMemo(() => {
    const allMetrics = [...contextMetrics, ...draftReportContext.draftMetrics];

    let loading = false;
    let errors: string[] = [];

    const filteredMetrics = filterMetricsByDependencies(
      allMetrics,
      dependencies || [],
      sourceUrlMap
    ) as CompatibleSpatialMetricDetailsFragment[];

    // Check loading and error states
    for (const metric of filteredMetrics) {
      if (
        metric.state === SpatialMetricState.DependencyNotReady ||
        metric.state === SpatialMetricState.Processing ||
        metric.state === SpatialMetricState.Queued
      ) {
        loading = true;
      }
      if (metric.state === SpatialMetricState.Error) {
        errors.push(metric.errorMessage || "Unknown error");
      }
    }

    // Filter sources for this widget's dependencies
    let filteredSources = [
      ...overlaySources,
      ...adminSources,
      ...draftReportContext.draftOverlaySources,
    ].filter((s) =>
      (dependencies || []).some(
        (d: MetricDependency) =>
          d.tableOfContentsItemId === s.tableOfContentsItemId
      )
    );

    // Dedupe by tableOfContentsItemId
    const sourceIds = new Set<number>();
    filteredSources = filteredSources.filter((s) => {
      if (sourceIds.has(s.tableOfContentsItemId!)) {
        return false;
      }
      sourceIds.add(s.tableOfContentsItemId!);
      return true;
    });

    // Check if we're still waiting for metrics
    if (!loading) {
      for (const dependency of dependencies || []) {
        const hash = hashMetricDependency(dependency);
        const relatedMetric = filteredMetrics.find(
          (m) => m.dependencyHash === hash
        );
        if (!relatedMetric) {
          loading = true;
          break;
        }
      }
    }

    return {
      rawMetrics: filteredMetrics,
      rawSources: filteredSources,
      loading,
      errors,
    };
  }, [
    contextMetrics,
    draftReportContext.draftMetrics,
    draftReportContext.draftOverlaySources,
    dependencies,
    overlaySources,
    adminSources,
    sourceUrlMap,
  ]);

  // Use stable references - only change when content actually changes
  const metrics = useStableMetrics(rawMetrics);
  const sources = useStableSources(rawSources);

  // Stabilize the loading and errors values
  const stableLoading = useStableValue(loading);
  const stableErrors = useStableArray(errors);

  // Stabilize geographies and sketchClass
  const geographies = useStableGeographies(contextGeographies);
  const sketchClass = useStableSketchClass(contextSketchClass);

  return {
    metrics,
    sources,
    loading: stableLoading,
    errors: stableErrors,
    geographies,
    sketchClass,
  };
}

/**
 * Returns stable reference for a primitive value
 */
function useStableValue<T>(value: T): T {
  const ref = useRef<T>(value);
  if (ref.current !== value) {
    ref.current = value;
  }
  return ref.current;
}

/**
 * Returns stable reference for a string array
 */
function useStableArray(arr: string[]): string[] {
  const ref = useRef<string[]>(arr);
  const prevKey = useRef<string>("");

  const key = arr.sort().join("|");
  if (key !== prevKey.current) {
    prevKey.current = key;
    ref.current = arr;
  }

  return ref.current;
}

/**
 * Returns stable reference for geographies array
 */
function useStableGeographies(
  geographies: Pick<Geography, "id" | "name" | "translatedProps">[]
): Pick<Geography, "id" | "name" | "translatedProps">[] {
  const ref = useRef(geographies);
  const prevKey = useRef<string>("");

  const key = geographies.map((g) => `${g.id}:${g.name}`).join("|");
  if (key !== prevKey.current) {
    prevKey.current = key;
    ref.current = geographies;
  }

  return ref.current;
}

/**
 * Returns stable reference for sketchClass
 */
function useStableSketchClass(
  sketchClass: ReportContextSketchClassDetailsFragment
): ReportContextSketchClassDetailsFragment {
  const ref = useRef(sketchClass);
  const prevKey = useRef<string>("");

  // Key based on id and geometry type - these rarely change
  const key = `${sketchClass.id}:${sketchClass.geometryType}`;
  if (key !== prevKey.current) {
    prevKey.current = key;
    ref.current = sketchClass;
  }

  return ref.current;
}
