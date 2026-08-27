import { Feature, Polygon } from "geojson";
import { H3Index } from "h3-js";
import { FlatGeobufSource } from "fgb-source";
import {
  bboxToEnvelope,
  cleanBBox,
  splitBBoxAntimeridian,
} from "../utils/bboxUtils";
import { bboxForCell } from "./bboxForCell";

export type LandOccupancyCache = Map<string, boolean>;

/**
 * True if the FlatGeobuf R-tree reports any land features in this cell.
 * Index-only (no feature fetch). Results are cached per cell.
 */
export function cellHasLand(
  cell: H3Index,
  land: FlatGeobufSource<Feature<Polygon>>,
  cache: LandOccupancyCache
): boolean {
  const cached = cache.get(cell);
  if (cached !== undefined) return cached;

  const cellBBox = bboxForCell(cell);
  const cleaned = cleanBBox(cellBBox);
  const split = splitBBoxAntimeridian(
    cleaned as [number, number, number, number]
  );

  let hasLand = false;
  for (const part of split) {
    const env = bboxToEnvelope(part);
    const estimate = land.search(env as any);
    if (estimate.features > 0) {
      hasLand = true;
      break;
    }
  }

  cache.set(cell, hasLand);
  return hasLand;
}
