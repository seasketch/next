import { Feature, Geometry, LineString, Point, Polygon, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import booleanIntersects from "@turf/boolean-intersects";
import bbox from "@turf/bbox";
import { getHexagonEdgeLengthAvg, getResolution, H3Index } from "h3-js";
import {
  bboxToEnvelope,
  cleanBBox,
  splitBBoxAntimeridian,
} from "../utils/bboxUtils";
import { bboxForCell } from "./bboxForCell";
import {
  COARSE_H3_RESOLUTION,
  FINE_H3_RESOLUTION,
  MAX_SEARCH_METERS,
  MIN_POINT_BUFFER_METERS,
  metersToDegrees,
} from "./constants";
import {
  cellsCoveringGeometry,
  densifiedPositionsFromGeometry,
} from "./coverGeometry";
import { cellHasLand, LandOccupancyCache } from "./landOccupancy";
import {
  cellLowerBoundMeters,
  refineToFine,
  sameResNeighbors,
} from "./adaptiveGrid";
import { MinHeap } from "./minHeap";
import { nearestPointsBetweenGeometryAndPolygon } from "./nearestShorelinePath";

export type GeodesicNearestLandResult = {
  meters: number;
  geojsonLine: Feature<LineString> | null;
};

function envelopeAroundPoint(point: Point, bufferMeters: number) {
  const [lng, lat] = point.coordinates;
  const delta = metersToDegrees(bufferMeters);
  const raw: [number, number, number, number] = [
    lng - delta,
    lat - delta,
    lng + delta,
    lat + delta,
  ];
  const cleaned = cleanBBox(raw);
  const split = splitBBoxAntimeridian(
    cleaned as [number, number, number, number]
  );
  return split.map(bboxToEnvelope);
}

function pathLine(
  origin: Position | null,
  shoreline: Position | null
): Feature<LineString> | null {
  if (!origin || !shoreline) return null;
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [origin, shoreline],
    },
    properties: {},
  };
}

async function exactDistanceInCell(
  feature: Feature,
  cell: H3Index,
  land: FlatGeobufSource<Feature<Polygon>>,
  seenOffsets: Set<number>,
  minimumDistanceMeters: number
): Promise<{
  meters: number;
  origin: Position | null;
  shoreline: Position | null;
}> {
  const cellBBox = bboxForCell(cell);
  const cleaned = cleanBBox(cellBBox);
  const split = splitBBoxAntimeridian(
    cleaned as [number, number, number, number]
  );

  let bestMeters = Infinity;
  let bestOrigin: Position | null = null;
  let bestShoreline: Position | null = null;

  for (const part of split) {
    const env = bboxToEnvelope(part);
    const queryPlan = land.createPlan(env as any);
    for await (const landFeature of land.getFeaturesAsync(env as any, {
      queryPlan,
    })) {
      const offset =
        (landFeature as any).properties &&
        (landFeature as any).properties.__offset;
      if (typeof offset === "number") {
        if (seenOffsets.has(offset)) continue;
        seenOffsets.add(offset);
      }
      if (booleanIntersects(feature as any, landFeature as any)) {
        return { meters: 0, origin: null, shoreline: null };
      }
      const path = nearestPointsBetweenGeometryAndPolygon(
        feature.geometry as Geometry,
        landFeature as any
      );
      if (path.meters < bestMeters) {
        bestMeters = path.meters;
        bestOrigin = path.origin;
        bestShoreline = path.shoreline;
        if (bestMeters <= minimumDistanceMeters) {
          return {
            meters: 0,
            origin: bestOrigin,
            shoreline: bestShoreline,
          };
        }
      }
    }
  }

  return { meters: bestMeters, origin: bestOrigin, shoreline: bestShoreline };
}

async function searchWithAdaptiveH3(
  feature: Feature,
  land: FlatGeobufSource<Feature<Polygon>>,
  originSamples: Position[],
  minimumDistanceMeters: number
): Promise<GeodesicNearestLandResult> {
  const originCells = cellsCoveringGeometry(
    feature.geometry as Geometry,
    COARSE_H3_RESOLUTION
  );
  if (originCells.length === 0) {
    return { meters: Infinity, geojsonLine: null };
  }

  const occupancy: LandOccupancyCache = new Map();
  const visited = new Set<string>();
  const heap = new MinHeap<H3Index>();
  const seenOffsets = new Set<number>();

  const enqueue = (cell: H3Index) => {
    if (visited.has(cell)) return;
    visited.add(cell);
    const lb = cellLowerBoundMeters(originSamples, cell);
    if (lb > MAX_SEARCH_METERS) return;
    heap.push(lb, cell);
  };

  for (const cell of originCells) {
    enqueue(cell);
  }

  let bestMeters = Infinity;
  let bestOrigin: Position | null = null;
  let bestShoreline: Position | null = null;

  while (heap.size > 0) {
    const next = heap.pop()!;
    if (next.key >= bestMeters) {
      break;
    }
    if (next.key > MAX_SEARCH_METERS) {
      break;
    }

    const cell = next.value;
    const res = getResolution(cell);
    const hasLand = cellHasLand(cell, land, occupancy);

    if (res < FINE_H3_RESOLUTION) {
      if (hasLand) {
        for (const child of refineToFine(cell)) {
          enqueue(child);
        }
      }
      for (const neighbor of sameResNeighbors(cell)) {
        enqueue(neighbor);
      }
      continue;
    }

    if (!hasLand) {
      continue;
    }

    const exact = await exactDistanceInCell(
      feature,
      cell,
      land,
      seenOffsets,
      minimumDistanceMeters
    );
    if (exact.meters < bestMeters) {
      bestMeters = exact.meters;
      bestOrigin = exact.origin;
      bestShoreline = exact.shoreline;
      if (bestMeters <= minimumDistanceMeters) {
        return {
          meters: 0,
          geojsonLine: pathLine(bestOrigin, bestShoreline),
        };
      }
    }
  }

  if (bestMeters === Infinity) {
    return { meters: Infinity, geojsonLine: null };
  }

  const finalMeters =
    bestMeters <= minimumDistanceMeters ? 0 : bestMeters;
  return {
    meters: finalMeters,
    geojsonLine: pathLine(bestOrigin, bestShoreline),
  };
}

async function searchImmediateBbox(
  feature: Feature,
  land: FlatGeobufSource<Feature<Polygon>>,
  minimumDistanceMeters: number
): Promise<GeodesicNearestLandResult | null> {
  let envelopes: ReturnType<typeof bboxToEnvelope>[];
  if (feature.geometry!.type === "Point") {
    const point = feature.geometry as Point;
    const pointBufferMeters = Math.max(
      MIN_POINT_BUFFER_METERS,
      minimumDistanceMeters
    );
    envelopes = envelopeAroundPoint(point, pointBufferMeters);
  } else {
    const rawBBox = bbox(feature.geometry as any);
    const cleaned = cleanBBox(rawBBox);
    const split = splitBBoxAntimeridian(
      cleaned as [number, number, number, number]
    );
    envelopes = split.map(bboxToEnvelope);
  }

  const estimate = land.search(
    envelopes.length === 1 ? (envelopes[0] as any) : (envelopes as any)
  );
  if (estimate.features === 0) {
    return null;
  }

  const seenOffsets = new Set<number>();
  const queryPlan = land.createPlan(
    envelopes.length === 1 ? (envelopes[0] as any) : (envelopes as any)
  );

  let bestMeters = Infinity;
  let bestOrigin: Position | null = null;
  let bestShoreline: Position | null = null;

  for await (const landFeature of land.getFeaturesAsync(
    envelopes.length === 1 ? (envelopes[0] as any) : (envelopes as any),
    { queryPlan }
  )) {
    const offset =
      (landFeature as any).properties &&
      (landFeature as any).properties.__offset;
    if (typeof offset === "number") {
      if (seenOffsets.has(offset)) continue;
      seenOffsets.add(offset);
    }
    if (booleanIntersects(feature as any, landFeature as any)) {
      return { meters: 0, geojsonLine: null };
    }
    const path = nearestPointsBetweenGeometryAndPolygon(
      feature.geometry as Geometry,
      landFeature as any
    );
    if (path.meters < bestMeters) {
      bestMeters = path.meters;
      bestOrigin = path.origin;
      bestShoreline = path.shoreline;
      if (bestMeters <= minimumDistanceMeters) {
        return {
          meters: 0,
          geojsonLine: pathLine(bestOrigin, bestShoreline),
        };
      }
    }
  }

  if (bestMeters < Infinity && bestOrigin && bestShoreline) {
    return {
      meters: bestMeters,
      geojsonLine: pathLine(bestOrigin, bestShoreline),
    };
  }
  return null;
}

export async function searchGeodesicNearestLand(
  feature: Feature,
  land: FlatGeobufSource<Feature<Polygon>>,
  options?: { minimumDistanceMeters?: number }
): Promise<GeodesicNearestLandResult> {
  if (!feature.geometry) {
    throw new Error("searchGeodesicNearestLand: feature.geometry is required");
  }
  const minimumDistanceMeters = options?.minimumDistanceMeters ?? 0;

  const immediate = await searchImmediateBbox(
    feature,
    land,
    minimumDistanceMeters
  );
  if (immediate) {
    return immediate;
  }

  const originSamples = densifiedPositionsFromGeometry(
    feature.geometry,
    getHexagonEdgeLengthAvg(FINE_H3_RESOLUTION, "m") / 2
  );
  return searchWithAdaptiveH3(
    feature,
    land,
    originSamples,
    minimumDistanceMeters
  );
}
