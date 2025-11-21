import React from "react";
import { SpatialMetricState } from "../../generated/graphql";
import CircularProgressIndicator from "./CircularProgressIndicator";
import ETACountdown from "./ETACountdown";
import { ClockIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  CheckCircleIcon,
  PauseIcon,
  XCircleIcon,
} from "@heroicons/react/solid";
import bytes from "bytes";
import { useTranslation } from "react-i18next";

interface ReportTaskLineItemProps {
  title: React.ReactNode;
  state: SpatialMetricState;
  progress?: number | null;
  completedAt?: string | null;
  durationSeconds?: number | null;
  errorMessage?: string | null;
  outputSize?: string | null;
  outputUrl?: string | null;
  isAdmin?: boolean;
  outputType?: string;
  estimatedCompletionTime?: Date | string | number | null;
  startedAt?: Date | string | number | null;
  progressPercent?: number | null;
  sourcesReady?: boolean;
  value?: any;
}

export default function ReportTaskLineItem({
  title,
  state,
  progress,
  completedAt,
  durationSeconds,
  errorMessage,
  outputSize,
  outputUrl,
  isAdmin,
  outputType,
  estimatedCompletionTime,
  startedAt,
  progressPercent,
  sourcesReady,
  value,
}: ReportTaskLineItemProps) {
  const { t } = useTranslation("sketching");
  const hasTooltipInfo =
    (state === SpatialMetricState.Complete ||
      state === SpatialMetricState.Error) &&
    (completedAt || durationSeconds || errorMessage || outputSize || value);

  // Precompute tooltip content
  const queuedTooltip = (
    <div className="text-sm text-gray-200">
      <div className="font-semibold text-white">{t("Queued")}</div>
      <div className="text-gray-300">
        {sourcesReady === false
          ? t("Calculations will start once overlay layers are processed.")
          : t("Calculations are queued and should start momentarily.")}
      </div>
    </div>
  );

  const infoTooltip = (
    <div className="space-y-2 text-sm">
      {state === SpatialMetricState.Error && errorMessage && (
        <div>
          <div className="font-semibold text-red-400 mb-1">{t("Error")}</div>
          <div className="text-gray-300">{errorMessage}</div>
        </div>
      )}
      {state === SpatialMetricState.Complete && outputSize && (
        <div>
          <div className="font-semibold text-white">{t("Output")}</div>
          <div className="text-gray-300">
            {isAdmin && outputUrl ? (
              <a
                href={outputUrl}
                className="text-blue-400 hover:text-blue-300 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {outputType ? outputType : t("Download")} (
                {bytes(parseInt(outputSize))})
              </a>
            ) : (
              <span>{bytes(parseInt(outputSize))}</span>
            )}
          </div>
        </div>
      )}
      {completedAt && (
        <div>
          <div className="font-semibold text-white">
            {state === SpatialMetricState.Error
              ? t("Failed On")
              : t("Completed")}
          </div>
          <div
            className="text-gray-300"
            title={new Date(completedAt).toLocaleString()}
          >
            {new Date(completedAt).toLocaleDateString()}
          </div>
        </div>
      )}
      {durationSeconds !== null && durationSeconds !== undefined && (
        <div>
          <div className="font-semibold text-white">{t("Duration")}</div>
          <div className="text-gray-300">
            {humanizeDuration(durationSeconds)}
          </div>
        </div>
      )}
      {state === SpatialMetricState.Complete &&
        value !== null &&
        value !== undefined && (
          <div>
            <div className="font-semibold text-white mb-1">{t("Value")}</div>
            <JSONPreview value={value} />
          </div>
        )}
    </div>
  );

  const tooltipContent = hasTooltipInfo
    ? infoTooltip
    : state === SpatialMetricState.Queued
    ? queuedTooltip
    : null;

  return (
    <li className="flex items-center">
      <span className="flex-1 truncate text-sm">{title}</span>
      <ETACountdown
        eta={
          estimatedCompletionTime
            ? new Date(estimatedCompletionTime).getTime()
            : null
        }
        done={
          state === SpatialMetricState.Complete ||
          state === SpatialMetricState.Error
        }
      />
      {tooltipContent ? (
        <Tooltip.Root delayDuration={100}>
          <Tooltip.Trigger asChild>
            <div className="text-sm text-gray-600 flex items-center justify-center w-5 h-5 cursor-help focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">
              <StateIcon
                state={state}
                progress={progress}
                progressPercent={progressPercent}
                t={t}
              />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-gray-900 rounded-lg shadow-xl p-3 max-w-96 z-50 overflow-hidden"
              sideOffset={5}
              side="left"
            >
              {tooltipContent}
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : (
        <span className="ml-2 text-sm text-gray-600 flex items-center justify-center w-5 h-5">
          <StateIcon
            state={state}
            progress={progress}
            progressPercent={progressPercent}
            t={t}
            startedAt={startedAt}
          />
        </span>
      )}
    </li>
  );
}

function JSONPreview({ value }: { value: any }) {
  const [formattedJson, setFormattedJson] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function formatJSON() {
      try {
        // Lazy load prettier dependencies
        const [prettier, babel] = await Promise.all([
          import("prettier/standalone"),
          import("prettier/parser-babel"),
        ]);

        if (cancelled) return;

        // Handle case where value might already be a JSON string
        let parsedValue = value;
        if (typeof value === "string") {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // If it's not valid JSON, just use the string as-is
            parsedValue = value;
          }
        }

        // Stringify the value, handling circular references
        let jsonString: string;
        try {
          jsonString = JSON.stringify(parsedValue, null, 2);
          if (!jsonString || jsonString === "null") {
            jsonString = String(parsedValue);
          }
        } catch (e) {
          // If stringify fails (e.g., circular reference), try with a replacer
          const seen = new WeakSet();
          try {
            jsonString = JSON.stringify(
              parsedValue,
              (key, val) => {
                if (val != null && typeof val === "object") {
                  if (seen.has(val)) {
                    return "[Circular]";
                  }
                  seen.add(val);
                }
                return val;
              },
              2
            );
          } catch {
            // Last resort fallback
            jsonString = String(parsedValue);
          }
        }

        // Format with prettier
        let formatted: string;
        try {
          formatted = prettier.default.format(jsonString, {
            parser: "json",
            plugins: [babel.default],
            printWidth: 60,
          });
        } catch {
          // If prettier fails, just use the stringified version
          formatted = jsonString;
        }

        if (!cancelled) {
          setFormattedJson(formatted);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          // Fallback: try to show something useful
          let displayValue: string;
          if (value === null) {
            displayValue = "null";
          } else if (value === undefined) {
            displayValue = "undefined";
          } else if (typeof value === "string") {
            displayValue = value;
          } else {
            // Last resort: try JSON.stringify one more time
            try {
              displayValue = JSON.stringify(value, null, 2);
            } catch {
              displayValue = String(value);
            }
          }
          setFormattedJson(displayValue);
          setIsLoading(false);
        }
      }
    }

    formatJSON();

    return () => {
      cancelled = true;
    };
  }, [value]);

  // Early returns for null/undefined
  if (value === null || value === undefined) {
    return (
      <div className="bg-gray-800 rounded p-2 max-h-64 overflow-auto">
        <pre className="text-xs text-gray-300 font-mono">
          {value === null ? "null" : "undefined"}
        </pre>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded p-2 max-h-64 overflow-auto">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <pre className="text-xs text-gray-400 font-mono">Loading...</pre>
      </div>
    );
  }

  if (!formattedJson) {
    return null;
  }

  // Simple syntax highlighting using regex and CSS classes
  // Process line by line to avoid issues with overlapping matches
  let highlighted;
  try {
    highlighted = formattedJson.split("\n").map((line, lineIdx) => {
      let result = "";
      let i = 0;

      while (i < line.length) {
        // Match strings first (they can contain escaped quotes)
        const stringMatch = line.slice(i).match(/^"([^"\\]|\\.)*"/);
        if (stringMatch) {
          // eslint-disable-next-line i18next/no-literal-string
          result += `<span class="text-green-400">${stringMatch[0]}</span>`;
          i += stringMatch[0].length;
          continue;
        }

        // Match keywords (true, false, null) - but not as part of other words
        const keywordMatch = line.slice(i).match(/^(true|false|null)\b/);
        if (keywordMatch) {
          // eslint-disable-next-line i18next/no-literal-string
          result += `<span class="text-purple-400">${keywordMatch[0]}</span>`;
          i += keywordMatch[0].length;
          continue;
        }

        // Match numbers (but not inside strings, which we already handled)
        const numberMatch = line.slice(i).match(/^-?\d+\.?\d*/);
        if (numberMatch) {
          // eslint-disable-next-line i18next/no-literal-string
          result += `<span class="text-blue-400">${numberMatch[0]}</span>`;
          i += numberMatch[0].length;
          continue;
        }

        // Match braces and brackets
        if (/^[{}[\]]/.test(line.slice(i))) {
          // eslint-disable-next-line i18next/no-literal-string
          result += `<span class="text-gray-400">${line[i]}</span>`;
          i++;
          continue;
        }

        // Match colons
        if (line[i] === ":") {
          // eslint-disable-next-line i18next/no-literal-string
          result += '<span class="text-gray-500">:</span>';
          i++;
          continue;
        }

        // Match commas
        if (line[i] === ",") {
          // eslint-disable-next-line i18next/no-literal-string
          result += '<span class="text-gray-500">,</span>';
          i++;
          continue;
        }

        // Regular character
        result += line[i];
        i++;
      }

      return (
        <div key={lineIdx} className="font-mono text-xs text-gray-300">
          <span dangerouslySetInnerHTML={{ __html: result }} />
        </div>
      );
    });
  } catch {
    // If highlighting fails, just show plain text
    highlighted = formattedJson.split("\n").map((line, lineIdx) => (
      <div key={lineIdx} className="font-mono text-xs text-gray-300">
        {line}
      </div>
    ));
  }

  return (
    <div className="bg-gray-800 rounded p-2 max-h-64 overflow-auto">
      <pre className="text-xs">{highlighted}</pre>
    </div>
  );
}

function humanizeDuration(seconds: number): string {
  if (seconds < 60) {
    if (seconds < 3) {
      const rounded = Math.round(seconds * 10) / 10;
      return `${rounded} ${rounded === 1.0 ? "second" : "seconds"}`;
    }
    return `${Math.round(seconds)} ${
      Math.round(seconds) === 1 ? "second" : "seconds"
    }`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    if (remainingSeconds === 0) {
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
    }
    return `${minutes} ${
      minutes === 1 ? "minute" : "minutes"
    }, ${remainingSeconds} ${remainingSeconds === 1 ? "second" : "seconds"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${hours} ${hours === 1 ? "hour" : "hours"}, ${remainingMinutes} ${
    remainingMinutes === 1 ? "minute" : "minutes"
  }`;
}

function StateIcon({
  state,
  progress,
  progressPercent,
  t,
  startedAt,
}: {
  state: SpatialMetricState;
  progress?: number | null;
  progressPercent?: number | null;
  t: (key: string) => string;
  startedAt?: Date | string | number | null;
}) {
  switch (state) {
    case SpatialMetricState.Processing:
      // Use circular progress indicator with progress value or indeterminate
      const normalizedProgress =
        typeof progress === "number" ? progress / 100 : null;
      // Calculate progress percentage for tooltip: prefer progressPercent, fallback to progress
      const displayProgressPercent =
        progressPercent !== null && progressPercent !== undefined
          ? progressPercent
          : typeof progress === "number"
          ? progress
          : null;

      const progressTooltip = (
        <div className="text-sm text-gray-200">
          <div className="font-semibold text-white">{t("Processing")}</div>
          {displayProgressPercent !== null && (
            <>
              <div className="text-gray-300">
                {Math.round(displayProgressPercent)}%
              </div>
            </>
          )}
        </div>
      );

      return (
        <Tooltip.Root delayDuration={100}>
          <Tooltip.Trigger asChild>
            <div className="cursor-help focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">
              <CircularProgressIndicator
                progress={normalizedProgress}
                size={20}
                strokeWidth={2.5}
                className="w-5 h-5"
              />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-gray-900 rounded-lg shadow-xl p-3 max-w-72 z-50 overflow-hidden"
              sideOffset={5}
              side="right"
            >
              {progressTooltip}
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    case SpatialMetricState.Queued:
      return <PauseIcon className="text-gray-400 w-5 h-5" />;
    case SpatialMetricState.Complete:
      return <CheckCircleIcon className="text-green-700 w-5 h-5" />;
    case SpatialMetricState.Error:
      return <XCircleIcon className="text-red-700 w-5 h-5" />;
    case SpatialMetricState.DependencyNotReady:
      return <ClockIcon className="text-green-700" />;
  }
}
