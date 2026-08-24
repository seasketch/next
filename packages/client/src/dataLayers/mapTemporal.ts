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
};

const MAX_STEPS = 2000;

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
    if (!source || !isTemporalInfo(source.temporal)) continue;
    if (!sourceParticipatesInMapClock(source.type)) continue;
    out.push({
      tocStableId: item.stableId,
      dataSourceId: source.id,
      temporal: source.temporal,
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

export function resolutionForSources(
  sources: VisibleTemporalSource[]
): TemporalPrecision | null {
  if (sources.length === 0) return null;
  return sources.reduce(
    (acc, source) => coarserPrecision(acc, source.temporal.nativeResolution),
    sources[0].temporal.nativeResolution
  );
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

/**
 * Keep the current clock when it is still a valid step and does not hide a
 * newly toggled layer-granularity source. Otherwise snap to the latest step
 * of the new source (or the domain).
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
  if (previous && previous.viewResolution === resolution) {
    const idx = clockStepIndex(previous, steps);
    if (idx !== -1) {
      const expanded = expandTemporalClock(previous);
      const hidesNew =
        expanded &&
        newLayerSources.some(
          (source) =>
            !temporalValueIntersects(source.temporal.coverage, expanded, now)
        );
      if (!hidesNew) {
        return previous;
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

export function formatClockLabel(
  clock: TemporalClock,
  locale?: string
): string {
  const parts = parseTemporalIso(clock.start);
  if (!parts) return clock.start;
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
  switch (clock.viewResolution) {
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
