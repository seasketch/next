import React, { useEffect, useRef, useState } from "react";
import { SpatialMetricState } from "../../generated/graphql";
import CircularProgressIndicator from "./CircularProgressIndicator";
import ETACountdown from "./ETACountdown";
import { ClockIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  CheckCircleIcon,
  CogIcon,
  PauseIcon,
  XCircleIcon,
} from "@heroicons/react/solid";
import bytes from "bytes";
import { Trans, useTranslation } from "react-i18next";
import JsonPreview from "../../components/JsonPreview";

/**
 * Inline menu (no portal) so it stays inside the Radix tooltip hover region.
 */
function LayerOutputActionsMenu({
  outputUrl,
  onReprocessSource,
  reprocessLoading,
}: {
  outputUrl?: string | null;
  onReprocessSource: (repairInvalid: boolean) => void;
  reprocessLoading?: boolean;
}) {
  const { t } = useTranslation("sketching");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasDownload = Boolean(outputUrl);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex items-center">
      <button
        type="button"
        disabled={reprocessLoading}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("Layer actions")}
        title={t("Layer actions")}
        className="inline-flex items-center justify-center rounded p-0.5 text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 disabled:opacity-50"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <CogIcon className="w-4 h-4" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-[200] mt-1 min-w-[12rem] rounded-md bg-white py-1 text-sm text-gray-800 shadow-lg border border-gray-200"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hasDownload && (
            <a
              role="menuitem"
              href={outputUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 hover:bg-gray-100 outline-none"
              onClick={() => setOpen(false)}
            >
              {t("Download")}
            </a>
          )}
          {hasDownload && <div className="h-px bg-gray-200 my-1" />}
          <button
            type="button"
            role="menuitem"
            disabled={reprocessLoading}
            className="w-full text-left px-3 py-2 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onReprocessSource(false);
            }}
          >
            {reprocessLoading ? t("Reprocessing...") : t("Reprocess Layer")}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={reprocessLoading}
            className="w-full text-left px-3 py-2 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onReprocessSource(true);
            }}
          >
            {reprocessLoading ? t("Reprocessing...") : t("Reprocess and Repair")}
          </button>
        </div>
      )}
    </div>
  );
}

interface ReportTaskLineItemProps {
  /** When true, renders only ETA + status icon (no title, no li). Use for inline rows that supply their own title. */
  onlyStatus?: boolean;
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
  metricType?: string;
  parameters?: any;
  numInvalidFeatures?: number | null;
  numFeatures?: number | null;
  numRepairedFeatures?: number | null;
  wasRepaired?: boolean | null;
  containsOverlappingFeatures?: boolean | null;
  /** Admin: re-run source preprocessing (optimized layer). `true` runs make_valid repair. */
  onReprocessSource?: (repairInvalid: boolean) => void;
  reprocessLoading?: boolean;
}

export default function ReportTaskLineItem({
  onlyStatus = false,
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
  metricType,
  parameters,
  numInvalidFeatures,
  numFeatures,
  numRepairedFeatures,
  wasRepaired,
  containsOverlappingFeatures,
  onReprocessSource,
  reprocessLoading,
}: ReportTaskLineItemProps) {
  const { t } = useTranslation("sketching");
  const hasTopologyIssues =
    state === SpatialMetricState.Complete &&
    numInvalidFeatures != null &&
    numInvalidFeatures > 0;
  const hasOverlappingFeatures =
    state === SpatialMetricState.Complete &&
    containsOverlappingFeatures === true;
  const hasTooltipInfo =
    (state === SpatialMetricState.Complete ||
      state === SpatialMetricState.Error) &&
    (completedAt ||
      durationSeconds ||
      errorMessage ||
      outputSize ||
      value ||
      hasTopologyIssues ||
      hasOverlappingFeatures ||
      (isAdmin && onReprocessSource));

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
      {metricType && (
        <div>
          <div className="font-semibold text-white">{t("Operation")}</div>
          <div className="text-gray-300">
            {metricType}
            {metricType === "overlay_area" &&
              parameters?.sourceHasOverlappingFeatures && (
                <span className="ml-1.5 text-blue-300 text-xs">
                  ({t("overlap mode")})
                </span>
              )}
          </div>
        </div>
      )}
      {parameters && hasParameters(parameters) && (
        <div>
          <div className="font-semibold text-white mb-1">{t("Parameters")}</div>
          <JsonPreview value={formatParameters(parameters)} />
        </div>
      )}
      {state === SpatialMetricState.Error &&
        (errorMessage || (isAdmin && onReprocessSource)) && (
          <div>
            {errorMessage && (
              <>
                <div className="font-semibold text-red-400 mb-1">
                  {t("Error")}
                </div>
                <div className="text-gray-300">{errorMessage}</div>
              </>
            )}
            {isAdmin && onReprocessSource && (
              <div className={errorMessage ? "mt-2" : ""}>
                <LayerOutputActionsMenu
                  outputUrl={undefined}
                  onReprocessSource={onReprocessSource}
                  reprocessLoading={reprocessLoading}
                />
              </div>
            )}
          </div>
        )}
      {state === SpatialMetricState.Complete && outputSize && (
        <div>
          <div className="font-semibold text-white">{t("Output")}</div>
          <div className="text-gray-300 flex flex-wrap items-center gap-x-2 gap-y-1">
            {isAdmin && onReprocessSource ? (
              <>
                {outputUrl ? (
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
                  <span>
                    {outputType
                      ? `${outputType} (${bytes(parseInt(outputSize))})`
                      : bytes(parseInt(outputSize))}
                  </span>
                )}
                <LayerOutputActionsMenu
                  outputUrl={outputUrl ?? undefined}
                  onReprocessSource={onReprocessSource}
                  reprocessLoading={reprocessLoading}
                />
              </>
            ) : isAdmin && outputUrl ? (
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
      {isAdmin &&
        state === SpatialMetricState.Complete &&
        (hasTopologyIssues || wasRepaired) &&
        numFeatures != null && (
          <div>
            <div className="font-semibold text-white">
              {t("Topology Quality")}
            </div>
            {hasTopologyIssues && (
              <>
                <div className="text-yellow-400">
                  {numInvalidFeatures.toLocaleString()} /{" "}
                  {numFeatures.toLocaleString()} {t("features invalid")}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  <Trans ns="admin:sketching">
                    One or more features have geometry topology problems. These
                    can slow calculations and result in less accurate results.
                    Consider running validation checks in desktop GIS or
                    reprocessing data using the repair option, which will use
                    the{" "}
                    <a
                      className="text-blue-400 hover:text-blue-300 underline"
                      href="https://shapely.readthedocs.io/en/latest/reference/shapely.make_valid.html"
                      target="_blank"
                    >
                      shapely make_valid
                    </a>{" "}
                    function to repair topology.
                  </Trans>
                </div>
                {onReprocessSource && !wasRepaired && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReprocessSource(true);
                    }}
                    disabled={reprocessLoading}
                  >
                    {reprocessLoading
                      ? t("Reprocessing...")
                      : t("Reprocess and Repair")}
                  </button>
                )}
              </>
            )}
            {wasRepaired && numRepairedFeatures != null && (
              <>
                <div className="text-gray-300">
                  {numRepairedFeatures.toLocaleString()}{" "}
                  {numRepairedFeatures === 1
                    ? t("feature repaired")
                    : t("features repaired")}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  <Trans ns="admin:sketching">
                    Data source was processed using{" "}
                    <a
                      className="text-blue-400 hover:text-blue-300 underline"
                      href="https://shapely.readthedocs.io/en/latest/reference/shapely.make_valid.html"
                      target="_blank"
                    >
                      shapely's make_valid function
                    </a>{" "}
                    to repair topology problems. You may wish to download and
                    verify the output in desktop GIS.
                  </Trans>
                </div>
              </>
            )}
          </div>
        )}
      {hasOverlappingFeatures && (
        <div>
          <div className="font-semibold text-white">
            {t("Overlapping Features")}
          </div>
          <div className="text-blue-300">
            {t(
              "This data source contains overlapping polygon features. Overlay area calculations should be configured to use per-feature clipping to ensure accurate results."
            )}
          </div>
        </div>
      )}
      {state === SpatialMetricState.Complete &&
        value !== null &&
        value !== undefined && (
          <div>
            <div className="font-semibold text-white mb-1">{t("Value")}</div>
            <JsonPreview value={value} />
          </div>
        )}
    </div>
  );

  const tooltipContent = hasTooltipInfo
    ? infoTooltip
    : state === SpatialMetricState.Queued
    ? queuedTooltip
    : null;

  const statusBlock = (
    <>
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
            {hasTopologyIssues ? (
              <div className="ml-1 flex items-center gap-1 px-1.5 py-0.5 pl-2 rounded-full bg-yellow-50 border border-yellow-300 cursor-help focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1">
                <span className="text-xs font-medium text-yellow-700 whitespace-nowrap">
                  {t("Topology problems")}
                </span>
                <CheckCircleIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              </div>
            ) : (
              <div className="text-sm text-gray-600 flex items-center justify-center w-5 h-5 cursor-help focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded flex-shrink-0">
                <StateIcon
                  state={state}
                  progress={progress}
                  progressPercent={progressPercent}
                  t={t}
                />
              </div>
            )}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-gray-900 rounded-lg shadow-xl p-3 max-w-96 z-50 overflow-visible"
              sideOffset={5}
              side="left"
            >
              {tooltipContent}
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : (
        <span className="ml-2 text-sm text-gray-600 flex items-center justify-center w-5 h-5 flex-shrink-0">
          <StateIcon
            state={state}
            progress={progress}
            progressPercent={progressPercent}
            t={t}
            startedAt={startedAt}
          />
        </span>
      )}
    </>
  );

  if (onlyStatus) {
    return statusBlock;
  }

  return (
    <li className="flex items-center gap-2 min-w-0">
      <span className="flex-1 min-w-0 text-sm">{title}</span>
      {statusBlock}
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

function hasParameters(params: any) {
  for (const key in params) {
    if (key === "__typename") {
      continue;
    }
    if (params[key] === null || params[key] === undefined) {
      continue;
    }
    return true;
  }
  return false;
}

function formatParameters(params: any) {
  let newParams = {} as Record<string, string>;
  for (const key in params) {
    if (
      key !== "__typename" &&
      params[key] !== null &&
      params[key] !== undefined
    ) {
      newParams[key] = params[key];
    }
  }
  return newParams;
}
