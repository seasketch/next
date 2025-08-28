import { useTranslation, Trans } from "react-i18next";
import { useReportContext } from "../../reports/ReportContext";
import { Geography, SpatialMetricState } from "../../generated/graphql";
import {
  subjectIsFragment,
  subjectIsGeography,
} from "overlay-engine/dist/metrics/metrics";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

// Typing animation component
function TypingText({ text, className }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Reset animation when text changes
    setDisplayText("");
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 20); // Adjust speed here (lower = faster)

      return () => clearTimeout(timer);
    }
  }, [currentIndex, text]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity }}
        className="inline-block w-0.5 h-4 ml-0.5 -mb-0.5 bg-indigo-500"
      />
    </motion.span>
  );
}

export default function GeographyMetricsProgressIndicator() {
  const { t } = useTranslation("admin:sketching");

  const { report, metrics, geographies } = useReportContext();

  const inProgress = metrics.filter(
    (m) =>
      subjectIsGeography(m.subject) &&
      (m.state === SpatialMetricState.Processing ||
        m.state === SpatialMetricState.Queued)
  );

  const [recentProcessingCount, setRecentProcessingCount] = useState(0);

  useEffect(() => {
    if (inProgress.length === 0) {
      setRecentProcessingCount(0);
    } else {
      if (inProgress.length > recentProcessingCount) {
        setRecentProcessingCount(inProgress.length);
      }
    }
  }, [inProgress, recentProcessingCount]);

  return (
    <AnimatePresence>
      {inProgress.length > 0 && (
        <motion.div
          className="absolute bottom-0 right-0 p-4 text-right text-sm mb-6 -z-10 opacity-75 transition-opacity"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          exit={{ y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            height: `${recentProcessingCount * 25 + 20}px`,
            maxHeight: "90%",
          }}
        >
          <h4 className="font-medium">
            <Trans ns="admin:sketching">
              {inProgress.length.toString()} geography metrics being calculated
            </Trans>
          </h4>
          <div className="space-y-1 text-indigo-900">
            <AnimatePresence>
              {inProgress.map((m) => (
                <motion.div
                  key={m.id}
                  className="relative flex items-center space-x-1 text-right justify-end h-5 rounded overflow-hidden"
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 200 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <h3 className="relative px-1">
                    <div
                      className="absolute left-0 origin-left w-full bg-indigo-500 h-[1.5px] bottom-0 transition-transform duration-100"
                      style={{
                        transform: `scaleX(${(m.progress || 0) / 100})`,
                      }}
                    ></div>
                    <div
                      className="absolute left-0 origin-left w-full bg-indigo-500/5 h-full bottom-0 transition-transform duration-100"
                      style={{
                        transform: `scaleX(${(m.progress || 0) / 100})`,
                      }}
                    ></div>
                    <span className="relative">{`${labelForState(m.state)} ${
                      "id" in m.subject
                        ? nameForGeography(m.subject, geographies)
                        : "..."
                    }`}</span>
                  </h3>
                  <NumberFlow
                    value={(m.progress || 0) / 100}
                    format={{ style: "percent" }}
                  />
                  {/* <div className="absolute left-0 w-1/2 bg-indigo-500 h-0.5 bottom-0"></div> */}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function nameForGeography(
  subject: {
    type: "geography";
    id: number;
  },
  geographies: Pick<Geography, "id" | "name">[]
) {
  if (subjectIsFragment(subject)) {
    return subject.hash;
  }
  return geographies.find((g) => g.id === subject.id)?.name;
}

function labelForState(state: SpatialMetricState) {
  switch (state) {
    case SpatialMetricState.Processing:
      return "Processing";
    case SpatialMetricState.Queued:
      return "Queued";
    case SpatialMetricState.Complete:
      return "Complete";
    case SpatialMetricState.Error:
      return "Error";
  }
}
