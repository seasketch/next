import { useContext, useMemo } from "react";
import { MetricDependency } from "overlay-engine";
import {
  OverlaySourceDetailsFragment,
  useProjectReportingLayersQuery,
} from "../../generated/graphql";
import { DraftReportContext } from "../DraftReportContext";
import getSlug from "../../getSlug";

/**
 * Hook that returns overlay sources for use in tooltip controls.
 * This replaces the pattern of accessing reportContext.overlaySources and
 * reportContext.preprocessedOverlaySources.
 */
export function useOverlaySources(dependencies?: MetricDependency[]): {
  allSources: OverlaySourceDetailsFragment[];
  filteredSources: OverlaySourceDetailsFragment[];
  loading: boolean;
} {
  const draftContext = useContext(DraftReportContext);
  const { data: reportingLayersData, loading } = useProjectReportingLayersQuery(
    {
      variables: { slug: getSlug() },
    }
  );

  const allSources = useMemo(() => {
    const reportingLayers =
      reportingLayersData?.projectBySlug?.reportingLayers || [];
    return [...reportingLayers, ...draftContext.draftOverlaySources];
  }, [
    reportingLayersData?.projectBySlug?.reportingLayers,
    draftContext.draftOverlaySources,
  ]);

  const filteredSources = useMemo(() => {
    if (!dependencies || dependencies.length === 0) {
      return [];
    }
    return allSources.filter((s) =>
      dependencies.some((d) => d.stableId === s.stableId)
    );
  }, [allSources, dependencies]);

  return {
    allSources,
    filteredSources,
    loading,
  };
}

/**
 * Hook that returns a single overlay source that matches any of the given dependencies.
 * Useful for tooltip controls that need to display information about a related layer.
 */
export function useRelatedOverlay(
  dependencies?: MetricDependency[]
): OverlaySourceDetailsFragment | null {
  const { allSources } = useOverlaySources();

  return useMemo(() => {
    if (!dependencies || dependencies.length === 0) {
      return null;
    }
    for (const dependency of dependencies) {
      if (dependency.stableId) {
        const source = allSources.find(
          (s) => s.stableId === dependency.stableId
        );
        if (source) {
          return source;
        }
      }
    }
    return null;
  }, [dependencies, allSources]);
}
