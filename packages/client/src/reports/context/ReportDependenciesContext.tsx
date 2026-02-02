import { createContext, useContext, useEffect, useMemo } from "react";
import {
  CardDependencyLists,
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
  useReportDependenciesQuery,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

export const ReportDependenciesContext = createContext<{
  metrics: CompatibleSpatialMetricDetailsFragment[];
  overlaySources: OverlaySourceDetailsFragment[];
  cardDependencyLists: CardDependencyLists[];
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

export function useCardDependencies(cardId: number): CardDependenciesResult {
  const context = useContext(ReportDependenciesContext);
  const dependencies = useMemo(() => {
    const list = context.cardDependencyLists.find(
      (list) => list.cardId === cardId
    );
    if (list) {
      const metrics = list.metrics
        .map((metric) => context.metrics.find((m) => m.id === metric)!)
        .filter((m) => m !== undefined);
      const overlaySources = list.overlaySources
        .map(
          (overlay) =>
            context.overlaySources.find(
              (s) => s.tableOfContentsItemId === overlay
            )!
        )
        .filter((s) => s !== undefined);

      // Compute loading state
      const loading =
        metrics.some(
          (metric) =>
            metric.state !== SpatialMetricState.Complete &&
            metric.state !== SpatialMetricState.Error
        ) ||
        overlaySources.some(
          (source) =>
            source.sourceProcessingJob?.state !== SpatialMetricState.Complete &&
            source.sourceProcessingJob?.state !== SpatialMetricState.Error
        );

      // Compute errors
      const errors: { [errorMessage: string]: number } = {};
      for (const metric of metrics) {
        if (metric.state === SpatialMetricState.Error) {
          const errorMessage = metric.errorMessage || "Unknown error";
          errors[errorMessage] = (errors[errorMessage] || 0) + 1;
        }
      }
      for (const source of overlaySources) {
        if (source.sourceProcessingJob?.state === SpatialMetricState.Error) {
          const errorMessage =
            source.sourceProcessingJob?.errorMessage || "Unknown error";
          errors[errorMessage] = (errors[errorMessage] || 0) + 1;
        }
      }

      return {
        metrics,
        overlaySources,
        loading,
        errors,
      };
    } else {
      return {
        metrics: [],
        overlaySources: [],
        loading: context.loading,
        errors: {},
      };
    }
  }, [
    context.cardDependencyLists,
    context.loading,
    context.metrics,
    context.overlaySources,
    cardId,
  ]);
  return dependencies;
}

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
    return {
      metrics: data?.report?.dependencies?.metrics || [],
      overlaySources: data?.report?.dependencies?.overlaySources || [],
      cardDependencyLists:
        data?.report?.dependencies?.cardDependencyLists || [],
      loading: loading,
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
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data, loading, refetch, value.metrics, value.overlaySources]);

  return (
    <ReportDependenciesContext.Provider value={value}>
      {children}
    </ReportDependenciesContext.Provider>
  );
}
