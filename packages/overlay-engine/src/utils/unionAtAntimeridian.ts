import { Feature } from "geojson";
import { MultiPolygon, Polygon, Position } from "geojson";
import * as polygonClipping from "polygon-clipping";
import truncate from "@turf/truncate";

/**
 * Parts within this distance of ±180 are treated as meeting the antimeridian.
 * Prime-meridian geometries (the UK EEZ, for example) are far inside the band,
 * so their negative longitudes must stay negative.
 */
const ANTIMERIDIAN_TOLERANCE_DEGREES = 1e-3;

type AntimeridianSide = "west" | "east" | "cross" | "none";

/**
 * Prepares a MultiPolygon for Mapbox by making antimeridian crossings
 * continuous on the number line.
 *
 * Mapbox draws an edge from 179° to -179° the long way around the world.
 * The rendered sketch avoids that by rewriting the same edge as 179° to 181°,
 * which may leave the -180..180 box. Parts that only cross the prime meridian
 * (the UK EEZ, London to Birmingham) stay near longitude 0. Shifting those
 * negative longitudes by 360 is what wraps a sketch around the globe.
 *
 * This is display geometry only. Sketch fragments stay cut at ±180 so each
 * part is a valid WGS84 polygon. A Polygon is returned unchanged. Coordinates
 * are truncated to 6 decimal places so antimeridian seams still match.
 */
export function unionAtAntimeridian(feature: Feature<MultiPolygon | Polygon>) {
  if (isPolygon(feature)) {
    return feature;
  }

  const truncated = truncate(feature, {
    precision: 6,
    coordinates: 2,
    mutate: true,
  }) as Feature<MultiPolygon>;

  // Put each ring into a continuous longitude frame before deciding which
  // parts actually meet at ±180. A hop from 174° to -178° becomes 174° to 182°.
  // A hop from -0.1° to -1.9° is left alone.
  const polygons = truncated.geometry.coordinates.map((polygon) =>
    polygon.map((ring) => unwrapRing(ring)),
  );
  const sides = polygons.map((polygon) => classifyPolygon(polygon));
  const hasEasternSeam = sides.some(
    (side) => side === "east" || side === "cross",
  );
  const normalized = polygons.map((polygon, index) =>
    shouldShiftToAntimeridian(polygon, sides[index], hasEasternSeam)
      ? shiftNegativeLongitudes(polygon)
      : polygon,
  );

  const unioned = unionNormalizedPolygons(normalized);

  const unionedFeature: Feature<MultiPolygon> = {
    type: "Feature",
    geometry: {
      type: "MultiPolygon",
      coordinates: unioned as MultiPolygon["coordinates"],
    },
    properties: truncated.properties || {},
  };

  return unionedFeature;
}

function unionNormalizedPolygons(
  polygons: Position[][][],
): polygonClipping.MultiPolygon {
  if (polygons.length === 0) {
    return [];
  }
  const [first, ...rest] = polygons;
  return polygonClipping.union(
    first as polygonClipping.Polygon,
    ...(rest as polygonClipping.Polygon[]),
  );
}

/**
 * Shift a polygon only when that closes a seam on the antimeridian.
 * A western piece is shifted when another part of the same feature already
 * lies on the eastern side of ±180. A single part that itself crosses ±180
 * is shifted when doing so makes the ring narrower.
 */
function shouldShiftToAntimeridian(
  polygon: Position[][],
  side: AntimeridianSide,
  hasEasternSeam: boolean,
): boolean {
  if (side === "west") {
    return hasEasternSeam;
  }
  if (side !== "cross") {
    return false;
  }
  const shifted = shiftNegativeLongitudes(polygon);
  return longitudeSpan(shifted) < longitudeSpan(polygon) - 1e-9;
}

function classifyPolygon(polygon: Position[][]): AntimeridianSide {
  let west = false;
  let east = false;
  let outside = false;
  for (const ring of polygon) {
    for (const [longitude] of ring) {
      if (longitude < -180 || longitude > 180) {
        outside = true;
      }
      if (longitude <= -180 + ANTIMERIDIAN_TOLERANCE_DEGREES) {
        west = true;
      }
      if (longitude >= 180 - ANTIMERIDIAN_TOLERANCE_DEGREES) {
        east = true;
      }
    }
  }
  if (outside || (west && east)) {
    return "cross";
  }
  if (west) {
    return "west";
  }
  if (east) {
    return "east";
  }
  return "none";
}

/**
 * Walk a ring so each longitude is within 180° of the previous one.
 * Closed rings are resealed on the unwrapped first vertex.
 */
function unwrapRing(ring: Position[]): Position[] {
  if (ring.length === 0) {
    return ring;
  }
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const positions = closed ? ring.slice(0, -1) : ring;
  const unwrapped: Position[] = [[positions[0][0], positions[0][1]]];
  for (let index = 1; index < positions.length; index++) {
    let longitude = positions[index][0];
    const previous = unwrapped[index - 1][0];
    while (longitude - previous > 180) longitude -= 360;
    while (previous - longitude > 180) longitude += 360;
    unwrapped.push([longitude, positions[index][1]]);
  }
  if (closed) {
    unwrapped.push([unwrapped[0][0], unwrapped[0][1]]);
  }
  return unwrapped;
}

function shiftNegativeLongitudes(polygon: Position[][]): Position[][] {
  return polygon.map((ring) =>
    ring.map(([longitude, latitude]) => [
      longitude < 0 ? longitude + 360 : longitude,
      latitude,
    ]),
  );
}

function longitudeSpan(polygon: Position[][]): number {
  let min = Infinity;
  let max = -Infinity;
  for (const ring of polygon) {
    for (const [longitude] of ring) {
      if (longitude < min) min = longitude;
      if (longitude > max) max = longitude;
    }
  }
  return max - min;
}

export function isPolygon(
  feature: Feature<Polygon | MultiPolygon>,
): feature is Feature<Polygon> {
  return feature.geometry.type === "Polygon";
}
