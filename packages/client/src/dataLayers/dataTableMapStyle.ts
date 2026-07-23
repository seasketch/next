import { Expression } from "mapbox-gl";

/** Feature-state key for aggregated data-table values on overlay features. */
export const DATA_TABLE_VALUE_PROPERTY = "__dataTableValue";

/**
 * Sentinel written to feature-state when a join site has no matching
 * table rows for the current filters (distinct from an explicit zero).
 * Paint expressions treat non-numeric `scaledValue` as no-data.
 */
export const DATA_TABLE_NO_DATA_VALUE = null;

/**
 * Stand-in used when feature-state / get returns null (feature not yet
 * joined). Same null as {@link DATA_TABLE_NO_DATA_VALUE} in the scaledValue
 * model — distinguish loading vs no-data via the `loading` feature-state.
 */
export const DATA_TABLE_UNSET_VALUE = null;

/**
 * Coalesce a possibly-null feature-state/get expression. With null sentinels
 * this is a no-op; kept for call sites that still wrap value expressions.
 */
export function buildDataTableValueExpression(
  rawValueExpression: Expression
): Expression {
  return ["coalesce", rawValueExpression, DATA_TABLE_UNSET_VALUE] as Expression;
}

/**
 * Sentinel written to `scaledValue` feature-state for a true zero value.
 * Positive values scale 0–1 against scaleMin/scaleMax, so the smallest
 * positive value also lands on 0 — zero needs its own marker.
 */
export const DATA_TABLE_ZERO_SENTINEL = -1;

export const DATA_TABLE_ACTIVE_COLOR = "#2563eb";
export const DATA_TABLE_NO_DATA_COLOR = "#9ca3af";
export const DATA_TABLE_LOADING_COLOR = "#6b7280";

export const DATA_TABLE_CIRCLE_FILL_OPACITY = 0.8;
export const DATA_TABLE_CIRCLE_STROKE_OPACITY = Math.min(
  DATA_TABLE_CIRCLE_FILL_OPACITY + 0.2,
  1
);
export const DATA_TABLE_LOADING_FILL_OPACITY = 0.35;
export const DATA_TABLE_LOADING_STROKE_OPACITY = 0.25;

/** Full-size radii used at high zoom (and in the legend). */
export const DATA_TABLE_VALUE_MIN_RADIUS = 10;
export const DATA_TABLE_VALUE_MAX_RADIUS = 65;
/** No-data sites render slightly smaller than the min positive-value symbol. */
export const DATA_TABLE_NO_DATA_RADIUS = DATA_TABLE_VALUE_MIN_RADIUS * 0.9;
/** Zero-value sites match the no-data footprint exactly, but in active blue. */
export const DATA_TABLE_ZERO_RADIUS = DATA_TABLE_NO_DATA_RADIUS;

/** Light fill shared by the no-data and zero-value symbols. */
export const DATA_TABLE_NO_DATA_FILL_OPACITY = 0.35;
export const DATA_TABLE_ZERO_FILL_OPACITY = DATA_TABLE_NO_DATA_FILL_OPACITY;

export const DATA_TABLE_PAINT_TRANSITION = { duration: 450, delay: 0 };

/** Zoom at which circle radii reach DATA_TABLE_VALUE_MIN/MAX_RADIUS. */
export const DATA_TABLE_RADIUS_FULL_ZOOM = 14;

/**
 * Scales all zoom-dependent radii. At 1, stops at DATA_TABLE_RADIUS_FULL_ZOOM
 * use the full MIN/MAX constants; lower values shrink symbols more when
 * zoomed out.
 */
export const DATA_TABLE_RADIUS_ZOOM_MULTIPLIER = 0.8;

/** Zoom levels at which radius stops are defined; values interpolate between. */
const DATA_TABLE_RADIUS_ZOOM_LEVELS = [5, 8, 11, DATA_TABLE_RADIUS_FULL_ZOOM];

function dataTableRadiusAtZoom(baseRadius: number, zoom: number): number {
  return (
    baseRadius *
    (zoom / DATA_TABLE_RADIUS_FULL_ZOOM) *
    DATA_TABLE_RADIUS_ZOOM_MULTIPLIER
  );
}

const DATA_TABLE_RADIUS_ZOOM_STOPS = DATA_TABLE_RADIUS_ZOOM_LEVELS.map(
  (zoom) => ({
    zoom,
    min: dataTableRadiusAtZoom(DATA_TABLE_VALUE_MIN_RADIUS, zoom),
    max: dataTableRadiusAtZoom(DATA_TABLE_VALUE_MAX_RADIUS, zoom),
  })
);

function valueRadiusExpression(
  valueExpression: Expression,
  scaleMin: number,
  scaleMax: number,
  minRadius: number,
  maxRadius: number
): Expression {
  return [
    "interpolate",
    ["linear"],
    valueExpression,
    scaleMin,
    minRadius,
    scaleMax,
    maxRadius,
  ] as Expression;
}

function radiusForStop(
  valueExpression: Expression,
  scaleMin: number,
  scaleMax: number,
  minRadius: number,
  maxRadius: number,
  hideWhenMissing: boolean
): Expression {
  // Keep zoom-stop radii in the same ratio as the full-size legend constants.
  const noDataRadius =
    minRadius * (DATA_TABLE_NO_DATA_RADIUS / DATA_TABLE_VALUE_MIN_RADIUS);
  const zeroRadius =
    minRadius * (DATA_TABLE_ZERO_RADIUS / DATA_TABLE_VALUE_MIN_RADIUS);
  // scaledValue is a number when present; null / missing feature-state is
  // non-numeric. (UNSET and NO_DATA are both null in the current model.)
  const isMissing = [
    "!=",
    ["typeof", valueExpression],
    "number",
  ] as Expression;
  // True zeros carry the sentinel; the smallest positive value scales to 0,
  // so a plain `== 0` check would misclassify it.
  const isZero = [
    "==",
    valueExpression,
    DATA_TABLE_ZERO_SENTINEL,
  ] as Expression;
  const isPositive = [">=", valueExpression, 0] as Expression;
  // Guard missing/zero before interpolate so Mapbox never runs `>` /
  // interpolate on null.
  const sized = [
    "case",
    isMissing,
    hideWhenMissing ? 0 : noDataRadius,
    isZero,
    zeroRadius,
    isPositive,
    valueRadiusExpression(
      valueExpression,
      scaleMin,
      scaleMax,
      minRadius,
      maxRadius
    ),
    0,
  ] as Expression;
  if (!hideWhenMissing) {
    return sized;
  }
  return [
    "case",
    ["any", isZero, isPositive],
    sized,
    // Missing / no-data: hidden when hideWhenMissing is set.
    0,
  ] as Expression;
}

/**
 * Build a `circle-radius` paint expression that scales with both the
 * aggregated value (via feature-state / get) and map zoom.
 *
 * Mapbox requires `["zoom"]` to be the input of a *top-level* interpolate
 * or step in paint properties, so value/feature-state logic lives inside
 * each zoom stop's output — never wrapping the zoom interpolate.
 */
export function buildDataTableCircleRadiusExpression({
  valueExpression,
  scaleMin,
  scaleMax,
  zoomDependent,
  hideWhenMissing,
}: {
  valueExpression: Expression;
  scaleMin: number;
  scaleMax: number;
  /** When false (legend preview), use full-size radii with no zoom scaling. */
  zoomDependent: boolean;
  /** When true, features without a known state value get radius 0. */
  hideWhenMissing: boolean;
}): Expression {
  if (!zoomDependent) {
    return radiusForStop(
      valueExpression,
      scaleMin,
      scaleMax,
      DATA_TABLE_VALUE_MIN_RADIUS,
      DATA_TABLE_VALUE_MAX_RADIUS,
      hideWhenMissing
    );
  }

  const expression: unknown[] = ["interpolate", ["linear"], ["zoom"]];
  for (const stop of DATA_TABLE_RADIUS_ZOOM_STOPS) {
    expression.push(
      stop.zoom,
      radiusForStop(
        valueExpression,
        scaleMin,
        scaleMax,
        stop.min,
        stop.max,
        hideWhenMissing
      )
    );
  }
  return expression as Expression;
}
