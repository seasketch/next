import { PauseIcon, PlayIcon } from "@heroicons/react/solid";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { currentSidebarState } from "../projects/ProjectAppSidebar";
import {
  timeSliderLeadingInset,
  useHomepageFlyoutState,
} from "../projects/HomepageFlyoutContext";
import { MapTemporalStateContext } from "./MapTemporalStateContext";
import {
  formatClockLabel,
  instantClockForStep,
  layoutTimeSliderCoverageMarks,
  layoutTimeSliderSteps,
  nearestTimeSliderStepIndex,
} from "./mapTemporal";

const PLAY_MS = 700;

export default function TimeSlider() {
  const { t } = useTranslation("homepage");
  const { clock, domain, resolution, temporalSources, setClock } = useContext(
    MapTemporalStateContext
  );
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

  const index = clock ? stepIndexes[clock.start] ?? -1 : -1;

  useEffect(() => {
    if (!playing || steps.length < 2 || !resolution) {
      return;
    }
    const id = window.setInterval(() => {
      const current = clockRef.current;
      const currentIndex = current
        ? stepIndexes[current.start] ?? -1
        : -1;
      const nextIndex =
        currentIndex < 0 ? 0 : (currentIndex + 1) % steps.length;
      const next = instantClockForStep(steps[nextIndex], resolution);
      if (next) setClock(next);
    }, PLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, steps, stepIndexes, resolution, setClock]);

  useEffect(() => {
    if (!clock) setPlaying(false);
  }, [clock]);

  const marks = useMemo(() => {
    if (!resolution) return [];
    return layoutTimeSliderCoverageMarks(
      layouts,
      temporalSources,
      resolution
    );
  }, [layouts, temporalSources, resolution]);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

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
  const label = formatClockLabel(clock);

  const goToIndex = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, nextIndex));
    const next = instantClockForStep(steps[clamped], resolution);
    if (next) setClock(next);
  };

  const seekFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || layouts.length === 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    goToIndex(nearestTimeSliderStepIndex(layouts, pct));
  };

  const thumbPct =
    index >= 0 ? layouts[index]?.midPct ?? 0 : layouts[0]?.midPct ?? 0;

  return (
    <div
      className="timeslider-dock absolute bottom-0 left-0 right-0 z-0 flex min-h-[52px] w-full select-none items-center gap-3 border-t border-black/40 bg-cool-gray-800 px-3 py-2 text-gray-100"
      style={{
        paddingLeft: inset || undefined,
        transition: "padding-left 200ms ease",
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goToIndex(index - 1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goToIndex(index + 1);
        }
      }}
    >
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
      <div
        className="w-20 shrink-0 truncate text-sm font-semibold tabular-nums tracking-tight"
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
          aria-valuenow={index < 0 ? 0 : index}
          aria-valuetext={label}
          className="timeslider-track relative flex h-6 w-full cursor-pointer items-center touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cool-gray-800"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            draggingRef.current = true;
            setPlaying(false);
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromClientX(event.clientX);
          }}
          onPointerMove={(event) => {
            if (!draggingRef.current) return;
            seekFromClientX(event.clientX);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
        >
          <div className="pointer-events-none relative h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            {marks.map((mark) => (
              <span
                key={mark.id}
                className="absolute inset-y-0 bg-sky-400/45"
                style={{
                  left: `${mark.left}%`,
                  width: `${Math.min(mark.width, 100 - mark.left)}%`,
                }}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-50 bg-sky-400 shadow"
            style={{ left: `${thumbPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
