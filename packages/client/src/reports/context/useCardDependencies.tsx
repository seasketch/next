import { useContext, useMemo } from "react";
import { SpatialMetricState } from "../../generated/graphql";
import {
  CardDependenciesResult,
  ReportDependenciesContext,
} from "./ReportDependenciesContext";

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
