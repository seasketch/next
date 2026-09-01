import {
  TemporalClock,
  TemporalGranularity,
  TemporalInfo,
  TemporalInterval,
  TemporalPrecision,
  TemporalIso,
  coarserPrecision,
  expandTemporalClock,
  expandTemporalIso,
  expandTemporalValue,
  isTemporalInfo,
  parseTemporalIso,
  temporalValueIntersects,
  unionTemporalCoverage,
} from "@seasketch/geostats-types";
import {
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  OverlayFragment,
} from "../generated/graphql";
import { LayerState } from "./MapContextManager";

export type VisibleTemporalSource = {
  tocStableId: string;
  dataSourceId: number;
  temporal: TemporalInfo;
  kind?: "layer" | "dataTable";
  tableStableId?: string;
};

/**
 * Max clock steps the slider will offer. Must stay in sync with
 * `MAX_WHEN_STEPS` on the overlay query server. 40_000 is ~109 years of
 * daily steps — enough for monitoring tables without exploding the
 * histogram (empty days are not painted).
 */
export const TIME_SLIDER_MAX_STEPS = 40000;
const MAX_STEPS = TIME_SLIDER_MAX_STEPS;

const VIEW_RESOLUTIONS: TemporalPrecision[] = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
];

const INTERNAL_TIME: TemporalGranularity[] = [
  "feature",
  "band",
  "row",
  "remote",
];

export function hasInternalTimeSeries(info: TemporalInfo): boolean {
  return INTERNAL_TIME.indexOf(info.granularity) !== -1;
}

export function coverageKey(coverage: TemporalInterval): string {
  // eslint-disable-next-line i18next/no-literal-string
  return `${coverage.start}|${coverage.end ?? ""}|${coverage.precision}`;
}

/**
 * Show the timeslider only when there is something to scrub:
 * more than one distinct layer-level span, or a source with per-feature /
 * per-band / per-row / remote time.
 */
export function shouldShowTimeSlider(
  sources: VisibleTemporalSource[]
): boolean {
  if (sources.length === 0) return false;
  if (sources.some((source) => hasInternalTimeSeries(source.temporal))) {
    return true;
  }
  if (sources.length < 2) return false;
  const keys = new Set<string>();
  for (const source of sources) {
    keys.add(coverageKey(source.temporal.coverage));
  }
  return keys.size > 1;
}

export function isLayerChecked(
  state: LayerState | undefined
): boolean {
  return Boolean(state?.visible) && !state?.hidden;
}

/**
 * ArcGIS services have no map-clock implementation. Ignore them so they
 * neither open the timeslider nor get paint-hidden when the year changes.
 */
const MAP_CLOCK_IGNORED_SOURCE_TYPES = [
  "ARCGIS_DYNAMIC_MAPSERVER",
  "ARCGIS_DYNAMIC_MAPSERVER_RASTER_SUBLAYER",
  "ARCGIS_DYNAMIC_MAPSERVER_VECTOR_SUBLAYER",
  "ARCGIS_RASTER_TILES",
  "ARCGIS_VECTOR",
];

export function sourceParticipatesInMapClock(
  sourceType: string | undefined
): boolean {
  if (!sourceType) return true;
  return MAP_CLOCK_IGNORED_SOURCE_TYPES.indexOf(sourceType) === -1;
}

export function collectVisibleTemporalSources(
  layerStates: { [stableId: string]: LayerState },
  tocItems: OverlayFragment[] | undefined,
  dataLayers: DataLayerDetailsFragment[] | undefined,
  dataSources: DataSourceDetailsFragment[] | undefined
): VisibleTemporalSource[] {
  if (!tocItems || !dataLayers || !dataSources) return [];
  const layersById: { [id: number]: DataLayerDetailsFragment } = {};
  for (const layer of dataLayers) {
    layersById[layer.id] = layer;
  }
  const sourcesById: { [id: number]: DataSourceDetailsFragment } = {};
  for (const source of dataSources) {
    sourcesById[source.id] = source;
  }
  const out: VisibleTemporalSource[] = [];
  for (const item of tocItems) {
    if (item.isFolder || !item.dataLayerId) continue;
    if (!isLayerChecked(layerStates[item.stableId])) continue;
    const layer = layersById[item.dataLayerId];
    if (!layer) continue;
    const source = sourcesById[layer.dataSourceId];
    if (source && isTemporalInfo(source.temporal)) {
      if (sourceParticipatesInMapClock(source.type)) {
        out.push({
          kind: "layer",
          tocStableId: item.stableId,
          dataSourceId: source.id,
          temporal: source.temporal,
        });
      }
    }
    const activatedStableId = layerStates[item.stableId]?.dataTable?.stableId;
    if (!activatedStableId) continue;
    const tables = item.overlayDataTables || [];
    const table = tables.find((entry) => entry.stableId === activatedStableId);
    if (!table || !isTemporalInfo(table.temporal)) continue;
    out.push({
      kind: "dataTable",
      tocStableId: item.stableId,
      dataSourceId: source?.id || layer.dataSourceId,
      tableStableId: table.stableId,
      temporal: table.temporal,
    });
  }
  return out;
}

export function domainForSources(
  sources: VisibleTemporalSource[],
  now: number = Date.now()
): TemporalInterval | null {
  return unionTemporalCoverage(
    sources.map((source) => source.temporal.coverage),
    now
  );
}

function sourceViewResolution(source: VisibleTemporalSource): TemporalPrecision {
  return (
    source.temporal.defaultViewResolution || source.temporal.nativeResolution
  );
}

export function resolutionForSources(
  sources: VisibleTemporalSource[]
): TemporalPrecision | null {
  if (sources.length === 0) return null;
  return sources.reduce(
    (acc, source) => coarserPrecision(acc, sourceViewResolution(source)),
    sourceViewResolution(sources[0])
  );
}

export function supportedViewResolutionsForSources(
  sources: VisibleTemporalSource[]
): TemporalPrecision[] {
  if (sources.length === 0) return [];
  let current: TemporalPrecision[] | null = null;
  for (const source of sources) {
    const listed = source.temporal.supportedViewResolutions;
    const list =
      listed && listed.length > 0
        ? listed
        : [sourceViewResolution(source)];
    current = current
      ? current.filter((precision) => list.indexOf(precision) !== -1)
      : list.slice();
  }
  if (current && current.length > 0) {
    return VIEW_RESOLUTIONS.filter(
      (precision) => current!.indexOf(precision) !== -1
    );
  }
  const fallback = resolutionForSources(sources);
  return fallback ? [fallback] : [];
}

export function viewResolutionsThatFit(
  domain: TemporalInterval,
  candidates: TemporalPrecision[],
  now: number = Date.now()
): TemporalPrecision[] {
  return candidates.filter((resolution) =>
    resolutionFitsDomain(domain, resolution, now)
  );
}

/** True when `resolution` covers the domain without exceeding {@link TIME_SLIDER_MAX_STEPS}. */
export function resolutionFitsDomain(
  domain: TemporalInterval,
  resolution: TemporalPrecision,
  now: number = Date.now()
): boolean {
  const expanded = expandTemporalValue(domain, now);
  if (!expanded || expanded.end <= expanded.start) return false;
  let count = 0;
  let t = expanded.start;
  while (t < expanded.end) {
    count += 1;
    if (count > MAX_STEPS) {
      return false;
    }
    const iso = formatIsoFromMs(t, resolution);
    const next = expandTemporalIso(iso, resolution);
    if (!next || next.end <= t) break;
    t = next.end;
  }
  return count > 0;
}

export function formatIsoFromMs(
  ms: number,
  precision: TemporalPrecision
): TemporalIso {
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
  /* ISO tokens are identifiers, not UI copy. */
  /* eslint-disable i18next/no-literal-string */
  if (precision === "hour") return `${y}-${m}-${d}T${h}:00:00Z`;
  if (precision === "minute") return `${y}-${m}-${d}T${h}:${min}:00Z`;
  return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
  /* eslint-enable i18next/no-literal-string */
}

export function nextIsoAtPrecision(
  iso: TemporalIso,
  precision: TemporalPrecision
): TemporalIso | null {
  const expanded = expandTemporalIso(iso, precision);
  if (!expanded) return null;
  return formatIsoFromMs(expanded.end, precision);
}

export function enumerateSteps(
  domain: TemporalInterval,
  resolution: TemporalPrecision,
  now: number = Date.now()
): TemporalIso[] {
  const expanded = expandTemporalValue(domain, now);
  if (!expanded || expanded.end <= expanded.start) return [];
  const steps: TemporalIso[] = [];
  let t = expanded.start;
  while (t < expanded.end && steps.length < MAX_STEPS) {
    const iso = formatIsoFromMs(t, resolution);
    steps.push(iso);
    const next = expandTemporalIso(iso, resolution);
    if (!next || next.end <= t) break;
    t = next.end;
  }
  return steps;
}

export type TimeSliderStepLayout = {
  step: TemporalIso;
  startPct: number;
  endPct: number;
  midPct: number;
};

function sliderPct(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Places each clock step in an equal-width slot (ordinal band scale).
 * Ten annual steps therefore snap at 5, 15, … 95 — not the native-range
 * positions 0 … 100, and not leap-year-skewed millisecond midpoints.
 */
export function layoutTimeSliderSteps(
  domain: TemporalInterval,
  resolution: TemporalPrecision,
  now: number = Date.now()
): TimeSliderStepLayout[] {
  const steps = enumerateSteps(domain, resolution, now);
  const n = steps.length;
  if (n === 0) return [];
  return steps.map((step, i) => ({
    step,
    startPct: sliderPct((i / n) * 100),
    endPct: sliderPct(((i + 1) / n) * 100),
    midPct: sliderPct(((i + 0.5) / n) * 100),
  }));
}

/** Map a pointer position (0–100 along the track) to the containing step. */
export function nearestTimeSliderStepIndex(
  layouts: TimeSliderStepLayout[],
  pct: number
): number {
  if (layouts.length === 0) return -1;
  const clamped = Math.max(0, Math.min(100, pct));
  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i];
    const last = i === layouts.length - 1;
    if (
      clamped >= layout.startPct &&
      (last ? clamped <= layout.endPct : clamped < layout.endPct)
    ) {
      return i;
    }
  }
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < layouts.length; i++) {
    const dist = Math.abs(layouts[i].midPct - clamped);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export type TimeSliderCoverageMark = {
  id: string;
  left: number;
  width: number;
  count?: number;
  heightPct?: number;
  kind?: "coverage" | "histogram";
};

function sourceMarkId(source: VisibleTemporalSource): string {
  return source.tableStableId
    ? // eslint-disable-next-line i18next/no-literal-string
      `table:${source.tableStableId}`
    : source.tocStableId;
}

function histogramCountForStep(
  source: VisibleTemporalSource,
  stepStart: number,
  stepEnd: number,
  now: number,
  stepIso?: string,
  queryCounts?: { [tableStableId: string]: { [step: string]: number } }
): number | null {
  if (source.tableStableId && queryCounts && queryCounts[source.tableStableId]) {
    if (!stepIso) return 0;
    return queryCounts[source.tableStableId][stepIso] ?? 0;
  }
  const availability = source.temporal.availability;
  if (!availability || availability.type !== "histogram") {
    return null;
  }
  let count = 0;
  let matched = false;
  for (const bin of availability.bins) {
    const expanded = expandTemporalIso(
      bin.start,
      availability.resolution
    );
    if (!expanded || expanded.start >= stepEnd || stepStart >= expanded.end) {
      continue;
    }
    matched = true;
    count += bin.count;
  }
  if (!matched) {
    const coverage = expandTemporalValue(source.temporal.coverage, now);
    if (
      coverage &&
      stepStart < coverage.end &&
      coverage.start < stepEnd
    ) {
      return 0;
    }
  }
  return matched ? count : 0;
}

/** Coverage painted onto the same equal-width slots as the snap points. */
export function layoutTimeSliderCoverageMarks(
  layouts: TimeSliderStepLayout[],
  sources: VisibleTemporalSource[],
  resolution: TemporalPrecision,
  now: number = Date.now(),
  queryCounts?: { [tableStableId: string]: { [step: string]: number } }
): TimeSliderCoverageMark[] {
  if (layouts.length === 0) return [];
  const marks: TimeSliderCoverageMark[] = [];
  const histogramSources = sources.filter(
    (source) =>
      (source.tableStableId &&
        queryCounts &&
        queryCounts[source.tableStableId]) ||
      (source.temporal.providesSliderStats &&
        source.temporal.availability?.type === "histogram")
  );
  const bandSources = sources.filter(
    (source) => histogramSources.indexOf(source) === -1
  );

  if (histogramSources.length > 0) {
    const stepCounts = layouts.map((layout) => {
      const step = expandTemporalIso(layout.step, resolution);
      if (!step) return 0;
      return histogramSources.reduce((acc, source) => {
        const count = histogramCountForStep(
          source,
          step.start,
          step.end,
          now,
          layout.step,
          queryCounts
        );
        return acc + (count || 0);
      }, 0);
    });
    const maxCount = stepCounts.reduce((acc, count) => Math.max(acc, count), 0);
    layouts.forEach((layout, index) => {
      const count = stepCounts[index];
      if (count <= 0) return;
      marks.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: `hist:${layout.step}`,
        left: layout.startPct,
        width: sliderPct(layout.endPct - layout.startPct),
        count,
        heightPct:
          maxCount > 0 ? Math.max(8, Math.round((count / maxCount) * 100)) : 8,
        kind: "histogram",
      });
    });
  }

  for (const source of bandSources) {
    const coverage = expandTemporalValue(source.temporal.coverage, now);
    if (!coverage) continue;
    let startPct: number | null = null;
    let endPct: number | null = null;
    for (const layout of layouts) {
      const step = expandTemporalIso(layout.step, resolution);
      if (!step || step.start >= coverage.end || coverage.start >= step.end) {
        continue;
      }
      if (startPct === null) startPct = layout.startPct;
      endPct = layout.endPct;
    }
    if (startPct === null || endPct === null || endPct <= startPct) continue;
    marks.push({
      id: sourceMarkId(source),
      left: startPct,
      width: sliderPct(endPct - startPct),
      kind: "coverage",
    });
  }
  return marks;
}

export function instantClockForStep(
  step: TemporalIso,
  resolution: TemporalPrecision
): TemporalClock | null {
  const end = nextIsoAtPrecision(step, resolution);
  if (!end) return null;
  return {
    mode: "instant",
    start: step,
    end,
    viewResolution: resolution,
  };
}

export function windowClockForRange(
  start: TemporalIso,
  end: TemporalIso,
  resolution: TemporalPrecision
): TemporalClock | null {
  const startMs = expandTemporalIso(start, resolution);
  const endMs = expandTemporalIso(end, resolution);
  if (!startMs || !endMs || endMs.end <= startMs.start) {
    return instantClockForStep(start, resolution);
  }
  return {
    mode: "window",
    start,
    end,
    viewResolution: resolution,
  };
}

/** Slider step keys covered by the current clock (one key, or a window). */
export function stepKeysForClock(
  clock: TemporalClock,
  domain: TemporalInterval,
  resolution: TemporalPrecision
): string[] {
  if (clock.mode !== "window") {
    return [clock.start];
  }
  const steps = enumerateSteps(domain, resolution);
  const last = lastIncludedStep(clock, steps, resolution);
  const startIdx = steps.indexOf(clock.start);
  const lastIdx = last ? steps.indexOf(last) : startIdx;
  if (startIdx < 0) {
    return [clock.start];
  }
  return steps.slice(startIdx, Math.max(startIdx, lastIdx) + 1);
}

export function lastIncludedStep(
  clock: TemporalClock,
  steps: TemporalIso[],
  resolution: TemporalPrecision
): TemporalIso | null {
  const endIdx = steps.findIndex(
    (step) => nextIsoAtPrecision(step, resolution) === clock.end
  );
  if (endIdx >= 0) return steps[endIdx];
  const startIdx = steps.indexOf(clock.start);
  if (startIdx >= 0) return steps[startIdx];
  return clock.start;
}

export function advanceClock(
  clock: TemporalClock,
  steps: TemporalIso[],
  resolution: TemporalPrecision
): TemporalClock | null {
  if (steps.length === 0) return null;
  const startIdx = steps.indexOf(clock.start);
  if (clock.mode === "window") {
    const last = lastIncludedStep(clock, steps, resolution);
    const lastIdx = last ? steps.indexOf(last) : startIdx;
    const width = Math.max(0, lastIdx - startIdx);
    const nextStart = startIdx < 0 ? 0 : (startIdx + 1) % (steps.length - width);
    const nextLast = Math.min(nextStart + width, steps.length - 1);
    const end = nextIsoAtPrecision(steps[nextLast], resolution);
    if (!end) return instantClockForStep(steps[nextStart], resolution);
    return windowClockForRange(steps[nextStart], end, resolution);
  }
  const nextIndex = startIdx < 0 ? 0 : (startIdx + 1) % steps.length;
  return instantClockForStep(steps[nextIndex], resolution);
}

export function latestClock(
  domain: TemporalInterval,
  resolution: TemporalPrecision,
  now: number = Date.now()
): TemporalClock | null {
  const steps = enumerateSteps(domain, resolution, now);
  if (steps.length === 0) return null;
  return instantClockForStep(steps[steps.length - 1], resolution);
}

function clockStepIndex(
  clock: TemporalClock,
  steps: TemporalIso[]
): number {
  return steps.indexOf(clock.start);
}

function stepOverlapsExpanded(
  step: TemporalIso,
  resolution: TemporalPrecision,
  expanded: { start: number; end: number }
): boolean {
  const range = expandTemporalIso(step, resolution);
  if (!range) return false;
  return range.start < expanded.end && range.end > expanded.start;
}

/**
 * Re-express a clock at a new slider resolution without jumping to latest.
 * Instant year 2018 → month becomes 2018-01; a window keeps every overlapping
 * step. If nothing overlaps, pick the step nearest the previous start.
 */
export function snapClockToResolution(
  clock: TemporalClock,
  domain: TemporalInterval,
  resolution: TemporalPrecision,
  now: number = Date.now()
): TemporalClock | null {
  const steps = enumerateSteps(domain, resolution, now);
  if (steps.length === 0) return null;
  const expanded = expandTemporalClock(clock);
  if (!expanded) {
    return latestClock(domain, resolution, now);
  }

  const overlapping = steps.filter((step) =>
    stepOverlapsExpanded(step, resolution, expanded)
  );

  const pickInstant = (step: TemporalIso) =>
    instantClockForStep(step, resolution);

  if (overlapping.length === 0) {
    let nearest = steps[0];
    let nearestDist = Infinity;
    for (const step of steps) {
      const range = expandTemporalIso(step, resolution);
      if (!range) continue;
      const dist = Math.abs(range.start - expanded.start);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = step;
      }
    }
    return pickInstant(nearest);
  }

  if (clock.mode === "window") {
    const first = overlapping[0];
    const last = overlapping[overlapping.length - 1];
    const end = nextIsoAtPrecision(last, resolution);
    if (!end) return pickInstant(first);
    return windowClockForRange(first, end, resolution);
  }

  return pickInstant(overlapping[0]);
}

/**
 * Keep the current clock when it is still a valid step and does not hide a
 * newly toggled layer-granularity source. A resolution change snaps the
 * previous interval onto the new step list instead of jumping to latest.
 */
export function reconcileClock(
  previous: TemporalClock | null,
  domain: TemporalInterval,
  resolution: TemporalPrecision,
  previousIds: string[],
  nextSources: VisibleTemporalSource[],
  now: number = Date.now()
): TemporalClock | null {
  const steps = enumerateSteps(domain, resolution, now);
  if (steps.length === 0) return null;
  const fallback = instantClockForStep(steps[steps.length - 1], resolution);
  const prevIds = new Set(previousIds);
  const newLayerSources = nextSources.filter(
    (source) =>
      !prevIds.has(source.tocStableId) &&
      source.temporal.granularity === "layer"
  );
  const aligned =
    previous && previous.viewResolution !== resolution
      ? snapClockToResolution(previous, domain, resolution, now)
      : previous;
  if (aligned) {
    const idx = clockStepIndex(aligned, steps);
    if (idx !== -1) {
      const expanded = expandTemporalClock(aligned);
      const hidesNew =
        expanded &&
        newLayerSources.some(
          (source) =>
            !temporalValueIntersects(source.temporal.coverage, expanded, now)
        );
      if (!hidesNew) {
        return aligned;
      }
      const newDomain = unionTemporalCoverage(
        newLayerSources.map((source) => source.temporal.coverage),
        now
      );
      if (newDomain) {
        return latestClock(newDomain, resolution, now) || fallback;
      }
    }
  }
  return fallback;
}

/**
 * Layer-granularity sources that do not intersect the clock. Feature / band /
 * row / remote sources stay painted (their internal time is not filtered yet).
 */
export function tocIdsHiddenByClock(
  sources: VisibleTemporalSource[],
  clock: TemporalClock,
  now: number = Date.now()
): string[] {
  const expanded = expandTemporalClock(clock);
  if (!expanded) return [];
  const hidden: string[] = [];
  for (const source of sources) {
    if (source.temporal.granularity !== "layer") continue;
    if (
      !temporalValueIntersects(source.temporal.coverage, expanded, now)
    ) {
      hidden.push(source.tocStableId);
    }
  }
  return hidden;
}

function formatIsoLabel(
  iso: TemporalIso,
  resolution: TemporalPrecision,
  locale?: string
): string {
  const parts = parseTemporalIso(iso);
  if (!parts) return iso;
  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
  );
  const loc = locale || undefined;
  switch (resolution) {
    case "year":
      return String(date.getUTCFullYear());
    case "month":
      return date.toLocaleDateString(loc, {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    case "day":
      return date.toLocaleDateString(loc, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    default:
      return date.toLocaleString(loc, { timeZone: "UTC" });
  }
}

export function formatClockLabel(
  clock: TemporalClock,
  locale?: string,
  steps?: TemporalIso[]
): string {
  const startLabel = formatIsoLabel(clock.start, clock.viewResolution, locale);
  if (clock.mode !== "window") {
    return startLabel;
  }
  const last = lastIncludedStep(clock, steps || [], clock.viewResolution);
  if (!last || last === clock.start) {
    return startLabel;
  }
  const endLabel = formatIsoLabel(last, clock.viewResolution, locale);
  // eslint-disable-next-line i18next/no-literal-string
  return `${startLabel} – ${endLabel}`;
}
