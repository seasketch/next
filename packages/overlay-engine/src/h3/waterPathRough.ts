import { Feature, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import distance from "@turf/distance";
import {
  cellToBoundary,
  cellToChildren,
  cellToLatLng,
  areNeighborCells,
  cellToParent,
  getResolution,
  gridDisk,
  H3Index,
  latLngToCell,
} from "h3-js";
import { cleanBBox, splitBBoxAntimeridian } from "../utils/bboxUtils";
import { bboxForCell } from "./bboxForCell";
import { MinHeap } from "./minHeap";

/**
 * Thrown when a search passes its deadline. Hot loops check the clock and
 * throw so a synchronous stretch cannot run on after the budget.
 */
export class RouteDeadline extends Error {
  constructor() {
    super("water path deadline");
    this.name = "RouteDeadline";
  }
}

export function pastDeadline(deadline?: number): boolean {
  return deadline != null && Date.now() > deadline;
}

/** True when the straight line meets the land index, so it is not open water. */
export function geodesicHitsIndex(
  land: FlatGeobufSource<Feature>,
  origin: Position,
  goal: Position,
  cache: Map<H3Index, boolean>,
  deadline?: number
): boolean {
  let hits = 0;
  for (let step = 1; step <= 8; step++) {
    const t = step / 9;
    let lng = origin[0] + (goal[0] - origin[0]) * t;
    const lat = origin[1] + (goal[1] - origin[1]) * t;
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    const cell = latLngToCell(Math.max(-85, Math.min(85, lat)), lng, 7);
    if (cellBlocked(land, cell, cache, deadline)) hits++;
  }
  return hits >= 2;
}

/**
 * Interior samples whose cell meets the land index. A hit means the point
 * might be on land; the caller confirms with the polygon. Shoreline bboxes
 * make this true for a route that is still in the water.
 */
export function indexedRouteSamples(
  land: FlatGeobufSource<Feature>,
  coords: Position[],
  cache: Map<H3Index, boolean>,
  deadline?: number,
  stepMeters = 800
): Position[] {
  const hits: Position[] = [];
  if (coords.length < 2) return hits;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const length = metersBetween(coords[i - 1]!, coords[i]!);
    lengths.push(length);
    total += length;
  }
  if (total <= 4_500) return hits;
  let traveled = 0;
  for (let i = 1; i < coords.length; i++) {
    const start = coords[i - 1]!;
    const end = coords[i]!;
    let endLng = end[0];
    while (endLng - start[0] > 180) endLng -= 360;
    while (endLng - start[0] < -180) endLng += 360;
    const length = lengths[i - 1]!;
    const steps = Math.max(1, Math.ceil(length / stepMeters));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const along = traveled + length * t;
      if (along < 2_000 || along > total - 2_500) continue;
      let lng = start[0] + (endLng - start[0]) * t;
      const lat = start[1] + (end[1] - start[1]) * t;
      while (lng > 180) lng -= 360;
      while (lng < -180) lng += 360;
      const cell = latLngToCell(Math.max(-85, Math.min(85, lat)), lng, FINE);
      if (cellBlocked(land, cell, cache, deadline)) hits.push([lng, lat]);
    }
    traveled += length;
  }
  return hits;
}

/** Open water is one step at this size (~8 km). */
const COARSE = 5;

/**
 * A cell this small (~460 m) that still meets the land index is treated as
 * shore. Narrow channels can be threaded without downloading polygons.
 */
const FINE = 8;

const MAX_EXPANSIONS = 8_000;

/** Shoreline beside a rough path, in meters, included in the fetch window. */
const PATH_PAD_METERS = 8_000;

/** When the index search finds no way around, fetch only this band. */
const FALLBACK_PAD_METERS = 18_000;

const METERS_PER_DEG_LAT = 111_320;

const NODE_ITEM_BYTE_LENGTH = 40;

type IndexInternals = {
  view: DataView;
  details: {
    nodeSize: number;
    numNodes: number;
    levels: number[];
  };
};

export type RoughSpan = {
  /** Length of the index path, or the geodesic when that path was not found. */
  meters: number;
  /**
   * True when the fetch window is the geodesic band. A long detour is not
   * local: the caller can try nearby ports before paying for it.
   */
  local: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Index path, or the geodesic when that path was not found. */
  path: Position[];
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

/** Same bound as the FlatGeobuf R-tree: the first level end strictly past `value`. */
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

/** True when any land-feature bbox meets this box. Stops at the first leaf. */
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

export function cellBlocked(
  land: FlatGeobufSource<Feature>,
  cell: H3Index,
  cache: Map<H3Index, boolean>,
  deadline?: number
): boolean {
  const known = cache.get(cell);
  if (known !== undefined) return known;
  if (pastDeadline(deadline)) throw new RouteDeadline();
  const box = cleanBBox(bboxForCell(cell));
  const parts = splitBBoxAntimeridian(box as [number, number, number, number]);
  let hit = false;
  for (const part of parts) {
    if (indexIntersects(land, part[0], part[1], part[2], part[3])) {
      hit = true;
      break;
    }
  }
  cache.set(cell, hit);
  return hit;
}

function childrenOf(cell: H3Index): H3Index[] {
  try {
    return cellToChildren(cell, getResolution(cell) + 1);
  } catch {
    return [];
  }
}

function touches(cell: H3Index, other: H3Index): boolean {
  if (cell === other) return true;
  // Same-resolution neighbors share an edge, but a boundary vertex can fall in
  // a third cell, so the vertex probe below drops real neighbors.
  if (getResolution(cell) === getResolution(other)) {
    try {
      return areNeighborCells(cell, other);
    } catch {
      return false;
    }
  }
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

function spanOf(points: Position[], padMeters: number, refLng: number): RoughSpan {
  let prev = refLng;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lng, lat] of points) {
    let x = lng;
    while (x - prev > 180) x -= 360;
    while (x - prev < -180) x += 360;
    prev = x;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  }
  const midLat = (minY + maxY) / 2;
  const latPad = padMeters / METERS_PER_DEG_LAT;
  const lngPad = latPad / Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  return {
    meters: 0,
    local: true,
    path: points,
    minX: minX - lngPad,
    maxX: maxX + lngPad,
    minY: Math.max(-85, minY - latPad),
    maxY: Math.min(85, maxY + latPad),
  };
}

/**
 * Index-only path from `origin` to `goal`. Land polygons are not downloaded.
 * The returned window is what the tangent router should fetch to hone the line.
 */
export function roughCorridor(
  land: FlatGeobufSource<Feature>,
  origin: Position,
  goal: Position,
  maxMeters: number,
  cache: Map<H3Index, boolean>,
  deadline?: number
): RoughSpan {
  const geodesic = metersBetween(origin, goal);
  const fallback = (): RoughSpan => {
    const span = spanOf([origin, goal], FALLBACK_PAD_METERS, origin[0]);
    span.meters = geodesic;
    span.local = false;
    span.path = [origin, goal];
    return span;
  };
  if (pastDeadline(deadline)) throw new RouteDeadline();
  if (geodesic > maxMeters) return fallback();

  const blocked = (cell: H3Index) => cellBlocked(land, cell, cache, deadline);

  const lift = (cell: H3Index): H3Index => {
    let current = cell;
    while (getResolution(current) > COARSE) {
      const parent = cellToParent(current, getResolution(current) - 1);
      if (blocked(parent)) break;
      current = parent;
    }
    return current;
  };

  const anchor = (point: Position): H3Index | null => {
    const lat = Math.max(-85, Math.min(85, point[1]));
    const lng = wrapLng(point[0]);
    const fine = latLngToCell(lat, lng, FINE);
    if (!blocked(fine)) return lift(fine);
    const coarse = latLngToCell(lat, lng, COARSE);
    for (let ring = 0; ring <= 4; ring++) {
      const disk = gridDisk(coarse, ring);
      const inner = ring === 0 ? new Set<H3Index>() : new Set(gridDisk(coarse, ring - 1));
      for (const cell of disk) {
        if (inner.has(cell)) continue;
        if (!blocked(cell)) return lift(cell);
        const queue = childrenOf(cell);
        let guard = 0;
        while (queue.length > 0 && guard++ < 48) {
          const next = queue.shift()!;
          if (!blocked(next)) return lift(next);
          if (getResolution(next) < FINE) queue.push(...childrenOf(next));
        }
      }
    }
    return null;
  };

  const start = anchor(origin);
  const end = anchor(goal);
  if (!start || !end) return fallback();

  const goalAt = center(end);
  // A cell can be index-clear while the step to its neighbor crosses an island
  // that sits on the shared edge. Refuse that step and look for a finer one.
  const segmentCache = new Map<string, boolean>();
  const segmentClear = (from: Position, to: Position): boolean => {
    const key = `${from[0].toFixed(2)},${from[1].toFixed(2)}>${to[0].toFixed(2)},${to[1].toFixed(2)}`;
    const known = segmentCache.get(key);
    if (known !== undefined) return known;
    const span = metersBetween(from, to);
    const steps = Math.max(2, Math.ceil(span / 1_000));
    let toLng = to[0];
    while (toLng - from[0] > 180) toLng -= 360;
    while (toLng - from[0] < -180) toLng += 360;
    let clear = true;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      let lng = from[0] + (toLng - from[0]) * t;
      const lat = from[1] + (to[1] - from[1]) * t;
      while (lng > 180) lng -= 360;
      while (lng < -180) lng += 360;
      const sample = latLngToCell(Math.max(-85, Math.min(85, lat)), lng, FINE);
      if (blocked(sample)) {
        clear = false;
        break;
      }
    }
    segmentCache.set(key, clear);
    return clear;
  };
  const neighborsOf = (cell: H3Index): H3Index[] => {
    const out: H3Index[] = [];
    const seen = new Set<H3Index>();
    const here = center(cell);
    const hereToGoal = metersBetween(here, goalAt);
    const add = (candidate: H3Index) => {
      let chosen = candidate;
      let res = getResolution(chosen);
      while (res > COARSE) {
        const parent = cellToParent(chosen, res - 1);
        if (blocked(parent) || !segmentClear(here, center(parent))) break;
        chosen = parent;
        res--;
      }
      if (seen.has(chosen)) return;
      seen.add(chosen);
      out.push(chosen);
    };
    const walk = (candidate: H3Index, depth: number) => {
      if (out.length >= 24) return;
      if (!touches(candidate, cell)) return;
      if (!blocked(candidate)) {
        if (segmentClear(here, center(candidate))) {
          add(candidate);
          return;
        }
        if (getResolution(candidate) >= FINE || depth >= 4) return;
        for (const child of childrenOf(candidate)) walk(child, depth + 1);
        return;
      }
      // A channel often sits in a cell that is not closer to the port, because
      // the cell center is on the shore beside it. Take any clear water in
      // that cell, and keep splitting only when the cell is on the way.
      if (depth === 0) {
        const ahead = metersBetween(center(candidate), goalAt) < hereToGoal + 8_000;
        if (!ahead && hereToGoal > 25_000) {
          const admit = (parent: H3Index, nested: number) => {
            if (nested > 2 || getResolution(parent) >= FINE || out.length >= 24) return;
            for (const child of childrenOf(parent)) {
              if (!touches(child, cell)) continue;
              if (!blocked(child)) {
                if (segmentClear(here, center(child))) add(child);
                continue;
              }
              admit(child, nested + 1);
            }
          };
          admit(candidate, 0);
          return;
        }
      }
      if (getResolution(candidate) >= FINE || depth >= 4) return;
      for (const child of childrenOf(candidate)) walk(child, depth + 1);
    };
    for (const next of gridDisk(cell, 1)) {
      if (next !== cell) walk(next, 0);
    }
    return out;
  };

  const reached = (cell: H3Index): boolean => {
    if (cell === end) return true;
    const res = getResolution(cell);
    const endRes = getResolution(end);
    if (res < endRes) return cellToParent(end, res) === cell;
    if (endRes < res) return cellToParent(cell, endRes) === end;
    return false;
  };

  const best = new Map<H3Index, number>();
  const prev = new Map<H3Index, H3Index | null>();
  const heap = new MinHeap<{ cell: H3Index; g: number }>();
  const push = (cell: H3Index, from: H3Index | null, g: number) => {
    if (g > maxMeters) return;
    const known = best.get(cell);
    if (known !== undefined && known <= g) return;
    best.set(cell, g);
    prev.set(cell, from);
    heap.push(g + metersBetween(center(cell), goalAt), { cell, g });
  };
  push(start, null, 0);

  let found: H3Index | null = null;
  let expansions = 0;
  while (heap.size > 0 && expansions < MAX_EXPANSIONS) {
    if ((expansions & 31) === 0 && pastDeadline(deadline)) throw new RouteDeadline();
    const popped = heap.pop();
    if (!popped) break;
    const { cell, g } = popped.value;
    if (best.get(cell) !== g) continue;
    expansions++;
    if (reached(cell)) {
      found = cell;
      break;
    }
    for (const next of neighborsOf(cell)) {
      push(next, cell, g + metersBetween(center(cell), center(next)));
    }
  }
  if (!found) return fallback();

  const cells: H3Index[] = [];
  const seen = new Set<H3Index>();
  let cursor: H3Index | null = found;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    cells.push(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  cells.reverse();

  const route: Position[] = [origin];
  const windowPoints: Position[] = [origin];
  let meters = 0;
  let previous = origin;
  for (const cell of cells) {
    const at = center(cell);
    meters += metersBetween(previous, at);
    previous = at;
    route.push(at);
    windowPoints.push(at);
    for (const next of gridDisk(cell, 1)) {
      if (next === cell || !blocked(next)) continue;
      if (getResolution(next) >= FINE) {
        windowPoints.push(center(next));
        continue;
      }
      for (const child of childrenOf(next)) {
        if (blocked(child)) windowPoints.push(center(child));
      }
    }
  }
  meters += metersBetween(previous, goal);
  route.push(goal);
  windowPoints.push(goal);

  const span = spanOf(windowPoints, PATH_PAD_METERS, origin[0]);
  span.meters = Math.max(meters, geodesic);
  span.local = span.meters <= Math.max(geodesic * 1.8, geodesic + 20_000);
  span.path = route;
  return span;
}
