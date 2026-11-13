/**
 * Features appear on an integer zoom, which reads as a pop. The fade finishes
 * on that zoom and starts 0.4 earlier, so a view parked on the integer is
 * already solid. `["zoom"]` is only legal as the input of a top-level
 * interpolate, so every opacity — including a layer's own threshold and a
 * base such as the separation zone's 0.25 — is baked into that one curve.
 *
 * Soundings stay crisp: a field of numerals fading in looks muddy. Light
 * sectors are drawn at one size per zoom, so they are not pulled into the
 * zoom below.
 */

export const FADE_ZOOM = 0.4;

/** Source-layers whose features ease in. Soundings and light sectors do not. */
export const REVEAL_LAYERS = new Set([
  "depth_area",
  "depth_contour",
  "land",
  "land_detail",
  "inland_water",
  "coast",
  "separation",
  "seabed",
  "structure",
  "limit",
  "regulated",
  "cable",
  "mooring",
  "route",
  "hazard",
  "place",
  "pile",
  "platform",
  "aid",
]);

const LAST_ZOOM = 16;

/** The zoom at which a feature that becomes solid at `zoom` starts to appear. */
export function fadeStart(zoom: number): number {
  return Math.round((zoom - FADE_ZOOM) * 100) / 100;
}

function ramp(zoom: number, start: number, end: number): number {
  if (zoom <= start) return 0;
  if (zoom >= end) return 1;
  return (zoom - start) / (end - start);
}

/**
 * 1 when the feature is solid. `appear` 0 means it was already on the chart.
 * `retire` is the zoom at which a replaced feature has finished fading out.
 */
export function revealFactor(zoom: number, appear: number, retire: number): number {
  const intro = appear > 0 ? ramp(zoom, fadeStart(appear), appear) : 1;
  const outro = retire > 0 ? 1 - ramp(zoom, fadeStart(retire), retire) : 1;
  return Math.min(1, Math.max(0, intro * outro));
}

type Expr = unknown[];

const knots: number[] = [];
for (let zoom = 0; zoom <= LAST_ZOOM; zoom += 1) {
  if (zoom > 0) knots.push(fadeStart(zoom));
  knots.push(zoom);
}

/**
 * Opacity curve for one paint property. Evaluates to `base` once the feature
 * has finished fading in, and to 0 before it starts. A layer threshold fades
 * across the same span, ending at the layer's original minzoom.
 *
 * Fills and lines hold the outgoing feature solid (`holdOutgoing`). Fading it
 * out at the same time as the replacement fades in lets the water show through
 * the pair. Points crossfade, because two marks stacked at full opacity read
 * as a double symbol.
 */
export function revealExpression(base: number, layerMinzoom?: number, holdOutgoing = false): Expr {
  const appear = ["to-number", ["coalesce", ["get", "appear"], 0]];
  const retire = ["to-number", ["coalesce", ["get", "retire"], 0]];
  const stops: unknown[] = [];
  for (const zoom of knots) {
    if (layerMinzoom != null && zoom < layerMinzoom) {
      stops.push(zoom, 0);
      continue;
    }
    const arrived: Expr = ["any", ["==", appear, 0], ["<=", appear, zoom]];
    const shown: Expr = holdOutgoing
      ? arrived
      : ["all", arrived, ["any", ["==", retire, 0], [">", retire, zoom]]];
    stops.push(zoom, ["case", shown, base, 0]);
  }
  return ["interpolate", ["linear"], ["zoom"], ...stops];
}

/**
 * Record the zoom a feature becomes solid, and include it in the previous
 * tile so the fade has something to draw. Overview features (minzoom 0) are
 * left alone, or the chart would fade in from empty water.
 */
export function prepareReveal(feature: {
  properties: Record<string, unknown>;
  tippecanoe: { minzoom: number; maxzoom: number; layer?: string };
}): void {
  const layer = feature.tippecanoe.layer;
  if (!layer || !REVEAL_LAYERS.has(layer)) return;
  const minzoom = feature.tippecanoe.minzoom;
  if (!(minzoom > 0)) return;
  feature.properties.appear = minzoom;
  feature.tippecanoe.minzoom = minzoom - 1;
}
