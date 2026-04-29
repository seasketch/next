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
        .map((metricId) => context.metrics.find((m) => m.id === metricId))
        .filter((m): m is NonNullable<typeof m> => m != null);
      // After recalculate, DB rows are recreated with new ids; Apollo can briefly
      // keep stale normalized metrics while cardDependencyLists already references
      // new ids — treat unresolved ids as still loading so we don't show an empty card.
      // Ignore ids that are not in the latest slim server payload (stale card list
      // entries) or that were filtered out as unused by the current report doc.
      const pendingMetricIds = list.metrics.filter((metricId) => {
        const idStr = String(metricId);
        if (!context.slimMetricIdsFromServer.has(idStr)) {
          return false;
        }
        return !context.metrics.some((m) => String(m.id) === idStr);
      });
      const metricIdsPendingResolution = pendingMetricIds.length > 0;
      const overlaySources = list.overlaySources
        .map(
          (overlay) =>
            context.overlaySources.find((s) => s.stableId === overlay)!
        )
        .filter((s) => s !== undefined);
      const overlaySourceIdsPendingResolution =
        list.overlaySources.length > 0 &&
        overlaySources.length < list.overlaySources.length;

      // Once a card has dependency ids, keep loading scoped to that card.
      // Global query loading also includes background refetches, which should
      // not make unrelated cards show a loading state — except when dependency
      // cache was evicted and we're awaiting a fresh dependencies payload.
      const loading =
        context.dependenciesAwaitingRefresh ||
        metricIdsPendingResolution ||
        overlaySourceIdsPendingResolution ||
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
      if (context.error) {
        errors["Dependency retrieval error: " + context.error.message] = 1;
      }

      return {
        metrics,
        overlaySources,
        loading,
        errors,
      };
    } else {
      const errors: { [errorMessage: string]: number } = {};
      if (context.error) {
        errors["Dependency retrieval error: " + context.error.message] = 1;
      }

      return {
        metrics: [],
        overlaySources: [],
        loading: context.loading,
        errors: errors,
      };
    }
  }, [
    context.cardDependencyLists,
    context.dependenciesAwaitingRefresh,
    context.loading,
    context.metrics,
    context.overlaySources,
    context.slimMetricIdsFromServer,
    cardId,
    context.error,
  ]);

  return dependencies;
}
