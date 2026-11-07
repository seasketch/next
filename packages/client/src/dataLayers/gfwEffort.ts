import { Expression } from "mapbox-gl";
import { TemporalClock } from "@seasketch/geostats-types";
import { withHostedAuthParams } from "./tilesAuth";

export const GFW_SOURCE_TYPE = "GFW_4WINGS";
export const GFW_DATASET = "public-global-fishing-effort";
export const GFW_DATASET_VERSION = "v5.0";
export const GFW_COVERAGE_START_YEAR = 2012;
export const GFW_SOURCE_LAYER = "main";
export const GFW_TILES_HOST = "https://tiles.seasketch.org";

/** Sequential yellow–red ramp. Zero hours stay transparent. */
export const GFW_RAMP = ["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#800026"];

/**
 * Zoom-0 hour breaks used until `/gfw/bins` returns. The top stop matches the
 * v5.0 bins scale observed for this dataset.
 */
export const GFW_FALLBACK_BINS = [0, 24, 240, 2400, 24000, 8320000];

export type GfwFrame = {
  years: number[];
  /** Calendar year that is still incomplete, when it is in the painted frame. */
  partialYear: number | null;
};

let hoverFrame: GfwFrame = {
  years: [],
  partialYear: null,
};

export function isGfwSourceType(type: string | null | undefined): boolean {
  return type === GFW_SOURCE_TYPE;
}

export function gfwTileUrl(): string {
  return `${GFW_TILES_HOST}/gfw/tile/{z}/{x}/{y}.mvt?dataset=${GFW_DATASET}&version=${GFW_DATASET_VERSION}&interval=YEAR`;
}

export function gfwBinsUrl(): string {
  return `${GFW_TILES_HOST}/gfw/bins?dataset=${GFW_DATASET}&version=${GFW_DATASET_VERSION}&interval=YEAR`;
}

export function gfwYearOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const match = /^(\d{4})/.exec(iso);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Years whose hour properties the current clock should paint.
 * Instant reads one year. A window sums the years it covers.
 * Cumulative sums from 2012 through the selected year.
 */
export function gfwFrameForClock(
  clock: TemporalClock | null,
  now: Date = new Date(),
  coverageStartYear: number = GFW_COVERAGE_START_YEAR
): GfwFrame {
  const currentYear = now.getUTCFullYear();
  const selected = gfwYearOf(clock?.start) ?? currentYear;
  let years: number[] = [];
  if (!clock || clock.mode === "instant" || clock.mode === "cumulative") {
    const through = selected;
    const from = clock?.mode === "cumulative" ? coverageStartYear : through;
    for (let year = from; year <= through; year++) {
      years.push(year);
    }
  } else {
    const start = gfwYearOf(clock.start) ?? coverageStartYear;
    const exclusive = gfwYearOf(clock.end);
    const last = exclusive == null ? start : exclusive - 1;
    for (let year = start; year <= last; year++) {
      years.push(year);
    }
  }
  years = years.filter(
    (year) => year >= coverageStartYear && year <= currentYear
  );
  if (years.length === 0) {
    years = [Math.min(Math.max(selected, coverageStartYear), currentYear)];
  }
  return {
    years,
    partialYear: years.indexOf(currentYear) >= 0 ? currentYear : null,
  };
}

export function setGfwHoverFrame(frame: GfwFrame) {
  hoverFrame = frame;
}

export function getGfwHoverFrame(): GfwFrame {
  return hoverFrame;
}

export function gfwYearHours(year: number): Expression {
  return ["to-number", ["get", String(year)], 0];
}

export function gfwHoursExpression(years: number[]): Expression {
  if (years.length === 0) return ["literal", 0];
  if (years.length === 1) return gfwYearHours(years[0]);
  return ["+", ...years.map(gfwYearHours)] as Expression;
}

export function gfwHoursFromProperties(
  properties: { [key: string]: unknown } | null | undefined,
  years: number[]
): number {
  if (!properties) return 0;
  let total = 0;
  for (const year of years) {
    const raw = properties[String(year)];
    const value =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : 0;
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

export function gfwOpacityExpression(
  hours: Expression,
  opacity: number
): Expression {
  const clamped = Math.max(0, Math.min(1, opacity));
  return ["*", clamped, ["case", [">", hours, 0], 0.85, 0]];
}

/** Positive zoom-0 breaks divided by 4^z, matching the 4Wings bins rule. */
export function gfwBreaksForZoom(bins: number[], zoom: number): number[] {
  const z = Math.max(0, Math.min(12, Math.floor(zoom)));
  const scale = Math.pow(4, z);
  const positive = bins
    .filter((value) => typeof value === "number" && value > 0)
    .sort((a, b) => a - b);
  const source = positive.length > 0 ? positive : GFW_FALLBACK_BINS.slice(1);
  return source.map((value) => value / scale);
}

export function gfwColorExpression(
  hours: Expression,
  bins: number[]
): Expression {
  const stops = sampleBreaks(
    bins.filter((value) => value > 0).sort((a, b) => a - b)
  );
  const expression: unknown[] = ["step", ["zoom"], ramp(hours, stops)];
  for (let zoom = 1; zoom <= 12; zoom++) {
    const scale = Math.pow(4, zoom);
    expression.push(
      zoom,
      ramp(
        hours,
        stops.map((value) => value / scale)
      )
    );
  }
  return expression as Expression;
}

export function parseGfwBins(body: unknown): number[] | null {
  let values: unknown[] | null = null;
  if (Array.isArray(body)) {
    values = body;
  } else if (
    body !== null &&
    typeof body === "object" &&
    "bins" in body &&
    Array.isArray(body.bins)
  ) {
    values = body.bins;
  }
  if (!values) return null;
  const bins: number[] = [];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      bins.push(value);
    }
  }
  bins.sort((a, b) => a - b);
  return bins.some((value) => value > 0) ? bins : null;
}

export async function fetchGfwBins(
  accessToken: string | null | undefined
): Promise<number[] | null> {
  const url = withHostedAuthParams(gfwBinsUrl(), { accessToken });
  const response = await fetch(url);
  if (!response.ok) return null;
  const body: unknown = await response.json();
  return parseGfwBins(body);
}

export function gfwCreateParams(): {
  version: 1;
  dataset: typeof GFW_DATASET;
  datasetVersion: typeof GFW_DATASET_VERSION;
  intervals: ["YEAR"];
} {
  return {
    version: 1,
    dataset: GFW_DATASET,
    datasetVersion: GFW_DATASET_VERSION,
    intervals: ["YEAR"],
  };
}

function sampleBreaks(bins: number[]): number[] {
  const positive = bins.filter((value) => value > 0);
  const source = positive.length > 0 ? positive : GFW_FALLBACK_BINS.slice(1);
  if (source.length <= GFW_RAMP.length) return source;
  const chosen: number[] = [];
  for (let i = 0; i < GFW_RAMP.length; i++) {
    const index = Math.round((i * (source.length - 1)) / (GFW_RAMP.length - 1));
    chosen.push(source[index]);
  }
  return chosen;
}

function ramp(hours: Expression, breaks: number[]): Expression {
  const expression: unknown[] = [
    "interpolate",
    ["linear"],
    hours,
    0,
    "rgba(0,0,0,0)",
  ];
  const count = Math.min(GFW_RAMP.length, breaks.length);
  for (let i = 0; i < count; i++) {
    expression.push(breaks[i], GFW_RAMP[i]);
  }
  return expression as Expression;
}
