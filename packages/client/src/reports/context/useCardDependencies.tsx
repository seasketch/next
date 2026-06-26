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
      (list) => list.cardId === cardId,
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
            context.overlaySources.find((s) => s.stableId === overlay)!,
        )
        .filter((s) => s !== undefined);

      const resolutionForThisCard = context.dependencyResolutionErrors.filter(
        (e) => e.affectedCardIds.includes(cardId),
      );

      const missingStableOverlayIds = list.overlaySources.filter(
        (sid) => !context.overlaySources.some((s) => s.stableId === sid),
      );
      const explainedMissingOverlayIds = missingStableOverlayIds.filter((sid) =>
        resolutionForThisCard.some((e) => e.stableId === sid),
      );
      const unresolvedMissingOverlays =
        missingStableOverlayIds.length - explainedMissingOverlayIds.length;
      const overlaySourceIdsPendingResolution = unresolvedMissingOverlays > 0;

      const dependencyResolutionFailuresByHash: {
        [dependencyHash: string]: string;
      } = {};
      for (const e of resolutionForThisCard) {
        dependencyResolutionFailuresByHash[e.dependencyHash] = e.message;
      }

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
            metric.state !== SpatialMetricState.Error,
        ) ||
        overlaySources.some((source) => {
          const jobState = source.sourceProcessingJob?.state;
          if (jobState === SpatialMetricState.Complete) return false;
          if (jobState === SpatialMetricState.Error) return false;
          if (
            jobState === SpatialMetricState.Queued ||
            jobState === SpatialMetricState.Processing
          ) {
            return true;
          }
          // No job / unknown state: settled only when output exists (same idea as ReportTaskLineItem).
          return !source.output?.url;
        });

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
      for (const msg of Object.values(dependencyResolutionFailuresByHash)) {
        errors[msg] = (errors[msg] || 0) + 1;
      }

      const globalErrors: string[] = [];
      if (context.error) {
        const globalErrorMessage =
          "Dependency retrieval error: " + context.error.message;
        globalErrors.push(globalErrorMessage);
        errors[globalErrorMessage] = 1;
      }

      return {
        metrics,
        overlaySources,
        loading,
        errors,
        globalErrors,
        dependenciesAwaitingRefresh: context.dependenciesAwaitingRefresh,
        dependencyResolutionFailuresByHash,
      };
    } else {
      const errors: { [errorMessage: string]: number } = {};
      const globalErrors: string[] = [];
      if (context.error) {
        const globalErrorMessage =
          "Dependency retrieval error: " + context.error.message;
        globalErrors.push(globalErrorMessage);
        errors[globalErrorMessage] = 1;
      }

      return {
        metrics: [],
        overlaySources: [],
        loading: context.loading,
        errors: errors,
        globalErrors,
        dependenciesAwaitingRefresh: context.dependenciesAwaitingRefresh,
        dependencyResolutionFailuresByHash: {},
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
    context.dependencyResolutionErrors,
  ]);

  return dependencies;
}
