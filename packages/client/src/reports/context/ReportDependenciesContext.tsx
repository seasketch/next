import { createContext, useEffect, useMemo } from "react";
import {
  CardDependencyLists,
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
  useReportDependenciesQuery,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";

export const ReportDependenciesContext = createContext<{
  metrics: CompatibleSpatialMetricDetailsFragment[];
  overlaySources: OverlaySourceDetailsFragment[];
  cardDependencyLists: CardDependencyLists[];
  fragmentCalculationsRuntime?: number;
  loading: boolean;
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
  const onError = useGlobalErrorHandler();
  const { data, loading, refetch } = useReportDependenciesQuery({
    variables: {
      reportId: reportId!,
      sketchId: sketchId!,
    },
    onError,
    skip: !reportId || !sketchId,
  });
  const value = useMemo(() => {
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
    };
  }, [data, loading]);

  useEffect(() => {
    if (loading) {
      return;
    }
    const anyMetricsLoading = value.metrics.some(
      (metric) =>
        metric.state !== SpatialMetricState.Complete &&
        metric.state !== SpatialMetricState.Error
    );
    const anyOverlaySourcesLoading = value.overlaySources.some(
      (source) =>
        source.sourceProcessingJob?.state !== SpatialMetricState.Complete &&
        source.sourceProcessingJob?.state !== SpatialMetricState.Error
    );
    if (anyMetricsLoading || anyOverlaySourcesLoading) {
      const interval = setInterval(() => {
        refetch();
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [data, loading, refetch, value.metrics, value.overlaySources]);

  return (
    <ReportDependenciesContext.Provider value={value}>
      {children}
    </ReportDependenciesContext.Provider>
  );
}
