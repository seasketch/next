import {
  expandTemporalIso,
  TemporalPrecision,
} from "../../../geostats-types/lib/temporal";
import { QueryError, TemporalWhenFilter } from "./params";

/**
 * Safety cap on calendar bins in a `when.step` series — not a scan cost.
 * The parquet pass is the same as a single-window query; extra work is
 * grouping rows onto overlapping steps (usually one step per survey row).
 * 40_000 covers ~109 years of daily steps (or ~4.5 years of hourly).
 * Keep in sync with `TIME_SLIDER_MAX_STEPS` in the client.
 */
export const MAX_WHEN_STEPS = 40000;

export function formatIsoFromMs(
  ms: number,
  precision: TemporalPrecision
): string {
  const date = new Date(ms);
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  if (precision === "year") return y;
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (precision === "month") return `${y}-${m}`;
  const d = String(date.getUTCDate()).padStart(2, "0");
  if (precision === "day") return `${y}-${m}-${d}`;
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  if (precision === "hour") return `${y}-${m}-${d}T${h}:00:00Z`;
  if (precision === "minute") return `${y}-${m}-${d}T${h}:${min}:00Z`;
  return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
}

/** Ordered step labels covering `[startSec, endSec)` at `step`. */
export function enumerateWhenSteps(
  window: TemporalWhenFilter,
  step: TemporalPrecision
): string[] {
  if (!(window.endSec > window.startSec)) return [];
  const steps: string[] = [];
  const firstIso = formatIsoFromMs(window.startSec * 1000, step);
  const first = expandTemporalIso(firstIso, step);
  let t = first ? first.start : window.startSec * 1000;
  const endMs = window.endSec * 1000;
  while (t < endMs) {
    if (steps.length >= MAX_WHEN_STEPS) {
      throw new QueryError(
        `when.step="${step}" produces more than ${MAX_WHEN_STEPS} bins in this range. Use a coarser step.`,
        400,
        { code: "when_step_limit", step, maxSteps: MAX_WHEN_STEPS }
      );
    }
    const iso = formatIsoFromMs(t, step);
    steps.push(iso);
    const next = expandTemporalIso(iso, step);
    if (!next || next.end <= t) break;
    t = next.end;
  }
  return steps;
}

/**
 * Every slider step in the requested window that intersects the row's
 * `_when_*` interval — same rule as a single-step `when.start`/`when.end`
 * filter, so a year-long row appears in each overlapping month step.
 */
export function stepsOverlappingInterval(
  rowStartSec: number,
  rowEndSec: number,
  window: TemporalWhenFilter,
  step: TemporalPrecision
): string[] {
  const start = Math.max(rowStartSec, window.startSec);
  const end = Math.min(rowEndSec, window.endSec);
  if (!(start < end)) return [];
  const steps: string[] = [];
  const firstIso = formatIsoFromMs(start * 1000, step);
  const first = expandTemporalIso(firstIso, step);
  let t = first ? first.start : start * 1000;
  const endMs = end * 1000;
  while (t < endMs) {
    const iso = formatIsoFromMs(t, step);
    steps.push(iso);
    const next = expandTemporalIso(iso, step);
    if (!next || next.end <= t) break;
    t = next.end;
  }
  return steps;
}
