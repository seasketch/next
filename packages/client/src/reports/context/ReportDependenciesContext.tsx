import { createContext, useEffect, useMemo } from "react";
import {
  CardDependencyLists,
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
  useReportDependenciesQuery,
} from "../../generated/graphql";
import { subjectIsFragment } from "overlay-engine";
import { ApolloError } from "@apollo/client";

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
  const { data, loading, refetch, error } = useReportDependenciesQuery({
    variables: {
      reportId: reportId!,
      sketchId: sketchId!,
    },
    skip: !reportId || !sketchId,
  });

  const contextValue = useMemo(() => {
    let fragmentCalculationsRuntime: number | undefined = undefined;
    if (!loading) {
      fragmentCalculationsRuntime = 0;
      for (const metric of data?.report?.dependencies?.metrics || []) {
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
      metrics: data?.report?.dependencies?.metrics || [],
      overlaySources: data?.report?.dependencies?.overlaySources || [],
      cardDependencyLists:
        data?.report?.dependencies?.cardDependencyLists || [],
      loading: loading,
      fragmentCalculationsRuntime,
      error,
    };
  }, [data, loading, error]);

  useEffect(() => {
    if (loading) {
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

    let interval: ReturnType<typeof setInterval> | null = null;
    if (anyMetricsLoading || anyOverlaySourcesLoading) {
      interval = setInterval(() => {
        refetch();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    data,
    loading,
    refetch,
    contextValue.metrics,
    contextValue.overlaySources,
  ]);

  return (
    <ReportDependenciesContext.Provider value={contextValue}>
      {children}
    </ReportDependenciesContext.Provider>
  );
}
