import {
  cellToChildren,
  cellToLatLng,
  getHexagonEdgeLengthAvg,
  getResolution,
  gridDisk,
  H3Index,
} from "h3-js";
import distance from "@turf/distance";
import { Position } from "geojson";
import { COARSE_H3_RESOLUTION, FINE_H3_RESOLUTION } from "./constants";

export { COARSE_H3_RESOLUTION, FINE_H3_RESOLUTION };

/**
 * Admissible lower bound (meters) from origin sample points to any location
 * inside `cell`: geodesic to the cell center minus the hex circumradius
 * (edge length).
 */
export function cellLowerBoundMeters(
  originSamples: Position[],
  cell: H3Index
): number {
  if (originSamples.length === 0) return 0;
  const res = getResolution(cell);
  const circumradius = getHexagonEdgeLengthAvg(res, "m");
  const [lat, lng] = cellToLatLng(cell);

  let best = Infinity;
  for (const sample of originSamples) {
    const meters = distance(sample as any, [lng, lat] as any, {
      units: "meters",
    });
    const lb = meters - circumradius;
    if (lb < best) best = lb;
  }
  return best < 0 ? 0 : best;
}

export function sameResNeighbors(cell: H3Index): H3Index[] {
  return gridDisk(cell, 1).filter((n) => n !== cell);
}

export function refineToFine(cell: H3Index): H3Index[] {
  const res = getResolution(cell);
  if (res >= FINE_H3_RESOLUTION) return [cell];
  return cellToChildren(cell, FINE_H3_RESOLUTION);
}
