import { createContext, useEffect, useMemo, useRef, useState } from "react";
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

  // State for sources missing processing jobs for 5+ seconds
  const [missingJobSourceIds, setMissingJobSourceIds] = useState<Set<string>>(
    new Set()
  );
  const missingJobTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rawValue = useMemo(() => {
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

  // Augmented value for context - inject dummy processing jobs with error
  // state for sources that have been missing their processing job for 5+ sec
  const contextValue = useMemo(() => {
    if (missingJobSourceIds.size === 0) return rawValue;

    const augmentedSources = rawValue.overlaySources.map((source) => {
      if (
        source.stableId &&
        missingJobSourceIds.has(source.stableId) &&
        !source.sourceProcessingJob
      ) {
        /* eslint-disable i18next/no-literal-string */
        return {
          ...source,
          sourceProcessingJob: {
            __typename: "SourceProcessingJob" as const,
            jobKey: `missing-${source.stableId}`,
            state: SpatialMetricState.Error,
            progressPercentage: 0,
            progressMessage: null,
            createdAt: new Date().toISOString(),
            errorMessage: `Source processing job not found for overlay "${
              source.tableOfContentsItem?.title || source.stableId
            }". The layer may need to be republished.`,
            startedAt: null,
            durationSeconds: null,
            eta: null,
          },
        };
        /* eslint-enable i18next/no-literal-string */
      }
      return source;
    });

    return { ...rawValue, overlaySources: augmentedSources };
  }, [rawValue, missingJobSourceIds]);

  useEffect(() => {
    if (loading) {
      return;
    }
    // Use rawValue (not contextValue) so augmented dummy jobs don't
    // interfere with the missing-job detection logic.
    const anyMetricsLoading = rawValue.metrics.some(
      (metric) =>
        metric.state !== SpatialMetricState.Complete &&
        metric.state !== SpatialMetricState.Error
    );
    // Only count sources that HAVE a processing job in a non-terminal state.
    // Sources with no processing job at all are handled separately below.
    const anyOverlaySourcesLoading = rawValue.overlaySources.some(
      (source) =>
        source.sourceProcessingJob &&
        source.sourceProcessingJob.state !== SpatialMetricState.Complete &&
        source.sourceProcessingJob.state !== SpatialMetricState.Error
    );
    const overlaysMissingProcessingJobs = rawValue.overlaySources.filter(
      (source) => !source.sourceProcessingJob
    );

    // Track how long sources are missing their processing job.
    // If missing for 5+ seconds, inject a dummy error processing job so the
    // widget displays the error through its normal error-handling path.
    if (overlaysMissingProcessingJobs.length > 0) {
      if (!missingJobTimerRef.current && missingJobSourceIds.size === 0) {
        missingJobTimerRef.current = setTimeout(() => {
          setMissingJobSourceIds(
            new Set(
              overlaysMissingProcessingJobs
                .map((s) => s.stableId)
                .filter(Boolean) as string[]
            )
          );
          missingJobTimerRef.current = null;
        }, 5000);
      }
    } else {
      if (missingJobTimerRef.current) {
        clearTimeout(missingJobTimerRef.current);
        missingJobTimerRef.current = null;
      }
      if (missingJobSourceIds.size > 0) {
        setMissingJobSourceIds(new Set());
      }
    }

    // Also poll during the grace period for missing processing jobs
    // (they may still appear). Once the error is set, stop polling for them.
    const shouldPollForMissingJobs =
      overlaysMissingProcessingJobs.length > 0 &&
      missingJobSourceIds.size === 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    if (
      anyMetricsLoading ||
      anyOverlaySourcesLoading ||
      shouldPollForMissingJobs
    ) {
      interval = setInterval(() => {
        refetch();
      }, 600);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (missingJobTimerRef.current) {
        clearTimeout(missingJobTimerRef.current);
        missingJobTimerRef.current = null;
      }
    };
  }, [
    data,
    loading,
    refetch,
    rawValue.metrics,
    rawValue.overlaySources,
    missingJobSourceIds,
  ]);

  return (
    <ReportDependenciesContext.Provider value={contextValue}>
      {children}
    </ReportDependenciesContext.Provider>
  );
}
