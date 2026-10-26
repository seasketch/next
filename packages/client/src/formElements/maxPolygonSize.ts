import area from "@turf/area";
import { MultiPolygon, Polygon } from "geojson";
import { SketchGeometryType } from "../generated/graphql";

const SQ_METERS_PER_SQ_KM = 1_000_000;

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

export function formatSqKm(sqKm: number): string {
  if (!Number.isFinite(sqKm)) {
    return "";
  }
  const abs = Math.abs(sqKm);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  const factor = 10 ** digits;
  return (Math.round(sqKm * factor) / factor).toString();
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
