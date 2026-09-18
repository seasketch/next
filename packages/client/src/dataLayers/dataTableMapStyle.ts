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
 * Sentinel written to `scaledValue` / `rawValue` feature-state for a true
 * zero. Mapbox `setFeatureState` / tile paint updates drop `0` (and `false`),
 * so a real zero must never be stored as the number 0.
 */
export const DATA_TABLE_ZERO_SENTINEL = -1;

/**
 * Lower bound for scaled positives. The smallest positive value would
 * otherwise scale to 0 and get stuck on the previous feature-state.
 */
export const DATA_TABLE_SCALED_MIN_POSITIVE = 0.001;

export const DATA_TABLE_VALUE_CLASS_PROPERTY = "valueClass";
export const DATA_TABLE_VALUE_CLASS_DATA = "data";
export const DATA_TABLE_VALUE_CLASS_ZERO = "zero";
export const DATA_TABLE_VALUE_CLASS_EMPTY = "empty";

export type DataTableValueClass =
  | typeof DATA_TABLE_VALUE_CLASS_DATA
  | typeof DATA_TABLE_VALUE_CLASS_ZERO
  | typeof DATA_TABLE_VALUE_CLASS_EMPTY;

/**
 * Scale a table value for circle paint. True zeros use
 * {@link DATA_TABLE_ZERO_SENTINEL}; positives stay in
 * ({@link DATA_TABLE_SCALED_MIN_POSITIVE}, 1] so Mapbox never sees 0.
 */
export function scaleDataTableValue(
  value: number,
  scaleMin: number,
  scaleMax: number
): number {
  if (value === 0) {
    return DATA_TABLE_ZERO_SENTINEL;
  }
  if (value < 0) {
    return DATA_TABLE_SCALED_MIN_POSITIVE;
  }
  const range = scaleMax - scaleMin;
  if (range === 0) {
    return 1;
  }
  const scaled = (value - scaleMin) / range;
  return Math.min(Math.max(scaled, DATA_TABLE_SCALED_MIN_POSITIVE), 1);
}

/** Feature-state payload for one join site. Never includes numeric 0. */
export function buildDataTablePaintFeatureState(
  value: number | null,
  scaleMin: number,
  scaleMax: number
): {
  scaledValue: number | null;
  rawValue: number | null;
  valueClass: DataTableValueClass;
} {
  if (value === null) {
    return {
      scaledValue: null,
      rawValue: null,
      valueClass: DATA_TABLE_VALUE_CLASS_EMPTY,
    };
  }
  if (value === 0) {
    return {
      scaledValue: DATA_TABLE_ZERO_SENTINEL,
      rawValue: DATA_TABLE_ZERO_SENTINEL,
      valueClass: DATA_TABLE_VALUE_CLASS_ZERO,
    };
  }
  return {
    scaledValue: scaleDataTableValue(value, scaleMin, scaleMax),
    rawValue: value,
    valueClass: DATA_TABLE_VALUE_CLASS_DATA,
  };
}

/** Inverse of {@link buildDataTablePaintFeatureState} for tooltips. */
export function decodeDataTableRawValue(state: {
  rawValue?: number | null;
  scaledValue?: number | null;
  valueClass?: string;
}): number | null | undefined {
  if (
    state.valueClass === DATA_TABLE_VALUE_CLASS_ZERO ||
    state.rawValue === DATA_TABLE_ZERO_SENTINEL ||
    state.scaledValue === DATA_TABLE_ZERO_SENTINEL
  ) {
    return 0;
  }
  if (state.valueClass === DATA_TABLE_VALUE_CLASS_EMPTY) {
    return null;
  }
  if (state.rawValue === null) {
    return null;
  }
  return state.rawValue;
}

export function dataTableIsZeroExpression(): Expression {
  return [
    "any",
    [
      "==",
      ["feature-state", DATA_TABLE_VALUE_CLASS_PROPERTY],
      DATA_TABLE_VALUE_CLASS_ZERO,
    ],
    ["==", ["feature-state", "scaledValue"], DATA_TABLE_ZERO_SENTINEL],
  ] as Expression;
}

export const DATA_TABLE_ACTIVE_COLOR = "#2563eb";
/** Slightly darker fill/stroke while a bubble's tooltip is showing. */
export const DATA_TABLE_HOVER_COLOR = "#1d4ed8";
export const DATA_TABLE_NO_DATA_COLOR = "#9ca3af";
export const DATA_TABLE_NO_DATA_HOVER_COLOR = "#6b7280";
export const DATA_TABLE_LOADING_COLOR = "#6b7280";
export const DATA_TABLE_LOADING_HOVER_COLOR = "#4b5563";

export const DATA_TABLE_HOVER_FILL_OPACITY = 0.95;
export const DATA_TABLE_HOVER_STROKE_WIDTH = 1.25;

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
/** No-data sites render as a small grey fill with a faint black outline. */
export const DATA_TABLE_NO_DATA_RADIUS = DATA_TABLE_VALUE_MIN_RADIUS * 0.45;
/**
 * True zeros stay smaller than the smallest positive bubble, including
 * stroke. A near-min radius plus a 2px ring read as *larger* than low
 * positives when zoomed out.
 */
export const DATA_TABLE_ZERO_RADIUS = DATA_TABLE_VALUE_MIN_RADIUS * 0.4;
export const DATA_TABLE_NO_DATA_STROKE_WIDTH = 1;
export const DATA_TABLE_NO_DATA_STROKE_COLOR = "#000000";
export const DATA_TABLE_NO_DATA_STROKE_OPACITY = 0.2;
export const DATA_TABLE_ZERO_STROKE_WIDTH = 1;

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
  hideWhenMissing: boolean,
  isZero: Expression
): Expression {
  // Keep zoom-stop radii in the same ratio as the full-size legend constants.
  const noDataRadius =
    minRadius * (DATA_TABLE_NO_DATA_RADIUS / DATA_TABLE_VALUE_MIN_RADIUS);
  const zeroRadius = Math.max(
    1,
    minRadius * (DATA_TABLE_ZERO_RADIUS / DATA_TABLE_VALUE_MIN_RADIUS) -
      DATA_TABLE_ZERO_STROKE_WIDTH / 2
  );
  // scaledValue is a number when present; null / missing feature-state is
  // non-numeric. (UNSET and NO_DATA are both null in the current model.)
  const isMissing = [
    "!=",
    ["typeof", valueExpression],
    "number",
  ] as Expression;
  const isPositive = [">=", valueExpression, 0] as Expression;
  // Guard missing/zero before interpolate so Mapbox never runs `>` /
  // interpolate on null. The final fallback must stay non-zero: a painted
  // radius of 0 is dropped by the feature-state vertex update (same as
  // writing 0 to setFeatureState), so the previous circle would stick.
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
    hideWhenMissing ? 0 : noDataRadius,
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
  isZero,
}: {
  valueExpression: Expression;
  scaleMin: number;
  scaleMax: number;
  /** When false (legend preview), use full-size radii with no zoom scaling. */
  zoomDependent: boolean;
  /** When true, features without a known state value get radius 0. */
  hideWhenMissing: boolean;
  /** Override for true zeros; defaults to the scaledValue sentinel. */
  isZero?: Expression;
}): Expression {
  const zeroExpression =
    isZero ||
    (["==", valueExpression, DATA_TABLE_ZERO_SENTINEL] as Expression);
  if (!zoomDependent) {
    return radiusForStop(
      valueExpression,
      scaleMin,
      scaleMax,
      DATA_TABLE_VALUE_MIN_RADIUS,
      DATA_TABLE_VALUE_MAX_RADIUS,
      hideWhenMissing,
      zeroExpression
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
        hideWhenMissing,
        zeroExpression
      )
    );
  }
  return expression as Expression;
}

export function dataTableHoveredExpression(): Expression {
  return ["boolean", ["feature-state", "hovered"], false] as Expression;
}

export function buildDataTableCircleColorExpression(
  isLoading: Expression,
  isNoData: Expression
): Expression {
  return [
    "case",
    dataTableHoveredExpression(),
    [
      "case",
      isLoading,
      DATA_TABLE_LOADING_HOVER_COLOR,
      isNoData,
      DATA_TABLE_NO_DATA_HOVER_COLOR,
      DATA_TABLE_HOVER_COLOR,
    ],
    isLoading,
    DATA_TABLE_LOADING_COLOR,
    isNoData,
    DATA_TABLE_NO_DATA_COLOR,
    DATA_TABLE_ACTIVE_COLOR,
  ] as Expression;
}

export function buildDataTableCircleStrokeColorExpression(
  isNoData: Expression
): Expression {
  return [
    "case",
    dataTableHoveredExpression(),
    [
      "case",
      isNoData,
      DATA_TABLE_NO_DATA_HOVER_COLOR,
      DATA_TABLE_HOVER_COLOR,
    ],
    isNoData,
    DATA_TABLE_NO_DATA_STROKE_COLOR,
    DATA_TABLE_ACTIVE_COLOR,
  ] as Expression;
}
