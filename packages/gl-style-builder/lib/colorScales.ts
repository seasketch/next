import type { RasterValueSteps } from "ai-data-analyst";
import type {
  GeostatsAttribute,
  RasterBandInfo,
  RasterBucket,
} from "@seasketch/geostats-types";
import * as d3Chromatic from "d3-scale-chromatic";
import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
import {
  AnyLayer,
  CircleLayer,
  Expression,
  FillLayer,
  LineLayer,
  RasterLayer,
  SymbolLayer,
} from "mapbox-gl";

extend([namesPlugin]);

/**
 * Resolved d3-scale-chromatic scale as a callable.
 * - Continuous scales: pass a fraction in [0, 1].
 * - Categorical scales: pass a bucket index (0, 1, …), or when
 *   {@link ColorScaleFn.categoricalKeyToColor} is set (object custom palette),
 *   pass the attribute value string for a direct key→color lookup.
 * `name` is the export key (e.g. `interpolatePlasma`) or `customPalette` / `""`.
 */
export type ColorScaleFn = ((value: number | string) => string) & {
  name: string;
  /** Set for object-shaped custom palettes: exact attribute-value string → color. */
  categoricalKeyToColor?: ReadonlyMap<string, string>;
};

function defineScaleName(fn: ColorScaleFn, resolvedName: string): ColorScaleFn {
  Object.defineProperty(fn, "name", {
    value: resolvedName,
    configurable: true,
  });
  return fn;
}

/** Deterministic ordering for category strings (matches object custom palette key sort). */
export function compareCategoricalKeys(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function sortCategoricalStrings(values: readonly string[]): string[] {
  return [...values].sort(compareCategoricalKeys);
}

function defineCategoricalColorScale(
  fn: (value: number | string) => string,
  resolvedName: string,
  keyToColor?: ReadonlyMap<string, string>,
): ColorScaleFn {
  const out = fn as ColorScaleFn;
  defineScaleName(out, resolvedName);
  if (keyToColor) {
    Object.defineProperty(out, "categoricalKeyToColor", {
      value: keyToColor,
      configurable: true,
      enumerable: false,
    });
  }
  return out;
}

/** Parse and normalize a single color string; returns null if missing or invalid. */
function parseValidCssColor(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const c = colord(trimmed);
  if (!c.isValid()) return null;
  if (c.alpha() < 1) {
    return c.toRgbString();
  }
  return c.toHex();
}

/**
 * Build a categorical {@link ColorScaleFn} from LLM/user palette input.
 * Invalid entries are omitted. Arrays keep valid colors in order. Objects are
 * sorted by key (numeric-aware) and treated as an ordered list for bucket indices.
 *
 * @returns A named scale, or `null` if no valid colors remain (use a named d3 scale instead).
 */
export function buildCustomColorScale(
  customPalette: string[] | Record<string, string>,
): ColorScaleFn | null {
  if (Array.isArray(customPalette)) {
    const colors: string[] = [];
    for (const item of customPalette) {
      const parsed = parseValidCssColor(item);
      if (parsed !== null) {
        colors.push(parsed);
      }
    }
    if (colors.length === 0) {
      return null;
    }
    const len = colors.length;
    const fn = (value: number | string) => {
      const n = typeof value === "number" ? value : Number(value);
      const idx = Number.isFinite(n) ? Math.trunc(n) : 0;
      return colors[((idx % len) + len) % len]!;
    };
    return defineCategoricalColorScale(fn, "customPalette");
  }

  const pairs: { key: string; color: string }[] = [];
  for (const [key, value] of Object.entries(customPalette)) {
    const parsed = parseValidCssColor(value);
    if (parsed !== null) {
      pairs.push({ key, color: parsed });
    }
  }
  if (pairs.length === 0) {
    return null;
  }

  pairs.sort((a, b) => compareCategoricalKeys(a.key, b.key));
  const colors = pairs.map((p) => p.color);
  const len = colors.length;
  const keyToColor = new Map<string, string>(
    pairs.map((p) => [p.key, p.color] as const),
  );
  const fn = (value: number | string) => {
    if (typeof value === "string") {
      const direct = keyToColor.get(value);
      if (direct !== undefined) {
        return direct;
      }
    }
    const n = typeof value === "number" ? value : Number(value);
    const idx = Number.isFinite(n) ? Math.trunc(n) : 0;
    return colors[((idx % len) + len) % len]!;
  };
  return defineCategoricalColorScale(fn, "customPalette", keyToColor);
}

export const colorScales = {
  categorical: [
    "schemeCategory10",
    "schemeTableau10",
    "schemeAccent",
    "schemeDark2",
    "schemePaired",
    "schemePastel1",
    "schemePastel2",
    "schemeSet1",
    "schemeSet2",
    "schemeSet3",
  ],
  continuous: {
    diverging: [
      "interpolateBrBG",
      "interpolatePRGn",
      "interpolatePiYG",
      "interpolatePuOr",
      "interpolateRdBu",
      "interpolateRdGy",
      "interpolateRdYlBu",
      "interpolateRdYlGn",
      "interpolateSpectral",
    ],
    sequential: [
      "interpolateBlues",
      "interpolateGreens",
      "interpolateGreys",
      "interpolateOranges",
      "interpolatePurples",
      "interpolateReds",
      "interpolateTurbo",
      "interpolateViridis",
      "interpolateInferno",
      "interpolateMagma",
      "interpolatePlasma",
      "interpolateCividis",
      "interpolateWarm",
      "interpolateCool",
      "interpolateCubehelixDefault",
      "interpolateBuGn",
      "interpolateBuPu",
      "interpolateGnBu",
      "interpolateOrRd",
      "interpolatePuBuGn",
      "interpolatePuBu",
      "interpolatePuRd",
      "interpolateRdPu",
      "interpolateYlGnBu",
      "interpolateYlGn",
      "interpolateYlOrBr",
      "interpolateYlOrRd",
    ],
    cyclical: ["interpolateRainbow", "interpolateSinebow"],
  },
};

/**
 * Given a type of color scale and a name, find and return an instance of
 * d3-scale-chromatic that is the best match. If no match is found, return a
 * default (appropriate for the type).
 * @param type 'categorical' | 'continuous'
 * @param name - The name of the color scale to get. This name may be coming
 * from our llm-based "ai cartographer", so it could be mismatched in case or
 * incomplete.
 * @param customPalette - A custom palette to use instead of the default or the named scale. Only valid for categorical scales. This
 * could also be coming from an llm, so it could have all sorts of invalid
 * values or issues. It will need strict validation. It could be in the form of:
 *   * an array of colors (e.g. ["#000000", "#FFFFFF", "green", "rgb(0, 0, 0)",
 *     rgba(0, 0, 0, 0.5), "inva-lid", null])
 *   * an object keyed by category value, with each value set to a hex color
 *     string (e.g. { "1": "#000000", "2": "#FFFFFF", "3": "green", "4":
 *     "invalid", "5": null })
 *   * null or undefined to use the default palette
 *   * an empty object to use the default palette
 * @returns A callable scale; invoke with a normalized value in [0, 1] for
 * continuous scales, or a bucket index for categorical. `fn.name` is the
 * resolved d3-scale-chromatic export name (e.g. `interpolatePlasma`).
 */
export function getColorScale(
  type: "categorical" | "continuous",
  name: string,
  customPalette?: string[] | Record<string, string> | null,
): ColorScaleFn {
  if (customPalette && type === "categorical") {
    const customScale = buildCustomColorScale(customPalette);
    if (customScale) {
      return customScale;
    }
  }
  const candidates: string[] = [];
  if (type === "categorical") {
    candidates.push(...colorScales.categorical);
  } else if (type === "continuous") {
    candidates.push(...colorScales.continuous.sequential);
    candidates.push(...colorScales.continuous.diverging);
    candidates.push(...colorScales.continuous.cyclical);
  }
  const bestMatch = candidates.find((candidate) =>
    candidate.toLowerCase().includes(name.toLowerCase()),
  );
  const resolvedName =
    bestMatch && bestMatch in d3Chromatic
      ? bestMatch
      : type === "categorical"
        ? "schemeCategory10"
        : "interpolatePlasma";
  const scale = d3Chromatic[resolvedName as keyof typeof d3Chromatic];

  if (type === "categorical") {
    const colors = scale as readonly string[];
    const len = colors.length;
    const fn = (value: number | string) => {
      const n = typeof value === "number" ? value : Number(value);
      const idx = Number.isFinite(n) ? Math.trunc(n) : 0;
      return colors[((idx % len) + len) % len]!;
    };
    return defineCategoricalColorScale(fn, resolvedName);
  }

  const interpolate = scale as (t: number) => string;
  const fn = (t: number | string) => {
    const x = typeof t === "number" ? t : Number(t);
    return interpolate(Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
  };
  return defineScaleName(fn, resolvedName);
}

/**
 * Builds a mapbox-gl-style interpolate expression that can be used for raster
 * or vector layers
 */
export function buildContinuousColorExpression(
  colorScale: ColorScaleFn,
  reverse: boolean,
  range: [number, number],
  arg: Expression,
) {
  const fnName = "interpolate";
  const iType = ["linear"];
  const stops = [];
  const nStops = 10;
  const interval = (range[1] - range[0]) / (nStops - 1);
  if (interval === 0) {
    stops.push(range[0], colorScale(0));
  } else {
    for (var i = 0; i < nStops; i++) {
      const fraction = reverse ? 1 - i / (nStops - 1) : i / (nStops - 1);
      stops.push(range[0] + interval * i, colorScale(fraction));
    }
  }
  return [fnName, iType, arg, ...stops] as Expression;
}

/** Raster stats keys that expose {@link RasterBandInfo["stats"]} bucket maps by class count. */
export type RasterStepMethod =
  | "equalInterval"
  | "geometricInterval"
  | "naturalBreaks"
  | "quantiles"
  | "standardDeviations";

const RASTER_STEP_METHODS: ReadonlySet<string> = new Set<RasterStepMethod>([
  "equalInterval",
  "geometricInterval",
  "naturalBreaks",
  "quantiles",
  "standardDeviations",
]);

export function isRasterStepMethod(value: string): value is RasterStepMethod {
  return RASTER_STEP_METHODS.has(value);
}

/** Postgres / GraphQL `value_steps` → geostats `stats` bucket map key. */
export function rasterValueStepsToRasterStepMethod(
  steps: RasterValueSteps,
): RasterStepMethod | null {
  switch (steps) {
    case "CONTINUOUS":
      return null;
    case "EQUAL_INTERVALS":
      return "equalInterval";
    case "NATURAL_BREAKS":
      return "naturalBreaks";
    case "QUANTILES":
      return "quantiles";
  }
}

/**
 * Sample `n` colors along a continuous scale (same fractions as the admin style
 * editor uses for function palettes in `getColorStops`).
 */
export function getColorStopsFromScale(
  colorScale: ColorScaleFn,
  n: number,
  reverse: boolean,
): string[] {
  if (n <= 0) {
    return [];
  }
  if (n === 1) {
    return [colorScale(reverse ? 1 : 0)];
  }
  const stops: string[] = [];
  for (let i = 0; i < n; i++) {
    const fraction = reverse ? 1 - i / (n - 1) : i / (n - 1);
    stops.push(colorScale(fraction));
  }
  return stops;
}

/**
 * Mapbox `step` paint expression for raster values, aligned with
 * `buildStepExpression` in the client style editor (continuous palette sampled
 * at each class).
 */
export function buildRasterStepColorExpression(
  buckets: RasterBucket[],
  colorScale: ColorScaleFn,
  reverse: boolean,
  arg: Expression,
): Expression {
  const expression: Expression = ["step", arg, "transparent"];
  const nStops = buckets.length - 1;
  const colors = getColorStopsFromScale(colorScale, nStops, reverse);
  for (let i = 0; i < nStops; i++) {
    const bucket = buckets[i]!;
    if (buckets[1] !== null && (i === 0 || bucket[0] !== buckets[i - 1]![0])) {
      expression.push(bucket[0], colors[i]!);
    }
  }
  return expression;
}

/**
 * Resolve precomputed break buckets for a histogram method and requested class
 * count.
 *
 * - If the stats map for `method` is missing or empty, or no entry has enough
 *   breaks to build a step expression, returns `null` (caller should use a
 *   continuous ramp).
 * - Otherwise picks the **numeric key** whose bucket list is valid
 *   (`length >= 2`) and is **closest** to `n` (ties → smaller key).
 */
export function resolveRasterStepBuckets(
  stats: RasterBandInfo["stats"],
  method: RasterStepMethod,
  n: number,
): { n: number; buckets: RasterBucket[] } | null {
  const bucketsByN = stats[method];
  if (!bucketsByN || typeof bucketsByN !== "object") {
    return null;
  }
  const requested = Math.round(n);
  const validKeys: number[] = [];
  for (const key of Object.keys(bucketsByN)) {
    const k = parseInt(key, 10);
    if (!Number.isFinite(k)) {
      continue;
    }
    const b = bucketsByN[k as keyof typeof bucketsByN];
    if (b && b.length >= 2) {
      validKeys.push(k);
    }
  }
  if (validKeys.length === 0) {
    return null;
  }
  let bestK = validKeys[0]!;
  let bestDist = Math.abs(bestK - requested);
  for (const k of validKeys) {
    const d = Math.abs(k - requested);
    if (d < bestDist || (d === bestDist && k < bestK)) {
      bestK = k;
      bestDist = d;
    }
  }
  const buckets = bucketsByN[bestK as keyof typeof bucketsByN]!;
  return { n: bestK, buckets };
}

/**
 * Inspects a custom palette and returns a single color if it is valid. Performs
 * extensive validation and normalization of the palette.
 * @param customPalette - LLM-generated custom palette
 */
export function getSingleColorFromCustomPalette(
  customPalette?: null | string | string[] | Record<string, string>,
): string | null {
  if (!customPalette) {
    return null;
  }
  if (Array.isArray(customPalette)) {
    return parseValidCssColor(customPalette[0]) ?? null;
  }
  if (typeof customPalette === "string") {
    return parseValidCssColor(customPalette) ?? null;
  }
  if (typeof customPalette === "object") {
    if ("*" in customPalette) {
      return parseValidCssColor(customPalette["*"]) ?? null;
    }
    if ("default" in customPalette) {
      return parseValidCssColor(customPalette["default"]) ?? null;
    }
    for (const [key, value] of Object.entries(customPalette)) {
      const parsed = parseValidCssColor(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  return null;
}

export function autoStrokeColorForFillColor(fillColor: string) {
  const c = colord(fillColor);
  if (c.alpha() === 0) {
    return "#558";
  }
  if (c.isDark()) {
    return c.lighten(0.3).alpha(1).toRgbString();
  } else {
    return c.darken(0.15).alpha(1).toRgbString();
  }
}

// Colors borrowed from https://github.com/mapbox/mbview/blob/master/views/vector.ejs#L75
var lightColors = [
  "#FC49A3", // pink
  "#CC66FF", // purple-ish
  "#1b14e3", // blue
  "#009463", // dark green
  "#0ac90a", // green
  "#FFCC66", // light orange
  "#FF6666", // salmon
  "#FF0000", // red
  "#FF8000", // orange
  "#dede00", // yellow
  "#00FFFF", // turquoise
];

let i = 0;

export function getDefaultFillColor() {
  i++;
  if (i >= lightColors.length) {
    i = 0;
  }
  return lightColors[i];
}

/**
 * Build mapbox-gl-style match expression for a categorical attribute, matching
 * colors in the scale to attribute values.
 * @param attribute
 * @param colorScale
 * @param reverse
 */
export function buildMatchExpressionForAttribute(
  attribute: GeostatsAttribute,
  colorScale: ColorScaleFn,
  reverse: boolean,
): Expression {
  const keyMap = colorScale.categoricalKeyToColor;
  const uniqueValues = sortCategoricalStrings(Object.keys(attribute.values));
  if (reverse) {
    uniqueValues.reverse();
  }
  const getExpr = ["get", attribute.attribute];
  const expression: Expression = ["match", getExpr];
  for (let i = 0; i < uniqueValues.length; i++) {
    let value: any = uniqueValues[i]!;
    if (attribute.type === "number") {
      value = Number(value);
    } else if (attribute.type === "boolean") {
      value = value === "true" ? true : false;
    }
    const color = keyMap?.get(value) ?? colorScale(i);
    expression.push(value, color);
  }
  expression.push("transparent");
  return expression;
}

/** Layer slice used when building styles before `id` / `source` are assigned. */
type LayerWithMetadata = {
  metadata?: Record<string, unknown>;
};

export function setPaletteMetadata(
  layer: LayerWithMetadata,
  colorScale: ColorScaleFn,
) {
  if (layer.metadata == null) {
    layer.metadata = {};
  }
  if (colorScale.name && colorScale.name !== "customPalette") {
    // check if the color scale is a named d3 scale
    if (
      colorScales.continuous.sequential.includes(colorScale.name) ||
      colorScales.continuous.diverging.includes(colorScale.name) ||
      colorScales.continuous.cyclical.includes(colorScale.name) ||
      colorScales.categorical.includes(colorScale.name)
    ) {
      layer.metadata["s:palette"] = colorScale.name;
    }
  }
}
