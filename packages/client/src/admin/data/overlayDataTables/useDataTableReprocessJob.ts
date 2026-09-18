import { useCallback, useContext, useEffect, useRef } from "react";
import {
  JobDetailsFragment,
  ProjectBackgroundJobState,
} from "../../../generated/graphql";
import { ProjectBackgroundJobContext } from "../../uploads/ProjectBackgroundJobContext";

export function useTrackOverlayDataTableJob() {
  const { manager } = useContext(ProjectBackgroundJobContext);
  return useCallback(
    (tableOfContentsItemId: number, job?: JobDetailsFragment | null) => {
      if (!manager || !job) {
        return;
      }
      manager.trackOverlayDataTableJob(tableOfContentsItemId, job);
    },
    [manager]
  );
}

/**
 * `reprocessing` is a local placeholder until the TOC job list includes the
 * new job. Once that job completes it is no longer "active", so this hook
 * clears the overlay instead of leaving "Starting…" up forever.
 */
export function useClearReprocessWhenJobSettles({
  job,
  reprocessing,
  saving,
  setReprocessing,
  onSettled,
}: {
  job?: Pick<JobDetailsFragment, "state">;
  reprocessing: boolean;
  saving: boolean;
  setReprocessing: (value: boolean) => void;
  onSettled?: () => void;
}) {
  const sawRunningJob = useRef(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    const running =
      job?.state === ProjectBackgroundJobState.Queued ||
      job?.state === ProjectBackgroundJobState.Running;
    if (running) {
      sawRunningJob.current = true;
      return;
    }
    if (!reprocessing || saving) {
      return;
    }
    const settled =
      job?.state === ProjectBackgroundJobState.Complete ||
      job?.state === ProjectBackgroundJobState.Failed ||
      (sawRunningJob.current && !job);
    if (!settled) {
      return;
    }
    sawRunningJob.current = false;
    setReprocessing(false);
    onSettledRef.current?.();
  }, [job, reprocessing, saving, setReprocessing]);
}
