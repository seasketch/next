import { PauseIcon, PlayIcon } from "@heroicons/react/solid";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { expandTemporalValue } from "@seasketch/geostats-types";
import { currentSidebarState } from "../projects/ProjectAppSidebar";
import { MapTemporalStateContext } from "./MapTemporalStateContext";
import {
  enumerateSteps,
  formatClockLabel,
  instantClockForStep,
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

  const steps = useMemo(() => {
    if (!domain || !resolution) return [];
    return enumerateSteps(domain, resolution);
  }, [domain, resolution]);
  const stepIndexes = useMemo(() => {
    const indexes: { [step: string]: number } = {};
    steps.forEach((step, index) => {
      indexes[step] = index;
    });
    return indexes;
  }, [steps]);

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
    if (!domain) return [];
    const domainExpanded = expandTemporalValue(domain);
    if (!domainExpanded) return [];
    const span = domainExpanded.end - domainExpanded.start;
    if (span <= 0) return [];
    return temporalSources.map((source) => {
      const expanded = expandTemporalValue(source.temporal.coverage);
      if (!expanded) return null;
      const left = Math.max(
        0,
        ((expanded.start - domainExpanded.start) / span) * 100
      );
      const width = Math.max(
        1.5,
        ((expanded.end - expanded.start) / span) * 100
      );
      return { id: source.tocStableId, left, width };
    });
  }, [domain, temporalSources]);

  if (!clock || !domain || !resolution || steps.length === 0) {
    return null;
  }

  const sidebar = currentSidebarState();
  const label = formatClockLabel(clock);

  const goToIndex = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, nextIndex));
    const next = instantClockForStep(steps[clamped], resolution);
    if (next) setClock(next);
  };

  return (
    <div
      className="pointer-events-none absolute bottom-8 left-0 z-20 flex w-full justify-center px-4"
      style={{
        paddingLeft: sidebar.open ? sidebar.width + 24 : 24,
      }}
    >
      <div
        className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-xl border border-white/10 bg-gray-800/90 px-3 py-2 text-white shadow-lg backdrop-blur-sm"
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          aria-label={playing ? t("Pause") : t("Play")}
          onClick={() => setPlaying((prev) => !prev)}
        >
          {playing ? (
            <PauseIcon className="h-4 w-4" aria-hidden />
          ) : (
            <PlayIcon className="h-4 w-4" aria-hidden />
          )}
        </button>
        <div
          className="w-20 shrink-0 truncate text-sm font-semibold tabular-nums"
          aria-live="polite"
        >
          {label}
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(0, steps.length - 1)}
            step={1}
            value={index < 0 ? 0 : index}
            aria-label={t("Time")}
            aria-valuetext={label}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-sky-400"
            onChange={(event) => {
              setPlaying(false);
              goToIndex(parseInt(event.target.value, 10));
            }}
          />
          <div className="relative mt-1.5 h-1.5">
            {marks.map((mark) =>
              mark ? (
                <span
                  key={mark.id}
                  className="absolute top-0 h-1 rounded-full bg-sky-400/70"
                  style={{
                    left: `${mark.left}%`,
                    width: `${Math.min(mark.width, 100 - mark.left)}%`,
                  }}
                />
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
