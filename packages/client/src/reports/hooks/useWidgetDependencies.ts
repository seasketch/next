import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { hashMetricDependency, MetricDependency } from "overlay-engine";
import {
  CompatibleSpatialMetricDetailsFragment,
  Geography,
  OverlaySourceDetailsFragment,
  ReportContextSketchClassDetailsFragment,
  SpatialMetricState,
} from "../../generated/graphql";
import { DraftReportContext } from "../DraftReportContext";
import { filterMetricsByDependencies } from "../utils/metricSatisfiesDependency";
import { useCardDependenciesContext } from "../context/CardDependenciesContext";

type SketchClassForWidgets = Pick<
  ReportContextSketchClassDetailsFragment,
  "id" | "projectId" | "geometryType" | "form" | "clippingGeographies"
>;

export type WidgetDependenciesResult = {
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  loading: boolean;
  errors: string[];
  geographies: Pick<Geography, "id" | "name" | "translatedProps">[];
  sketchClass: SketchClassForWidgets;
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
 *
 * This hook consumes CardDependenciesContext to get card-scoped metrics and
 * sources, then filters further based on the widget's specific dependencies.
 * This prevents re-renders when other cards' data changes.
 */
export function useWidgetDependencies(
  dependencies: MetricDependency[] | undefined
): WidgetDependenciesResult {
  // Get card-level dependencies from context (provided by ReportCard)
  const {
    metrics: cardMetrics,
    sources: cardSources,
    loading: cardLoading,
    geographies: contextGeographies,
    sketchClass: contextSketchClass,
    errors: cardErrors,
  } = useCardDependenciesContext();

  // Also get draft metrics/sources for editor scenarios
  const draftReportContext = useContext(DraftReportContext);

  // State for delayed error when a dependency's source is missing for 5+ seconds
  const [deletedLayerError, setDeletedLayerError] = useState<string | null>(
    null
  );
  const missingSourceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Combine card sources with draft sources
  const allSources = useMemo(() => {
    const combined = [
      ...cardSources,
      ...draftReportContext.draftOverlaySources,
    ];
    // Dedupe by stableId
    const sourceIds = new Set<string>();
    return combined.filter((s) => {
      if (s.stableId && sourceIds.has(s.stableId)) {
        return false;
      }
      if (s.stableId) {
        sourceIds.add(s.stableId);
      }
      return true;
    });
  }, [cardSources, draftReportContext.draftOverlaySources]);

  // Compute source URL map for filtering metrics
  const sourceUrlMap = useMemo(() => {
    return allSources.reduce((acc, s) => {
      if (s.stableId && s.sourceUrl) {
        acc[s.stableId] = s.sourceUrl;
      }
      return acc;
    }, {} as Record<string, string>);
  }, [allSources]);

  // Combine card metrics with draft metrics
  const allMetrics = useMemo(() => {
    return [...cardMetrics, ...draftReportContext.draftMetrics];
  }, [cardMetrics, draftReportContext.draftMetrics]);

  // Filter metrics and sources for this widget
  const {
    rawMetrics,
    rawSources,
    loading,
    errors,
    hasMissingDependencyWithoutSource,
  } = useMemo(() => {
    let loading = cardLoading;
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
    const filteredSources = allSources.filter((s) =>
      (dependencies || []).some(
        (d: MetricDependency) => d.stableId === s.stableId
      )
    );

    // Check if we're still waiting for metrics
    let hasMissingDependencyWithoutSource: string[] = [];
    if (!loading) {
      for (const dependency of dependencies || []) {
        const hash = hashMetricDependency(dependency, sourceUrlMap);
        const relatedMetric = filteredMetrics.find(
          (m) => m.dependencyHash === hash
        );
        const relatedSource = filteredSources.find(
          (s) => s.stableId === dependency.stableId
        );
        if (!relatedMetric) {
          loading = true;
          if (!relatedSource && dependency.stableId) {
            hasMissingDependencyWithoutSource.push(dependency.stableId);
          }
        }
      }
    }

    if (cardErrors) {
      errors.push(...Object.keys(cardErrors));
    }

    return {
      rawMetrics: filteredMetrics,
      rawSources: filteredSources,
      loading,
      errors,
      hasMissingDependencyWithoutSource,
    };
  }, [
    allMetrics,
    allSources,
    cardLoading,
    dependencies,
    sourceUrlMap,
    cardErrors,
  ]);

  // Manage 5-second timer for missing dependency without source.
  // If a dependency's metric is missing, the card is done loading, and no
  // related source exists, wait 5 seconds before treating it as an error
  // (to allow for transient states to resolve).
  useEffect(() => {
    if (hasMissingDependencyWithoutSource.length > 0 && !cardLoading) {
      if (!missingSourceTimerRef.current && !deletedLayerError) {
        missingSourceTimerRef.current = setTimeout(() => {
          setDeletedLayerError(
            // eslint-disable-next-line i18next/no-literal-string
            `Metrics missing. This report widget may be referencing a deleted layer (${Array.from(
              new Set(hasMissingDependencyWithoutSource)
            ).join(", ")})`
          );
          missingSourceTimerRef.current = null;
        }, 5000);
      }
    } else {
      if (missingSourceTimerRef.current) {
        clearTimeout(missingSourceTimerRef.current);
        missingSourceTimerRef.current = null;
      }
      if (deletedLayerError) {
        setDeletedLayerError(null);
      }
    }
    return () => {
      if (missingSourceTimerRef.current) {
        clearTimeout(missingSourceTimerRef.current);
        missingSourceTimerRef.current = null;
      }
    };
  }, [hasMissingDependencyWithoutSource, cardLoading, deletedLayerError]);

  // Use stable references - only change when content actually changes
  const metrics = useStableMetrics(rawMetrics);
  const sources = useStableSources(rawSources);

  // Stabilize the loading and errors values
  const stableLoading = useStableValue(loading);
  const stableErrors = useStableArray(errors);

  // Stabilize geographies and sketchClass
  const geographies = useStableGeographies(contextGeographies);
  const sketchClass = useStableSketchClass(contextSketchClass);

  // When deletedLayerError is set, override loading to false and merge error
  const finalLoading = deletedLayerError ? false : stableLoading;
  const finalErrors = useMemo(
    () =>
      deletedLayerError ? [...stableErrors, deletedLayerError] : stableErrors,
    [stableErrors, deletedLayerError]
  );

  return {
    metrics,
    sources,
    loading: finalLoading,
    errors: finalErrors,
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
  sketchClass: SketchClassForWidgets | null
): SketchClassForWidgets {
  const ref = useRef<SketchClassForWidgets | null>(sketchClass);
  const prevKey = useRef<string>("");

  if (!sketchClass) {
    // Return existing value if available, otherwise throw
    if (ref.current) {
      return ref.current;
    }
    throw new Error("sketchClass is required but not available in context");
  }

  // Key based on id and geometry type - these rarely change
  const key = `${sketchClass.id}:${sketchClass.geometryType}`;
  if (key !== prevKey.current) {
    prevKey.current = key;
    ref.current = sketchClass;
  }

  return ref.current!;
}
