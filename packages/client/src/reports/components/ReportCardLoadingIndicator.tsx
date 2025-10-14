import { useEffect, useMemo, useRef } from "react";
import { LocalMetric } from "../ReportContext";
import { motion } from "framer-motion";
import { SpatialMetricState } from "../../generated/graphql";

export default function ReportCardLoadingIndicator({
  display,
  metrics,
  className,
}: {
  display: boolean;
  metrics: Pick<LocalMetric, "id" | "state" | "progress">[];
  className?: string;
}) {
  const prevOutRef = useRef(0); // store previous output percent [0,100]
  const lastPhaseRef = useRef<"incomplete" | "complete" | undefined>(undefined);

  const metricPhase: "incomplete" | "complete" = useMemo(() => {
    const hasIncomplete = metrics.find(
      (m) => m.state !== SpatialMetricState.Complete
    );
    return hasIncomplete ? "incomplete" : "complete";
  }, [metrics]);

  // Reset smoothing when we go from a completed state back to in-progress (restarts)
  useEffect(() => {
    if (lastPhaseRef.current === "complete" && metricPhase === "incomplete") {
      prevOutRef.current = 0;
    }
    lastPhaseRef.current = metricPhase;
  }, [metricPhase]);

  const progress = useMemo(() => {
    const N = metrics.length;
    if (N === 0) {
      return prevOutRef.current;
    }

    if (metricPhase === "complete") {
      prevOutRef.current = 100;
      return 100;
    }

    // Normalize to [0,1]
    const ps = metrics.map((m) => {
      const p = typeof m.progress === "number" ? (m.progress as number) : 0;
      return Math.max(0, Math.min(100, p)) / 100;
    });

    const started = ps.filter((p) => p > 0).length;
    const c = started / N;

    // Weighted blend factor: early -> mean, late -> soft-min
    const w = Math.min(1, Math.pow(c, 2.5));

    // Mean with epsilon for unstarted jobs
    const eps = 0.02;
    const psEps = ps.map((p) => (p > 0 ? p : eps));
    const meanEps = psEps.reduce((a, b) => a + b, 0) / N;

    // Soft-min via log-sum-exp
    const betaLow = 1;
    const betaHigh = 12;
    const beta = betaLow + (betaHigh - betaLow) * w;
    const lse = psEps.reduce((s, p) => s + Math.exp(-beta * p), 0) / N;
    const softMin = -Math.log(lse) / beta;

    const blended = (1 - w) * meanEps + w * softMin;

    // EWMA smoothing with monotonic non-decreasing constraint
    const alpha = 0.3;
    const prevNorm = Math.max(0, Math.min(1, prevOutRef.current / 100));
    const ewma = alpha * blended + (1 - alpha) * prevNorm;
    let outNorm = Math.max(prevNorm, ewma);

    // Cap at 90% until overall complete
    outNorm = Math.min(outNorm, 1);

    const outPercent = Math.max(0, Math.min(100, outNorm * 100));
    prevOutRef.current = outPercent;
    return outPercent;
  }, [metrics, metricPhase]);

  if (!display) return null;

  const size = 40; // px
  const strokeWidth = 4; // px
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const isComplete = metricPhase === "complete";
  // Show accurate number, but visually limit ring to 90% unless complete
  const visualProgress = isComplete ? 100 : Math.min(progress, 94);
  const dashOffset = circumference * (1 - visualProgress / 100);
  const restarting =
    lastPhaseRef.current === "complete" && metricPhase === "incomplete";

  return (
    <motion.div
      className={`inline-flex items-center space-x-1 ${className || ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      initial={{ opacity: 0 }}
      animate={{ opacity: isComplete ? 0 : 1 }}
      transition={
        isComplete
          ? { duration: 0.5, ease: "easeInOut" }
          : { duration: 1, ease: "easeInOut", delay: 1.5 }
      }
    >
      <span className="text-[10px] font-medium text-gray-400">
        {Math.round(progress)}%
      </span>
      <motion.svg
        width={16}
        height={16}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(0,0,0,0.05)" /* gray track */
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: restarting ? circumference : dashOffset,
          }}
          transition={
            restarting ? { duration: 0 } : { duration: 0.4, ease: "easeInOut" }
          }
        />
        {/* Inner pulse circle */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius * 0.35}
          fill="rgba(0,0,0,0.12)"
          initial={{ opacity: isComplete ? 0 : 1 }}
          animate={
            isComplete
              ? { opacity: 0, r: radius * 0.35 }
              : {
                  opacity: [0.5, 0.3, 0.5],
                  r: [radius * 0.6, radius * 0.15, radius * 0.6],
                }
          }
          transition={
            isComplete
              ? { duration: 0.2 }
              : { duration: 1.6, ease: "easeInOut", repeat: Infinity }
          }
        />
      </motion.svg>
    </motion.div>
  );
}
