import { useEffect, useMemo, useRef, useState } from "react";

import { motion } from "framer-motion";
import {
  CompatibleSpatialMetric,
  SourceProcessingJob,
  SpatialMetricState,
} from "../../generated/graphql";
import CircularProgressIndicator from "./CircularProgressIndicator";
import ETACountdown from "./ETACountdown";
import { useTranslation } from "react-i18next";
const LOADING_INDICATOR_DELAY_MS = 2000;

type MinimalJob = {
  progress: number; // 0-100
  eta: Date | null;
  state: SpatialMetricState;
};

function toMinimalJobsFromSources(
  jobs: Pick<SourceProcessingJob, "state" | "progressPercentage" | "eta">[]
): MinimalJob[] {
  return jobs.map((j) => ({
    progress: Math.max(
      0,
      Math.min(
        100,
        typeof j.progressPercentage === "number" ? j.progressPercentage : 0
      )
    ),
    eta: j.eta ? new Date(j.eta as unknown as string) : null,
    state: j.state,
  }));
}

function toMinimalJobsFromMetrics(
  metrics: Pick<CompatibleSpatialMetric, "state" | "progress" | "eta">[]
): MinimalJob[] {
  return metrics.map((m) => ({
    progress: Math.max(
      0,
      Math.min(100, typeof m.progress === "number" ? (m.progress as number) : 0)
    ),
    eta: m.eta ? new Date(m.eta as unknown as string) : null,
    state: m.state,
  }));
}

function computeCombinedProgress(items: MinimalJob[]): {
  progressPercent: number | null; // null => indeterminate
  farthestEta: Date | null;
  thresholdMet: boolean;
  allComplete: boolean;
} {
  const N = items.length;
  if (N === 0) {
    return {
      progressPercent: null,
      farthestEta: null,
      thresholdMet: false,
      allComplete: true,
    };
  }

  const withEtaOrComplete = items.filter(
    (i) => i.eta !== null || i.state === SpatialMetricState.Complete
  ).length;
  const thresholdMet = withEtaOrComplete / N >= 0.75;

  const farthestEta =
    items
      .filter((i) => i.eta)
      .sort((a, b) => (a.eta!.getTime() > b.eta!.getTime() ? -1 : 1))[0]?.eta ||
    null;

  const started = items.filter((i) => i.progress > 0);
  const allComplete = items.every(
    (i) => i.state === SpatialMetricState.Complete
  );

  if (allComplete) {
    return {
      progressPercent: 100,
      farthestEta: null,
      thresholdMet,
      allComplete,
    };
  }

  if (!thresholdMet) {
    if (started.length === 0) {
      return {
        progressPercent: null,
        farthestEta: null,
        thresholdMet,
        allComplete,
      };
    }
    const minProgress = started.reduce(
      (min, i) => Math.min(min, i.progress),
      100
    );
    // Scale progress by fraction of jobs that have actually started
    // This prevents one early job from pinning the overall progress high
    // while others are still at 0%.
    const startedFraction = started.length / N;
    const scaledProgress = Math.floor(minProgress * startedFraction);
    return {
      progressPercent: scaledProgress,
      farthestEta: null,
      thresholdMet,
      allComplete,
    };
  }

  // Threshold met: show progress of job with farthest-out ETA if available
  if (farthestEta) {
    const farthestItem = items
      .filter((i) => i.eta)
      .sort((a, b) => (a.eta!.getTime() > b.eta!.getTime() ? -1 : 1))[0]!;
    return {
      progressPercent: farthestItem.progress,
      farthestEta,
      thresholdMet,
      allComplete,
    };
  }

  // Fallback if threshold met via completions but no ETAs available
  if (started.length === 0) {
    return {
      progressPercent: null,
      farthestEta: null,
      thresholdMet,
      allComplete,
    };
  }
  const minProgress = started.reduce(
    (min, i) => Math.min(min, i.progress),
    100
  );
  return {
    progressPercent: minProgress,
    farthestEta: null,
    thresholdMet,
    allComplete,
  };
}

export default function ReportCardLoadingIndicator({
  display,
  metrics,
  sourceProcessingJobs,
  className,
}: {
  display: boolean;
  metrics: Pick<CompatibleSpatialMetric, "id" | "state" | "progress" | "eta">[];
  sourceProcessingJobs?: Pick<
    SourceProcessingJob,
    "jobKey" | "state" | "progressPercentage" | "eta"
  >[];
  className?: string;
}) {
  const { t } = useTranslation("sketching");
  const sourceJobs = useMemo(
    () => toMinimalJobsFromSources(sourceProcessingJobs || []),
    [sourceProcessingJobs]
  );
  const metricJobs = useMemo(
    () => toMinimalJobsFromMetrics(metrics as any),
    [metrics]
  );

  // Source stage if any source job is not complete and exists
  const anySourceInProgress = sourceJobs.some(
    (j) =>
      j.state !== SpatialMetricState.Complete &&
      j.state !== SpatialMetricState.Error
  );

  const stage = anySourceInProgress ? "sources" : "metrics";

  const { progressPercent, farthestEta, thresholdMet } = useMemo(() => {
    return computeCombinedProgress(
      stage === "sources" ? sourceJobs : metricJobs
    );
  }, [stage, sourceJobs, metricJobs]);

  const isComplete =
    !anySourceInProgress && computeCombinedProgress(metricJobs).allComplete;

  // Enforce monotonic non-decreasing visual progress with phase-aware reset
  const prevPercentRef = useRef<number>(0);
  const lastPhaseRef = useRef<"sources" | "metrics" | "complete" | null>(null);

  const currentPhase: "sources" | "metrics" | "complete" = isComplete
    ? "complete"
    : stage === "sources"
      ? "sources"
      : "metrics";

  // Synchronous reset when switching phases to avoid a one-frame lag
  if (
    (lastPhaseRef.current &&
      lastPhaseRef.current !== currentPhase &&
      (currentPhase === "sources" || currentPhase === "metrics")) ||
    (lastPhaseRef.current === "complete" && currentPhase !== "complete")
  ) {
    prevPercentRef.current = 0;
  }
  lastPhaseRef.current = currentPhase;

  const targetPercent = isComplete
    ? 100
    : typeof progressPercent === "number"
      ? Math.max(0, Math.min(94, progressPercent))
      : prevPercentRef.current; // hold if unknown

  const nextPercent = Math.max(prevPercentRef.current, targetPercent);
  if (nextPercent !== prevPercentRef.current) {
    prevPercentRef.current = nextPercent;
  }

  let normalizedProgress: number | null;
  if (isComplete) {
    normalizedProgress = 1;
  } else if (prevPercentRef.current === 0 && progressPercent == null) {
    normalizedProgress = null; // indeterminate until we have some signal
  } else {
    normalizedProgress = Math.max(0, Math.min(1, prevPercentRef.current / 100));
  }

  const etaForCountdown =
    thresholdMet && farthestEta ? farthestEta.getTime() : null;

  // Only show the indicator after a short waiting period
  const [readyToShow, setReadyToShow] = useState(false);
  useEffect(() => {
    if (display && !isComplete) {
      if (farthestEta) {
        setReadyToShow(true);
      } else {
        const timeoutId = setTimeout(
          () => setReadyToShow(true),
          LOADING_INDICATOR_DELAY_MS
        );
        return () => {
          clearTimeout(timeoutId);
          setReadyToShow(false);
        };
      }
    } else {
      setReadyToShow(false);
    }
  }, [display, isComplete]);

  console.log('isComplete', isComplete, readyToShow);

  if (!display || (!isComplete && !readyToShow)) return null;

  return (
    <motion.div
      className={`inline-flex items-center space-x-2 ${className || ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={
        typeof progressPercent === "number"
          ? Math.round(progressPercent)
          : undefined
      }
      initial={{ opacity: 0 }}
      animate={{ opacity: isComplete ? 0 : 1 }}
      transition={
        isComplete
          ? { duration: 0.5, ease: "easeInOut" }
          : { duration: 1, ease: "easeInOut", delay: 0.6 }
      }
    >
      {stage === "metrics" && (
        <ETACountdown
          eta={etaForCountdown}
          done={isComplete}
          minWaitToShow={0}
          showUnmodified
        />
      )}
      {stage === "sources" && (
        <>
          <span className="text-xs text-gray-400 whitespace-nowrap italic">
            {t("optimizing sources")}
          </span>
          {etaForCountdown && (
            <ETACountdown
              eta={etaForCountdown}
              done={isComplete}
              showUnmodified
            />
          )}
        </>
      )}
      <CircularProgressIndicator
        progress={normalizedProgress}
        size={40}
        strokeWidth={4}
        className="w-4 h-4"
      />
    </motion.div>
  );
}
