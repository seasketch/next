import { Feature, Geometry, LineString, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import booleanIntersects from "@turf/boolean-intersects";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import {
  cellToChildren,
  cellToLatLng,
  cellToParent,
  getHexagonEdgeLengthAvg,
  getResolution,
  gridDisk,
  latLngToCell,
  polygonToCells,
} from "h3-js";
import { LandOccupancy, LandState, openLandOccupancy } from "@seasketch/h3-land/client";
import {
  bboxToEnvelope,
  cleanBBox,
  splitBBoxAntimeridian,
} from "../utils/bboxUtils";
import { bboxForCell } from "./bboxForCell";
import { MinHeap } from "./minHeap";
import {
  DEFAULT_WATER_PATH_DISTANCE_KM,
  DEFAULT_WATER_PATH_MAX_RESULTS,
  MAX_DISTANCE_TO_FEATURES_KM,
  MAX_WATER_PATH_RESULTS,
  WaterPathNearestResult,
} from "./waterPathNearestH3";

/**
 * Resolution-9 occupancy router.
 *
 * Open ocean is one step at resolution 4 (~22 km), because a water parent is
 * water everywhere inside it. A mixed parent is split, to resolution 7 and
 * then 9, and only the water children are entered. The cell chain is then
 * pulled straight. Real land polygons are fetched for the ends of the route,
 * and for a short mixed stretch the straight line still has to cross.
 */
const COARSE = 4;
const MID = 7;
const OCCUPANCY_URL =
  process.env.H3_LAND_URL ?? "https://tiles.seasketch.org/h3-land/v1/land-res9.h3ld";

const DEPARTURE_METERS = 800;
const ARRIVAL_METERS = 800;
const HARBOR_METERS = 3_500;
const CORRIDOR_METERS = 6_000;
const MAX_EXPANSIONS = 12_000;
const CANDIDATE_FACTOR = 8;

type ShoreMode = "none" | "prefix" | "suffix" | "ends";
type MixedMode = "ends" | "corridor";

type Session = {
  occupancy: LandOccupancy;
  fine: number;
  land: FlatGeobufSource<Feature>;
  known: Map<string, LandState>;
  waterAdj: Map<string, string[]>;
  centerWater: Map<string, boolean>;
  features: Map<number, Feature>;
  featureBox: Map<Feature, [number, number, number, number]>;
  loaded: Set<string>;
  segments: Map<string, boolean>;
  expansions: number;
};

const openings = new Map<string, Promise<LandOccupancy>>();

function landArchive(url: string): Promise<LandOccupancy> {
  const existing = openings.get(url);
  if (existing) return existing;
  const pending = openLandOccupancy(url, {
    cacheBytes: 64 * 1024 * 1024,
    read: (start: number, end: number) => readRange(url, start, end),
  }).catch((error: unknown) => {
    openings.delete(url);
    throw error;
  });
  openings.set(url, pending);
  return pending;
}

async function readRange(url: string, start: number, end: number): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      Range: `bytes=${start}-${end - 1}`,
      "User-Agent": "seasketch-overlay-engine",
    },
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`land occupancy range ${start}-${end - 1} returned ${response.status}`);
  }
  const body = new Uint8Array(await response.arrayBuffer());
  if (response.status === 206 || body.byteLength === end - start) return body;
  if (response.status === 200 && body.byteLength >= end) return body.slice(start, end);
  throw new Error(
    `land occupancy range ${start}-${end - 1} returned ${response.status} (${body.byteLength} bytes)`
  );
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function metersBetween(a: Position, b: Position): number {
  let lng = b[0];
  while (lng - a[0] > 180) lng -= 360;
  while (lng - a[0] < -180) lng += 360;
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (lng - a[0]) * rad;
  const lat1 = a[1] * rad;
  const lat2 = b[1] * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const centerCache = new Map<string, Position>();

function center(cell: string): Position {
  const cached = centerCache.get(cell);
  if (cached) return cached;
  const [lat, lng] = cellToLatLng(cell);
  const point: Position = [wrapLng(lng), lat];
  centerCache.set(cell, point);
  return point;
}

function edgeMeters(resolution: number): number {
  return getHexagonEdgeLengthAvg(resolution, "m");
}

function cellContains(coarse: string, finer: string): boolean {
  const coarseRes = getResolution(coarse);
  const fineRes = getResolution(finer);
  if (fineRes < coarseRes) return false;
  if (fineRes === coarseRes) return coarse === finer;
  return cellToParent(finer, coarseRes) === coarse;
}

function covers(session: Session, cell: string, point: Position): boolean {
  const fine = latLngToCell(point[1], wrapLng(point[0]), session.fine);
  return cellContains(cell, fine);
}

const diskCache = new Map<string, string[]>();
const childCache = new Map<string, string[]>();

function neighborsOf(cell: string): string[] {
  const cached = diskCache.get(cell);
  if (cached) return cached;
  const disk = gridDisk(cell, 1);
  diskCache.set(cell, disk);
  return disk;
}

function childrenAt(cell: string, resolution: number): string[] {
  const key = `${cell}:${resolution}`;
  const cached = childCache.get(key);
  if (cached) return cached;
  const children = cellToChildren(cell, resolution);
  childCache.set(key, children);
  return children;
}

function adjacentTo(a: string, b: string): boolean {
  if (a === b) return false;
  const aRes = getResolution(a);
  const bRes = getResolution(b);
  if (aRes === bRes) {
    for (const neighbor of neighborsOf(a)) {
      if (neighbor === b) return true;
    }
    return false;
  }
  const fine = aRes > bRes ? a : b;
  const coarse = fine === a ? b : a;
  if (cellToParent(fine, getResolution(coarse)) === coarse) return false;
  for (const neighbor of neighborsOf(fine)) {
    if (neighbor === fine) continue;
    if (cellToParent(neighbor, getResolution(coarse)) === coarse) return true;
  }
  return false;
}

async function classify(session: Session, cells: Iterable<string>): Promise<void> {
  const need: string[] = [];
  const seen = new Set<string>();
  const add = (cell: string) => {
    if (session.known.has(cell) || seen.has(cell)) return;
    seen.add(cell);
    need.push(cell);
    const resolution = getResolution(cell);
    if (resolution > MID) add(cellToParent(cell, MID));
    else if (resolution > COARSE) add(cellToParent(cell, COARSE));
  };
  for (const cell of cells) add(cell);
  if (need.length === 0) return;
  const states = await session.occupancy.states(need);
  for (const [cell, state] of states) session.known.set(cell, state);
}

function liftAbove(session: Session, cell: string, blocked: string): string {
  if (session.known.get(cell) !== "water") return cell;
  let current = cell;
  while (getResolution(current) > COARSE) {
    const parentRes = getResolution(current) > MID ? MID : COARSE;
    const parent = cellToParent(current, parentRes);
    if (session.known.get(parent) !== "water") break;
    if (cellContains(parent, blocked)) break;
    current = parent;
  }
  return current;
}

async function waterNeighbors(session: Session, from: string): Promise<string[]> {
  const cached = session.waterAdj.get(from);
  if (cached) return cached;
  const out: string[] = [];
  const seen = new Set<string>([from]);
  const queue = neighborsOf(from).filter((cell) => cell !== from);
  let read = 0;
  while (read < queue.length) {
    const pending: string[] = [];
    for (let i = read; i < queue.length; i++) pending.push(queue[i]!);
    await classify(session, pending);
    const end = queue.length;
    while (read < end) {
      const candidate = queue[read++]!;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const state = session.known.get(candidate);
      if (state === "water") {
        const lifted = liftAbove(session, candidate, from);
        // `candidate` is already in `seen`. A neighbor that stays at its own
        // resolution must still be kept; only a coarser parent is shared.
        if (lifted === from || (lifted !== candidate && seen.has(lifted))) continue;
        if (lifted !== candidate) seen.add(lifted);
        out.push(lifted);
        continue;
      }
      if (state !== "mixed" || getResolution(candidate) >= session.fine) continue;
      const nextRes = getResolution(candidate) < MID ? MID : session.fine;
      const border = childrenAt(candidate, nextRes).filter((child) => adjacentTo(from, child));
      for (const child of border) {
        if (!seen.has(child)) queue.push(child);
      }
    }
  }
  session.waterAdj.set(from, out);
  return out;
}

function nearPoint(cell: string, point: Position, limit: number): boolean {
  return metersBetween(center(cell), point) <= limit + edgeMeters(getResolution(cell));
}

function metersToSegment(point: Position, a: Position, b: Position): number {
  let bx = b[0];
  while (bx - a[0] > 180) bx -= 360;
  while (bx - a[0] < -180) bx += 360;
  let px = point[0];
  while (px - a[0] > 180) px -= 360;
  while (px - a[0] < -180) px += 360;
  const scale = Math.max(0.2, Math.cos((a[1] * Math.PI) / 180));
  const abx = (bx - a[0]) * scale;
  const aby = b[1] - a[1];
  const apx = (px - a[0]) * scale;
  const apy = point[1] - a[1];
  const len2 = abx * abx + aby * aby;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / len2));
  const dx = (apx - abx * t) * 111_320;
  const dy = (apy - aby * t) * 111_320;
  return Math.hypot(dx, dy);
}

function wantsMixed(
  cell: string,
  origin: Position,
  goal: Position,
  mode: MixedMode
): boolean {
  if (nearPoint(cell, origin, HARBOR_METERS) || nearPoint(cell, goal, HARBOR_METERS)) {
    return true;
  }
  return mode === "corridor" && metersToSegment(center(cell), origin, goal) <= CORRIDOR_METERS;
}

async function loadBox(
  session: Session,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Promise<void> {
  const key = `${minX.toFixed(4)},${minY.toFixed(4)},${maxX.toFixed(4)},${maxY.toFixed(4)}`;
  if (session.loaded.has(key)) return;
  session.loaded.add(key);
  const parts = splitBBoxAntimeridian(
    cleanBBox([minX, minY, maxX, maxY]) as [number, number, number, number]
  );
  for (const part of parts) {
    const envelope = bboxToEnvelope(part);
    for await (const feature of session.land.getFeaturesAsync(envelope as never)) {
      const offset = (feature.properties as { __offset?: unknown } | null)?.__offset;
      if (typeof offset === "number") session.features.set(offset, feature);
    }
  }
}

async function loadAround(session: Session, point: Position, meters: number): Promise<void> {
  const lat = meters / 111_320;
  const lng = lat / Math.max(0.2, Math.cos((point[1] * Math.PI) / 180));
  const x = wrapLng(point[0]);
  await loadBox(session, x - lng, point[1] - lat, x + lng, point[1] + lat);
}

function boxOf(session: Session, feature: Feature): [number, number, number, number] {
  const known = session.featureBox.get(feature);
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
  session.featureBox.set(feature, box);
  return box;
}

function pointOnFeature(point: Position, feature: Feature): boolean {
  const lng = wrapLng(point[0]);
  const lat = point[1];
  for (const shifted of [lng, lng + 360, lng - 360]) {
    if (booleanPointInPolygon([shifted, lat], feature as never)) return true;
  }
  return false;
}

async function waterCenter(session: Session, cell: string): Promise<boolean> {
  const known = session.centerWater.get(cell);
  if (known !== undefined) return known;
  const box = bboxForCell(cell);
  await loadBox(session, box[0], box[1], box[2], box[3]);
  const at = center(cell);
  let water = true;
  for (const feature of session.features.values()) {
    const bounds = boxOf(session, feature);
    if (at[0] < bounds[0] - 0.02 || at[0] > bounds[2] + 0.02) continue;
    if (at[1] < bounds[1] - 0.02 || at[1] > bounds[3] + 0.02) continue;
    if (pointOnFeature(at, feature)) {
      water = false;
      break;
    }
  }
  session.centerWater.set(cell, water);
  return water;
}

async function mixedExtras(
  session: Session,
  from: string,
  origin: Position,
  goal: Position,
  mode: MixedMode
): Promise<string[]> {
  if (!wantsMixed(from, origin, goal, mode)) return [];
  const out: string[] = [];
  const seen = new Set<string>([from]);
  const queue = neighborsOf(from).filter((cell) => cell !== from);
  let read = 0;
  while (read < queue.length) {
    const pending: string[] = [];
    for (let i = read; i < queue.length; i++) pending.push(queue[i]!);
    await classify(session, pending);
    const end = queue.length;
    while (read < end) {
      const candidate = queue[read++]!;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (session.known.get(candidate) !== "mixed") continue;
      if (!wantsMixed(candidate, origin, goal, mode)) continue;
      if (getResolution(candidate) >= session.fine) {
        if (await waterCenter(session, candidate)) out.push(candidate);
        continue;
      }
      const nextRes = getResolution(candidate) < MID ? MID : session.fine;
      for (const child of childrenAt(candidate, nextRes)) {
        if (!seen.has(child) && adjacentTo(from, child)) queue.push(child);
      }
    }
  }
  return out;
}

function pointAlong(a: Position, lng: number, lat: number, t: number): Position {
  return [a[0] + (lng - a[0]) * t, a[1] + (lat - a[1]) * t];
}

function ignoreEdge(mode: ShoreMode, edge: "start" | "end", meters: number): number {
  if (edge === "start" && (mode === "prefix" || mode === "ends")) return meters;
  if (edge === "end" && (mode === "suffix" || mode === "ends")) return meters;
  return 0;
}

function overlapsOpen(
  d0: number,
  d1: number,
  span: number,
  ignoreStart: number,
  ignoreEnd: number
): boolean {
  return Math.min(d1, span - ignoreEnd) - Math.max(d0, ignoreStart) > 1;
}

type CellSpan = { cell: string; d0: number; d1: number };

/**
 * Cells a straight line crosses, in order. Each step doubles until the cell
 * changes, then binary-searches the boundary, so a clear stretch costs a
 * handful of lookups instead of one every 40 m.
 */
function lineCrossings(
  a: Position,
  lng: number,
  lat: number,
  span: number,
  resolution: number,
  d0: number,
  d1: number
): CellSpan[] {
  const out: CellSpan[] = [];
  let d = Math.max(0, d0);
  const end = Math.min(span, d1);
  const step0 = Math.max(15, edgeMeters(resolution) * 0.2);
  let guard = 0;
  while (d < end - 0.4 && guard++ < 8000) {
    const at = pointAlong(a, lng, lat, span === 0 ? 0 : d / span);
    const cell = latLngToCell(at[1], wrapLng(at[0]), resolution);
    let inside = d;
    let outside = Math.min(end, d + step0);
    let grow = step0;
    while (outside < end - 0.4) {
      const probe = pointAlong(a, lng, lat, outside / span);
      if (latLngToCell(probe[1], wrapLng(probe[0]), resolution) !== cell) break;
      inside = outside;
      grow *= 2;
      outside = Math.min(end, outside + grow);
    }
    const endAt = pointAlong(a, lng, lat, span === 0 ? 0 : end / span);
    if (
      outside >= end - 0.4 &&
      latLngToCell(endAt[1], wrapLng(endAt[0]), resolution) === cell
    ) {
      const prev = out[out.length - 1];
      if (prev && prev.cell === cell) prev.d1 = end;
      else out.push({ cell, d0: d, d1: end });
      break;
    }
    let lo = inside;
    let hi = Math.min(end, outside);
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      const probe = pointAlong(a, lng, lat, span === 0 ? 0 : mid / span);
      if (latLngToCell(probe[1], wrapLng(probe[0]), resolution) === cell) lo = mid;
      else hi = mid;
    }
    const prev = out[out.length - 1];
    if (prev && prev.cell === cell && d <= prev.d1 + 2) prev.d1 = lo;
    else out.push({ cell, d0: d, d1: lo });
    d = hi;
    const check = pointAlong(a, lng, lat, span === 0 ? 0 : d / span);
    if (latLngToCell(check[1], wrapLng(check[0]), resolution) === cell) {
      d = Math.min(end, d + 1);
    }
    if (d <= inside) d = Math.min(end, inside + step0);
  }
  return out;
}

/**
 * Shoreline polygons inside fine mixed cells. A water cell is water
 * everywhere, so the geometric test only runs on the mixed stretches.
 */
async function polygonsOnMixed(
  session: Session,
  a: Position,
  lng: number,
  lat: number,
  span: number,
  pieces: CellSpan[],
  ignoreStart: number,
  ignoreEnd: number
): Promise<Position | null> {
  if (pieces.length === 0) return null;
  const cells = new Set<string>();
  for (const piece of pieces) cells.add(piece.cell);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let crosses = false;
  for (const cell of cells) {
    const box = bboxForCell(cell);
    if (box[0] > box[2]) crosses = true;
    minX = Math.min(minX, box[0], box[2]);
    maxX = Math.max(maxX, box[0], box[2]);
    minY = Math.min(minY, box[1]);
    maxY = Math.max(maxY, box[3]);
  }
  if (!crosses && metersBetween([minX, minY], [maxX, maxY]) < 40_000) {
    await loadBox(session, minX, minY, maxX, maxY);
  } else {
    for (const cell of cells) {
      const box = bboxForCell(cell);
      await loadBox(session, box[0], box[1], box[2], box[3]);
    }
  }
  for (const piece of pieces) {
    const from = Math.max(piece.d0, ignoreStart);
    const to = Math.min(piece.d1, span - ignoreEnd);
    if (to - from <= 1) continue;
    const start = pointAlong(a, lng, lat, from / span);
    const stop = pointAlong(a, lng, lat, to / span);
    if (Math.abs(wrapLng(stop[0]) - wrapLng(start[0])) <= 180) {
      const pieceLine: LineString = {
        type: "LineString",
        coordinates: [
          [wrapLng(start[0]), start[1]],
          [wrapLng(stop[0]), stop[1]],
        ],
      };
      const x0 = Math.min(pieceLine.coordinates[0]![0], pieceLine.coordinates[1]![0]);
      const x1 = Math.max(pieceLine.coordinates[0]![0], pieceLine.coordinates[1]![0]);
      const y0 = Math.min(start[1], stop[1]);
      const y1 = Math.max(start[1], stop[1]);
      for (const feature of session.features.values()) {
        const bounds = boxOf(session, feature);
        if (x1 < bounds[0] - 0.02 || x0 > bounds[2] + 0.02) continue;
        if (y1 < bounds[1] - 0.02 || y0 > bounds[3] + 0.02) continue;
        if (booleanIntersects(pieceLine, feature as never)) return start;
      }
    }
    for (let d = from; d <= to; d += 40) {
      const at = pointAlong(a, lng, lat, d / span);
      if (pointHitsLoadedLand(session, at)) return at;
    }
  }
  return null;
}

/** Land blocking the open part of a segment, or null when the line stays on water. */
async function occupancyHit(
  session: Session,
  a: Position,
  lng: number,
  lat: number,
  span: number,
  resolution: number,
  d0: number,
  d1: number,
  cellStart: number,
  cellEnd: number,
  polygonStart: number,
  polygonEnd: number
): Promise<Position | null> {
  const pieces = lineCrossings(a, lng, lat, span, resolution, d0, d1);
  if (pieces.length === 0) return null;
  await classify(
    session,
    pieces.map((piece) => piece.cell)
  );
  const finer: CellSpan[] = [];
  const polygonPieces: CellSpan[] = [];
  for (const piece of pieces) {
    const state = session.known.get(piece.cell);
    if (state === "water") continue;
    if (state === "land") {
      if (!overlapsOpen(piece.d0, piece.d1, span, cellStart, cellEnd)) continue;
      const from = Math.max(piece.d0, cellStart);
      const to = Math.min(piece.d1, span - cellEnd);
      return pointAlong(a, lng, lat, ((from + to) / 2) / span);
    }
    if (resolution >= session.fine) {
      if (overlapsOpen(piece.d0, piece.d1, span, polygonStart, polygonEnd)) polygonPieces.push(piece);
      continue;
    }
    finer.push(piece);
  }
  const polygonHit = await polygonsOnMixed(
    session,
    a,
    lng,
    lat,
    span,
    polygonPieces,
    polygonStart,
    polygonEnd
  );
  if (polygonHit) return polygonHit;
  const next = resolution < MID ? MID : session.fine;
  for (const piece of finer) {
    const hit = await occupancyHit(
      session,
      a,
      lng,
      lat,
      span,
      next,
      piece.d0,
      piece.d1,
      cellStart,
      cellEnd,
      polygonStart,
      polygonEnd
    );
    if (hit) return hit;
  }
  return null;
}

async function segmentBlocked(
  session: Session,
  a: Position,
  b: Position,
  mode: ShoreMode
): Promise<boolean> {
  let lng = b[0];
  while (lng - a[0] > 180) lng -= 360;
  while (lng - a[0] < -180) lng += 360;
  const span = metersBetween(a, [lng, b[1]]);
  if (span < 1) return false;
  const memoKey = `${mode}:${a[0].toFixed(4)},${a[1].toFixed(4)}:${lng.toFixed(4)},${b[1].toFixed(4)}`;
  const remembered = session.segments.get(memoKey);
  if (remembered !== undefined) return remembered;
  // Resolution-4 water is water everywhere inside the cell. Mixed parents are
  // split to 7 and then to the archive's fine resolution. Land cells and
  // shoreline polygons both block outside the 800 m harbor allowance, so a
  // shortcut cannot clip an island that sits just seaward of a port.
  const hit = await occupancyHit(
    session,
    a,
    lng,
    b[1],
    span,
    COARSE,
    0,
    span,
    ignoreEdge(mode, "start", DEPARTURE_METERS),
    ignoreEdge(mode, "end", ARRIVAL_METERS),
    ignoreEdge(mode, "start", DEPARTURE_METERS),
    ignoreEdge(mode, "end", ARRIVAL_METERS)
  );
  const blocked = hit != null;
  session.segments.set(memoKey, blocked);
  return blocked;
}

async function bendAround(
  session: Session,
  a: Position,
  b: Position,
  mode: ShoreMode
): Promise<Position | null> {
  let lng = b[0];
  while (lng - a[0] > 180) lng -= 360;
  while (lng - a[0] < -180) lng += 360;
  const mid = pointAlong(a, lng, b[1], 0.5);
  const cos = Math.max(0.2, Math.cos((mid[1] * Math.PI) / 180));
  const east = (lng - a[0]) * cos * 111_320;
  const north = (b[1] - a[1]) * 111_320;
  const len = Math.hypot(east, north) || 1;
  const sideEast = -north / len;
  const sideNorth = east / len;
  for (const meters of [200, 450, 900, 1800, 3600, 7000]) {
    for (const side of [1, -1]) {
      const at: Position = [
        mid[0] + (sideEast * meters * side) / (111_320 * cos),
        mid[1] + (sideNorth * meters * side) / 111_320,
      ];
      const firstMode: ShoreMode = mode === "suffix" ? "none" : mode === "ends" ? "prefix" : mode;
      const secondMode: ShoreMode = mode === "prefix" ? "none" : mode === "ends" ? "suffix" : mode;
      if (await segmentBlocked(session, a, at, firstMode)) continue;
      if (await segmentBlocked(session, at, [lng, b[1]], secondMode)) continue;
      return at;
    }
  }
  return null;
}

async function openHops(session: Session, coords: Position[]): Promise<Position[]> {
  if (coords.length < 2) return coords;
  const out: Position[] = [coords[0]!];
  for (let i = 1; i < coords.length; i++) {
    const prev = out[out.length - 1]!;
    const next = coords[i]!;
    const last = i === coords.length - 1;
    const mode: ShoreMode =
      out.length === 1 && last ? "ends" : out.length === 1 ? "prefix" : last ? "suffix" : "none";
    if (!(await segmentBlocked(session, prev, next, mode))) {
      out.push(next);
      continue;
    }
    const bend = await bendAround(session, prev, next, mode);
    if (bend) out.push(bend);
    out.push(next);
  }
  return out;
}

async function stringPull(session: Session, coords: Position[]): Promise<Position[]> {
  if (coords.length < 3) return coords;
  const out: Position[] = [coords[0]!];
  let index = 0;
  const last = coords.length - 1;
  const modeFor = (j: number): ShoreMode =>
    index === 0 && j === last ? "ends" : index === 0 ? "prefix" : j === last ? "suffix" : "none";
  while (index < last) {
    let step = 1;
    let chosen = index + 1;
    while (index + step * 2 <= last) {
      const j = index + step * 2;
      if (await segmentBlocked(session, coords[index]!, coords[j]!, modeFor(j))) break;
      chosen = j;
      step *= 2;
    }
    const remaining = last - chosen;
    if (remaining > 0 && remaining < step) {
      if (!(await segmentBlocked(session, coords[index]!, coords[last]!, modeFor(last)))) {
        chosen = last;
      }
    }
    out.push(coords[chosen]!);
    index = chosen;
  }
  return out;
}

function heuristic(cell: string, goal: Position): number {
  return Math.max(0, metersBetween(center(cell), goal) - edgeMeters(getResolution(cell)));
}

async function routeCells(
  session: Session,
  seeds: Array<{ point: Position; cell: string; hop: number }>,
  anchor: string,
  origin: Position,
  goal: Position,
  maxDistanceMeters: number,
  mode: MixedMode,
  deadline: number | undefined,
  limitMeters: number
): Promise<{ end: string; prev: Map<string, string | null>; depart: Map<string, Position> } | null> {
  const gScore = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const depart = new Map<string, Position>();
  const expanded = new Set<string>();
  const heap = new MinHeap<string>();
  for (const seed of seeds) {
    const inside = covers(session, seed.cell, seed.point);
    const g = inside ? 0 : seed.hop;
    const previous = gScore.get(seed.cell);
    if (previous !== undefined && previous <= g) continue;
    gScore.set(seed.cell, g);
    prev.set(seed.cell, null);
    depart.set(seed.cell, seed.point);
    heap.push(g + heuristic(seed.cell, goal), seed.cell);
  }
  let expansions = 0;
  while (heap.size > 0) {
    const popped = heap.pop();
    if (!popped) break;
    if (popped.key >= limitMeters) break;
    const cell = popped.value;
    const g = gScore.get(cell);
    if (g === undefined || expanded.has(cell)) continue;
    if (popped.key > g + heuristic(cell, goal) + 1) continue;
    expanded.add(cell);
    if (cell === anchor || cellContains(cell, anchor)) {
      const sameFineCell = cell === anchor && getResolution(cell) === session.fine;
      if (
        sameFineCell ||
        g > 0 ||
        !(await segmentBlocked(session, depart.get(cell)!, goal, "ends"))
      ) {
        return { end: cell, prev, depart };
      }
    }
    if (++expansions > MAX_EXPANSIONS) return null;
    session.expansions++;
    if ((expansions & 255) === 0 && deadline != null && Date.now() > deadline) return null;
    const neighbors = await waterNeighbors(session, cell);
    const extras = await mixedExtras(session, cell, origin, goal, mode);
    const at = prev.get(cell) == null ? depart.get(cell)! : center(cell);
    const unique = new Set<string>([...neighbors, ...extras]);
    for (const next of unique) {
      if (next === cell) continue;
      const step = Math.max(1, metersBetween(at, center(next)));
      const nextG = g + step;
      if (nextG > maxDistanceMeters * 1.35) continue;
      if (nextG + heuristic(next, goal) >= limitMeters) continue;
      const old = gScore.get(next);
      if (old !== undefined && nextG >= old - 0.5) continue;
      gScore.set(next, nextG);
      prev.set(next, cell);
      depart.set(next, depart.get(cell)!);
      heap.push(nextG + heuristic(next, goal), next);
    }
  }
  return null;
}

function trace(
  session: Session,
  end: string,
  prev: Map<string, string | null>,
  depart: Map<string, Position>,
  port: Position
): Position[] {
  const cells: string[] = [];
  const guard = new Set<string>();
  let cursor: string | null = end;
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    cells.push(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  cells.reverse();
  const start = depart.get(cells[0]!) ?? center(cells[0]!);
  const raw: Position[] = [start];
  for (const cell of cells) {
    if (raw.length === 1 && covers(session, cell, start)) continue;
    raw.push(center(cell));
  }
  raw.push(port);
  return raw;
}

function finishLine(coords: Position[]): Position[] {
  const out: Position[] = [];
  for (const [lng, lat] of coords) {
    const wrapped: Position = [wrapLng(lng), lat];
    const prev = out[out.length - 1];
    if (prev && metersBetween(prev, wrapped) < 1 && Math.abs(wrapped[0] - prev[0]) <= 180) {
      continue;
    }
    out.push(wrapped);
  }
  return cutAntimeridian(out);
}

/**
 * A segment whose stored longitudes differ by more than 180° is the short hop
 * across the antimeridian, but a straight line through those coordinates is
 * drawn the long way around the earth. Insert both sides of the meridian so
 * each piece stays on the short arc. The two meridian vertices are one point;
 * the segment between them has no length.
 */
function cutAntimeridian(coords: Position[]): Position[] {
  if (coords.length < 2) return coords;
  const out: Position[] = [coords[0]!];
  for (let i = 1; i < coords.length; i++) {
    const prev = out[out.length - 1]!;
    const next = coords[i]!;
    const raw = next[0] - prev[0];
    if (raw > 180 || raw < -180) {
      let lng = next[0];
      while (lng - prev[0] > 180) lng -= 360;
      while (lng - prev[0] < -180) lng += 360;
      const span = lng - prev[0];
      if (span !== 0) {
        const boundary = span > 0 ? 180 : -180;
        const t = (boundary - prev[0]) / span;
        const lat = prev[1] + (next[1] - prev[1]) * t;
        if (Math.abs(boundary - prev[0]) > 1e-8) out.push([boundary, lat]);
        const exitLng = boundary === 180 ? -180 : 180;
        out.push([exitLng, lat]);
      }
    }
    const last = out[out.length - 1]!;
    if (last[0] === next[0] && last[1] === next[1]) continue;
    out.push(next);
  }
  return out;
}

function lineLength(coords: Position[]): number {
  let meters = 0;
  for (let i = 1; i < coords.length; i++) meters += metersBetween(coords[i - 1]!, coords[i]!);
  return meters;
}

function pointHitsLoadedLand(session: Session, point: Position): boolean {
  const x = wrapLng(point[0]);
  for (const feature of session.features.values()) {
    const bounds = boxOf(session, feature);
    if (x < bounds[0] - 0.02 || x > bounds[2] + 0.02) continue;
    if (point[1] < bounds[1] - 0.02 || point[1] > bounds[3] + 0.02) continue;
    if (pointOnFeature(point, feature)) return true;
  }
  return false;
}

/** Same windows as the port tests: land in the first 2 km or last 2.5 km is the harbor. */
async function firstInteriorLand(session: Session, coords: Position[]): Promise<Position | null> {
  const total = lineLength(coords);
  if (total < 4_500) return null;
  let walked = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    let lng = b[0];
    while (lng - a[0] > 180) lng -= 360;
    while (lng - a[0] < -180) lng += 360;
    const span = metersBetween(a, [lng, b[1]]);
    const ignoreStart = Math.max(0, 2_000 - walked);
    const ignoreEnd = Math.max(0, 2_500 - (total - walked - span));
    if (span > 1 && ignoreStart + ignoreEnd < span) {
      const hit = await occupancyHit(
        session,
        a,
        lng,
        b[1],
        span,
        COARSE,
        0,
        span,
        ignoreStart,
        ignoreEnd,
        ignoreStart,
        ignoreEnd
      );
      if (hit) return hit;
    }
    walked += span;
  }
  return null;
}

function moveMeters(origin: Position, eastMeters: number, northMeters: number): Position {
  const cos = Math.max(0.2, Math.cos((origin[1] * Math.PI) / 180));
  return [origin[0] + eastMeters / (111_320 * cos), origin[1] + northMeters / 111_320];
}

async function offshoreGoal(session: Session, point: Position): Promise<Position> {
  await loadAround(session, point, 3_500);
  if (!pointHitsLoadedLand(session, point)) return point;
  for (let dist = 200; dist <= 3_500; dist += 200) {
    const steps = Math.max(12, Math.ceil((2 * Math.PI * dist) / 250));
    for (let step = 0; step < steps; step++) {
      const rad = (step / steps) * Math.PI * 2;
      const at = moveMeters(point, Math.sin(rad) * dist, Math.cos(rad) * dist);
      if (!pointHitsLoadedLand(session, at)) return at;
    }
  }
  return point;
}

async function dockAtShore(session: Session, coords: Position[]): Promise<Position[]> {
  if (coords.length < 2) return coords;
  const port = coords[coords.length - 1]!;
  await loadAround(session, port, 4_000);
  for (let index = coords.length - 2; index >= 0; index--) {
    const from = coords[index]!;
    let best: Position | null = null;
    let bestMeters = Infinity;
    for (let bearing = 0; bearing < 360; bearing += 20) {
      const rad = (bearing * Math.PI) / 180;
      for (const dist of [900, 1600, 2300]) {
        const at = moveMeters(port, Math.sin(rad) * dist, Math.cos(rad) * dist);
        if (pointHitsLoadedLand(session, at)) continue;
        const mode: ShoreMode = index === 0 ? "prefix" : "none";
        if (await segmentBlocked(session, from, at, mode)) continue;
        const meters = metersBetween(from, at);
        if (meters < bestMeters) {
          bestMeters = meters;
          best = at;
        }
      }
    }
    if (!best) continue;
    const docked = coords.slice(0, index + 1).concat([best, port]);
    if (!(await firstInteriorLand(session, docked))) return docked;
  }
  return coords;
}

async function nudgeOffLand(
  session: Session,
  coords: Position[],
  hit: Position
): Promise<Position[] | null> {
  let bestIndex = 1;
  let best = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const meters = metersBetween(hit, coords[i]!);
    if (meters < best) {
      best = meters;
      bestIndex = i;
    }
  }
  const a = coords[bestIndex - 1]!;
  const b = coords[bestIndex]!;
  let lng = b[0];
  while (lng - a[0] > 180) lng -= 360;
  while (lng - a[0] < -180) lng += 360;
  const cos = Math.max(0.2, Math.cos((hit[1] * Math.PI) / 180));
  const east = (lng - a[0]) * cos * 111_320;
  const north = (b[1] - a[1]) * 111_320;
  const len = Math.hypot(east, north) || 1;
  const sideEast = -north / len;
  const sideNorth = east / len;
  for (const meters of [400, 900, 1800, 3500, 7000]) {
    for (const side of [1, -1]) {
      const at: Position = [
        hit[0] + (sideEast * meters * side) / (111_320 * cos),
        hit[1] + (sideNorth * meters * side) / 111_320,
      ];
      const next = coords.slice();
      next.splice(bestIndex, 0, at);
      if (!(await firstInteriorLand(session, next))) return next;
    }
  }
  return null;
}

async function anchorFor(session: Session, point: Position): Promise<string | null> {
  const fine = latLngToCell(point[1], wrapLng(point[0]), session.fine);
  await classify(session, [fine]);
  if (session.known.get(fine) === "water") return fine;
  const disk = gridDisk(fine, 22);
  await classify(session, disk);
  let best: { cell: string; meters: number } | null = null;
  for (const cell of disk) {
    if (session.known.get(cell) !== "water") continue;
    const meters = metersBetween(point, center(cell));
    if (meters > 4_500) continue;
    if (!best || meters < best.meters) best = { cell, meters };
  }
  if (best) return best.cell;
  for (const cell of disk) {
    if (getResolution(cell) !== session.fine || session.known.get(cell) !== "mixed") continue;
    const meters = metersBetween(point, center(cell));
    if (meters > 2_500) continue;
    if (!(await waterCenter(session, cell))) continue;
    if (!best || meters < best.meters) best = { cell, meters };
  }
  return best?.cell ?? null;
}

async function seedFor(
  session: Session,
  point: Position,
  anchor: string
): Promise<{ point: Position; cell: string; hop: number } | null> {
  const fine = latLngToCell(point[1], wrapLng(point[0]), session.fine);
  await classify(session, [fine]);
  let cell: string | null = session.known.get(fine) === "water" ? fine : null;
  let hop = cell ? metersBetween(point, center(cell)) : Infinity;
  if (!cell) {
    const disk = gridDisk(fine, 20);
    await classify(session, disk);
    for (const candidate of disk) {
      if (session.known.get(candidate) !== "water") continue;
      const meters = metersBetween(point, center(candidate));
      if (meters < hop) {
        hop = meters;
        cell = candidate;
      }
    }
    if (!cell) {
      for (const candidate of disk) {
        if (getResolution(candidate) !== session.fine) continue;
        if (session.known.get(candidate) !== "mixed") continue;
        const meters = metersBetween(point, center(candidate));
        if (meters > 2_500 || meters >= hop) continue;
        if (!(await waterCenter(session, candidate))) continue;
        hop = meters;
        cell = candidate;
      }
    }
  }
  if (!cell) return null;
  const lifted = descendBeside(session, liftAbove(session, cell, anchor), point, anchor);
  const inside = covers(session, lifted, point);
  return { point, cell: lifted, hop: inside ? 0 : metersBetween(point, center(lifted)) };
}

function exteriorRings(geometry: Geometry | null | undefined): Position[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0];
    return ring ? [ring] : [];
  }
  if (geometry.type === "MultiPolygon") {
    const rings: Position[][] = [];
    for (const polygon of geometry.coordinates) {
      if (polygon[0]) rings.push(polygon[0]);
    }
    return rings;
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

function closestOnSegment(start: Position, end: Position, target: Position): Position {
  let ex = end[0];
  while (ex - start[0] > 180) ex -= 360;
  while (ex - start[0] < -180) ex += 360;
  let tx = target[0];
  while (tx - start[0] > 180) tx -= 360;
  while (tx - start[0] < -180) tx += 360;
  const dx = ex - start[0];
  const dy = end[1] - start[1];
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((tx - start[0]) * dx + (target[1] - start[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return [start[0] + dx * t, start[1] + dy * t];
}

function descendBeside(session: Session, cell: string, point: Position, anchor: string): string {
  let current = cell;
  while (
    getResolution(current) < session.fine &&
    current !== anchor &&
    cellContains(current, anchor)
  ) {
    const childRes = getResolution(current) < MID ? MID : session.fine;
    const child = latLngToCell(point[1], wrapLng(point[0]), childRes);
    if (cellToParent(child, getResolution(current)) !== current) break;
    current = child;
  }
  return current;
}

function boundarySamples(rings: Position[][], goal: Position): Position[] {
  const samples: Position[] = [];
  for (const ring of rings) {
    if (ring.length === 0) continue;
    if (ring.length === 1) {
      samples.push(ring[0]!);
      continue;
    }
    const closed =
      ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1];
    const edges = closed ? ring.length - 1 : ring.length;
    for (let i = 0; i < edges; i++) {
      const start = ring[i]!;
      const end = ring[(i + 1) % ring.length]!;
      samples.push(closestOnSegment(start, end, goal));
      const span = metersBetween(start, end);
      const steps = Math.max(1, Math.ceil(span / 350));
      for (let step = 0; step <= steps; step++) {
        samples.push(pointAlong(start, unwrapLng(start[0], end[0]), end[1], step / steps));
      }
    }
  }
  samples.sort((a, b) => metersBetween(a, goal) - metersBetween(b, goal));
  const unique: Position[] = [];
  for (const sample of samples) {
    if (unique.some((kept) => metersBetween(kept, sample) < 120)) continue;
    unique.push(sample);
    if (unique.length >= 48) break;
  }
  return unique;
}

function unwrapLng(from: number, lng: number): number {
  let x = lng;
  while (x - from > 180) x -= 360;
  while (x - from < -180) x += 360;
  return x;
}

function spread(samples: Position[], goal: Position): Position[] {
  const picked = samples.slice(0, 12);
  const step = Math.max(1, Math.floor(samples.length / 8));
  for (let i = 0; i < samples.length; i += step) picked.push(samples[i]!);
  picked.sort((a, b) => metersBetween(a, goal) - metersBetween(b, goal));
  return picked;
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

async function loadPoints(
  source: FlatGeobufSource<Feature>,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Promise<Feature[]> {
  const parts = splitBBoxAntimeridian(
    cleanBBox([minX, minY, maxX, maxY]) as [number, number, number, number]
  );
  const found: Feature[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    const envelope = bboxToEnvelope(part);
    for await (const feature of source.getFeaturesAsync(envelope as never)) {
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

async function warmCoarse(
  session: Session,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Promise<void> {
  const boxes = splitBBoxAntimeridian(
    cleanBBox([minX, minY, maxX, maxY]) as [number, number, number, number]
  );
  const cells: string[] = [];
  for (const box of boxes) {
    const ring = [
      [box[0], box[1]],
      [box[2], box[1]],
      [box[2], box[3]],
      [box[0], box[3]],
      [box[0], box[1]],
    ];
    try {
      for (const cell of polygonToCells([ring], COARSE, true)) cells.push(cell);
    } catch {
      // A degenerate ring still leaves the on-demand lookups.
    }
  }
  if (cells.length > 0) await session.occupancy.prefetch(cells);
}

/**
 * Water route from a sketch to the nearest point features. The search walks
 * the H3 land archive, then straightens the chain and checks the last mile
 * against shoreline polygons.
 */
export type OccupancyTrace = {
  fine: number;
  expansions: number;
  requests: number;
  bytes: number;
  /** Every cell whose state was read, including parents that were lifted or split. */
  cells: { cell: string; state: LandState }[];
};

export async function searchWaterPathByOccupancy(
  feature: Feature,
  points: FlatGeobufSource<Feature>,
  land: FlatGeobufSource<Feature>,
  options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
    deadline?: number;
    /** Occupancy archive. Defaults to the res-9 file, or H3_LAND_URL. */
    archiveUrl?: string;
    /** Attach the cells this search read. The route itself does not change. */
    trace?: boolean;
  }
): Promise<WaterPathNearestResult & { trace?: OccupancyTrace }> {
  if (!feature.geometry) {
    throw new Error("searchWaterPathByOccupancy: feature.geometry is required");
  }
  const started = Date.now();
  const occupancy = await landArchive(options?.archiveUrl || OCCUPANCY_URL);
  const session: Session = {
    occupancy,
    fine: occupancy.fineResolution,
    land,
    known: new Map(),
    waterAdj: new Map(),
    centerWater: new Map(),
    features: new Map(),
    featureBox: new Map(),
    loaded: new Set(),
    segments: new Map(),
    expansions: 0,
  };
  const requestsBefore = occupancy.stats.requests;
  const bytesBefore = occupancy.stats.bytes;
  const maxResults = Math.min(
    MAX_WATER_PATH_RESULTS,
    Math.max(1, options?.maxResults ?? DEFAULT_WATER_PATH_MAX_RESULTS)
  );
  const requestedKm = options?.maxDistanceKm ?? DEFAULT_WATER_PATH_DISTANCE_KM;
  const maxDistanceMeters = Math.min(requestedKm, MAX_DISTANCE_TO_FEATURES_KM) * 1000;
  const deadline = options?.deadline;
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
  await warmCoarse(session, minX - lngPad, minY - latPad, maxX + lngPad, maxY + latPad);
  const sketch: Position = [wrapLng((minX + maxX) / 2), refLat];
  await loadAround(session, sketch, 6_000);
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
    geodesic: number;
    properties: Record<string, unknown>;
    samples: Position[];
  };
  const candidates: Candidate[] = [];
  for (const pointFeature of pointFeatures) {
    for (const position of pointPositions(pointFeature.geometry)) {
      const samples = boundarySamples(rings, position);
      const origin = samples[0] ?? boundary[0]!;
      const geodesic = metersBetween(origin, position);
      if (geodesic > maxDistanceMeters) continue;
      candidates.push({
        id: featureId(pointFeature, position),
        position,
        geodesic,
        properties: publicProperties(
          pointFeature.properties as Record<string, unknown> | null,
          options?.includedColumns
        ),
        samples,
      });
    }
  }
  candidates.sort((a, b) => a.geodesic - b.geodesic);

  const routes: WaterPathNearestResult["features"] = [];
  let exceededLimit = false;
  let routed = 0;
  const pool = candidates.slice(0, Math.max(maxResults * CANDIDATE_FACTOR, maxResults));

  const accept = (id: number, meters: number, properties: Record<string, unknown>, line: Position[]) => {
    if (meters <= 0 || meters > maxDistanceMeters || line.length < 2) return;
    const previous = routes.find((hit) => hit.__id === id);
    if (previous && previous.meters <= meters) return;
    if (previous) routes.splice(routes.indexOf(previous), 1);
    routes.push({
      __id: id,
      meters,
      properties,
      geojsonLine: lineFeature(line),
    });
    routes.sort((a, b) => a.meters - b.meters);
    if (routes.length > maxResults) routes.length = maxResults;
  };

  for (const candidate of pool) {
    if (deadline != null && Date.now() > deadline) {
      exceededLimit = true;
      break;
    }
    // Geodesic distance is a lower bound, so a port farther than the worst
    // route already kept cannot enter the top results.
    if (routes.length >= maxResults && candidate.geodesic >= routes[maxResults - 1]!.meters) {
      break;
    }
    if (routed >= maxResults * CANDIDATE_FACTOR) {
      exceededLimit = true;
      break;
    }
    routed++;
    const goal = await offshoreGoal(session, candidate.position);
    let direct: Position[] | null = null;
    let attempts = 0;
    for (const sample of candidate.samples) {
      if (++attempts > 16) break;
      if (await segmentBlocked(session, sample, goal, "ends")) continue;
      direct = finishLine([sample, goal]);
      break;
    }
    if (direct && !(await firstInteriorLand(session, direct))) {
      accept(candidate.id, lineLength(direct), candidate.properties, direct);
      continue;
    }

    const anchor = await anchorFor(session, goal);
    if (!anchor) continue;
    await loadAround(session, goal, 6_000);
    const seeds: Array<{ point: Position; cell: string; hop: number }> = [];
    const seeded = new Set<string>();
    for (const sample of spread(candidate.samples, candidate.position)) {
      const seed = await seedFor(session, sample, anchor);
      if (!seed || seeded.has(seed.cell)) continue;
      seeded.add(seed.cell);
      seeds.push(seed);
      if (seeds.length >= 10) break;
    }
    if (seeds.length === 0) continue;
    const origin = seeds[0]!.point;
    // Until the result list is full, a later port may still be closer by
    // water than anything kept so far. After that, only a route that beats
    // the worst kept one is worth the walk.
    const limitMeters =
      routes.length >= maxResults ? routes[maxResults - 1]!.meters : maxDistanceMeters;
    let found = await routeCells(
      session,
      seeds,
      anchor,
      origin,
      goal,
      maxDistanceMeters,
      "ends",
      deadline,
      limitMeters
    );
    if (!found && (deadline == null || Date.now() < deadline)) {
      found = await routeCells(
        session,
        seeds,
        anchor,
        origin,
        goal,
        maxDistanceMeters,
        "corridor",
        deadline,
        limitMeters
      );
    }
    if (!found) continue;
    let pulled = finishLine(
      await stringPull(
        session,
        await openHops(
          session,
          await stringPull(
            session,
            trace(session, found.end, found.prev, found.depart, goal)
          )
        )
      )
    );
    for (let attempt = 0; attempt < 4; attempt++) {
      const hit = await firstInteriorLand(session, pulled);
      if (!hit) break;
      const nudged = await nudgeOffLand(session, pulled, hit);
      if (!nudged) break;
      const simplified = finishLine(await stringPull(session, nudged));
      pulled = (await firstInteriorLand(session, simplified)) ? nudged : simplified;
    }
    if (await firstInteriorLand(session, pulled)) {
      pulled = await dockAtShore(session, pulled);
    }
    if (await firstInteriorLand(session, pulled)) continue;
    accept(candidate.id, lineLength(pulled), candidate.properties, pulled);
  }

  if (process.env.WATER_PATH_DEBUG) {
    const name = String(
      (feature.properties as { name?: unknown } | null)?.name ?? "occupancy"
    );
    console.log(
      `occupancy ${name}: routes=${routes.length} expansions=${session.expansions} requests=${
        occupancy.stats.requests - requestsBefore
      } bytes=${occupancy.stats.bytes - bytesBefore} ${Date.now() - started}ms`
    );
  }

  const routedMeters = new Map(routes.map((route) => [route.__id, route.meters]));
  const kept = routes.slice(0, maxResults);
  const occupancyTrace: OccupancyTrace | undefined = options?.trace
    ? {
        fine: session.fine,
        expansions: session.expansions,
        requests: occupancy.stats.requests - requestsBefore,
        bytes: occupancy.stats.bytes - bytesBefore,
        cells: [...session.known].map(([cell, state]) => ({ cell, state })),
      }
    : undefined;
  return {
    features: kept,
    exceededLimit,
    candidates: candidates.map((candidate) => ({
      __id: candidate.id,
      position: candidate.position,
      properties: candidate.properties,
      geodesicMeters: candidate.geodesic,
      meters: routedMeters.get(candidate.id),
    })),
    trace: occupancyTrace,
  };
}
