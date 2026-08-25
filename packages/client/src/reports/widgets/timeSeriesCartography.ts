import { Expression } from "mapbox-gl";
import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import { ExpressionEvaluator } from "../../dataLayers/legends/ExpressionEvaluator";
import { isTransparentColor } from "../utils/colors";

extend([a11yPlugin]);

/** Fallback when a layer has no usable paint color. */
export const DEFAULT_TIME_SERIES_COLOR = "#0284c7";

const CHART_BG = "#ffffff";
/** WCAG contrast for non-text graphics (2px strokes on white). */
const MIN_CONTRAST = 3;

export type TimeSeriesColorRole = "observed" | "interpolated" | "span";

export type TimeSeriesCartographyMode = "stats" | "area" | "sum_proportion";

export type TimeSeriesDatumColors = {
  color?: string;
  colorMin?: string;
  colorMax?: string;
};

/**
 * Darkens (and slightly saturates) a map color until it reads on the
 * white chart. Pale legend stops are common for continuous rasters.
 */
export function contrastSafeChartColor(
  css: string,
  fallback = DEFAULT_TIME_SERIES_COLOR
): string {
  let c = colord(css);
  if (!c.isValid()) return fallback;
  c = c.alpha(1);
  for (let i = 0; i < 8 && c.contrast(CHART_BG) < MIN_CONTRAST; i++) {
    c = c.darken(0.08).saturate(0.05);
  }
  return c.toHex();
}

/**
 * Variants so interpolated connectors, observed marks, and multi-year
 * spans stay distinguishable without leaving the layer's hue family.
 */
export function timeSeriesRoleColor(
  base: string,
  role: TimeSeriesColorRole
): string {
  const c = colord(base);
  if (!c.isValid()) return base;
  if (role === "interpolated") {
    return contrastSafeChartColor(c.lighten(0.14).desaturate(0.12).toHex());
  }
  if (role === "span") {
    return contrastSafeChartColor(c.rotate(-16).darken(0.1).toHex());
  }
  return contrastSafeChartColor(base);
}

/** First `raster-color` on a raster layer, or null. */
export function rasterColorFromStyles(
  styles: unknown
): Expression | string | null {
  if (!Array.isArray(styles)) return null;
  for (const layer of styles) {
    if (!layer || typeof layer !== "object") continue;
    const typed = layer as { type?: unknown; paint?: Record<string, unknown> };
    if (typed.type !== "raster" || !typed.paint) continue;
    const expr = typed.paint["raster-color"];
    if (typeof expr === "string" && expr.length > 0) return expr;
    if (Array.isArray(expr) && expr.length >= 2) {
      return expr as Expression;
    }
  }
  return null;
}

/**
 * True when paint maps the raster (Y-axis) value to a color. Literal
 * colors and missing expressions do not follow the plotted value.
 */
export function rasterColorFollowsValue(
  expression: Expression | string | null
): boolean {
  if (!expression || typeof expression === "string") return false;
  const fn = expression[0];
  return (
    typeof fn === "string" &&
    (/^interpolate(-hcl|-lab)?$/.test(fn) || fn === "step" || fn === "match")
  );
}

function rewriteRasterColorInput(expression: Expression): Expression {
  const fnType = expression[0];
  return /interpolate/.test(String(fnType))
    ? ([
        expression[0],
        expression[1],
        ["get", "value"],
        ...expression.slice(3),
      ] as Expression)
    : ([expression[0], ["get", "value"], ...expression.slice(2)] as Expression);
}

function cssFromEvaluatorColor(result: unknown): string | null {
  if (typeof result === "string") {
    return colord(result).isValid() ? result : null;
  }
  if (!result || typeof result !== "object") return null;
  if (typeof (result as { toString?: unknown }).toString === "function") {
    const printed = (result as { toString: () => string }).toString();
    if (printed && printed !== "[object Object]" && colord(printed).isValid()) {
      return printed;
    }
  }
  const rgba = result as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
  if (
    typeof rgba.r !== "number" ||
    typeof rgba.g !== "number" ||
    typeof rgba.b !== "number"
  ) {
    return null;
  }
  const scale = rgba.r <= 1 && rgba.g <= 1 && rgba.b <= 1 ? 255 : 1;
  const parsed = colord({
    r: Math.round(rgba.r * scale),
    g: Math.round(rgba.g * scale),
    b: Math.round(rgba.b * scale),
    a: typeof rgba.a === "number" ? rgba.a : 1,
  });
  return parsed.isValid() ? parsed.toHex() : null;
}

/** Evaluate a raster-color expression at a numeric raster value. */
export function colorAtRasterValue(
  expression: Expression | string | null,
  value: number
): string | null {
  if (!Number.isFinite(value)) return null;
  if (typeof expression === "string") {
    return isTransparentColor(expression) ? null : expression;
  }
  if (!expression) return null;
  try {
    const evaluator = ExpressionEvaluator.parse(
      rewriteRasterColorInput(expression),
      "color"
    );
    return cssFromEvaluatorColor(
      evaluator.evaluate({
        type: "Feature",
        properties: { value },
        geometry: { type: "Point", coordinates: [0, 0] },
      })
    );
  } catch {
    return null;
  }
}

function opaqueStopsFromExpression(expression: Expression): string[] {
  const out: string[] = [];
  const fn = expression[0];
  if (typeof fn !== "string") return out;
  const pushIfOpaque = (c: unknown) => {
    if (typeof c === "string" && !isTransparentColor(c) && colord(c).isValid()) {
      out.push(c);
    }
  };
  if (/^interpolate(-hcl|-lab)?$/.test(fn)) {
    for (let i = 4; i < expression.length; i += 2) {
      pushIfOpaque(expression[i]);
    }
  } else if (fn === "step") {
    for (let i = 2; i < expression.length; i += 2) {
      pushIfOpaque(expression[i]);
    }
  } else if (fn === "match") {
    let i = 2;
    while (i < expression.length) {
      if (i === expression.length - 1) {
        pushIfOpaque(expression[i]);
        break;
      }
      pushIfOpaque(expression[i + 1]);
      i += 2;
    }
  }
  return out;
}

/**
 * One color for a series whose Y-axis is not the styled raster value
 * (area, sum). Prefers the most saturated, mid-brightness opaque stop.
 */
export function seriesColorFromStyles(styles: unknown): string | null {
  const expression = rasterColorFromStyles(styles);
  if (typeof expression === "string") {
    return isTransparentColor(expression) ? null : expression;
  }
  if (!expression) return null;
  const stops = opaqueStopsFromExpression(expression);
  if (stops.length === 0) return null;
  let best = stops[0];
  let bestScore = -1;
  for (const stop of stops) {
    const c = colord(stop);
    const score = c.toHsl().s / 100 + (1 - Math.abs(c.brightness() - 0.4));
    if (score > bestScore) {
      bestScore = score;
      best = stop;
    }
  }
  return best;
}

/**
 * Colors for one time-series sample. Stats against a value-driven
 * raster-color follow min/mean/max. Area and sum use a layer color.
 */
export function timeSeriesDatumColors(args: {
  styles: unknown;
  mode: TimeSeriesCartographyMode;
  value: number;
  min?: number;
  max?: number;
}): TimeSeriesDatumColors {
  const expression = rasterColorFromStyles(args.styles);
  const follows =
    args.mode === "stats" && rasterColorFollowsValue(expression);
  if (follows) {
    const raw = colorAtRasterValue(expression, args.value);
    const rawMin =
      args.min !== undefined
        ? colorAtRasterValue(expression, args.min)
        : null;
    const rawMax =
      args.max !== undefined
        ? colorAtRasterValue(expression, args.max)
        : null;
    return {
      color: raw ? contrastSafeChartColor(raw) : undefined,
      colorMin: rawMin ? contrastSafeChartColor(rawMin) : undefined,
      colorMax: rawMax ? contrastSafeChartColor(rawMax) : undefined,
    };
  }
  const series = seriesColorFromStyles(args.styles);
  return series ? { color: contrastSafeChartColor(series) } : {};
}
