import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { MetricDependency } from "overlay-engine";
import { FC } from "react";
import { useTranslation } from "react-i18next";

type MetricSuggestionContext = {
  type?: string;
  parameters?: Record<string, any> | null;
};

function addSuggestedFixesForError(
  suggestedFixes: Record<string, string>,
  error: string,
  contexts: MetricSuggestionContext[]
) {
  if (
    error.includes("Invalid array length") &&
    contexts.some((context) => context.type === "raster_stats")
  ) {
    suggestedFixes["Adjust VRM settings"] =
      "https://docs.seasketch.org/seasketch-documentation/administrators-guide/reports/debugging-timeout-and-performance-issues#raster-vrm-settings";
  } else if (/timeout/i.test(error)) {
    const overlapContext = contexts.find(
      (context) =>
        context.type === "overlay_area" ||
        context.parameters?.sourceHasOverlappingFeatures === true
    );
    if (overlapContext) {
      suggestedFixes["Adjust overlap settings"] =
        "https://docs.seasketch.org/seasketch-documentation/administrators-guide/reports/debugging-timeout-and-performance-issues#overlapping-polygon-settings";
    } else {
      suggestedFixes["Review report performance documentation"] =
        "https://docs.seasketch.org/seasketch-documentation/administrators-guide/reports/debugging-timeout-and-performance-issues";
    }
  }
}

export function getMetricErrorInfo(
  errors: string[],
  dependencies: MetricDependency[]
) {
  const errorMap: Record<string, number> = {};
  for (const error of errors) {
    if (error in errorMap) {
      errorMap[error]++;
    } else {
      errorMap[error] = 1;
    }
  }

  const suggestedFixes: Record<string, string> = {};
  const contexts = dependencies.map((dependency) => ({
    type: dependency.type,
    parameters: dependency.parameters,
  }));
  for (const error of Object.keys(errorMap)) {
    addSuggestedFixesForError(suggestedFixes, error, contexts);
  }

  return { errorMap, suggestedFixes };
}

export function getSuggestedFixesForMetricError({
  error,
  metricType,
  parameters,
}: {
  error?: string | null;
  metricType?: string;
  parameters?: Record<string, any> | null;
}) {
  const suggestedFixes: Record<string, string> = {};
  if (!error) {
    return suggestedFixes;
  }
  addSuggestedFixesForError(suggestedFixes, error, [
    { type: metricType, parameters },
  ]);
  return suggestedFixes;
}

export const MetricSuggestedFixes: FC<{
  suggestedFixes: Record<string, string>;
  compact?: boolean;
  theme?: "light" | "dark";
}> = ({ suggestedFixes, compact, theme = "light" }) => {
  const { t } = useTranslation("reports");
  const entries = Object.entries(suggestedFixes);
  if (entries.length === 0) {
    return null;
  }
  const dark = theme === "dark";

  return (
    <div
      className={`rounded-md border ${
        dark ? "border-gray-700 bg-gray-800/80" : "border-gray-200 bg-gray-50"
      } ${compact ? "mt-2 px-2.5 py-2" : "mt-3 px-3 py-2.5"}`}
    >
      <div
        className={`font-semibold ${dark ? "text-gray-100" : "text-gray-700"} ${
          compact ? "" : "text-sm"
        }`}
      >
        {t("Suggested fixes")}
      </div>
      <div className={`${compact ? "mt-1" : "mt-1.5 text-sm"} space-y-1`}>
        {entries.map(([msg, url]) => (
          <div key={msg}>
            <a
              className={`inline-flex items-center gap-1 rounded !underline underline-offset-2 ${
                dark
                  ? "text-blue-300 hover:text-blue-200"
                  : "text-blue-600 hover:text-blue-800"
              }`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {msg}
              <ExternalLinkIcon className="h-3 w-3 shrink-0" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
