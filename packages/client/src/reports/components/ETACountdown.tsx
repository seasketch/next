import { useEffect, useRef, useState } from "react";

interface ETACountdownProps {
  /** ETA as Date.getTime() */
  eta: number | null | undefined;
  done: boolean;
  minWaitToShow?: number;
  /** When true, display raw ETA without smoothing/hysteresis */
  showUnmodified?: boolean;
}

/**
 * Hysteresis approach:
 * - Compute target remaining seconds from incoming ETA.
 * - Maintain a smoothed remaining value.
 * - If target < smoothed  => snap DOWN immediately (users like finishing sooner).
 * - If target > smoothed  => allow it to increase only slowly, capped by a drift rate.
 *
 * Tuning tips:
 * - MAX_UPWARD_DRIFT_RATE = 0.25 means ETA can creep up by at most 0.25 seconds per real second.
 *   (The countdown slows to 0.75× speed at worst.) Increase to be more permissive, decrease to be calmer.
 * - For long jobs you can also switch to a % cap; see commented code below.
 */
const MAX_UPWARD_DRIFT_RATE = 0.25; // sec/sec when ETA worsens (upward drift cap)
const MAX_DOWNWARD_DRIFT_RATE = 3; // sec/sec when ETA improves (downward drift cap)
// const MAX_UPWARD_PERCENT_PER_MIN = 0.10; // 10% per minute cap, optional alternative

// Don't show the component at all unless it's going to take at least this long
// to complete
const MIN_WAIT_TO_SHOW = 1; // 1 second

export default function ETACountdown({
  eta,
  done,
  minWaitToShow = MIN_WAIT_TO_SHOW,
  showUnmodified = false,
}: ETACountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Holds the latest raw ETA and the smoothed "display remaining"
  const etaRef = useRef<number | null | undefined>(eta);
  const smoothedRemainingRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const [reachedMinWait, setReachedMinWait] = useState(false);

  useEffect(() => {
    etaRef.current = eta;

    // If ETA disappears, clear smoothed remaining too
    if (eta === null || eta === undefined) {
      smoothedRemainingRef.current = null;
      setSecondsRemaining(null);
    }
  }, [eta]);

  useEffect(() => {
    if (done) {
      return;
    }
    const intervalRef = setInterval(() => {
      const now = Date.now();
      const dt = Math.max(0, (now - lastTickRef.current) / 1000); // seconds since last update
      lastTickRef.current = now;

      const currentEta = etaRef.current;
      if (currentEta === null || currentEta === undefined) {
        smoothedRemainingRef.current = null;
        setSecondsRemaining(null);
        return;
      }

      // Compute target remaining seconds from the raw ETA
      const rawRemaining = (currentEta - now) / 1000;
      const targetRemaining = Math.max(0, rawRemaining); // floor at 0

      if (showUnmodified) {
        // Show raw ETA, allow jumping up or down with no smoothing
        setSecondsRemaining(Math.round(targetRemaining));
        return;
      }

      // Initialize on first tick (smoothed mode)
      if (smoothedRemainingRef.current === null) {
        smoothedRemainingRef.current = targetRemaining;
        setSecondsRemaining(Math.round(targetRemaining));
        return;
      }

      const smoothed = smoothedRemainingRef.current;

      // Apply directional hysteresis (smoothed mode)
      let next = smoothed;
      if (targetRemaining < smoothed) {
        const allowedDecrease = MAX_DOWNWARD_DRIFT_RATE * dt;
        next = Math.max(targetRemaining, smoothed - allowedDecrease);
      } else if (targetRemaining > smoothed) {
        const allowedIncrease = MAX_UPWARD_DRIFT_RATE * dt;
        next = Math.min(targetRemaining, smoothed + allowedIncrease);
      }

      smoothedRemainingRef.current = next;
      setSecondsRemaining(Math.round(next));
    }, 250);

    return () => clearInterval(intervalRef);
  }, [done, showUnmodified]);

  useEffect(() => {
    if (
      secondsRemaining !== null &&
      secondsRemaining > minWaitToShow &&
      !reachedMinWait
    ) {
      setReachedMinWait(true);
    }
  }, [secondsRemaining, reachedMinWait, minWaitToShow]);

  const show = !done && secondsRemaining !== null && reachedMinWait;

  return (
    <span
      className={`pointer-events-none italic ml-2 text-xs text-gray-400 whitespace-nowrap tabular-nums ${
        show ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
      } transition-opacity duration-500`}
    >
      {formatTimeRemaining(secondsRemaining || 0)}
    </span>
  );
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) {
    return "0:00";
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
