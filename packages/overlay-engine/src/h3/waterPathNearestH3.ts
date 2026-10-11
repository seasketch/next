import { Feature, Geometry, LineString, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import distance from "@turf/distance";
import {
  cellToBoundary,
  cellToChildren,
  cellToLatLng,
  cellToParent,
  getHexagonEdgeLengthAvg,
  getResolution,
  H3Index,
  latLngToCell,
} from "h3-js";
import {
  bboxToEnvelope,
  cleanBBox,
  splitBBoxAntimeridian,
} from "../utils/bboxUtils";
import { bboxForCell } from "./bboxForCell";
import { COARSE_H3_RESOLUTION } from "./constants";
import { densifiedPositionsFromGeometry } from "./coverGeometry";
import { cellHasLand, LandOccupancyCache } from "./landOccupancy";
import { sameResNeighbors } from "./adaptiveGrid";
import { MinHeap } from "./minHeap";
import { straightenWaterPath } from "./straightenWaterPath";

/**
 * Fine water-path cells (~460 m). Shore search keeps its own floor
 * (`FINE_H3_RESOLUTION`); this one is local so harbors and channels stay
 * reachable without changing that search.
 */
const WATER_PATH_FINE_RESOLUTION = 8;

/**
 * Largest radius the engine will search. A miss expands the whole disk, so
 * this stays well under the overlay worker's practical time budget.
 * Retune with the bench when the grid changes.
 */
export const MAX_DISTANCE_TO_FEATURES_KM = 400;

/** Default number of nearest features when the caller does not set one. */
export const DEFAULT_WATER_PATH_MAX_RESULTS = 3;

/** Default search radius: 200 statute miles, stored in kilometres. */
export const DEFAULT_WATER_PATH_DISTANCE_KM = 200 * 1.609344;

export const MAX_WATER_PATH_RESULTS = 25;

/**
 * Extra rough hits kept before the shoreline pull. Ports are sparse, so
 * refining a couple past `maxResults` is enough to re-rank by real distance.
 */
const ROUGH_EXTRA = 2;
const MAX_EXPANSIONS = 40_000;

export type WaterPathFeatureHit = {
  __id: number;
  meters: number;
  properties: Record<string, unknown>;
  geojsonLine: Feature<LineString>;
};

/** A port inside the search disk, whether or not it received a water route. */
export type WaterPathCandidate = {
  __id: number;
  position: Position;
  properties: Record<string, unknown>;
  /** Straight-line distance from the sketch boundary, in meters. */
  geodesicMeters: number;
  /** Water-route length when this port was routed. */
  meters?: number;
};

export type WaterPathNearestResult = {
  features: WaterPathFeatureHit[];
  exceededLimit: boolean;
  /** Every port in the search disk, nearest geodesic first. */
  candidates: WaterPathCandidate[];
};

type Occupancy = "water" | "land" | "mixed";

type Classified = {
  kind: Occupancy;
  centerOnLand: boolean;
};

type IndexedPoint = {
  id: number;
  position: Position;
  properties: Record<string, unknown>;
};

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function normalizeGeometry(geometry: Geometry): Geometry {
  const clone = JSON.parse(JSON.stringify(geometry)) as Geometry;
  const walk = (coords: unknown): unknown => {
    if (!Array.isArray(coords)) return coords;
    if (typeof coords[0] === "number") {
      coords[0] = wrapLng(coords[0] as number);
      return coords;
    }
    return coords.map(walk);
  };
  (clone as { coordinates: unknown }).coordinates = walk(
    (clone as { coordinates: unknown }).coordinates
  );
  return clone;
}

function cellCenter(cell: H3Index): Position {
  const [lat, lng] = cellToLatLng(cell);
  return [wrapLng(lng), lat];
}

function unwrapCoordinates(coords: Position[]): Position[] {
  if (coords.length === 0) return [];
  const out: Position[] = [[coords[0]![0], coords[0]![1]]];
  for (let i = 1; i < coords.length; i++) {
    let lng = coords[i]![0];
    const prev = out[i - 1]![0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, coords[i]![1]]);
  }
  return out;
}

function positionsOf(geometry: Geometry | null | undefined): Position[] {
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "MultiPoint") return geometry.coordinates;
  return [];
}

function publicProperties(
  properties: Record<string, unknown> | null | undefined,
  includedColumns: string[] | undefined
): Record<string, unknown> {
  if (!properties) return {};
  const keys = includedColumns?.length
    ? includedColumns
    : Object.keys(properties);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key.startsWith("__")) continue;
    if (key in properties) out[key] = properties[key];
  }
  return out;
}

function featureId(feature: Feature, position: Position): number {
  const offset = (feature.properties as { __offset?: unknown } | null)
    ?.__offset;
  if (typeof offset === "number" && Number.isFinite(offset)) return offset;
  return (
    Math.round(position[0] * 1e5) * 1_000_003 + Math.round(position[1] * 1e5)
  );
}

function lineFeature(coords: Position[]): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

function passable(info: Classified, resolution: number): boolean {
  if (info.kind === "water") return true;
  if (info.kind === "land") return false;
  return resolution >= WATER_PATH_FINE_RESOLUTION && !info.centerOnLand;
}

/**
 * True when `child` shares a border with `cell`. Used so a mixed cell is
 * entered from the near shore instead of jumping to children on the far
 * side of an island.
 */
function cellsTouch(cell: H3Index, child: H3Index): boolean {
  const resolution = getResolution(cell);
  const [lat, lng] = cellToLatLng(child);
  const samples: Array<[number, number]> = [[lat, wrapLng(lng)]];
  for (const [boundaryLat, boundaryLng] of cellToBoundary(child)) {
    samples.push([boundaryLat, wrapLng(boundaryLng)]);
  }
  for (const [sampleLat, sampleLng] of samples) {
    if (latLngToCell(sampleLat, sampleLng, resolution) === cell) return true;
  }
  const limit =
    getHexagonEdgeLengthAvg(resolution, "m") +
    getHexagonEdgeLengthAvg(getResolution(child), "m");
  return (
    distance(cellCenter(cell), cellCenter(child), { units: "meters" }) <= limit
  );
}

/**
 * Hex-grid water path. Open ocean steps up to coarse cells; the shore stays
 * on fine cells, then the chain is pulled taut. Kept so it can be compared
 * with the tangent router.
 */
export async function searchWaterPathNearestH3(
  feature: Feature,
  points: FlatGeobufSource<Feature>,
  land: FlatGeobufSource<Feature>,
  options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
  }
): Promise<WaterPathNearestResult> {
  if (!feature.geometry) {
    throw new Error("searchWaterPathNearest: feature.geometry is required");
  }

  const maxResults = Math.min(
    MAX_WATER_PATH_RESULTS,
    Math.max(1, options?.maxResults ?? DEFAULT_WATER_PATH_MAX_RESULTS)
  );
  const requestedKm =
    options?.maxDistanceKm ?? DEFAULT_WATER_PATH_DISTANCE_KM;
  const maxDistanceMeters =
    Math.min(requestedKm, MAX_DISTANCE_TO_FEATURES_KM) * 1000;

  const geometry = normalizeGeometry(feature.geometry);
  const spacing = getHexagonEdgeLengthAvg(WATER_PATH_FINE_RESOLUTION, "m") / 2;
  const samples = densifiedPositionsFromGeometry(geometry, spacing);

  const occupancy: LandOccupancyCache = new Map();
  const classCache = new Map<H3Index, Promise<Classified>>();
  const landRegionCache = new Map<H3Index, Promise<Feature[]>>();
  const pointRegionCache = new Map<H3Index, Promise<IndexedPoint[]>>();
  const pointCache = new Map<H3Index, IndexedPoint[]>();

  const landSource = land as FlatGeobufSource<Feature<never>>;

  function regionKey(cell: H3Index): H3Index {
    const resolution = getResolution(cell);
    return resolution > 6 ? cellToParent(cell, 6) : cell;
  }

  function positionInCell(position: Position, cell: H3Index): boolean {
    const [minX, minY, maxX, maxY] = bboxForCell(cell);
    const lat = position[1];
    if (lat < minY || lat > maxY) return false;
    const lng = wrapLng(position[0]);
    if (minX > maxX) return lng >= minX || lng <= maxX;
    return lng >= minX && lng <= maxX;
  }

  async function fetchFeatures(
    source: FlatGeobufSource<Feature>,
    cell: H3Index
  ): Promise<Feature[]> {
    if (source === land && !cellHasLand(cell, landSource, occupancy)) {
      return [];
    }
    const cleaned = cleanBBox(bboxForCell(cell));
    const parts = splitBBoxAntimeridian(
      cleaned as [number, number, number, number]
    );
    const found: Feature[] = [];
    const seen = new Set<number>();
    for (const part of parts) {
      const env = bboxToEnvelope(part);
      const queryPlan = source.createPlan(env as never);
      for await (const feature of source.getFeaturesAsync(env as never, {
        queryPlan,
      })) {
        const offset = (feature.properties as { __offset?: unknown } | null)
          ?.__offset;
        if (typeof offset === "number") {
          if (seen.has(offset)) continue;
          seen.add(offset);
        }
        found.push(feature);
      }
    }
    return found;
  }

  function landInCell(cell: H3Index): Promise<Feature[]> {
    const key = regionKey(cell);
    const cached = landRegionCache.get(key);
    if (cached) return cached;
    const pending = fetchFeatures(land, key);
    landRegionCache.set(key, pending);
    return pending;
  }

  function pointInside(sample: Position, polys: Feature[]): boolean {
    const [lng, lat] = sample;
    const candidates: Position[] = [
      [lng, lat],
      [lng + 360, lat],
      [lng - 360, lat],
    ];
    return polys.some((poly) =>
      candidates.some((candidate) =>
        booleanPointInPolygon(candidate, poly as never)
      )
    );
  }

  function classify(cell: H3Index): Promise<Classified> {
    const cached = classCache.get(cell);
    if (cached) return cached;
    const pending = (async (): Promise<Classified> => {
      if (!cellHasLand(cell, landSource, occupancy)) {
        return { kind: "water", centerOnLand: false };
      }
      if (getResolution(cell) < WATER_PATH_FINE_RESOLUTION) {
        return { kind: "mixed", centerOnLand: false };
      }
      const polys = await landInCell(cell);
      if (polys.length === 0) return { kind: "water", centerOnLand: false };
      const [lat, lng] = cellToLatLng(cell);
      const center: Position = [wrapLng(lng), lat];
      const probes: Position[] = [center];
      for (const [boundaryLat, boundaryLng] of cellToBoundary(cell)) {
        probes.push([wrapLng(boundaryLng), boundaryLat]);
      }
      let inside = 0;
      for (const probe of probes) {
        if (pointInside(probe, polys)) inside++;
      }
      const centerOnLand = pointInside(center, polys);
      if (inside === 0) return { kind: "water", centerOnLand: false };
      if (inside === probes.length) return { kind: "land", centerOnLand: true };
      return { kind: "mixed", centerOnLand };
    })();
    classCache.set(cell, pending);
    return pending;
  }

  function pointsInRegion(cell: H3Index): Promise<IndexedPoint[]> {
    const key = regionKey(cell);
    const cached = pointRegionCache.get(key);
    if (cached) return cached;
    const pending = (async () => {
      const features = await fetchFeatures(points, key);
      const indexed: IndexedPoint[] = [];
      const seen = new Set<number>();
      for (const pointFeature of features) {
        const positions = positionsOf(pointFeature.geometry);
        if (positions.length === 0) continue;
        const position: Position = [
          wrapLng(positions[0]![0]),
          positions[0]![1],
        ];
        const id = featureId(pointFeature, position);
        if (seen.has(id)) continue;
        seen.add(id);
        indexed.push({
          id,
          position,
          properties: publicProperties(
            pointFeature.properties as Record<string, unknown> | null,
            options?.includedColumns
          ),
        });
      }
      return indexed;
    })();
    pointRegionCache.set(key, pending);
    return pending;
  }

  async function pointsInCell(cell: H3Index): Promise<IndexedPoint[]> {
    const cached = pointCache.get(cell);
    if (cached) return cached;
    const region = await pointsInRegion(cell);
    const filtered = region.filter((hit) => positionInCell(hit.position, cell));
    pointCache.set(cell, filtered);
    return filtered;
  }

  const startCells = new Set<H3Index>();
  for (const [lng, lat] of samples) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    startCells.add(
      latLngToCell(lat, wrapLng(lng), WATER_PATH_FINE_RESOLUTION)
    );
  }

  const starts: H3Index[] = [];
  for (const cell of startCells) {
    const info = await classify(cell);
    if (passable(info, WATER_PATH_FINE_RESOLUTION)) {
      starts.push(cell);
      continue;
    }
    for (const neighbor of sameResNeighbors(cell)) {
      const neighborInfo = await classify(neighbor);
      if (passable(neighborInfo, WATER_PATH_FINE_RESOLUTION)) {
        starts.push(neighbor);
      }
    }
  }

  if (starts.length === 0) {
    return { features: [], exceededLimit: false, candidates: [] };
  }

  const best = new Map<H3Index, number>();
  const cameFrom = new Map<H3Index, H3Index | null>();
  const heap = new MinHeap<H3Index>();
  for (const cell of starts) {
    if (best.has(cell)) continue;
    best.set(cell, 0);
    cameFrom.set(cell, null);
    heap.push(0, cell);
  }

  const hits = new Map<number, WaterPathFeatureHit>();
  const rough = new Map<
    number,
    {
      id: number;
      position: Position;
      properties: Record<string, unknown>;
      graphMeters: number;
      cell: H3Index;
    }
  >();
  const expanded = new Set<H3Index>();
  let exceededLimit = false;
  let expansions = 0;

  const chainTo = (cell: H3Index): H3Index[] => {
    const chain: H3Index[] = [];
    const guard = new Set<H3Index>();
    let cursor: H3Index | null | undefined = cell;
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      chain.push(cursor);
      cursor = cameFrom.get(cursor);
    }
    chain.reverse();
    return chain;
  };

  const consider = (node: H3Index, from: H3Index, g: number) => {
    if (node === from) return;
    const step = distance(cellCenter(from), cellCenter(node), {
      units: "meters",
    });
    const next = g + step;
    if (next > maxDistanceMeters) return;
    const prev = best.get(node);
    if (prev !== undefined && next >= prev - 0.5) return;
    best.set(node, next);
    cameFrom.set(node, from);
    heap.push(next, node);
  };

  async function segmentHitsLand(start: Position, end: Position): Promise<boolean> {
    let lng = end[0];
    while (lng - start[0] > 180) lng -= 360;
    while (lng - start[0] < -180) lng += 360;
    const span = distance(start, [lng, end[1]], { units: "meters" });
    const steps = Math.max(1, Math.ceil(span / 40));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sample: Position = [
        wrapLng(start[0] + (lng - start[0]) * t),
        start[1] + (end[1] - start[1]) * t,
      ];
      const polys = await landInCell(
        latLngToCell(sample[1], sample[0], WATER_PATH_FINE_RESOLUTION)
      );
      if (pointInside(sample, polys)) return true;
    }
    return false;
  }

  async function edgeCrossesLand(from: H3Index, to: H3Index): Promise<boolean> {
    const fromFine = getResolution(from) >= WATER_PATH_FINE_RESOLUTION;
    const toFine = getResolution(to) >= WATER_PATH_FINE_RESOLUTION;
    if (!fromFine && !toFine) return false;
    return segmentHitsLand(cellCenter(from), cellCenter(to));
  }

  async function tryConsider(node: H3Index, from: H3Index, g: number) {
    if (await edgeCrossesLand(from, node)) return;
    consider(node, from, g);
  }

  while (heap.size > 0) {
    const popped = heap.pop();
    if (!popped) break;
    const g = popped.key;
    const cell = popped.value;
    const known = best.get(cell);
    if (known === undefined || g > known + 0.5) continue;
    if (expanded.has(cell)) continue;
    if (g > maxDistanceMeters) {
      exceededLimit = true;
      break;
    }
    if (rough.size >= maxResults + ROUGH_EXTRA) {
      const rankedRough = Array.from(rough.values()).sort(
        (a, b) => a.graphMeters - b.graphMeters
      );
      const cutoff =
        rankedRough[maxResults + ROUGH_EXTRA - 1]?.graphMeters ?? Infinity;
      if (g >= cutoff) {
        exceededLimit = true;
        break;
      }
    }
    expanded.add(cell);
    expansions++;
    if (expansions > MAX_EXPANSIONS) {
      exceededLimit = true;
      break;
    }

    const info = await classify(cell);
    const resolution = getResolution(cell);
    const canTraverse = passable(info, resolution);

    if (canTraverse && resolution >= WATER_PATH_FINE_RESOLUTION) {
      const center = cellCenter(cell);
      const searchCells = [cell, ...sameResNeighbors(cell)];
      const nearLand = searchCells.some((searchCell) =>
        cellHasLand(searchCell, landSource, occupancy)
      );
      const indexedCells = nearLand ? searchCells : [];
      const indexedGroups = await Promise.all(
        indexedCells.map((searchCell) => pointsInCell(searchCell))
      );
      for (const indexed of indexedGroups) {
        for (const hit of indexed) {
          const hop = distance(center, hit.position, { units: "meters" });
          const graphMeters = g + hop;
          if (graphMeters > maxDistanceMeters) continue;
          const previous = rough.get(hit.id);
          if (previous && previous.graphMeters <= graphMeters) continue;
          rough.set(hit.id, {
            id: hit.id,
            position: hit.position,
            properties: hit.properties,
            graphMeters,
            cell,
          });
        }
      }
    }

    if (!canTraverse) continue;

    const enterCoarseMixed = async (candidate: H3Index) => {
      const candidateInfo = await classify(candidate);
      const candidateRes = getResolution(candidate);
      if (candidateInfo.kind === "land") return;
      if (passable(candidateInfo, candidateRes)) {
        await tryConsider(candidate, cell, g);
        return;
      }
      if (
        candidateInfo.kind !== "mixed" ||
        candidateRes >= WATER_PATH_FINE_RESOLUTION
      ) {
        return;
      }
      const children = cellToChildren(candidate, candidateRes + 1).filter(
        (child) => cellsTouch(cell, child)
      );
      await Promise.all(children.map((child) => enterCoarseMixed(child)));
    };

    const neighborCells = sameResNeighbors(cell);
    await Promise.all(neighborCells.map((neighbor) => classify(neighbor)));
    for (const neighbor of neighborCells) {
      const neighborInfo = await classify(neighbor);
      const neighborRes = getResolution(neighbor);
      if (
        neighborInfo.kind === "mixed" &&
        neighborRes < WATER_PATH_FINE_RESOLUTION
      ) {
        await enterCoarseMixed(neighbor);
        continue;
      }
      if (!passable(neighborInfo, neighborRes)) continue;
      let node = neighbor;
      if (neighborInfo.kind === "water") {
        while (getResolution(node) > COARSE_H3_RESOLUTION) {
          const parent = cellToParent(node, getResolution(node) - 1);
          const parentInfo = await classify(parent);
          if (parentInfo.kind !== "water") break;
          node = parent;
        }
      }
      await tryConsider(node, cell, g);
    }
  }

  if (process.env.WATER_PATH_DEBUG) {
    console.log("water-path expansions", expansions);
  }

  const candidates = Array.from(rough.values())
    .sort((a, b) => a.graphMeters - b.graphMeters)
    .slice(0, maxResults + ROUGH_EXTRA);
  for (const candidate of candidates) {
    const line = unwrapCoordinates(
      await straightenWaterPath(
        geometry,
        chainTo(candidate.cell),
        candidate.position,
        segmentHitsLand
      )
    );
    let meters = 0;
    for (let i = 1; i < line.length; i++) {
      meters += distance(line[i - 1]!, line[i]!, { units: "meters" });
    }
    if (meters > maxDistanceMeters || meters <= 0) continue;
    hits.set(candidate.id, {
      __id: candidate.id,
      meters,
      properties: candidate.properties,
      geojsonLine: lineFeature(line),
    });
  }

  const features = Array.from(hits.values())
    .sort((a, b) => a.meters - b.meters)
    .slice(0, maxResults);
  if (hits.size > maxResults) exceededLimit = true;

  return { features, exceededLimit, candidates: [] };
}
