/**
 * GL layer shape used only to zero paint opacity for the map clock.
 * Kept independent of LayerState.opacity / adjustLayerOpacities.
 */
export type ClockPaintableLayer = {
  type?: string;
  paint?: { [key: string]: unknown };
};

const PRELOADABLE_SOURCE_TYPES = [
  "SEASKETCH_RASTER",
  "SEASKETCH_MVT",
  "SEASKETCH_VECTOR",
  "VECTOR",
  "GEOJSON",
  "RASTER",
  "INATURALIST",
];

/**
 * Tile-backed sources Mapbox will keep warm if a visible layer references
 * them. Used only for hosted / static overlays that participate in the
 * map clock — not as a hide strategy for remote services.
 */
export function canKeepTilesWhenClockHidden(
  sourceType: string | undefined
): boolean {
  if (!sourceType) return false;
  return PRELOADABLE_SOURCE_TYPES.indexOf(sourceType) !== -1;
}

const OPACITY_PAINT_BY_TYPE: { [type: string]: string[] } = {
  raster: ["raster-opacity"],
  fill: ["fill-opacity"],
  line: ["line-opacity"],
  circle: ["circle-opacity", "circle-stroke-opacity"],
  symbol: ["icon-opacity", "text-opacity"],
  heatmap: ["heatmap-opacity"],
  "fill-extrusion": ["fill-extrusion-opacity"],
  background: ["background-opacity"],
  sky: ["sky-opacity"],
};

const INSTANT_TRANSITION = { duration: 0, delay: 0 };

/**
 * Kill Mapbox's default 300ms paint fade so clock steps snap. Also zero
 * raster-fade-duration so cached tiles do not ease in after a style diff.
 */
export function snapClockOpacityTransitions<T>(layers: T[]): T[] {
  return layers.map((layer) => {
    const typed = layer as ClockPaintableLayer;
    const props = OPACITY_PAINT_BY_TYPE[typed.type || ""];
    if (!props) return layer;
    const paint: { [key: string]: unknown } = { ...(typed.paint || {}) };
    for (const name of props) {
      paint[`${name}-transition`] = INSTANT_TRANSITION;
    }
    if (typed.type === "raster") {
      paint["raster-fade-duration"] = 0;
    }
    return {
      ...typed,
      paint,
    } as T;
  });
}

/**
 * Hide a layer on the map without `visibility: none` (which unloads tiles)
 * and without writing LayerState.opacity (legend / TOC slider).
 */
export function applyClockPaintHidden<T>(layers: T[]): T[] {
  const hidden = layers.map((layer) => {
    const typed = layer as ClockPaintableLayer;
    const props = OPACITY_PAINT_BY_TYPE[typed.type || ""];
    if (!props) return layer;
    const paint: { [key: string]: unknown } = { ...(typed.paint || {}) };
    for (const name of props) {
      paint[name] = 0;
    }
    return {
      ...typed,
      paint,
    } as T;
  });
  return snapClockOpacityTransitions(hidden);
}
