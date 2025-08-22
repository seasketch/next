import { useTranslation, Trans } from "react-i18next";
import { useReportContext } from "../../reports/ReportContext";
import { Geography, SpatialMetricState } from "../../generated/graphql";
import {
  subjectIsFragment,
  subjectIsGeography,
} from "overlay-engine/dist/metrics/metrics";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

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

  return (
    <AnimatePresence>
      {inProgress.length > 0 && (
        <motion.div
          className="absolute bottom-0 right-0 p-4 text-right text-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <h4 className="font-medium">
            <Trans ns="admin:sketching">
              {inProgress.length.toString()} geography-level metrics being
              calculated
            </Trans>
          </h4>
          {inProgress.map((m) => (
            <div key={m.id} className="relative">
              <h3>
                <span className="text-indigo-900 relative">{`${labelForState(
                  m.state
                )} ${
                  "id" in m.subject
                    ? nameForGeography(m.subject, geographies)
                    : "..."
                }`}</span>
                {Boolean(m.progress) && (
                  <span
                    className="w-full bottom-0 left-0 h-0.5 absolute bg-indigo-500 transition-transform duration-75"
                    style={{ transform: `scaleX(${(m.progress || 0) / 100})` }}
                  ></span>
                )}
                {Boolean(m.progress) && (
                  <span className="text-indigo-500">
                    {m.progress?.toString() || "0"}%
                  </span>
                )}
              </h3>
            </div>
          ))}
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
