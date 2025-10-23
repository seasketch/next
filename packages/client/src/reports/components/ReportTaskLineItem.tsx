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
}: ReportTaskLineItemProps) {
  const { t } = useTranslation("sketching");
  const hasTooltipInfo =
    (state === SpatialMetricState.Complete ||
      state === SpatialMetricState.Error) &&
    (completedAt || durationSeconds || errorMessage || outputSize);

  // Precompute tooltip content
  const queuedTooltip = (
    <div className="text-sm text-gray-200">
      <div className="font-semibold text-white">{t("Queued")}</div>
      <div className="text-gray-300">
        {t("Calculations will start once overlay layers are processed.")}
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
              <StateIcon state={state} progress={progress} />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-gray-900 rounded-lg shadow-xl p-3 max-w-72 z-50 overflow-hidden"
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
          <StateIcon state={state} progress={progress} />
        </span>
      )}
    </li>
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
}: {
  state: SpatialMetricState;
  progress?: number | null;
}) {
  switch (state) {
    case SpatialMetricState.Processing:
      // Use circular progress indicator with progress value or indeterminate
      const normalizedProgress =
        typeof progress === "number" ? progress / 100 : null;
      return (
        <CircularProgressIndicator
          progress={normalizedProgress}
          size={20}
          strokeWidth={2.5}
          className="w-5 h-5"
        />
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
