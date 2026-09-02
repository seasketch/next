import { ExclamationCircleIcon } from "@heroicons/react/outline";
import { PauseIcon, PlayIcon } from "@heroicons/react/solid";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { TemporalPrecision } from "@seasketch/geostats-types";
import { currentSidebarState } from "../projects/ProjectAppSidebar";
import {
  timeSliderLeadingInset,
  useHomepageFlyoutState,
} from "../projects/HomepageFlyoutContext";
import { isWhenStepLimitError } from "./dataTableQueryApi";
import { MapTemporalStateContext } from "./MapTemporalStateContext";
import {
  advanceClock,
  formatClockLabel,
  instantClockForStep,
  lastIncludedStep,
  layoutTimeSliderCoverageMarks,
  layoutTimeSliderSteps,
  nearestTimeSliderStepIndex,
  windowClockForRange,
} from "./mapTemporal";

const PLAY_MS = 700;

function resolutionOptionLabel(
  resolution: TemporalPrecision,
  t: (key: string) => string
) {
  switch (resolution) {
    case "year":
      return t("Year");
    case "month":
      return t("Month");
    case "day":
      return t("Day");
    case "hour":
      return t("Hour");
    case "minute":
      return t("Minute");
    case "second":
      return t("Second");
    default:
      return resolution;
  }
}

export default function TimeSlider() {
  const { t } = useTranslation("homepage");
  const {
    clock,
    domain,
    resolution,
    availableResolutions,
    temporalSources,
    queryStepCounts,
    queryErrors,
    setClock,
    setViewResolution,
  } = useContext(MapTemporalStateContext);
  const [playing, setPlaying] = useState(false);
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const { pathname } = useLocation();
  const flyout = useHomepageFlyoutState();

  const layouts = useMemo(() => {
    if (!domain || !resolution) {
      return [];
    }
    return layoutTimeSliderSteps(domain, resolution);
  }, [domain, resolution]);
  const steps = useMemo(() => layouts.map((layout) => layout.step), [layouts]);
  const stepIndexes = useMemo(() => {
    const indexes: { [step: string]: number } = {};
    layouts.forEach((layout, index) => {
      indexes[layout.step] = index;
    });
    return indexes;
  }, [layouts]);

  const startIndex = clock ? stepIndexes[clock.start] ?? -1 : -1;
  const lastStep = clock
    ? lastIncludedStep(clock, steps, clock.viewResolution)
    : null;
  const endIndex = lastStep ? stepIndexes[lastStep] ?? startIndex : startIndex;
  const windowMode = clock?.mode === "window";

  useEffect(() => {
    if (!playing || windowMode || steps.length < 2 || !resolution) {
      return;
    }
    const id = window.setInterval(() => {
      const current = clockRef.current;
      if (!current || current.mode === "window") return;
      const next = advanceClock(current, steps, resolution);
      if (next) setClock(next);
    }, PLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, windowMode, steps, resolution, setClock]);

  useEffect(() => {
    if (!clock || windowMode) setPlaying(false);
  }, [clock, windowMode]);

  const marks = useMemo(() => {
    if (!resolution) return [];
    return layoutTimeSliderCoverageMarks(
      layouts,
      temporalSources,
      resolution,
      Date.now(),
      queryStepCounts
    );
  }, [layouts, temporalSources, resolution, queryStepCounts]);
  const histogramMarks = marks.filter((mark) => mark.kind === "histogram");
  const coverageMarks = marks.filter((mark) => mark.kind !== "histogram");
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | "instant" | null>(null);

  if (!clock || !domain || !resolution || steps.length === 0) {
    return null;
  }

  const sidebar = currentSidebarState();
  const inset = timeSliderLeadingInset({
    overlayOpen: /\/app\/\w+/.test(pathname) && sidebar.open,
    overlayWidth: sidebar.width,
    flyoutOpen: flyout.open,
    flyoutWidth: flyout.width,
  });
  const label = formatClockLabel(clock, undefined, steps);
  const queryError = queryErrors[0]
    ? isWhenStepLimitError({ message: queryErrors[0] })
      ? t(
          "This time step is too detailed for the selected range. Choose a coarser step such as Month or Year."
        )
      : queryErrors[0]
    : null;

  const goToIndex = (nextIndex: number, handle: "start" | "end" | "instant") => {
    const clamped = Math.max(0, Math.min(steps.length - 1, nextIndex));
    if (handle === "instant" || !windowMode) {
      const next = instantClockForStep(steps[clamped], resolution);
      if (next) setClock(next);
      return;
    }
    let nextStart = handle === "start" ? clamped : startIndex < 0 ? 0 : startIndex;
    let nextEnd = handle === "end" ? clamped : endIndex < 0 ? clamped : endIndex;
    if (nextStart > nextEnd) {
      const swap = nextStart;
      nextStart = nextEnd;
      nextEnd = swap;
    }
    const end = instantClockForStep(steps[nextEnd], resolution)?.end;
    if (!end) return;
    const next = windowClockForRange(steps[nextStart], end, resolution);
    if (next) setClock(next);
  };

  const handleForClientX = (clientX: number): "start" | "end" | "instant" => {
    if (!windowMode) return "instant";
    const el = trackRef.current;
    if (!el || layouts.length === 0) return "start";
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return "start";
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const startPct = startIndex >= 0 ? layouts[startIndex]?.midPct ?? 0 : 0;
    const endPct = endIndex >= 0 ? layouts[endIndex]?.midPct ?? 100 : 100;
    return Math.abs(pct - endPct) < Math.abs(pct - startPct) ? "end" : "start";
  };

  const seekFromClientX = (
    clientX: number,
    handle: "start" | "end" | "instant"
  ) => {
    const el = trackRef.current;
    if (!el || layouts.length === 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    goToIndex(nearestTimeSliderStepIndex(layouts, pct), handle);
  };

  const startThumbPct =
    startIndex >= 0
      ? layouts[startIndex]?.midPct ?? 0
      : layouts[0]?.midPct ?? 0;
  const endThumbPct =
    endIndex >= 0 ? layouts[endIndex]?.midPct ?? startThumbPct : startThumbPct;
  const rangeLeft = Math.min(startThumbPct, endThumbPct);
  const rangeWidth = Math.abs(endThumbPct - startThumbPct);

  return (
    <div
      className="timeslider-dock absolute bottom-0 left-0 right-0 z-0 flex min-h-[52px] w-full select-none flex-col gap-2 border-t border-black/40 bg-cool-gray-800 px-3 py-2 text-gray-100"
      style={{
        paddingLeft: inset || undefined,
        transition: "padding-left 200ms ease",
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goToIndex(startIndex - 1, windowMode ? "start" : "instant");
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goToIndex(
            windowMode ? endIndex + 1 : startIndex + 1,
            windowMode ? "end" : "instant"
          );
        }
      }}
    >
      {queryError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-red-500/15 px-2.5 py-1.5 text-xs leading-snug text-red-100 ring-1 ring-inset ring-red-400/30"
        >
          <ExclamationCircleIcon
            className="mt-0.5 h-3.5 w-3.5 flex-none"
            aria-hidden
          />
          <span className="min-w-0">{queryError}</span>
        </div>
      ) : null}
      <div className="flex w-full items-center gap-3">
        {!windowMode && (
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label={playing ? t("Pause") : t("Play")}
            onClick={() => setPlaying((prev) => !prev)}
          >
            {playing ? (
              <PauseIcon className="h-5 w-5" aria-hidden />
            ) : (
              <PlayIcon className="h-5 w-5" aria-hidden />
            )}
          </button>
        )}
      <div
        className="w-28 shrink-0 truncate text-sm font-semibold tabular-nums tracking-tight"
        aria-live="polite"
      >
        {label}
      </div>
      <div className="min-w-0 flex-1 pr-2">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={t("Time")}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, steps.length - 1)}
          aria-valuenow={startIndex < 0 ? 0 : startIndex}
          aria-valuetext={label}
          className="timeslider-track relative flex h-8 w-full cursor-pointer items-end touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cool-gray-800"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const handle = handleForClientX(event.clientX);
            draggingRef.current = handle;
            setPlaying(false);
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromClientX(event.clientX, handle);
          }}
          onPointerMove={(event) => {
            if (!draggingRef.current) return;
            seekFromClientX(event.clientX, draggingRef.current);
          }}
          onPointerUp={() => {
            draggingRef.current = null;
          }}
          onPointerCancel={() => {
            draggingRef.current = null;
          }}
        >
          <div className="pointer-events-none relative mb-1.5 h-5 w-full overflow-hidden rounded-sm">
            {histogramMarks.map((mark) => (
              <span
                key={mark.id}
                className="absolute bottom-0 bg-sky-300/55"
                style={{
                  left: `${mark.left}%`,
                  width: `${Math.min(mark.width, 100 - mark.left)}%`,
                  height: `${mark.heightPct ?? 40}%`,
                }}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            {coverageMarks.map((mark) => (
              <span
                key={mark.id}
                className="absolute inset-y-0 bg-sky-400/45"
                style={{
                  left: `${mark.left}%`,
                  width: `${Math.min(mark.width, 100 - mark.left)}%`,
                }}
              />
            ))}
            {windowMode && (
              <span
                className="absolute inset-y-0 bg-sky-200/40"
                style={{
                  left: `${rangeLeft}%`,
                  width: `${rangeWidth}%`,
                }}
              />
            )}
          </div>
          <div
            className="pointer-events-none absolute bottom-0.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-slate-50 bg-sky-400 shadow"
            style={{ left: `${startThumbPct}%` }}
          />
          {windowMode && (
            <div
              className="pointer-events-none absolute bottom-0.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-slate-50 bg-sky-200 shadow"
              style={{ left: `${endThumbPct}%` }}
            />
          )}
        </div>
      </div>
      {availableResolutions.length > 1 && (
        <select
          aria-label={t("View resolution")}
          className="h-8 shrink-0 rounded-md border-0 bg-white/10 px-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          value={resolution}
          onChange={(event) =>
            setViewResolution(event.target.value as TemporalPrecision)
          }
        >
          {availableResolutions.map((item) => (
            <option key={item} value={item}>
              {resolutionOptionLabel(item, t)}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        className={`h-8 shrink-0 rounded-md px-2 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
          windowMode
            ? "bg-sky-400/20 text-sky-100"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
        onClick={() => {
          if (windowMode) {
            const next = instantClockForStep(lastStep || clock.start, resolution);
            if (next) setClock(next);
            return;
          }
          setPlaying(false);
          const first = steps[0];
          const last = steps[steps.length - 1];
          const rangeEnd = instantClockForStep(last, resolution)?.end;
          if (!first || !rangeEnd) return;
          const next = windowClockForRange(first, rangeEnd, resolution);
          if (next) setClock(next);
        }}
      >
        {windowMode ? t("Range") : t("Instant")}
      </button>
      </div>
    </div>
  );
}
