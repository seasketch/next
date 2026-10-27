import area from "@turf/area";
import { MultiPolygon, Polygon } from "geojson";
import { SketchGeometryType } from "../generated/graphql";

const SQ_METERS_PER_SQ_KM = 1_000_000;

/**
 * Same area units as report widgets (`AreaUnit` in reports/utils/units).
 * Square kilometers stay the stored comparison value. The unit only changes
 * how authors enter the limit and how respondents see it.
 */
export const POLYGON_AREA_UNITS = [
  "kilometer",
  "hectare",
  "acre",
  "mile",
] as const;
export type PolygonAreaUnit = (typeof POLYGON_AREA_UNITS)[number];

/** Square kilometers in one of the display unit. Matches report-card conversion. */
const SQ_KM_PER_UNIT: { [unit in PolygonAreaUnit]: number } = {
  kilometer: 1,
  hectare: 0.01,
  acre: 1 / 247.105381,
  mile: 1 / 0.386102,
};

export function isPolygonAreaUnit(value: unknown): value is PolygonAreaUnit {
  return (
    value === "kilometer" ||
    value === "hectare" ||
    value === "acre" ||
    value === "mile"
  );
}

export function areaToSqKm(value: number, unit: PolygonAreaUnit): number {
  return value * SQ_KM_PER_UNIT[unit];
}

export function sqKmToArea(sqKm: number, unit: PolygonAreaUnit): number {
  return sqKm / SQ_KM_PER_UNIT[unit];
}

/** Drop binary dust so a typed limit round-trips through square kilometers. */
export function roundArea(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    return value;
  }
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const factor = 10 ** (8 - 1 - magnitude);
  return Math.round(value * factor) / factor;
}

export type PolygonSizeViolation = {
  areaSqKm: number;
  maxSqKm: number;
};

/**
 * Positive finite square kilometers, or no limit. Zero, negatives, and
 * non-numbers are treated as unset so a blank admin field does not reject
 * every polygon.
 */
export function parseMaxPolygonSizeSqKm(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

/** Size limits apply only when the sketch class draws polygons. */
export function effectiveMaxPolygonSizeSqKm(
  geometryType: SketchGeometryType | null | undefined,
  value: unknown
): number | undefined {
  if (geometryType !== SketchGeometryType.Polygon) {
    return undefined;
  }
  return parseMaxPolygonSizeSqKm(value);
}

function isPolygonGeometry(value: unknown): value is Polygon | MultiPolygon {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  if (!("type" in value) || !("coordinates" in value)) {
    return false;
  }
  if (!Array.isArray(value.coordinates) || value.coordinates.length === 0) {
    return false;
  }
  return value.type === "Polygon" || value.type === "MultiPolygon";
}

function polygonFromUnknown(input: unknown): Polygon | MultiPolygon | null {
  if (input === null || input === undefined || typeof input !== "object") {
    return null;
  }
  if ("type" in input && input.type === "Feature" && "geometry" in input) {
    return polygonFromUnknown(input.geometry);
  }
  if (!isPolygonGeometry(input)) {
    return null;
  }
  return input;
}

/** Geodesic area in km². Null for empty, non-polygon, or unmeasurable geometry. */
export function polygonAreaSqKm(input: unknown): number | null {
  const geometry = polygonFromUnknown(input);
  if (!geometry) {
    return null;
  }
  try {
    const sqMeters = area(geometry);
    if (!Number.isFinite(sqMeters)) {
      return null;
    }
    return sqMeters / SQ_METERS_PER_SQ_KM;
  } catch {
    return null;
  }
}

export function polygonSizeViolation(
  feature: unknown,
  maxSqKm: unknown
): PolygonSizeViolation | null {
  const limit = parseMaxPolygonSizeSqKm(maxSqKm);
  if (limit === undefined) {
    return null;
  }
  const areaSqKm = polygonAreaSqKm(feature);
  if (areaSqKm === null || areaSqKm <= limit) {
    return null;
  }
  return { areaSqKm, maxSqKm: limit };
}

function numberFormat(
  locale: string | undefined,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    return new Intl.NumberFormat(undefined, options);
  }
}

/**
 * Fraction digits for a standalone quantity. Whole numbers stay whole.
 * A real fraction is kept (one digit from 10 up, two from 1, three below),
 * and float noise within 0.05 does not count. Same idea as the report-card
 * area formatter, which also drops trailing zeros and uses a short unit.
 */
function fractionDigits(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const abs = Math.abs(value);
  if (Math.abs(abs - Math.round(abs)) < 0.05) {
    return 0;
  }
  if (abs >= 10) {
    return 1;
  }
  if (abs >= 1) {
    return 2;
  }
  return 3;
}

/**
 * Square kilometers with grouping and a short unit, e.g. "8,000 km²".
 * Locale comes from the survey language. The square mark is appended the
 * same way report cards do for kilometer and mile.
 */
export function formatPolygonSizeLimit(
  sqKm: number,
  locale?: string,
  unit?: PolygonAreaUnit | null
): string {
  const resolved = unit && isPolygonAreaUnit(unit) ? unit : "kilometer";
  if (!Number.isFinite(sqKm)) {
    return "";
  }
  const quantity = sqKmToArea(sqKm, resolved);
  const formatted = numberFormat(locale, {
    style: "unit",
    unit: resolved,
    unitDisplay: "short",
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits(quantity),
  }).format(quantity);
  if (resolved === "kilometer" || resolved === "mile") {
    // eslint-disable-next-line i18next/no-literal-string
    return `${formatted}²`;
  }
  return formatted;
}

/**
 * Short label for the admin unit menu, matching report-card abbreviations.
 * km and mi stay squared. A native select shows this both closed and open,
 * so the closed control stays narrow.
 */
export function polygonAreaUnitLabel(
  unit: PolygonAreaUnit,
  locale?: string
): string {
  const formatted = numberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
  }).formatToParts(10);
  const label = formatted.find((part) => part.type === "unit")?.value;
  if (!label) {
    return unit;
  }
  if (unit === "kilometer" || unit === "mile") {
    // eslint-disable-next-line i18next/no-literal-string
    return `${label}²`;
  }
  return label;
}

/**
 * How far the polygon is over the limit, as a signed percent: "+230%".
 * Percents of 100 or more, and values that are already whole, stay whole.
 * A fractional overage keeps one decimal ("+2.4%", "+0.4%"). Anything under
 * a tenth of a percent stays visible as "+<0.1%" so it does not round to 0.
 */
export function formatPolygonOverage(
  areaSqKm: number,
  maxSqKm: number,
  locale?: string
): string {
  if (
    !Number.isFinite(areaSqKm) ||
    !Number.isFinite(maxSqKm) ||
    !(maxSqKm > 0) ||
    !(areaSqKm > maxSqKm)
  ) {
    return "";
  }
  const ratio = (areaSqKm - maxSqKm) / maxSqKm;
  const percent = ratio * 100;
  if (percent < 0.1) {
    const tiny = numberFormat(locale, {
      style: "percent",
      signDisplay: "exceptZero",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(0.001);
    if (tiny.startsWith("+")) {
      // eslint-disable-next-line i18next/no-literal-string
      return `+<${tiny.slice(1)}`;
    }
    // eslint-disable-next-line i18next/no-literal-string
    return `<${tiny}`;
  }
  const digits =
    percent >= 100 || Math.abs(percent - Math.round(percent)) < 0.05 ? 0 : 1;
  return numberFormat(locale, {
    style: "percent",
    signDisplay: "exceptZero",
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(ratio);
}

/**
 * Block committing a draw when the current polygon is over the limit.
 * Shapes already saved before a limit existed can still be closed until the
 * respondent changes their geometry.
 */
export function polygonSaveViolation(options: {
  geometryType: SketchGeometryType | null | undefined;
  maxPolygonSizeSqKm: unknown;
  feature: unknown;
  isNew: boolean;
  geometryEdited: boolean;
}): PolygonSizeViolation | null {
  const limit = effectiveMaxPolygonSizeSqKm(
    options.geometryType,
    options.maxPolygonSizeSqKm
  );
  if (limit === undefined) {
    return null;
  }
  const violation = polygonSizeViolation(options.feature, limit);
  if (!violation) {
    return null;
  }
  if (!options.isNew && !options.geometryEdited) {
    return null;
  }
  return violation;
}

/**
 * Whether to leave the drawing-intro stage after a shape is created.
 * Desktop still opens the attribute form when a polygon self-intersects.
 * An over-size polygon stays on the map on every layout. Mobile also stays
 * on the map when the shape self-intersects.
 */
export function shouldAdvanceFromDrawingIntro(options: {
  isSmall: boolean;
  hasKinks: boolean;
  tooLarge: boolean;
}): boolean {
  if (options.tooLarge) {
    return false;
  }
  if (options.isSmall && options.hasKinks) {
    return false;
  }
  return true;
}
