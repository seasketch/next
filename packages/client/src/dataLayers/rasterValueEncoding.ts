/* eslint-disable i18next/no-literal-string */
/**
 * Decode SeaSketch RGB-encoded raster tile pixels back to scalar data values.
 *
 * Upload packing (`encodeValuesToRGB`) stores:
 *   N = floor((A - base) / interval) + 32768
 *   R = floor(N / 65536), G = floor((N % 65536) / 256), B = N % 256
 *
 * Mapbox recovers the scalar via `raster-color-mix` (with a GPU-oriented 258
 * factor). For exact byte samples from source tiles we use integer math that
 * matches the encoder — never the 258 GPU factor.
 */

export type RasterValueEncodingParams = {
  base: number;
  interval: number;
  byteEncoding?: boolean;
};

/**
 * Inverse of SeaSketch RGB packing. Returns null when alpha is 0 (nodata).
 */
export function decodeRgbEncodedRasterValue(
  r: number,
  g: number,
  b: number,
  a: number,
  params: RasterValueEncodingParams
): number | null {
  if (a === 0) {
    return null;
  }
  const base = params.base ?? 0;
  const interval =
    params.interval !== undefined && params.interval !== 0
      ? params.interval
      : 1;
  if (params.byteEncoding) {
    return b + base;
  }
  const n = r * 65536 + g * 256 + b;
  return (n - 32768) * interval + base;
}

/** Apply GDAL band scale/offset for presentation (legend / {{value}}). */
export function applyRasterScaleOffset(
  value: number,
  scale?: number | null,
  offset?: number | null
): number {
  const s = scale == null || scale === 0 ? 1 : scale;
  const o = offset == null ? 0 : offset;
  return value * s + o;
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Evaluate simple Mapbox-style numeric expressions used in raster-color-mix. */
function evalNumericExpr(expr: unknown): number | null {
  if (isNumber(expr)) {
    return expr;
  }
  if (!Array.isArray(expr) || expr.length === 0) {
    return null;
  }
  const op = expr[0];
  if (op === "*" && expr.length === 3) {
    const a = evalNumericExpr(expr[1]);
    const b = evalNumericExpr(expr[2]);
    if (a === null || b === null) return null;
    return a * b;
  }
  if (op === "+" && expr.length === 3) {
    const a = evalNumericExpr(expr[1]);
    const b = evalNumericExpr(expr[2]);
    if (a === null || b === null) return null;
    return a + b;
  }
  if (op === "-" && expr.length === 3) {
    const a = evalNumericExpr(expr[1]);
    const b = evalNumericExpr(expr[2]);
    if (a === null || b === null) return null;
    return a - b;
  }
  if (op === "literal" && expr.length === 2 && isNumber(expr[1])) {
    return expr[1];
  }
  return null;
}

/**
 * Parse encoding params from a layer's `raster-color-mix` paint value.
 * This is the single source of truth for admin and published map sampling.
 *
 * Recognized shapes (as produced by SeaSketch style builders):
 * - Byte / categorical: `[0, 0, 258, base]` (or expressions evaluating to that)
 * - Full 24-bit: `[258*65536, 258*256, 258, -32768+base]`, optionally each
 *   channel wrapped in `["*", interval, channel]`
 */
export function encodingParamsFromRasterColorMix(
  mix: unknown
): RasterValueEncodingParams | null {
  if (!Array.isArray(mix) || mix.length !== 4) {
    return null;
  }
  const channels = mix.map((c) => evalNumericExpr(c));
  if (channels.some((c) => c === null)) {
    return null;
  }
  const [m0, m1, m2, m3] = channels as [number, number, number, number];

  // Blue-only byte encoding: [0, 0, 258, base]
  if (m0 === 0 && m1 === 0 && Math.abs(m2 - 258) < 1e-6) {
    return { base: m3, interval: 1, byteEncoding: true };
  }

  // Full 24-bit with optional outer interval factor on every component.
  // Expected unscaled: m0=258*65536, m1=258*256, m2=258, m3=-32768+base
  const expectedR = 258 * 65536;
  const expectedG = 258 * 256;
  const expectedB = 258;

  let interval = 1;
  let r = m0;
  let g = m1;
  let b = m2;
  let offsetTerm = m3;

  // If blue channel is a multiple of 258 other than 258 itself, treat that
  // multiplier as interval (style builders wrap all four terms).
  if (Math.abs(m2) > 1e-9 && Math.abs(m2 / expectedB - 1) > 1e-6) {
    const candidate = m2 / expectedB;
    if (Number.isFinite(candidate) && candidate !== 0) {
      interval = candidate;
      r = m0 / interval;
      g = m1 / interval;
      b = m2 / interval;
      offsetTerm = m3 / interval;
    }
  }

  if (
    Math.abs(r - expectedR) > 1 ||
    Math.abs(g - expectedG) > 1 ||
    Math.abs(b - expectedB) > 1e-3
  ) {
    return null;
  }

  const base = offsetTerm + 32768;
  return { base, interval, byteEncoding: false };
}

/** Find raster-color-mix on the first raster style layer that defines one. */
export function rasterColorMixFromGlStyles(
  mapboxGlStyles: unknown
): unknown | null {
  if (!Array.isArray(mapboxGlStyles)) {
    return null;
  }
  for (const layer of mapboxGlStyles) {
    if (!layer || typeof layer !== "object") continue;
    const paint = (layer as { paint?: Record<string, unknown> }).paint;
    if (paint && "raster-color-mix" in paint) {
      return paint["raster-color-mix"];
    }
  }
  return null;
}

export function encodingParamsFromGlStyles(
  mapboxGlStyles: unknown
): RasterValueEncodingParams | null {
  const mix = rasterColorMixFromGlStyles(mapboxGlStyles);
  if (mix == null) {
    return null;
  }
  return encodingParamsFromRasterColorMix(mix);
}

export function styleRespectsScaleAndOffset(
  mapboxGlStyles: unknown
): boolean {
  if (!Array.isArray(mapboxGlStyles)) {
    return false;
  }
  for (const layer of mapboxGlStyles) {
    if (!layer || typeof layer !== "object") continue;
    const metadata = (layer as { metadata?: Record<string, unknown> }).metadata;
    if (metadata?.["s:respect-scale-and-offset"]) {
      return true;
    }
  }
  return false;
}
