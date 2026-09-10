import { ExclamationCircleIcon } from "@heroicons/react/outline";
import { PauseIcon, PlayIcon } from "@heroicons/react/solid";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ReactElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  clockForSliderMode,
  instantClockForStep,
  layoutTimeSliderCoverageMarks,
  layoutTimeSliderSteps,
  nearestTimeSliderStepIndex,
  timeSliderWindowExtents,
  windowClockForRange,
  windowStepIndexes,
} from "./mapTemporal";

const PLAY_MS = 700;
const PLAY_RATES = [1, 2, 4, 8, 16];
/* CSS identifiers, not UI copy. */
/* eslint-disable i18next/no-literal-string */
const MAP_ROOT_SELECTOR = ".timeslider-map-root";
const DOCK_HEIGHT_VAR = "--timeslider-dock-height";
/* eslint-enable i18next/no-literal-string */

function dockHeightPx(height: number) {
  /* eslint-disable-next-line i18next/no-literal-string */
  return `${height}px`;
}

function playRateLabel(rate: number) {
  // eslint-disable-next-line i18next/no-literal-string
  return `${rate}×`;
}

function RangeHandle({
  pct,
  side,
  label,
}: {
  pct: number;
  side: "start" | "end";
  label: string;
}) {
  return (
    <div
      data-testid={
        side === "start" ? "timeslider-range-start" : "timeslider-range-end"
      }
      aria-hidden
      title={label}
      className={
        side === "start"
          ? "pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 items-center"
          : "pointer-events-none absolute top-1/2 z-10 flex -translate-x-full -translate-y-1/2 items-center"
      }
      style={{ left: `${pct}%` }}
    >
      <div className="h-[var(--ts-handle-h)] w-[var(--ts-handle-w)] rounded-[3px] border-2 border-white bg-sky-400 shadow-md" />
    </div>
  );
}

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

function singleModeTooltip(
  resolution: TemporalPrecision,
  t: (key: string) => string
) {
  switch (resolution) {
    case "year":
      return t("Show one year at a time");
    case "month":
      return t("Show one month at a time");
    case "day":
      return t("Show one day at a time");
    default:
      return t("Show one time step at a time");
  }
}

function displayedClockTooltip(
  resolution: TemporalPrecision,
  windowMode: boolean,
  t: (key: string) => string
) {
  if (windowMode) {
    switch (resolution) {
      case "year":
        return t("Displayed years");
      case "month":
        return t("Displayed months");
      case "day":
        return t("Displayed dates");
      default:
        return t("Displayed range");
    }
  }
  switch (resolution) {
    case "year":
      return t("Displayed year");
    case "month":
      return t("Displayed month");
    case "day":
      return t("Displayed date");
    default:
      return t("Displayed time");
  }
}

function rangeModeTooltip(
  resolution: TemporalPrecision,
  t: (key: string) => string
) {
  switch (resolution) {
    case "year":
      return t("Show a range of years");
    case "month":
      return t("Show a range of months");
    case "day":
      return t("Show a range of days");
    default:
      return t("Show a range of time");
  }
}

function ControlTip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={10}
          className="z-50 select-none rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-gray-100 shadow-md ring-1 ring-white/10"
        >
          {label}
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** One thumb on a track — the "Single" (one step at a time) mode glyph. */
function SingleModeGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-[var(--ts-glyph)] w-[var(--ts-glyph)]"
      aria-hidden
      fill="none"
    >
      <path
        d="M1.5 8h13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="8" cy="8" r="3" fill="currentColor" />
    </svg>
  );
}

/** Two thumbs on a track — the "Range" mode glyph. */
function RangeModeGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-[var(--ts-glyph)] w-[var(--ts-glyph)]"
      aria-hidden
      fill="none"
    >
      <path
        d="M1.5 8h13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M5 8h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <rect
        x="3.25"
        y="3.5"
        width="2.25"
        height="9"
        rx="0.75"
        fill="currentColor"
      />
      <rect
        x="10.5"
        y="3.5"
        width="2.25"
        height="9"
        rx="0.75"
        fill="currentColor"
      />
    </svg>
  );
}

const CLUSTER_BUTTON =
  "flex h-[var(--ts-btn-h)] shrink-0 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";
const CLUSTER_BUTTON_DISABLED =
  "flex h-[var(--ts-btn-h)] shrink-0 items-center justify-center rounded-md text-white/25 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";
const PLAY_BUTTON =
  "flex h-[var(--ts-play-h)] w-[var(--ts-btn-w)] shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";
const PLAY_BUTTON_DISABLED =
  "flex h-[var(--ts-play-h)] w-[var(--ts-btn-w)] shrink-0 items-center justify-center rounded-md text-white/25 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";

export default function TimeSlider() {
  const { t } = useTranslation("homepage");
  const {
    clock,
    domain,
    resolution,
    availableResolutions,
    temporalSources,
    queryStepCounts,
    queryStepCountsLoading,
    queryErrors,
    setClock,
    setViewResolution,
  } = useContext(MapTemporalStateContext);
  const [playing, setPlaying] = useState(false);
  const [playRate, setPlayRate] = useState(PLAY_RATES[0]);
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const dockRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const flyout = useHomepageFlyoutState();

  const layouts = useMemo(() => {
    if (!domain || !resolution) {
      return [];
    }
    return layoutTimeSliderSteps(domain, resolution);
  }, [domain, resolution]);
  const steps = useMemo(() => layouts.map((layout) => layout.step), [layouts]);

  const { startIndex, endIndex } = clock
    ? windowStepIndexes(layouts, clock, resolution || clock.viewResolution)
    : { startIndex: -1, endIndex: -1 };
  const windowMode = clock?.mode === "window";

  const tickPlayback = () => {
    const current = clockRef.current;
    if (!current || current.mode === "window" || !resolution) return;
    const next = advanceClock(current, steps, resolution);
    if (next) setClock(next);
  };

  useEffect(() => {
    if (!playing || windowMode || steps.length < 2 || !resolution) {
      return;
    }
    const id = window.setInterval(tickPlayback, PLAY_MS / playRate);
    return () => window.clearInterval(id);
  }, [playing, windowMode, steps, resolution, setClock, playRate]);

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
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | "instant" | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);

  const clearDrag = (el?: HTMLElement | null, pointerId?: number | null) => {
    draggingRef.current = null;
    const id = pointerId ?? dragPointerIdRef.current;
    dragPointerIdRef.current = null;
    if (el && id != null && el.hasPointerCapture(id)) {
      el.releasePointerCapture(id);
    }
  };

  useEffect(() => {
    clearDrag(trackRef.current);
  }, [windowMode]);

  const dockVisible = Boolean(clock && domain && resolution && steps.length);

  useLayoutEffect(() => {
    if (!dockVisible) return;
    const dock = dockRef.current;
    if (!dock) return;
    const root = dock.closest(MAP_ROOT_SELECTOR) as HTMLElement | null;
    const syncHeight = () => {
      const height = Math.ceil(dock.getBoundingClientRect().height);
      root?.style.setProperty(DOCK_HEIGHT_VAR, dockHeightPx(height));
    };
    syncHeight();
    if (typeof ResizeObserver === "undefined") {
      return () => {
        root?.style.setProperty(DOCK_HEIGHT_VAR, dockHeightPx(0));
      };
    }
    const observer = new ResizeObserver(syncHeight);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root?.style.setProperty(DOCK_HEIGHT_VAR, dockHeightPx(0));
    };
  }, [dockVisible]);

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

  const applyMode = (mode: "instant" | "window") => {
    clearDrag(trackRef.current);
    setPlaying(false);
    if ((mode === "window") === windowMode) return;
    const next = clockForSliderMode(mode, clock, steps, resolution);
    if (next) setClock(next);
  };

  const goToIndex = (
    nextIndex: number,
    handle: "start" | "end" | "instant"
  ) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, nextIndex));
    if (handle === "instant" || !windowMode) {
      const next = instantClockForStep(steps[clamped], resolution);
      if (next) setClock(next);
      return;
    }
    let nextStart =
      handle === "start" ? clamped : startIndex < 0 ? 0 : startIndex;
    let nextEnd =
      handle === "end" ? clamped : endIndex < 0 ? clamped : endIndex;
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
    const { startPct, endPct } = timeSliderWindowExtents(
      layouts,
      startIndex,
      endIndex
    );
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

  const instantThumbPct =
    startIndex >= 0
      ? layouts[startIndex]?.midPct ?? 0
      : layouts[0]?.midPct ?? 0;
  const { startPct: rangeStartPct, endPct: rangeEndPct } =
    timeSliderWindowExtents(layouts, startIndex, endIndex);
  const rangeWidth = Math.max(0, rangeEndPct - rangeStartPct);

  const playbackDisabled = windowMode;
  const playTooltip = playbackDisabled
    ? t("Switch to single view to play")
    : playing
    ? t("Pause")
    : t("Play");

  return (
    <div
      ref={dockRef}
      className="timeslider-dock absolute bottom-0 left-0 right-0 z-0 flex min-h-[var(--ts-dock-min-h)] w-full select-none flex-col gap-2 border-t border-black/40 bg-cool-gray-800 px-[var(--ts-dock-px)] py-[var(--ts-dock-py)] text-gray-100"
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
      <div className="flex w-full items-center gap-[var(--ts-row-gap)]">
        <Tooltip.Provider delayDuration={300} skipDelayDuration={500}>
          <div
            role="group"
            aria-label={t("Time controls")}
            className="flex h-[var(--ts-cluster-h)] shrink-0 items-center gap-[var(--ts-cluster-gap)] rounded-lg bg-white/[0.08] p-[var(--ts-cluster-p)] ring-1 ring-inset ring-white/10 shadow-sm"
          >
            <ControlTip label={playTooltip}>
              <button
                type="button"
                aria-label={playing ? t("Pause") : t("Play")}
                aria-disabled={playbackDisabled || undefined}
                className={
                  playbackDisabled ? PLAY_BUTTON_DISABLED : PLAY_BUTTON
                }
                onClick={
                  playbackDisabled
                    ? undefined
                    : () => {
                        if (!playing) {
                          tickPlayback();
                        }
                        setPlaying((prev) => !prev);
                      }
                }
              >
                {playing ? (
                  <PauseIcon
                    className="h-[var(--ts-play-icon)] w-[var(--ts-play-icon)]"
                    aria-hidden
                  />
                ) : (
                  <PlayIcon
                    className="h-[var(--ts-play-icon)] w-[var(--ts-play-icon)] translate-x-px"
                    aria-hidden
                  />
                )}
              </button>
            </ControlTip>
            <DropdownMenu.Root>
              <ControlTip label={t("Playback speed")}>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label={t("Playback speed")}
                    className={`${CLUSTER_BUTTON} w-[var(--ts-btn-w)] font-semibold tabular-nums text-[length:var(--ts-btn-text)]`}
                  >
                    {playRateLabel(playRate)}
                  </button>
                </DropdownMenu.Trigger>
              </ControlTip>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="start"
                  sideOffset={10}
                  className="z-50 min-w-[5.5rem] rounded-md bg-cool-gray-800 p-1 shadow-xl ring-1 ring-white/15"
                >
                  {PLAY_RATES.map((rate) => (
                    <DropdownMenu.Item
                      key={rate}
                      className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs text-gray-200 focus:bg-sky-500/25 focus:text-white focus:outline-none"
                      onSelect={() => setPlayRate(rate)}
                    >
                      <span className="flex w-4 justify-center">
                        {rate === playRate ? (
                          <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                        ) : null}
                      </span>
                      {playRateLabel(rate)}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            {availableResolutions.length > 1 && (
              <DropdownMenu.Root>
                <ControlTip label={t("Time step")}>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label={t("Time step")}
                      className={`${CLUSTER_BUTTON} gap-0.5 px-1.5 text-sm font-medium`}
                    >
                      {resolutionOptionLabel(resolution, t)}
                      <ChevronDownIcon
                        className="h-3 w-3 opacity-60"
                        aria-hidden
                      />
                    </button>
                  </DropdownMenu.Trigger>
                </ControlTip>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="top"
                    align="start"
                    sideOffset={10}
                    className="z-50 min-w-[7rem] rounded-md bg-cool-gray-800 p-1 shadow-xl ring-1 ring-white/15"
                  >
                    {availableResolutions.map((item) => (
                      <DropdownMenu.Item
                        key={item}
                        className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs text-gray-200 focus:bg-sky-500/25 focus:text-white focus:outline-none"
                        onSelect={() => setViewResolution(item)}
                      >
                        <span className="flex w-4 justify-center">
                          {item === resolution ? (
                            <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                          ) : null}
                        </span>
                        {resolutionOptionLabel(item, t)}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
            <ControlTip label={singleModeTooltip(resolution, t)}>
              <button
                type="button"
                aria-label={t("Single")}
                aria-pressed={!windowMode}
                className={`${CLUSTER_BUTTON} w-[var(--ts-btn-w)] ${
                  !windowMode
                    ? "bg-sky-400/25 text-sky-100 hover:bg-sky-400/25 hover:text-sky-100"
                    : ""
                }`}
                onClick={() => applyMode("instant")}
              >
                <SingleModeGlyph />
              </button>
            </ControlTip>
            <ControlTip label={rangeModeTooltip(resolution, t)}>
              <button
                type="button"
                aria-label={t("Range")}
                aria-pressed={windowMode}
                className={`${CLUSTER_BUTTON} w-[var(--ts-btn-w)] ${
                  windowMode
                    ? "bg-sky-400/25 text-sky-100 hover:bg-sky-400/25 hover:text-sky-100"
                    : ""
                }`}
                onClick={() => applyMode("window")}
              >
                <RangeModeGlyph />
              </button>
            </ControlTip>
            <ControlTip label={displayedClockTooltip(resolution, windowMode, t)}>
              <div
                className="flex h-[var(--ts-btn-h)] w-max shrink-0 items-center whitespace-nowrap rounded-md bg-black/20 px-[var(--ts-watch-px)] text-center font-mono text-[length:var(--ts-watch-text)] font-medium leading-none tracking-wide text-lime-200 shadow-inner ring-1 ring-inset ring-black/40"
                aria-label={displayedClockTooltip(resolution, windowMode, t)}
                aria-live="polite"
              >
                {label}
              </div>
            </ControlTip>
          </div>
        </Tooltip.Provider>
        <div className="min-w-0 flex-1">
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label={t("Time")}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, steps.length - 1)}
            aria-valuenow={startIndex < 0 ? 0 : startIndex}
            aria-valuetext={label}
            className="timeslider-track relative flex h-[var(--ts-track-h)] w-full cursor-pointer touch-none items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cool-gray-800"
            onPointerDown={(event) => {
              if (event.button > 0) return;
              const handle = handleForClientX(event.clientX);
              draggingRef.current = handle;
              dragPointerIdRef.current = event.pointerId;
              setPlaying(false);
              event.currentTarget.setPointerCapture(event.pointerId);
              seekFromClientX(event.clientX, handle);
            }}
            onPointerMove={(event) => {
              if (!draggingRef.current) return;
              if (event.buttons === 0) {
                clearDrag(event.currentTarget, event.pointerId);
                return;
              }
              seekFromClientX(event.clientX, draggingRef.current);
            }}
            onPointerUp={(event) => {
              clearDrag(event.currentTarget, event.pointerId);
            }}
            onPointerCancel={(event) => {
              clearDrag(event.currentTarget, event.pointerId);
            }}
            onLostPointerCapture={() => {
              draggingRef.current = null;
              dragPointerIdRef.current = null;
            }}
          >
            {windowMode && (
              <span
                className="pointer-events-none absolute inset-y-0 bg-sky-300/10"
                style={{
                  left: `${rangeStartPct}%`,
                  width: `${rangeWidth}%`,
                }}
              />
            )}
            <div
              className={`pointer-events-none relative h-[var(--ts-rail-h)] w-full overflow-hidden rounded-full bg-white/15 ${
                queryStepCountsLoading ? "animate-pulse" : ""
              }`}
              aria-busy={queryStepCountsLoading || undefined}
            >
              {queryStepCountsLoading && marks.length === 0 ? (
                <span className="absolute inset-0 bg-gray-400/30" />
              ) : (
                marks.map((mark) => (
                  <span
                    key={mark.id}
                    className={`absolute inset-y-0 ${
                      queryStepCountsLoading
                        ? "bg-gray-400/40"
                        : "bg-sky-400/45"
                    }`}
                    style={{
                      left: `${mark.left}%`,
                      width: `${Math.min(mark.width, 100 - mark.left)}%`,
                    }}
                  />
                ))
              )}
              {windowMode && (
                <span
                  className="absolute inset-y-0 bg-sky-200/55"
                  style={{
                    left: `${rangeStartPct}%`,
                    width: `${rangeWidth}%`,
                  }}
                />
              )}
              {queryStepCountsLoading ? (
                <span className="sr-only">
                  {t("Loading observation counts")}
                </span>
              ) : null}
            </div>
            {windowMode ? (
              <>
                <RangeHandle
                  pct={rangeStartPct}
                  side="start"
                  label={t("Range start")}
                />
                <RangeHandle
                  pct={rangeEndPct}
                  side="end"
                  label={t("Range end")}
                />
              </>
            ) : (
              <div
                className="pointer-events-none absolute top-1/2 h-[var(--ts-thumb)] w-[var(--ts-thumb)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-50 bg-sky-400 shadow"
                style={{ left: `${instantThumbPct}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
