import { Feature, LineString, MultiLineString, Position } from "geojson";

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function isLine(value: unknown): value is Position[] {
  return Array.isArray(value) && value.length >= 2 && value.every(isPosition);
}

export function isShorelineFeature(
  value: unknown
): value is Feature<LineString | MultiLineString> {
  if (value == null || typeof value !== "object") return false;
  if (!("geometry" in value)) return false;
  const geometry = value.geometry;
  if (geometry == null || typeof geometry !== "object") return false;
  if (!("type" in geometry) || !("coordinates" in geometry)) return false;
  if (geometry.type === "LineString") return isLine(geometry.coordinates);
  if (geometry.type === "MultiLineString") {
    return (
      Array.isArray(geometry.coordinates) && geometry.coordinates.some(isLine)
    );
  }
  return false;
}

export function shorelineLines(
  value: unknown
): Feature<LineString>[] {
  if (!isShorelineFeature(value)) return [];
  if (value.geometry.type === "LineString") return [value as Feature<LineString>];
  return value.geometry.coordinates.filter(isLine).map((coordinates) => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates },
  }));
}
