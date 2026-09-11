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
  layoutTimeSliderAxisTicks,
  layoutTimeSliderCoverageMarks,
  layoutTimeSliderSteps,
  nearestTimeSliderStepIndex,
  TimeSliderAxisTick,
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

function TrackAxis({ ticks }: { ticks: TimeSliderAxisTick[] }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 z-0"
      aria-hidden
      data-testid="timeslider-axis"
    >
      {ticks.map((tick) => (
        <div
          key={tick.id}
          className="absolute top-0"
          style={{ left: `${tick.pct}%` }}
        >
          <span className="timeslider-axis-mark" />
          <span className="timeslider-axis-label">{tick.label}</span>
        </div>
      ))}
    </div>
  );
}

function RangeHandle({
  pct,
  side,
  label,
  animate,
}: {
  pct: number;
  side: "start" | "end";
  label: string;
  animate: boolean;
}) {
  return (
    <div
      data-testid={
        side === "start" ? "timeslider-range-start" : "timeslider-range-end"
      }
      aria-hidden
      title={label}
      className={`${
        side === "start"
          ? "pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 items-center"
          : "pointer-events-none absolute top-1/2 z-10 flex -translate-x-full -translate-y-1/2 items-center"
      } ${animate ? "transition-[left] duration-200 ease-out" : ""}`}
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    const onVisibility = () => {
      if (document.hidden) {
        close();
      }
    };
    window.addEventListener("blur", close);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", close);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen} disableHoverableContent>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={24}
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
  "flex h-[var(--ts-play-h)] w-[var(--ts-btn-w)] shrink-0 items-center justify-center rounded-md text-white/80 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";
const PLAY_BUTTON_DISABLED =
  "flex h-[var(--ts-play-h)] w-[var(--ts-btn-w)] shrink-0 items-center justify-center rounded-md text-white/25 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";
const MODE_SWITCH_BUTTON =
  "relative z-10 flex h-full w-[var(--ts-btn-w)] shrink-0 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";

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
  const [dragging, setDragging] = useState(false);
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
  const instantThumbPct =
    startIndex >= 0
      ? layouts[startIndex]?.midPct ?? 0
      : layouts[0]?.midPct ?? 0;
  const { startPct: rangeStartPct, endPct: rangeEndPct } =
    timeSliderWindowExtents(layouts, startIndex, endIndex);
  const rangeWidth = Math.max(0, rangeEndPct - rangeStartPct);
  const prevThumbPctRef = useRef(instantThumbPct);
  const prevRangeRef = useRef({ start: rangeStartPct, end: rangeEndPct });
  const thumbJumped = Math.abs(instantThumbPct - prevThumbPctRef.current) > 40;
  const rangeJumped =
    Math.abs(rangeStartPct - prevRangeRef.current.start) > 40 ||
    Math.abs(rangeEndPct - prevRangeRef.current.end) > 40;
  useEffect(() => {
    prevThumbPctRef.current = instantThumbPct;
    prevRangeRef.current = { start: rangeStartPct, end: rangeEndPct };
  }, [instantThumbPct, rangeStartPct, rangeEndPct]);

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
  const [trackWidth, setTrackWidth] = useState(0);
  const draggingRef = useRef<"start" | "end" | "instant" | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);

  const clearDrag = (el?: HTMLElement | null, pointerId?: number | null) => {
    draggingRef.current = null;
    const id = pointerId ?? dragPointerIdRef.current;
    dragPointerIdRef.current = null;
    setDragging(false);
    if (el && id != null && el.hasPointerCapture(id)) {
      el.releasePointerCapture(id);
    }
  };

  useEffect(() => {
    clearDrag(trackRef.current);
  }, [windowMode]);

  const dockVisible = Boolean(clock && domain && resolution && steps.length);
  const axisTicks = useMemo(
    () =>
      resolution
        ? layoutTimeSliderAxisTicks(layouts, resolution, trackWidth)
        : [],
    [layouts, resolution, trackWidth]
  );

  useLayoutEffect(() => {
    if (!dockVisible) return;
    const track = trackRef.current;
    if (!track) return;
    const syncWidth = () => {
      setTrackWidth(track.getBoundingClientRect().width);
    };
    syncWidth();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(syncWidth);
    observer.observe(track);
    return () => observer.disconnect();
  }, [dockVisible]);

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

  const playbackDisabled = windowMode;
  const animateThumb = !dragging && !thumbJumped && !(playing && playRate > 2);
  const animateRange = !dragging && !rangeJumped && !(playing && playRate > 2);
  const playDisabledReason = t("Playback not available in range mode");
  const playButton = (
    <button
      type="button"
      aria-label={
        playbackDisabled ? playDisabledReason : playing ? t("Pause") : t("Play")
      }
      aria-disabled={playbackDisabled || undefined}
      className={playbackDisabled ? PLAY_BUTTON_DISABLED : PLAY_BUTTON}
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
  );

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
        <Tooltip.Provider delayDuration={1000} skipDelayDuration={400}>
          <div
            role="group"
            aria-label={t("Time controls")}
            className="flex h-[var(--ts-cluster-h)] shrink-0 items-center gap-[var(--ts-cluster-gap)] rounded-lg bg-white/[0.06] p-[var(--ts-cluster-p)] ring-1 ring-inset ring-white/10 shadow-sm"
          >
            {playbackDisabled ? (
              <ControlTip label={playDisabledReason}>{playButton}</ControlTip>
            ) : (
              playButton
            )}
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
                  align="center"
                  sideOffset={20}
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
                    align="center"
                    sideOffset={20}
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
            <div
              role="group"
              aria-label={t("Time mode")}
              className="relative flex h-[var(--ts-btn-h)] shrink-0 items-center rounded-md bg-black/35 p-0.5"
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-[var(--ts-btn-w)] rounded-[5px] bg-white/15 shadow-sm ring-1 ring-inset ring-white/10 transition-transform duration-200 ease-out ${
                  windowMode ? "translate-x-full" : ""
                }`}
              />
              <ControlTip label={singleModeTooltip(resolution, t)}>
                <button
                  type="button"
                  aria-label={t("Single")}
                  aria-pressed={!windowMode}
                  className={`${MODE_SWITCH_BUTTON} ${
                    !windowMode
                      ? "text-sky-100"
                      : "text-white/40 hover:text-white/70"
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
                  className={`${MODE_SWITCH_BUTTON} ${
                    windowMode
                      ? "text-sky-100"
                      : "text-white/40 hover:text-white/70"
                  }`}
                  onClick={() => applyMode("window")}
                >
                  <RangeModeGlyph />
                </button>
              </ControlTip>
            </div>
            <ControlTip
              label={displayedClockTooltip(resolution, windowMode, t)}
            >
              <div
                className="timeslider-watch flex h-[var(--ts-btn-h)] w-max shrink-0 items-center overflow-hidden whitespace-nowrap rounded-md px-[var(--ts-watch-px)] text-center font-mono text-[length:var(--ts-watch-text)] font-medium leading-none tracking-wide text-lime-200"
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
              setDragging(true);
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
            <TrackAxis ticks={axisTicks} />
            {windowMode && (
              <span
                className={`pointer-events-none absolute inset-y-0 bg-sky-300/10 ${
                  animateRange
                    ? "transition-[left,width] duration-200 ease-out"
                    : ""
                }`}
                style={{
                  left: `${rangeStartPct}%`,
                  width: `${rangeWidth}%`,
                }}
              />
            )}
            <div
              className={`timeslider-rail pointer-events-none relative h-[var(--ts-rail-h)] w-full overflow-hidden rounded-full ${
                queryStepCountsLoading ? "animate-pulse" : ""
              }`}
              aria-busy={queryStepCountsLoading || undefined}
            >
              {queryStepCountsLoading && marks.length === 0 ? (
                <span className="timeslider-coverage-loading absolute inset-0" />
              ) : (
                marks.map((mark) => (
                  <span
                    key={mark.id}
                    className={`absolute inset-y-0 ${
                      queryStepCountsLoading
                        ? "timeslider-coverage-loading"
                        : "timeslider-coverage"
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
                  className={`absolute inset-y-0 bg-sky-200/55 ${
                    animateRange
                      ? "transition-[left,width] duration-200 ease-out"
                      : ""
                  }`}
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
                  animate={animateRange}
                />
                <RangeHandle
                  pct={rangeEndPct}
                  side="end"
                  label={t("Range end")}
                  animate={animateRange}
                />
              </>
            ) : (
              <div
                className={`pointer-events-none absolute top-1/2 h-[var(--ts-thumb)] w-[var(--ts-thumb)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-50 bg-sky-400 shadow ${
                  animateThumb
                    ? "transition-[left] duration-100 ease-in-ease-out"
                    : ""
                }`}
                style={{ left: `${instantThumbPct}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
