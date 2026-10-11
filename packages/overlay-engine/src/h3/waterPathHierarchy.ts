import { Feature, Geometry, LineString, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import booleanIntersects from "@turf/boolean-intersects";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import distance from "@turf/distance";
import {
  cellToBoundary,
  cellToChildren,
  cellToLatLng,
  cellToParent,
  getHexagonEdgeLengthAvg,
  getResolution,
  gridDisk,
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
import { MinHeap } from "./minHeap";
import {
  DEFAULT_WATER_PATH_DISTANCE_KM,
  DEFAULT_WATER_PATH_MAX_RESULTS,
  MAX_DISTANCE_TO_FEATURES_KM,
  MAX_WATER_PATH_RESULTS,
  WaterPathNearestResult,
} from "./waterPathNearestH3";

/**
 * Open-ocean step (~22 km). A cell the land index misses is one move.
 * Anything the index touches is split instead of walked.
 */
const COARSE = COARSE_H3_RESOLUTION;

/**
 * Finest step (~460 m). A cell this small that still meets the land index
 * is treated as shore and is not entered, which keeps the route offshore
 * without buffering the coastline.
 */
const FINE = 8;

/** Open-ocean index step. A clear coarse neighborhood is one jump. */
const COARSE_EDGE_METERS = getHexagonEdgeLengthAvg(COARSE, "m");

/** Land is allowed only this far while leaving a sketch that sits on an island. */
const DEPARTURE_LAND_METERS = 1_500;

/** Land is allowed only this far while arriving at a harbor. */
const ARRIVAL_LAND_METERS = 2_000;

/** Geodesic candidates kept per result before paying for a route. */
const CANDIDATE_FACTOR = 8;

const MAX_EXPANSIONS = 8_000;

/** How far, in fine rings, to look for water when the endpoint itself meets land. */
const ANCHOR_RINGS = 18;

const NODE_ITEM_BYTE_LENGTH = 40;

type IndexInternals = {
  view: DataView;
  details: {
    nodeSize: number;
    numNodes: number;
    levels: number[];
  };
};

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function metersBetween(a: Position, b: Position): number {
  let lng = b[0];
  while (lng - a[0] > 180) lng -= 360;
  while (lng - a[0] < -180) lng += 360;
  return distance(a, [lng, b[1]], { units: "meters" });
}

function center(cell: H3Index): Position {
  const [lat, lng] = cellToLatLng(cell);
  return [wrapLng(lng), lat];
}

function upperBound(value: number, arr: number[]): number {
  let i = 0;
  let j = arr.length - 1;
  while (i < j) {
    const m = (i + j) >> 1;
    if (arr[m]! > value) j = m;
    else i = m + 1;
  }
  return arr[i]!;
}

/**
 * True when any land-feature bbox meets this box. Stops at the first leaf.
 * `FlatGeobufSource.search` collects every hit; a coarse coastal cell can
 * have hundreds, and the hierarchy only needs a yes or no.
 */
function indexIntersects(
  land: FlatGeobufSource<Feature>,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  const index = (land as unknown as { index?: IndexInternals }).index;
  if (!index?.view || !index.details?.levels) {
    return land.search({ minX, minY, maxX, maxY }).features > 0;
  }
  const { view, details } = index;
  const leafStart = details.levels[details.levels.length - 2]!;
  let nodeIndex: number | undefined = 0;
  const queue: number[] = [];
  while (nodeIndex !== undefined) {
    const end = Math.min(
      nodeIndex + details.nodeSize,
      upperBound(nodeIndex, details.levels)
    );
    for (let pos = nodeIndex; pos < end; pos++) {
      const byteIndex = pos * NODE_ITEM_BYTE_LENGTH;
      const nodeMinX = view.getFloat64(byteIndex, true);
      const nodeMinY = view.getFloat64(byteIndex + 8, true);
      const nodeMaxX = view.getFloat64(byteIndex + 16, true);
      const nodeMaxY = view.getFloat64(byteIndex + 24, true);
      if (
        maxX < nodeMinX ||
        maxY < nodeMinY ||
        minX > nodeMaxX ||
        minY > nodeMaxY
      ) {
        continue;
      }
      if (pos >= leafStart) return true;
      queue.push(Number(view.getBigUint64(byteIndex + 32, true)));
    }
    nodeIndex = queue.pop();
  }
  return false;
}

type LandCache = {
  water: Map<H3Index, boolean>;
  /** True when the land index has no feature bbox in the cell. */
  empty: Map<H3Index, boolean>;
  features: Map<number, Feature>;
  /** Segment blocked? Keyed by rounded endpoints and shore mode. */
  segments: Map<string, boolean>;
  boxes: Map<Feature, [number, number, number, number]>;
};

function indexMiss(
  cell: H3Index,
  land: FlatGeobufSource<Feature>,
  cache: LandCache
): boolean {
  const known = cache.empty.get(cell);
  if (known !== undefined) return known;
  const cleaned = cleanBBox(bboxForCell(cell));
  const parts = splitBBoxAntimeridian(
    cleaned as [number, number, number, number]
  );
  let empty = true;
  for (const part of parts) {
    if (indexIntersects(land, part[0]!, part[1]!, part[2]!, part[3]!)) {
      empty = false;
      break;
    }
  }
  cache.empty.set(cell, empty);
  if (empty) cache.water.set(cell, true);
  return empty;
}

function pointOnFeature(point: Position, feature: Feature): boolean {
  const lng = wrapLng(point[0]);
  const lat = point[1];
  for (const shifted of [lng, lng + 360, lng - 360]) {
    if (booleanPointInPolygon([shifted, lat], feature as never)) return true;
  }
  return false;
}

async function featuresTouching(
  cell: H3Index,
  land: FlatGeobufSource<Feature>,
  cache: LandCache
): Promise<Feature[]> {
  const cleaned = cleanBBox(bboxForCell(cell));
  const parts = splitBBoxAntimeridian(
    cleaned as [number, number, number, number]
  );
  const found: Feature[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    const env = bboxToEnvelope(part);
    const refs = land.search(env as never).refs;
    const missing = refs.some((ref) => !cache.features.has(ref[0]));
    if (missing) {
      for await (const feature of land.getFeaturesAsync(env as never)) {
        const offset = (feature.properties as { __offset?: unknown } | null)?.__offset;
        if (typeof offset === "number") cache.features.set(offset, feature);
      }
    }
    for (const ref of refs) {
      const feature = cache.features.get(ref[0]);
      if (!feature || seen.has(ref[0])) continue;
      seen.add(ref[0]);
      found.push(feature);
    }
  }
  return found;
}

/**
 * Index miss: water, no geometry. Coarser index hit: not traversable at this
 * resolution (the caller splits it). Fine index hit: the bbox can be a false
 * overlap, so the cell center is tested against the features that actually
 * meet the cell.
 */
async function cellIsWater(
  cell: H3Index,
  land: FlatGeobufSource<Feature>,
  cache: LandCache
): Promise<boolean> {
  const cached = cache.water.get(cell);
  if (cached !== undefined) return cached;
  if (indexMiss(cell, land, cache)) return true;
  if (getResolution(cell) < FINE) {
    cache.water.set(cell, false);
    return false;
  }
  const features = await featuresTouching(cell, land, cache);
  const water = !features.some((feature) => pointOnFeature(center(cell), feature));
  cache.water.set(cell, water);
  return water;
}

async function lift(
  cell: H3Index,
  land: FlatGeobufSource<Feature>,
  cache: LandCache
): Promise<H3Index> {
  let current = cell;
  while (getResolution(current) > COARSE) {
    const parent = cellToParent(current, getResolution(current) - 1);
    if (!(await cellIsWater(parent, land, cache))) break;
    current = parent;
  }
  return current;
}

function touches(cell: H3Index, other: H3Index): boolean {
  const res = getResolution(cell);
  const probe = getResolution(other) < res ? cell : other;
  const target = probe === cell ? other : cell;
  const targetRes = getResolution(target);
  const [lat, lng] = cellToLatLng(probe);
  if (latLngToCell(lat, lng, targetRes) === target) return true;
  for (const [boundaryLat, boundaryLng] of cellToBoundary(probe)) {
    if (latLngToCell(boundaryLat, boundaryLng, targetRes) === target) return true;
  }
  return false;
}

function exteriorRings(geometry: Geometry | null | undefined): Position[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0];
    return ring ? [ring] : [];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon) => polygon[0])
      .filter((ring): ring is Position[] => !!ring && ring.length > 0);
  }
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

function pointPositions(geometry: Geometry | null | undefined): Position[] {
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "MultiPoint") return geometry.coordinates;
  return [];
}

function closestOnSegment(a: Position, b: Position, target: Position): Position {
  const ax = a[0];
  const ay = a[1];
  let bx = b[0];
  let by = b[1];
  while (bx - ax > 180) bx -= 360;
  while (bx - ax < -180) bx += 360;
  const tx = target[0];
  let ux = tx;
  while (ux - ax > 180) ux -= 360;
  while (ux - ax < -180) ux += 360;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((ux - ax) * dx + (target[1] - ay) * dy) / len2));
  return [ax + dx * t, ay + dy * t];
}

function closestBoundary(rings: Position[][], goal: Position): Position {
  let best = rings[0]?.[0] ?? goal;
  let bestMeters = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const point = closestOnSegment(ring[i]!, ring[i + 1]!, goal);
      const meters = metersBetween(point, goal);
      if (meters < bestMeters) {
        bestMeters = meters;
        best = point;
      }
    }
  }
  return best;
}

/**
 * Boundary samples, closest to the goal first. Used when the single closest
 * point sits inland and cannot reach water in one short hop.
 */
function boundarySamples(rings: Position[][], goal: Position): Position[] {
  const samples: Position[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]!;
      const b = ring[i + 1]!;
      let bx = b[0];
      while (bx - a[0] > 180) bx -= 360;
      while (bx - a[0] < -180) bx += 360;
      const span = metersBetween(a, [bx, b[1]]);
      const steps = Math.max(1, Math.ceil(span / 400));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        samples.push([a[0] + (bx - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
  }
  samples.sort((a, b) => metersBetween(a, goal) - metersBetween(b, goal));
  return samples;
}

async function launchOrigin(
  rings: Position[][],
  goal: Position,
  land: FlatGeobufSource<Feature>,
  cache: LandCache
): Promise<Position | null> {
  const closest = closestBoundary(rings, goal);
  if (await anchorCell(closest, land, cache, false)) return closest;
  for (const point of boundarySamples(rings, goal)) {
    if (metersBetween(point, closest) > 40_000) continue;
    if (await anchorCell(point, land, cache, false)) return point;
  }
  return null;
}

function unwrapLine(coords: Position[]): Position[] {
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

function lineFeature(coords: Position[]): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

function publicProperties(
  properties: Record<string, unknown> | null | undefined,
  includedColumns: string[] | undefined
): Record<string, unknown> {
  if (!properties) return {};
  const keys = includedColumns?.length ? includedColumns : Object.keys(properties);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key.startsWith("__")) continue;
    if (key in properties) out[key] = properties[key];
  }
  return out;
}

function featureId(feature: Feature, position: Position): number {
  const offset = (feature.properties as { __offset?: unknown } | null)?.__offset;
  if (typeof offset === "number" && Number.isFinite(offset)) return offset;
  return Math.round(position[0] * 1e5) * 1_000_003 + Math.round(position[1] * 1e5);
}

type ShoreMode = "none" | "prefix" | "suffix" | "ends";

/**
 * True when the segment crosses land. `prefix` allows the line to leave an
 * island the sketch sits on. `suffix` allows it to enter a harbor. `ends`
 * allows both, and still rejects an island in the middle.
 */
function pointAlong(a: Position, lng: number, lat: number, t: number): Position {
  return [a[0] + (lng - a[0]) * t, a[1] + (lat - a[1]) * t];
}

/** True when this coarse cell and its neighbors have no land bboxes. */
function coarseClear(
  cell: H3Index,
  land: FlatGeobufSource<Feature>,
  cache: LandCache
): boolean {
  for (const neighbor of gridDisk(cell, 1)) {
    if (!indexMiss(neighbor, land, cache)) return false;
  }
  return true;
}

/** Split an unwrapped segment into linestrings inside [-180, 180]. */
function antimeridianPieces(
  lng0: number,
  lat0: number,
  lng1: number,
  lat1: number
): LineString[] {
  const span = Math.max(Math.abs(lng1 - lng0), Math.abs(lat1 - lat0), 1e-6);
  const steps = Math.max(1, Math.ceil(span / 0.05));
  const groups: Position[][] = [];
  let group: Position[] = [];
  let prevWrapped: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const unwrapped = lng0 + (lng1 - lng0) * t;
    const wrapped = wrapLng(unwrapped);
    const lat = lat0 + (lat1 - lat0) * t;
    if (prevWrapped !== null && Math.abs(wrapped - prevWrapped) > 180) {
      const boundary = prevWrapped >= 0 ? 180 : -180;
      const other = boundary === 180 ? -180 : 180;
      const prevT = (i - 1) / steps;
      const prevU = lng0 + (lng1 - lng0) * prevT;
      const denom = unwrapped - prevU;
      const tb =
        denom === 0 ? prevT : prevT + ((boundary - prevWrapped) / denom) * (t - prevT);
      const latB = lat0 + (lat1 - lat0) * Math.min(1, Math.max(0, tb));
      group.push([boundary, latB]);
      if (group.length >= 2) groups.push(group);
      group = [[other, latB]];
    }
    group.push([wrapped, lat]);
    prevWrapped = wrapped;
  }
  if (group.length >= 2) groups.push(group);
  return groups.map((coordinates) => ({ type: "LineString", coordinates }));
}

function featureBox(
  feature: Feature,
  cache: LandCache
): [number, number, number, number] {
  const known = cache.boxes.get(feature);
  if (known) return known;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const x = coords[0] as number;
      const y = coords[1] as number;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    for (const child of coords) visit(child);
  };
  const geometry = feature.geometry;
  if (geometry && "coordinates" in geometry) visit(geometry.coordinates);
  const box: [number, number, number, number] = [minX, minY, maxX, maxY];
  cache.boxes.set(feature, box);
  return box;
}

function pieceHitsFeature(piece: LineString, feature: Feature, cache: LandCache): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of piece.coordinates) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const box = featureBox(feature, cache);
  const separated = maxX < box[0] || minX > box[2] || maxY < box[1] || minY > box[3];
  const nearDateline = maxX > 170 || minX < -170 || box[2] > 170 || box[0] < -170;
  if (!separated && booleanIntersects(piece, feature as never)) return true;
  if (!nearDateline) return false;
  const shifted = (delta: number): LineString => ({
    type: "LineString",
    coordinates: piece.coordinates.map(([x, y]) => [x + delta, y]),
  });
  return (
    booleanIntersects(shifted(360), feature as never) ||
    booleanIntersects(shifted(-360), feature as never)
  );
}

async function segmentMeetsLand(
  a: Position,
  b: Position,
  land: FlatGeobufSource<Feature>,
  cache: LandCache,
  mode: ShoreMode = "none"
): Promise<boolean> {
  let lng = b[0];
  while (lng - a[0] > 180) lng -= 360;
  while (lng - a[0] < -180) lng += 360;
  const memoKey = `${mode}:${a[0].toFixed(4)},${a[1].toFixed(4)}:${lng.toFixed(4)},${b[1].toFixed(4)}`;
  const remembered = cache.segments.get(memoKey);
  if (remembered !== undefined) return remembered;
  const blocked = await segmentCrossesLand(a, lng, b[1], land, cache, mode);
  cache.segments.set(memoKey, blocked);
  return blocked;
}

async function segmentCrossesLand(
  a: Position,
  lng: number,
  lat: number,
  land: FlatGeobufSource<Feature>,
  cache: LandCache,
  mode: ShoreMode
): Promise<boolean> {
  const span = metersBetween(a, [lng, lat]);
  if (span === 0) {
    const at: Position = [wrapLng(a[0]), a[1]];
    const cell = latLngToCell(at[1], at[0], FINE);
    if (indexMiss(cell, land, cache)) return false;
    const features = await featuresTouching(cell, land, cache);
    return features.some((feature) => pointOnFeature(at, feature));
  }
  let along = 0;
  let nearLand = false;
  while (along <= span) {
    const at = pointAlong(a, lng, lat, Math.min(1, along / span));
    const coarse = latLngToCell(at[1], wrapLng(at[0]), COARSE);
    if (!coarseClear(coarse, land, cache)) {
      nearLand = true;
      break;
    }
    const jump = COARSE_EDGE_METERS * 0.5;
    if (along + jump >= span) break;
    along += jump;
  }
  if (!nearLand) return false;

  let from = 0;
  let to = span;
  if (mode === "prefix" || mode === "ends") from = Math.min(span, DEPARTURE_LAND_METERS);
  if (mode === "suffix" || mode === "ends") to = Math.max(0, span - ARRIVAL_LAND_METERS);
  if (to - from < 1) return false;
  const start = pointAlong(a, lng, lat, from / span);
  const end = pointAlong(a, lng, lat, to / span);
  const steps = Math.max(1, Math.ceil((to - from) / 200));
  const seen = new Set<number>();
  const features: Feature[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const at = pointAlong(start, end[0], end[1], t);
    const cell = latLngToCell(at[1], wrapLng(at[0]), FINE);
    if (indexMiss(cell, land, cache)) continue;
    for (const feature of await featuresTouching(cell, land, cache)) {
      const offset = (feature.properties as { __offset?: unknown } | null)?.__offset;
      const key = typeof offset === "number" ? offset : seen.size;
      if (seen.has(key)) continue;
      seen.add(key);
      features.push(feature);
    }
  }
  const pieces = antimeridianPieces(start[0], start[1], end[0], end[1]);
  return features.some((feature) =>
    pieces.some((piece) => pieceHitsFeature(piece, feature, cache))
  );
}

async function anchorCell(
  point: Position,
  land: FlatGeobufSource<Feature>,
  cache: LandCache,
  harborEnd: boolean
): Promise<H3Index | null> {
  const fine = latLngToCell(point[1], wrapLng(point[0]), FINE);
  const nearby: Array<{ cell: H3Index; meters: number }> = [];
  const consider = async (cell: H3Index) => {
    if (!(await cellIsWater(cell, land, cache))) return;
    nearby.push({ cell, meters: metersBetween(point, center(cell)) });
  };
  await consider(fine);
  if (nearby.length === 0) {
    let nearestMiss = Infinity;
    for (const cell of gridDisk(fine, ANCHOR_RINGS)) {
      if (!indexMiss(cell, land, cache)) continue;
      const meters = metersBetween(point, center(cell));
      if (meters < nearestMiss) nearestMiss = meters;
      nearby.push({ cell, meters });
    }
    // A coastal water cell still meets the land index. Resolve those centers
    // when the nearest index miss is farther than a short departure.
    if (nearestMiss > DEPARTURE_LAND_METERS) {
      for (const cell of gridDisk(fine, 8)) {
        if (indexMiss(cell, land, cache)) continue;
        await consider(cell);
      }
    }
  }
  nearby.sort((a, b) => a.meters - b.meters);
  let best: H3Index | null = null;
  let bestMeters = Infinity;
  for (const { cell, meters } of nearby) {
    if (meters >= bestMeters) break;
    if (meters > 25_000) break;
    const lifted = await lift(cell, land, cache);
    const choices = lifted === cell ? [cell] : [lifted, cell];
    for (const choice of choices) {
      const at = center(choice);
      const hop = metersBetween(point, at);
      if (hop >= bestMeters) continue;
      if (
        await segmentMeetsLand(
          harborEnd ? at : point,
          harborEnd ? point : at,
          land,
          cache,
          harborEnd ? "suffix" : "prefix"
        )
      ) {
        continue;
      }
      best = choice;
      bestMeters = hop;
    }
  }
  return best;
}

async function neighborsOf(
  cell: H3Index,
  land: FlatGeobufSource<Feature>,
  cache: LandCache
): Promise<H3Index[]> {
  const out: H3Index[] = [];
  const seen = new Set<H3Index>();
  const add = async (candidate: H3Index, from: H3Index) => {
    if (!(await cellIsWater(candidate, land, cache))) {
      if (getResolution(candidate) >= FINE) return;
      for (const child of cellToChildren(candidate, getResolution(candidate) + 1)) {
        if (!touches(from, child)) continue;
        await add(child, from);
      }
      return;
    }
    const lifted = await lift(candidate, land, cache);
    if (lifted === from || seen.has(lifted)) return;
    const fromCenter = center(from);
    const stepLimit = getHexagonEdgeLengthAvg(getResolution(from), "m") * 2.2;
    const blockedStep = async (to: H3Index) => {
      const at = center(to);
      if (metersBetween(fromCenter, at) > stepLimit) {
        return segmentMeetsLand(fromCenter, at, land, cache);
      }
      for (const t of [0.25, 0.5, 0.75]) {
        const sample: Position = [
          wrapLng(fromCenter[0] + (at[0] - fromCenter[0]) * t),
          fromCenter[1] + (at[1] - fromCenter[1]) * t,
        ];
        const cell = latLngToCell(sample[1], sample[0], FINE);
        if (indexMiss(cell, land, cache)) continue;
        const features = await featuresTouching(cell, land, cache);
        if (features.some((feature) => pointOnFeature(sample, feature))) return true;
      }
      return false;
    };
    if (await blockedStep(lifted)) {
      if (lifted === candidate || seen.has(candidate)) return;
      if (await blockedStep(candidate)) return;
      seen.add(candidate);
      out.push(candidate);
      return;
    }
    seen.add(lifted);
    out.push(lifted);
  };
  for (const next of gridDisk(cell, 1)) {
    if (next !== cell) await add(next, cell);
  }
  return out;
}

async function stringPull(
  coords: Position[],
  land: FlatGeobufSource<Feature>,
  cache: LandCache
): Promise<Position[]> {
  if (coords.length < 3) return coords;
  const out: Position[] = [coords[0]!];
  let index = 0;
  const last = coords.length - 1;
  while (index < last) {
    let farthest = index + 1;
    for (let j = last; j > index + 1; j--) {
      const mode: ShoreMode =
        index === 0 && j === last ? "ends" : index === 0 ? "prefix" : j === last ? "suffix" : "none";
      if (
        !(await segmentMeetsLand(coords[index]!, coords[j]!, land, cache, mode))
      ) {
        farthest = j;
        break;
      }
    }
    out.push(coords[farthest]!);
    index = farthest;
  }
  return out;
}

async function routeBetween(
  origin: Position,
  goal: Position,
  land: FlatGeobufSource<Feature>,
  cache: LandCache,
  maxDistanceMeters: number
): Promise<Position[] | null> {
  const start = await anchorCell(origin, land, cache, false);
  const end = await anchorCell(goal, land, cache, true);
  if (!start || !end) return null;
  if (!(await segmentMeetsLand(origin, goal, land, cache, "ends"))) {
    const meters = metersBetween(origin, goal);
    if (meters <= maxDistanceMeters) return unwrapLine([origin, goal]);
  }
  const best = new Map<H3Index, number>();
  const prev = new Map<H3Index, H3Index | null>();
  const expanded = new Set<H3Index>();
  const heap = new MinHeap<H3Index>();
  const startCost = metersBetween(origin, center(start));
  best.set(start, startCost);
  prev.set(start, null);
  heap.push(startCost + metersBetween(center(start), goal), start);
  let expansions = 0;
  let found = false;
  while (heap.size > 0) {
    const popped = heap.pop();
    if (!popped) break;
    const cell = popped.value;
    const known = best.get(cell);
    if (known === undefined) continue;
    if (popped.key > known + metersBetween(center(cell), goal) + 1) continue;
    if (expanded.has(cell)) continue;
    expanded.add(cell);
    if (cell === end) {
      found = true;
      break;
    }
    if (++expansions > MAX_EXPANSIONS) return null;
    for (const next of await neighborsOf(cell, land, cache)) {
      const step = metersBetween(center(cell), center(next));
      const nextCost = known + step;
      if (nextCost > maxDistanceMeters) continue;
      const previous = best.get(next);
      if (previous !== undefined && nextCost >= previous - 0.5) continue;
      best.set(next, nextCost);
      prev.set(next, cell);
      heap.push(nextCost + metersBetween(center(next), goal), next);
    }
  }
  if (!found) return null;
  const cells: H3Index[] = [];
  let cursor: H3Index | null = end;
  while (cursor) {
    cells.push(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  cells.reverse();
  const raw: Position[] = [origin];
  for (const cell of cells) raw.push(center(cell));
  raw.push(goal);
  const pulled = await stringPull(raw, land, cache);
  let meters = 0;
  for (let i = 1; i < pulled.length; i++) {
    meters += metersBetween(pulled[i - 1]!, pulled[i]!);
  }
  if (meters > maxDistanceMeters) return null;
  return unwrapLine(pulled);
}

async function loadPoints(
  source: FlatGeobufSource<Feature>,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Promise<Feature[]> {
  const parts = splitBBoxAntimeridian([minX, minY, maxX, maxY]);
  const found: Feature[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    const env = bboxToEnvelope(part);
    const queryPlan = source.createPlan(env as never);
    for await (const feature of source.getFeaturesAsync(env as never, { queryPlan })) {
      const offset = (feature.properties as { __offset?: unknown } | null)?.__offset;
      if (typeof offset === "number") {
        if (seen.has(offset)) continue;
        seen.add(offset);
      }
      found.push(feature);
    }
  }
  return found;
}

/**
 * Hierarchical water path. Open ocean is a coarse hex step. A cell whose
 * bbox meets the land index is split, and only the children that still
 * have water are entered. Land polygons are fetched only for the fine cells
 * the path actually touches. The cell chain is then string-pulled so an
 * ocean crossing stays a straight line.
 */
export async function searchWaterPathByHierarchy(
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
    throw new Error("searchWaterPathByHierarchy: feature.geometry is required");
  }
  const maxResults = Math.min(
    MAX_WATER_PATH_RESULTS,
    Math.max(1, options?.maxResults ?? DEFAULT_WATER_PATH_MAX_RESULTS)
  );
  const requestedKm = options?.maxDistanceKm ?? DEFAULT_WATER_PATH_DISTANCE_KM;
  const maxDistanceMeters = Math.min(requestedKm, MAX_DISTANCE_TO_FEATURES_KM) * 1000;
  const rings = exteriorRings(feature.geometry);
  if (rings.length === 0 && feature.geometry.type === "Point") {
    rings.push([feature.geometry.coordinates]);
  }
  const boundary = rings.flat();
  if (boundary.length === 0) {
    return { features: [], exceededLimit: false, candidates: [] };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let prev = boundary[0]![0];
  for (const [lng, lat] of boundary) {
    let x = lng;
    while (x - prev > 180) x -= 360;
    while (x - prev < -180) x += 360;
    prev = x;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  }
  const refLat = (minY + maxY) / 2;
  const latPad = maxDistanceMeters / 111_320;
  const lngPad = latPad / Math.max(0.2, Math.cos((refLat * Math.PI) / 180));
  const pointFeatures = await loadPoints(
    points,
    minX - lngPad,
    minY - latPad,
    maxX + lngPad,
    maxY + latPad
  );

  type Candidate = {
    id: number;
    position: Position;
    origin: Position;
    geodesic: number;
    properties: Record<string, unknown>;
  };
  const candidates: Candidate[] = [];
  for (const pointFeature of pointFeatures) {
    for (const position of pointPositions(pointFeature.geometry)) {
      const origin = closestBoundary(rings, position);
      const geodesic = metersBetween(origin, position);
      if (geodesic > maxDistanceMeters) continue;
      candidates.push({
        id: featureId(pointFeature, position),
        position,
        origin,
        geodesic,
        properties: publicProperties(
          pointFeature.properties as Record<string, unknown> | null,
          options?.includedColumns
        ),
      });
    }
  }
  candidates.sort((a, b) => a.geodesic - b.geodesic);
  const pool = candidates.slice(0, Math.max(maxResults * CANDIDATE_FACTOR, maxResults));

  const cache: LandCache = {
    water: new Map(),
    empty: new Map(),
    features: new Map(),
    segments: new Map(),
    boxes: new Map(),
  };
  const routes: WaterPathNearestResult["features"] = [];
  let exceededLimit = false;
  let routed = 0;
  for (const candidate of pool) {
    if (routes.length >= maxResults) {
      const worst = routes[maxResults - 1]!.meters;
      if (candidate.geodesic >= worst) break;
    }
    if (routed >= maxResults * CANDIDATE_FACTOR) {
      exceededLimit = true;
      break;
    }
    routed++;
    const origin =
      (await launchOrigin(rings, candidate.position, land, cache)) ?? candidate.origin;
    const line = await routeBetween(origin, candidate.position, land, cache, maxDistanceMeters);
    if (!line) continue;
    let meters = 0;
    for (let i = 1; i < line.length; i++) {
      meters += metersBetween(line[i - 1]!, line[i]!);
    }
    if (meters <= 0 || meters > maxDistanceMeters) continue;
    const previous = routes.find((hit) => hit.__id === candidate.id);
    if (previous && previous.meters <= meters) continue;
    if (previous) routes.splice(routes.indexOf(previous), 1);
    routes.push({
      __id: candidate.id,
      meters,
      properties: candidate.properties,
      geojsonLine: lineFeature(line),
    });
    routes.sort((a, b) => a.meters - b.meters);
    if (routes.length > maxResults) routes.length = maxResults;
  }

  return {
    features: routes,
    exceededLimit,
    candidates: [],
  };
}
