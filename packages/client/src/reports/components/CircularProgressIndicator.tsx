import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface CircularProgressIndicatorProps {
  /**
   * Progress value from 0 to 1, or null for indeterminate (spinning) state
   */
  progress: number | null;
  /**
   * Size of the SVG in pixels
   */
  size?: number;
  /**
   * Width of the progress stroke
   */
  strokeWidth?: number;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Color of the track (background circle)
   */
  trackColor?: string;
  /**
   * Color of the progress indicator
   */
  progressColor?: string;
  /**
   * Color of the pulsing inner circle
   */
  pulseColor?: string;
}

export default function CircularProgressIndicator({
  progress,
  size = 40,
  strokeWidth = 4,
  className = "",
  trackColor = "rgba(0,0,0,0.05)",
  progressColor = "rgba(0,0,0,0.15)",
  pulseColor = "rgba(0,0,0,0.12)",
}: CircularProgressIndicatorProps) {
  const prevProgressRef = useRef<number | null>(null);

  // Detect restart: when progress goes from 1 (or near 1) back to low value
  const isRestarting =
    prevProgressRef.current !== null &&
    prevProgressRef.current >= 0.9 &&
    progress !== null &&
    progress < 0.1;

  useEffect(() => {
    prevProgressRef.current = progress;
  }, [progress]);

  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  const isComplete = progress !== null && progress >= 1;
  const isIndeterminate = progress === null;

  // Calculate dash offset for determinate progress
  const dashOffset = progress !== null ? circumference * (1 - progress) : 0;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`-rotate-90 ${className} z-40`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />

      {/* Progress - single element that adapts to indeterminate vs determinate */}
      <motion.circle
        key="progress-circle"
        cx={center}
        cy={center}
        r={radius}
        stroke={"rgba(25,0,255,0.15)"} //progressColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap={isIndeterminate ? "round" : "butt"}
        strokeDasharray={circumference}
        initial={{
          strokeDashoffset: circumference,
          rotate: 0,
        }}
        animate={
          isIndeterminate
            ? {
                rotate: 360,
                strokeDashoffset: circumference * 0.75,
              }
            : {
                strokeDashoffset: isRestarting ? circumference : dashOffset,
                rotate: 0,
              }
        }
        transition={
          isIndeterminate
            ? {
                rotate: {
                  duration: 1.5,
                  ease: "linear",
                  repeat: Infinity,
                },
                strokeDashoffset: { duration: 0.3 },
              }
            : isRestarting
            ? { duration: 0 }
            : { duration: 0.4, ease: "easeInOut" }
        }
        style={{ originX: "50%", originY: "50%" }}
      />

      {/* Inner pulse circle */}
      <motion.circle
        cx={center}
        cy={center}
        r={radius * 0.35}
        fill={pulseColor}
        initial={{ opacity: isComplete || isIndeterminate ? 0 : 1 }}
        animate={
          isComplete || isIndeterminate
            ? { opacity: 0, r: radius * 0.35 }
            : {
                opacity: [0.5, 0.3, 0.5],
                r: [radius * 0.6, radius * 0.15, radius * 0.6],
              }
        }
        transition={
          isComplete || isIndeterminate
            ? { duration: 0.2 }
            : { duration: 1.6, ease: "easeInOut", repeat: Infinity }
        }
      />
    </motion.svg>
  );
}
