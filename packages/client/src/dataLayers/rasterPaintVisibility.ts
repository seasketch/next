/* eslint-disable i18next/no-literal-string */
/**
 * Decide whether a decoded raster pixel is actually painted.
 *
 * Source tiles keep a scalar for no-data classes that the style then draws
 * with a transparent `raster-color` stop (categorical step default, an
 * excluded class, or an rgba alpha of 0). Mapbox still has a pixel there, so
 * sampling alpha is not enough — those pixels look like empty ocean and must
 * not count as hover/click hits.
 *
 * The GPU does not evaluate `raster-color` per pixel. It bakes the expression
 * into a ramp spanning `raster-color-range` and clamps lookups to that ramp,
 * so a value outside the range wears the color at the nearest endpoint.
 */

export type RasterPaintStyle = {
  rasterColor: unknown;
  colorRange: [number, number] | null;
};

const RGBA_RE =
  /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/;
const HSLA_RE =
  /^hsla?\(\s*[0-9.]+\s*,\s*[0-9.]+%\s*,\s*[0-9.]+%(?:\s*,\s*([0-9.]+))?\s*\)$/;

export function rasterPaintStyleFromGlStyles(
  mapboxGlStyles: unknown
): RasterPaintStyle | null {
  if (!Array.isArray(mapboxGlStyles)) {
    return null;
  }
  for (const layer of mapboxGlStyles) {
    if (!layer || typeof layer !== "object") continue;
    const paint = (layer as { paint?: Record<string, unknown> }).paint;
    if (!paint || !("raster-color" in paint)) continue;
    return {
      rasterColor: paint["raster-color"],
      colorRange: colorRangeFromPaint(paint["raster-color-range"]),
    };
  }
  return null;
}

function colorRangeFromPaint(range: unknown): [number, number] | null {
  if (
    Array.isArray(range) &&
    range.length === 2 &&
    typeof range[0] === "number" &&
    typeof range[1] === "number" &&
    Number.isFinite(range[0]) &&
    Number.isFinite(range[1]) &&
    range[1] > range[0]
  ) {
    return [range[0], range[1]];
  }
  return null;
}

/**
 * True when this encoded raster-value (pre scale/offset) is drawn with a
 * non-zero alpha. Unknown expressions fail open so a style we cannot read
 * still tooltips.
 */
export function rasterValueIsVisible(
  style: RasterPaintStyle | null,
  encodedValue: number
): boolean {
  if (!style || style.rasterColor == null) {
    return true;
  }
  if (!Number.isFinite(encodedValue)) {
    return false;
  }
  let value = encodedValue;
  if (style.colorRange) {
    value = Math.min(style.colorRange[1], Math.max(style.colorRange[0], value));
  }
  const decision = decideColor(style.rasterColor, value);
  if (decision === "unknown") {
    return true;
  }
  return decision === "visible";
}

/** Hover/popup copy with no readable text — an empty tooltip bubble. */
export function isBlankHoverMessage(message: string): boolean {
  const text = message
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, "");
  return text.trim().length === 0;
}

type ColorDecision = "transparent" | "visible" | "unknown";

function decideColor(expr: unknown, rasterValue: number): ColorDecision {
  if (typeof expr === "string") {
    return colorStringDecision(expr);
  }
  if (!Array.isArray(expr) || expr.length === 0) {
    return "unknown";
  }
  const op = expr[0];
  if (op === "step") {
    return evalStep(expr, rasterValue);
  }
  if (op === "match") {
    return evalMatch(expr, rasterValue);
  }
  if (typeof op === "string" && op.indexOf("interpolate") === 0) {
    return evalInterpolate(expr, rasterValue);
  }
  return "unknown";
}

function evalStep(expr: unknown[], rasterValue: number): ColorDecision {
  if (expr.length < 3) {
    return "unknown";
  }
  const input = evalNumber(expr[1], rasterValue);
  if (input === null) {
    return "unknown";
  }
  let output: unknown = expr[2];
  for (let i = 3; i + 1 < expr.length; i += 2) {
    const stop = expr[i];
    if (typeof stop !== "number" || !Number.isFinite(stop)) {
      return "unknown";
    }
    if (input < stop) {
      break;
    }
    output = expr[i + 1];
  }
  return typeof output === "string" ? colorStringDecision(output) : "unknown";
}

function evalMatch(expr: unknown[], rasterValue: number): ColorDecision {
  // ["match", input, label, output, …, fallback] — odd length.
  if (expr.length < 3 || expr.length % 2 === 0) {
    return "unknown";
  }
  const input = evalNumber(expr[1], rasterValue);
  if (input === null) {
    return "unknown";
  }
  for (let i = 2; i < expr.length - 1; i += 2) {
    if (matchLabel(expr[i], input)) {
      const output = expr[i + 1];
      return typeof output === "string"
        ? colorStringDecision(output)
        : "unknown";
    }
  }
  const fallback = expr[expr.length - 1];
  return typeof fallback === "string"
    ? colorStringDecision(fallback)
    : "unknown";
}

function matchLabel(label: unknown, input: number): boolean {
  if (Array.isArray(label)) {
    return label.some((entry) => matchLabel(entry, input));
  }
  return typeof label === "number" && label === input;
}

function evalInterpolate(expr: unknown[], rasterValue: number): ColorDecision {
  if (expr.length < 5) {
    return "unknown";
  }
  const input = evalNumber(expr[2], rasterValue);
  if (input === null) {
    return "unknown";
  }
  const stops: { stop: number; color: unknown }[] = [];
  for (let i = 3; i + 1 < expr.length; i += 2) {
    if (typeof expr[i] !== "number" || !Number.isFinite(expr[i])) {
      return "unknown";
    }
    stops.push({ stop: expr[i] as number, color: expr[i + 1] });
  }
  if (!stops.length) {
    return "unknown";
  }
  if (input <= stops[0].stop) {
    return colorStringDecision(stops[0].color);
  }
  const last = stops[stops.length - 1];
  if (input >= last.stop) {
    return colorStringDecision(last.color);
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (input >= a.stop && input <= b.stop) {
      if (input === a.stop) return colorStringDecision(a.color);
      if (input === b.stop) return colorStringDecision(b.color);
      const left = colorStringDecision(a.color);
      const right = colorStringDecision(b.color);
      if (left === "unknown" || right === "unknown") return "unknown";
      if (left === "transparent" && right === "transparent") {
        return "transparent";
      }
      return "visible";
    }
  }
  return "unknown";
}

function evalNumber(expr: unknown, rasterValue: number): number | null {
  if (typeof expr === "number" && Number.isFinite(expr)) {
    return expr;
  }
  if (!Array.isArray(expr) || expr.length === 0) {
    return null;
  }
  const op = expr[0];
  if (op === "raster-value" && expr.length === 1) {
    return rasterValue;
  }
  if (op === "round" && expr.length === 2) {
    const inner = evalNumber(expr[1], rasterValue);
    return inner === null ? null : Math.round(inner);
  }
  if (op === "literal" && expr.length === 2 && typeof expr[1] === "number") {
    return Number.isFinite(expr[1]) ? expr[1] : null;
  }
  return null;
}

/**
 * Alpha of a CSS color SeaSketch writes into `raster-color`.
 * null means we do not recognize it (caller fails open).
 */
function cssColorAlpha(color: string): number | null {
  const c = color.trim().toLowerCase();
  if (c === "transparent") {
    return 0;
  }
  const rgba = RGBA_RE.exec(c);
  if (rgba) {
    if (rgba[4] === undefined) return 1;
    const alpha = Number(rgba[4]);
    return Number.isFinite(alpha) ? alpha : null;
  }
  const hsla = HSLA_RE.exec(c);
  if (hsla) {
    if (hsla[1] === undefined) return 1;
    const alpha = Number(hsla[1]);
    return Number.isFinite(alpha) ? alpha : null;
  }
  if (/^#[0-9a-f]{8}$/.test(c)) {
    return parseInt(c.slice(7), 16) / 255;
  }
  if (/^#[0-9a-f]{4}$/.test(c)) {
    return parseInt(c[4] + c[4], 16) / 255;
  }
  if (/^#[0-9a-f]{6}$/.test(c) || /^#[0-9a-f]{3}$/.test(c)) {
    return 1;
  }
  // Named palette colors (yellow, red, …). "transparent" is handled above.
  if (/^[a-z]+$/.test(c)) {
    return 1;
  }
  return null;
}

function colorStringDecision(color: unknown): ColorDecision {
  if (typeof color !== "string") {
    return "unknown";
  }
  const alpha = cssColorAlpha(color);
  if (alpha === null) {
    return "unknown";
  }
  return alpha === 0 ? "transparent" : "visible";
}
