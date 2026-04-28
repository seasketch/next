import { createContext, useEffect, useMemo } from "react";
import {
  CardDependencyLists,
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
  useReportDependenciesQuery,
  useReportOverlaySourcesQuery,
} from "../../generated/graphql";
import { subjectIsFragment } from "overlay-engine";
import { ApolloError, NetworkStatus } from "@apollo/client";

export const ReportDependenciesContext = createContext<{
  metrics: CompatibleSpatialMetricDetailsFragment[];
  overlaySources: OverlaySourceDetailsFragment[];
  cardDependencyLists: CardDependencyLists[];
  fragmentCalculationsRuntime?: number;
  loading: boolean;
  error?: ApolloError;
}>({
  metrics: [],
  overlaySources: [],
  cardDependencyLists: [],
  loading: true,
});

export type CardDependenciesResult = {
  metrics: CompatibleSpatialMetricDetailsFragment[];
  overlaySources: OverlaySourceDetailsFragment[];
  loading: boolean;
  errors: { [errorMessage: string]: number };
};

export default function ReportDependenciesContextProvider({
  children,
  sketchId,
  reportId,
}: {
  children: React.ReactNode;
  sketchId?: number;
  reportId?: number;
}) {
  const {
    data: depsData,
    loading: depsLoading,
    refetch: refetchDeps,
    error: depsError,
    networkStatus: depsNetworkStatus,
  } =
    useReportDependenciesQuery({
      variables: {
        reportId: reportId!,
        sketchId: sketchId!,
      },
      skip: !reportId || !sketchId,
      // notifyOnNetworkStatusChange: true,
    });

  // Apollo's `loading` is false during refetches; after cache eviction the
  // query refetches while still returning stale dependency data unless we treat
  // refetch / variable changes as loading for the report shell.
  const dependenciesQueryLoading =
    depsLoading ||
    depsNetworkStatus === NetworkStatus.refetch ||
    depsNetworkStatus === NetworkStatus.setVariables;

  const {
    data: overlayData,
    loading: overlayLoading,
    refetch: refetchOverlaySources,
    error: overlayError,
    networkStatus: overlayNetworkStatus,
  } = useReportOverlaySourcesQuery({
    variables: {
      reportId: reportId!,
    },
    skip: !reportId,
  });

  const overlaySourcesQueryLoading =
    overlayLoading ||
    overlayNetworkStatus === NetworkStatus.refetch ||
    overlayNetworkStatus === NetworkStatus.setVariables;

  const contextValue = useMemo(() => {
    let fragmentCalculationsRuntime: number | undefined = undefined;
    if (!dependenciesQueryLoading) {
      fragmentCalculationsRuntime = 0;
      for (const metric of depsData?.report?.dependencies?.metrics || []) {
        if (
          metric.state === SpatialMetricState.Complete &&
          subjectIsFragment(metric.subject) &&
          metric.durationSeconds
        ) {
          fragmentCalculationsRuntime += metric.durationSeconds * 1000;
        }
      }
    }
    return {
      metrics: depsData?.report?.dependencies?.metrics || [],
      overlaySources: overlayData?.report?.overlaySources || [],
      cardDependencyLists:
        depsData?.report?.dependencies?.cardDependencyLists || [],
      loading: dependenciesQueryLoading || overlaySourcesQueryLoading,
      fragmentCalculationsRuntime,
      error: depsError || overlayError,
    };
  }, [
    depsData,
    overlayData,
    dependenciesQueryLoading,
    overlaySourcesQueryLoading,
    depsError,
    overlayError,
  ]);

  useEffect(() => {
    if (contextValue.loading) {
      return;
    }
    const anyMetricsLoading = contextValue.metrics.some(
      (metric) =>
        metric.state !== SpatialMetricState.Complete &&
        metric.state !== SpatialMetricState.Error
    );
    const anyOverlaySourcesLoading = contextValue.overlaySources.some(
      (source) =>
        source.sourceProcessingJob &&
        source.sourceProcessingJob.state !== SpatialMetricState.Complete &&
        source.sourceProcessingJob.state !== SpatialMetricState.Error
    );

    let metricInterval: ReturnType<typeof setInterval> | null = null;
    let overlayInterval: ReturnType<typeof setInterval> | null = null;

    if (anyMetricsLoading) {
      metricInterval = setInterval(() => {
        refetchDeps();
      }, 1000);
    }

    if (anyOverlaySourcesLoading) {
      overlayInterval = setInterval(() => {
        refetchOverlaySources();
      }, 1000);
    }

    return () => {
      if (metricInterval) clearInterval(metricInterval);
      if (overlayInterval) clearInterval(overlayInterval);
    };
  }, [
    depsData,
    overlayData,
    refetchDeps,
    refetchOverlaySources,
    contextValue.metrics,
    contextValue.overlaySources,
    contextValue.loading,
  ]);

  return (
    <ReportDependenciesContext.Provider value={contextValue}>
      {children}
    </ReportDependenciesContext.Provider>
  );
}
