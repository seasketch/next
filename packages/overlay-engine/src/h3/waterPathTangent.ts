import { Feature, Geometry, LineString, Position } from "geojson";
import { H3Index, latLngToCell } from "h3-js";
import { FlatGeobufSource } from "fgb-source";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import distance from "@turf/distance";
import { metersToDegrees } from "./constants";
import { bboxForCell } from "./bboxForCell";
import { MinHeap } from "./minHeap";
import {
  bboxToEnvelope,
  cleanBBox,
  splitBBoxAntimeridian,
} from "../utils/bboxUtils";
import {
  MAX_DISTANCE_TO_FEATURES_KM,
  MAX_WATER_PATH_RESULTS,
  DEFAULT_WATER_PATH_DISTANCE_KM,
  DEFAULT_WATER_PATH_MAX_RESULTS,
  WaterPathNearestResult,
} from "./waterPathNearestH3";
import {
  cellBlocked,
  indexedRouteSamples,
  pastDeadline,
  roughCorridor,
  RouteDeadline,
  RoughSpan,
} from "./waterPathRough";

/**
 * Routes stand off the shoreline by about this much. The hex search got a
 * similar gap from the cell size; bend points should not be raw coast vertices.
 */
const OFFSHORE_METERS = 400;

/**
 * A segment closer than this is treated as blocked. Sharp corners of the
 * offset coast land a little inside `OFFSHORE_METERS`.
 */
const MIN_CLEARANCE_METERS = 180;

/** The sketch boundary can sit near land. Ignore that neighborhood at the start. */
const START_RELAX_METERS = 1000;

/**
 * An inland port is moved this far past the nearest shoreline so the goal
 * sits in the water. The search then ends offshore instead of on the dock.
 */
const GOAL_WATER_METERS = 40;

/**
 * Required shore clearance fades to zero over this approach, so the last hop
 * can reach a goal that sits just off the beach. It does not excuse crossing
 * land: a segment that meets the shore short of the goal is still blocked.
 */
const HARBOR_APPROACH_METERS = 2_500;
const HARBOR_RELAX_METERS = 0;

/** How far the harbor-entrance search will detour to stay in the water. */
const HARBOR_THREAD_METERS = 8_000;

const CELL_METERS = 2_000;
const ROUTE_CAP = 24;

const METERS_PER_DEG_LAT = 111_320;

type XY = { x: number; y: number };

type Mouth = {
  i: number;
  j: number;
  mid: XY;
  length: number;
};

type Obstacle = {
  id: number;
  kind: "land" | "subject";
  ring: XY[];
  offset: XY[];
  hull: XY[];
  mouths: Mouth[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type Edge = {
  a: XY;
  b: XY;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  clearance: number;
};

type HullGroup = {
  start: number;
  count: number;
  hull: XY[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type NavGraph = {
  nodes: XY[];
  adj: Array<Array<{ to: number; len: number }>>;
  groups: HullGroup[];
  pockets: Set<number>;
};

type Scene = {
  obstacles: Obstacle[];
  edges: Edge[];
  grid: Map<string, number[]>;
  landGrid: Map<string, Obstacle[]>;
  edgeStamp: Uint32Array;
  stamp: number;
  origin: XY;
  port: XY;
  originOnLand: boolean;
  maxDistance: number;
  /** Epoch ms. Hot loops throw {@link RouteDeadline} once this passes. */
  deadline?: number;
  clock: number;
};

function tick(scene: Scene) {
  if (scene.deadline == null) return;
  scene.clock++;
  if ((scene.clock & 255) === 0 && Date.now() > scene.deadline) {
    throw new RouteDeadline();
  }
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function dist(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerp(a: XY, b: XY, t: number): XY {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function cross(o: XY, a: XY, b: XY): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function project(lng: number, lat: number, refLng: number, refLat: number): XY {
  let x = lng;
  while (x - refLng > 180) x -= 360;
  while (x - refLng < -180) x += 360;
  const scale = Math.cos((refLat * Math.PI) / 180) || 1;
  return {
    x: (x - refLng) * METERS_PER_DEG_LAT * scale,
    y: (lat - refLat) * METERS_PER_DEG_LAT,
  };
}

function unproject(point: XY, refLng: number, refLat: number): Position {
  const scale = Math.cos((refLat * Math.PI) / 180) || 1;
  return [
    refLng + point.x / (METERS_PER_DEG_LAT * scale),
    refLat + point.y / METERS_PER_DEG_LAT,
  ];
}

function ringToXY(ring: Position[], refLng: number, refLat: number): XY[] {
  const out: XY[] = [];
  let prev = refLng;
  for (const [lng, lat] of ring) {
    let x = lng;
    while (x - prev > 180) x -= 360;
    while (x - prev < -180) x += 360;
    prev = x;
    out.push(project(x, lat, refLng, refLat));
  }
  return out;
}

function openRing(ring: XY[]): XY[] {
  if (ring.length > 1 && dist(ring[0]!, ring[ring.length - 1]!) < 1) {
    return ring.slice(0, -1);
  }
  return ring.slice();
}

function decimate(ring: XY[], spacing: number): XY[] {
  const pts = openRing(ring);
  if (pts.length === 0) return [];
  const out: XY[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    if (dist(out[out.length - 1]!, pts[i]!) >= spacing) out.push(pts[i]!);
  }
  const last = pts[pts.length - 1]!;
  if (dist(out[out.length - 1]!, last) > spacing * 0.3) out.push(last);
  return out;
}

function signedArea(ring: XY[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const next = ring[(i + 1) % ring.length]!;
    area += ring[i]!.x * next.y - next.x * ring[i]!.y;
  }
  return area / 2;
}

function outwardNormal(a: XY, b: XY): XY {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dy / len, y: -dx / len };
}

function offsetOutward(ring: XY[], gap: number): XY[] {
  let pts = openRing(ring);
  if (pts.length < 3) return pts;
  if (signedArea(pts) < 0) pts = [...pts].reverse();
  const out: XY[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i + pts.length - 1) % pts.length]!;
    const curr = pts[i]!;
    const next = pts[(i + 1) % pts.length]!;
    const n1 = outwardNormal(prev, curr);
    const n2 = outwardNormal(curr, next);
    let nx = n1.x + n2.x;
    let ny = n1.y + n2.y;
    const len = Math.hypot(nx, ny);
    if (len < 1e-6) {
      nx = n1.x;
      ny = n1.y;
    } else {
      nx /= len;
      ny /= len;
    }
    out.push({ x: curr.x + nx * gap, y: curr.y + ny * gap });
  }
  return out;
}

function convexHull(points: XY[]): XY[] {
  const uniq: XY[] = [];
  const seen = new Set<string>();
  for (const point of points) {
    const key = `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(point);
  }
  uniq.sort((a, b) => a.x - b.x || a.y - b.y);
  if (uniq.length <= 1) return uniq;
  const turn = (o: XY, a: XY, b: XY) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: XY[] = [];
  for (const point of uniq) {
    while (
      lower.length >= 2 &&
      turn(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: XY[] = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    const point = uniq[i]!;
    while (
      upper.length >= 2 &&
      turn(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function clipPolygon(subject: XY[], clip: XY[]): XY[] {
  let output = openRing(subject);
  if (output.length < 3 || clip.length < 3) return [];
  for (let i = 0; i < clip.length; i++) {
    const c1 = clip[i]!;
    const c2 = clip[(i + 1) % clip.length]!;
    const input = output;
    output = [];
    if (input.length === 0) return [];
    for (let j = 0; j < input.length; j++) {
      const start = input[j]!;
      const end = input[(j + 1) % input.length]!;
      const startIn = cross(c1, c2, start) >= -0.01;
      const endIn = cross(c1, c2, end) >= -0.01;
      if (endIn) {
        if (!startIn) {
          const hit = segmentCross(start, end, c1, c2);
          if (hit) output.push(hit);
        }
        output.push(end);
      } else if (startIn) {
        const hit = segmentCross(start, end, c1, c2);
        if (hit) output.push(hit);
      }
    }
  }
  return output.length >= 3 ? output : [];
}

function segmentCross(a: XY, b: XY, c: XY, d: XY): XY | null {
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pointInRing(point: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + 0) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function distToRing(point: XY, ring: XY[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const span = distPointToSeg(point, ring[i]!, ring[(i + 1) % ring.length]!);
    if (span < best) best = span;
  }
  return best;
}

function distPointToSeg(point: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

function properIntersect(a: XY, b: XY, c: XY, d: XY): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return (
    ((d1 > 1 && d2 < -1) || (d1 < -1 && d2 > 1)) &&
    ((d3 > 1 && d4 < -1) || (d3 < -1 && d4 > 1))
  );
}

function distSegSeg(a: XY, b: XY, c: XY, d: XY): number {
  if (properIntersect(a, b, c, d)) return 0;
  return Math.min(
    distPointToSeg(a, c, d),
    distPointToSeg(b, c, d),
    distPointToSeg(c, a, b),
    distPointToSeg(d, a, b)
  );
}

/** How far the closest point of shore segment cd is from the end of route ab. */
function approachOf(a: XY, b: XY, c: XY, d: XY): { span: number; fromEnd: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const len = Math.sqrt(len2);
  if (properIntersect(a, b, c, d)) {
    const denom = dx * (d.y - c.y) - dy * (d.x - c.x);
    const t =
      Math.abs(denom) < 1e-9
        ? 0
        : ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
    return { span: 0, fromEnd: (1 - Math.max(0, Math.min(1, t))) * len };
  }
  let span = Infinity;
  let fromEnd = len;
  const take = (next: number, end: number) => {
    if (next < span) {
      span = next;
      fromEnd = end;
    }
  };
  const project = (point: XY) => {
    if (len2 < 1) return 0;
    return Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
  };
  take(distPointToSeg(c, a, b), (1 - project(c)) * len);
  take(distPointToSeg(d, a, b), (1 - project(d)) * len);
  take(distPointToSeg(a, c, d), len);
  take(distPointToSeg(b, c, d), 0);
  return { span, fromEnd };
}

/** Full offshore gap in open water, fading to zero alongside the harbor. */
function clearanceAt(fromEnd: number, harbor: boolean): number {
  if (!harbor) return MIN_CLEARANCE_METERS;
  if (fromEnd <= HARBOR_RELAX_METERS) return 0;
  if (fromEnd >= HARBOR_APPROACH_METERS) return MIN_CLEARANCE_METERS;
  const t =
    (fromEnd - HARBOR_RELAX_METERS) / (HARBOR_APPROACH_METERS - HARBOR_RELAX_METERS);
  return MIN_CLEARANCE_METERS * t;
}

function bboxOf(points: XY[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

function chain(ring: XY[], start: number, end: number, dir: 1 | -1): XY[] {
  const out: XY[] = [ring[start]!];
  if (ring.length === 0) return out;
  let index = start;
  let guard = 0;
  while (index !== end && guard++ <= ring.length) {
    index = (index + dir + ring.length) % ring.length;
    out.push(ring[index]!);
  }
  return out;
}

function tangentIndices(point: XY, hull: XY[]): number[] {
  const found: number[] = [];
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const prev = hull[(i + n - 1) % n]!;
    const curr = hull[i]!;
    const next = hull[(i + 1) % n]!;
    const prevSide = cross(point, curr, prev);
    const nextSide = cross(point, curr, next);
    const sameSide =
      (prevSide >= -1 && nextSide >= -1) || (prevSide <= 1 && nextSide <= 1);
    if (!sameSide) continue;
    if (prevSide * nextSide < -1) continue;
    found.push(i);
  }
  if (found.length <= 2) return found;
  let minI = found[0]!;
  let maxI = found[0]!;
  let minAng = Infinity;
  let maxAng = -Infinity;
  for (const index of found) {
    const vertex = hull[index]!;
    const ang = Math.atan2(vertex.y - point.y, vertex.x - point.x);
    if (ang < minAng) {
      minAng = ang;
      minI = index;
    }
    if (ang > maxAng) {
      maxAng = ang;
      maxI = index;
    }
  }
  return minI === maxI ? [minI] : [minI, maxI];
}

function nearestIndex(ring: XY[], point: XY): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const span = dist(ring[i]!, point);
    if (span < bestDist) {
      bestDist = span;
      best = i;
    }
  }
  return best;
}

function pathLength(path: XY[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1]!, path[i]!);
  return total;
}

function dedupe(path: XY[]): XY[] {
  const out: XY[] = [];
  for (const point of path) {
    const prev = out[out.length - 1];
    if (prev && dist(prev, point) < 5) continue;
    out.push(point);
  }
  return out;
}

function buildObstacle(
  id: number,
  kind: "land" | "subject",
  ring: XY[],
  clip: XY[] | null
): Obstacle | null {
  if (kind === "subject" && openRing(ring).length < 3) return null;
  if (clip) {
    const windowBox = bboxOf(clip);
    const ringBox = bboxOf(ring);
    if (
      ringBox.maxX < windowBox.minX ||
      ringBox.minX > windowBox.maxX ||
      ringBox.maxY < windowBox.minY ||
      ringBox.minY > windowBox.maxY
    ) {
      return null;
    }
  }
  let pts =
    clip && kind === "land"
      ? decimate(clipPolygon(ring, clip), 140)
      : decimate(ring, kind === "land" ? 140 : 80);
  if (pts.length === 1) {
    const center = pts[0]!;
    pts = [
      { x: center.x - 40, y: center.y - 40 },
      { x: center.x + 40, y: center.y - 40 },
      { x: center.x + 40, y: center.y + 40 },
      { x: center.x - 40, y: center.y + 40 },
    ];
  }
  if (pts.length < 3) {
    if (pts.length === 0) return null;
    const center = pts[0]!;
    pts = [
      { x: center.x - 30, y: center.y - 30 },
      { x: center.x + 30, y: center.y - 30 },
      { x: center.x + 30, y: center.y + 30 },
      { x: center.x - 30, y: center.y + 30 },
    ];
  }
  if (Math.abs(signedArea(pts)) < 1) return null;
  const offset = kind === "land" ? offsetOutward(pts, OFFSHORE_METERS) : pts;
  const hull = convexHull(offset);
  if (hull.length < 3) return null;
  const mouths: Mouth[] = [];
  if (kind === "land") {
    for (let i = 0; i < hull.length; i++) {
      const j = (i + 1) % hull.length;
      const mid = lerp(hull[i]!, hull[j]!, 0.5);
      if (pointInRing(mid, offset)) continue;
      if (distToRing(mid, offset) < 80) continue;
      mouths.push({ i, j, mid, length: dist(hull[i]!, hull[j]!) });
    }
    mouths.sort((a, b) => b.length - a.length);
  }
  const box = bboxOf(pts);
  return {
    id,
    kind,
    ring: pts,
    offset,
    hull,
    mouths: mouths.slice(0, 12),
    ...box,
  };
}

function expandBox(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  pad: number
): XY[] {
  return [
    { x: box.minX - pad, y: box.minY - pad },
    { x: box.maxX + pad, y: box.minY - pad },
    { x: box.maxX + pad, y: box.maxY + pad },
    { x: box.minX - pad, y: box.maxY + pad },
  ];
}

function buildScene(
  origin: XY,
  port: XY,
  landRings: XY[][],
  subjectRings: XY[][],
  maxDistance: number,
  options?: { deadline?: number; clip?: XY[] | null }
): Scene {
  const subjectPoints = subjectRings.flat();
  const bounds = bboxOf(
    subjectPoints.length > 0 ? subjectPoints : [origin, port]
  );
  const clip = options?.clip ?? expandBox(bounds, maxDistance);
  const obstacles: Obstacle[] = [];
  let nextId = 1;
  for (const ring of landRings) {
    if (options?.deadline != null && pastDeadline(options.deadline)) {
      throw new RouteDeadline();
    }
    const obstacle = buildObstacle(nextId, "land", ring, clip);
    if (obstacle) {
      obstacles.push(obstacle);
      nextId++;
    }
  }
  for (const ring of subjectRings) {
    const obstacle = buildObstacle(nextId, "subject", ring, null);
    if (obstacle) {
      obstacles.push(obstacle);
      nextId++;
    }
  }
  const edges: Edge[] = [];
  const grid = new Map<string, number[]>();
  const landGrid = new Map<string, Obstacle[]>();
  const addEdge = (a: XY, b: XY, clearance: number) => {
    if (dist(a, b) < 1) return;
    const edge: Edge = {
      a,
      b,
      minX: Math.min(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x),
      maxY: Math.max(a.y, b.y),
      clearance,
    };
    const index = edges.length;
    edges.push(edge);
    const minCellX = Math.floor(edge.minX / CELL_METERS);
    const maxCellX = Math.floor(edge.maxX / CELL_METERS);
    const minCellY = Math.floor(edge.minY / CELL_METERS);
    const maxCellY = Math.floor(edge.maxY / CELL_METERS);
    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        const key = `${x}:${y}`;
        const bucket = grid.get(key);
        if (bucket) bucket.push(index);
        else grid.set(key, [index]);
      }
    }
  };
  for (const obstacle of obstacles) {
    if (obstacle.kind === "land") {
      const minCellX = Math.floor(obstacle.minX / CELL_METERS);
      const maxCellX = Math.floor(obstacle.maxX / CELL_METERS);
      const minCellY = Math.floor(obstacle.minY / CELL_METERS);
      const maxCellY = Math.floor(obstacle.maxY / CELL_METERS);
      for (let x = minCellX; x <= maxCellX; x++) {
        for (let y = minCellY; y <= maxCellY; y++) {
          const key = `${x}:${y}`;
          const bucket = landGrid.get(key);
          if (bucket) bucket.push(obstacle);
          else landGrid.set(key, [obstacle]);
        }
      }
    }
    const clearance = obstacle.kind === "land" ? MIN_CLEARANCE_METERS : 0;
    for (let i = 0; i < obstacle.ring.length; i++) {
      addEdge(
        obstacle.ring[i]!,
        obstacle.ring[(i + 1) % obstacle.ring.length]!,
        clearance
      );
    }
  }
  return {
    obstacles,
    edges,
    grid,
    landGrid,
    edgeStamp: new Uint32Array(edges.length),
    stamp: 0,
    origin,
    port,
    originOnLand: false,
    maxDistance,
    deadline: options?.deadline,
    clock: 0,
  };
}

function edgesNear(scene: Scene, a: XY, b: XY, pad: number): Edge[] {
  const minX = Math.min(a.x, b.x) - pad;
  const maxX = Math.max(a.x, b.x) + pad;
  const minY = Math.min(a.y, b.y) - pad;
  const maxY = Math.max(a.y, b.y) + pad;
  const out: Edge[] = [];
  let stamp = ++scene.stamp;
  if (stamp === 0xffffffff) {
    scene.edgeStamp.fill(0);
    stamp = scene.stamp = 1;
  }
  const consider = (cellX: number, cellY: number) => {
    const bucket = scene.grid.get(`${cellX}:${cellY}`);
    if (!bucket) return;
    for (const index of bucket) {
      if (scene.edgeStamp[index] === stamp) continue;
      scene.edgeStamp[index] = stamp;
      const edge = scene.edges[index]!;
      if (edge.maxX < minX || edge.minX > maxX || edge.maxY < minY || edge.minY > maxY) {
        continue;
      }
      out.push(edge);
    }
  };
  const minCellX = Math.floor(minX / CELL_METERS);
  const maxCellX = Math.floor(maxX / CELL_METERS);
  const minCellY = Math.floor(minY / CELL_METERS);
  const maxCellY = Math.floor(maxY / CELL_METERS);
  // Short shore edges cover a handful of cells, and scanning that box is
  // cheaper than walking a halo. A long tangent's box is mostly empty corners.
  if (maxCellX - minCellX <= 3 && maxCellY - minCellY <= 3) {
    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) consider(x, y);
    }
    return out;
  }
  let cellX = Math.floor(a.x / CELL_METERS);
  let cellY = Math.floor(a.y / CELL_METERS);
  const endX = Math.floor(b.x / CELL_METERS);
  const endY = Math.floor(b.y / CELL_METERS);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(CELL_METERS / dx);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(CELL_METERS / dy);
  const boundaryX = (stepX > 0 ? cellX + 1 : cellX) * CELL_METERS;
  const boundaryY = (stepY > 0 ? cellY + 1 : cellY) * CELL_METERS;
  let tMaxX = stepX === 0 ? Infinity : Math.abs((boundaryX - a.x) / dx);
  let tMaxY = stepY === 0 ? Infinity : Math.abs((boundaryY - a.y) / dy);
  const limit = Math.abs(endX - cellX) + Math.abs(endY - cellY) + 1;
  for (let step = 0; step <= limit; step++) {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) consider(cellX + ox, cellY + oy);
    }
    if (cellX === endX && cellY === endY) break;
    if (tMaxX < tMaxY) {
      cellX += stepX;
      tMaxX += tDeltaX;
    } else {
      cellY += stepY;
      tMaxY += tDeltaY;
    }
  }
  return out;
}

function strictPart(
  a: XY,
  b: XY,
  relaxA: number,
  relaxB: number
): [XY, XY] | null {
  const len = dist(a, b);
  if (len <= relaxA + relaxB + 1) return null;
  return [lerp(a, b, relaxA / len), lerp(a, b, 1 - relaxB / len)];
}

function relaxFor(scene: Scene, a: XY, b: XY): [number, number] {
  const atOrigin = dist(a, scene.origin) < 1;
  return [
    atOrigin ? (scene.originOnLand ? 2_500 : START_RELAX_METERS) : 0,
    dist(b, scene.port) < 1 ? HARBOR_RELAX_METERS : 0,
  ];
}

function hits(
  scene: Scene,
  a: XY,
  b: XY,
  useRelax = true,
  relax?: [number, number],
  checkInterior = true
): boolean {
  tick(scene);
  const [relaxA, relaxB] = relax ?? (useRelax ? relaxFor(scene, a, b) : [0, 0]);
  // Ending at the port still fades clearance, even though land crossings are
  // not ignored. An explicit relax distance means the same thing.
  const harbor = dist(b, scene.port) < 1 || relaxB > 0;
  const strict = strictPart(a, b, relaxA, harbor ? HARBOR_RELAX_METERS : relaxB);
  if (!strict) return false;
  for (const edge of edgesNear(scene, strict[0], strict[1], MIN_CLEARANCE_METERS)) {
    if (edge.clearance > 0) {
      const approach = approachOf(strict[0], strict[1], edge.a, edge.b);
      const fromEnd = approach.fromEnd + (harbor ? HARBOR_RELAX_METERS : 0);
      if (approach.span < clearanceAt(fromEnd, harbor)) return true;
    } else if (properIntersect(strict[0], strict[1], edge.a, edge.b)) {
      return true;
    }
  }
  // Graph links join offshore hull vertices, so a blocked link has to cross a
  // shore edge. Interior samples are for a segment that stays inside land,
  // which is how a sketch sitting on an island leaves the coast.
  if (!checkInterior) return false;
  const span = dist(strict[0], strict[1]);
  const steps = Math.ceil(span / 400);
  for (let i = 1; i < steps; i++) {
    if (landContains(scene, lerp(strict[0], strict[1], i / steps))) return true;
  }
  return false;
}

function pathHits(scene: Scene, path: XY[]): boolean {
  for (let i = 1; i < path.length; i++) {
    if (hits(scene, path[i - 1]!, path[i]!)) return true;
  }
  return false;
}

function thin(scene: Scene, path: XY[]): XY[] {
  if (path.length <= 2) return path;
  const out: XY[] = [path[0]!];
  let index = 0;
  while (index < path.length - 1) {
    let farthest = index + 1;
    for (let j = path.length - 1; j > index + 1; j--) {
      if (!hits(scene, path[index]!, path[j]!)) {
        farthest = j;
        break;
      }
    }
    out.push(path[farthest]!);
    index = farthest;
  }
  return out;
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

function closestOnSegment(start: XY, end: XY, target: XY): XY {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((target.x - start.x) * dx + (target.y - start.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return { x: start.x + dx * t, y: start.y + dy * t };
}

function boundaryPoint(rings: XY[][], target: XY): XY {
  let best: XY | null = null;
  let bestDist = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const start = ring[i]!;
      const end = ring[(i + 1) % ring.length]!;
      if (dist(start, end) < 0.01 && ring.length > 1) continue;
      const point = ring.length < 2 ? start : closestOnSegment(start, end, target);
      const span = dist(point, target);
      if (span < bestDist) {
        bestDist = span;
        best = point;
      }
    }
  }
  return best ?? target;
}

function landContains(scene: Scene, point: XY): boolean {
  const bucket = scene.landGrid.get(
    `${Math.floor(point.x / CELL_METERS)}:${Math.floor(point.y / CELL_METERS)}`
  );
  if (!bucket) return false;
  for (const obstacle of bucket) {
    if (
      point.x < obstacle.minX ||
      point.x > obstacle.maxX ||
      point.y < obstacle.minY ||
      point.y > obstacle.maxY
    ) {
      continue;
    }
    if (pointInRing(point, obstacle.ring)) return true;
  }
  return false;
}

/** Closest point on the coastline, including points in the middle of an edge. */
function nearestShorePoint(scene: Scene, point: XY): XY | null {
  let best: XY | null = null;
  let bestDist = Infinity;
  for (const obstacle of scene.obstacles) {
    if (obstacle.kind !== "land") continue;
    const ring = obstacle.ring;
    for (let i = 0; i < ring.length; i++) {
      const start = ring[i]!;
      const end = ring[(i + 1) % ring.length]!;
      if (dist(start, end) < 0.01) continue;
      const on = closestOnSegment(start, end, point);
      const span = dist(on, point);
      if (span < bestDist) {
        bestDist = span;
        best = on;
      }
    }
  }
  return best;
}

const OCEAN_SEARCH_METERS = 12_000;
const OCEAN_STEP_METERS = 40;
/** Two open samples in a row, so a gap between adjacent land pieces is not the ocean. */
const OCEAN_OPEN_SAMPLES = 2;

type RingBox = { ring: XY[]; minX: number; minY: number; maxX: number; maxY: number };

function ringsNear(rings: XY[][], point: XY, pad: number): RingBox[] {
  const out: RingBox[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const vertex of ring) {
      if (vertex.x < minX) minX = vertex.x;
      if (vertex.y < minY) minY = vertex.y;
      if (vertex.x > maxX) maxX = vertex.x;
      if (vertex.y > maxY) maxY = vertex.y;
    }
    if (
      point.x < minX - pad ||
      point.x > maxX + pad ||
      point.y < minY - pad ||
      point.y > maxY + pad
    ) {
      continue;
    }
    out.push({ ring, minX, minY, maxX, maxY });
  }
  return out;
}

function insideRings(rings: RingBox[], point: XY): boolean {
  for (const item of rings) {
    if (
      point.x < item.minX ||
      point.x > item.maxX ||
      point.y < item.minY ||
      point.y > item.maxY
    ) {
      continue;
    }
    if (pointInRing(point, item.ring)) return true;
  }
  return false;
}

/**
 * Ports already in the ocean stay put. A port on land moves along the shortest
 * walk that leaves every nearby land polygon, then a short step further offshore.
 * The nearest edge of one piece is not enough: that edge is often the border
 * with the next piece of land, not the beach.
 */
function oceanPoint(rings: XY[][], point: XY): XY {
  const near = ringsNear(rings, point, OCEAN_SEARCH_METERS);
  if (!insideRings(near, point)) return point;
  let best: XY | null = null;
  let bestDist = Infinity;
  const directions = 72;
  for (let i = 0; i < directions; i++) {
    const angle = (i / directions) * Math.PI * 2;
    const dirx = Math.cos(angle);
    const diry = Math.sin(angle);
    let open = 0;
    let exit = 0;
    for (let step = OCEAN_STEP_METERS; step <= OCEAN_SEARCH_METERS; step += OCEAN_STEP_METERS) {
      const at = { x: point.x + dirx * step, y: point.y + diry * step };
      if (insideRings(near, at)) {
        open = 0;
        continue;
      }
      open++;
      if (open === 1) exit = step;
      if (open < OCEAN_OPEN_SAMPLES || exit >= bestDist) continue;
      bestDist = exit;
      const offshore = exit + GOAL_WATER_METERS;
      best = { x: point.x + dirx * offshore, y: point.y + diry * offshore };
      break;
    }
  }
  return best ?? point;
}

/**
 * The scene shoreline is simplified, so a cove can be drawn as land. Keep walking
 * seaward until the goal is outside that drawing, or the search cannot reach it.
 */
function offshoreOfScene(scene: Scene, from: XY, point: XY): XY {
  if (!landContains(scene, point)) return point;
  const away = dist(from, point);
  const dirx = away >= 1 ? (point.x - from.x) / away : 0;
  const diry = away >= 1 ? (point.y - from.y) / away : -1;
  let open = 0;
  let exit = 0;
  for (let step = OCEAN_STEP_METERS; step <= OCEAN_SEARCH_METERS; step += OCEAN_STEP_METERS) {
    const at = { x: point.x + dirx * step, y: point.y + diry * step };
    if (landContains(scene, at)) {
      open = 0;
      continue;
    }
    open++;
    if (open === 1) exit = step;
    if (open < OCEAN_OPEN_SAMPLES) continue;
    const offshore = exit + GOAL_WATER_METERS;
    return { x: point.x + dirx * offshore, y: point.y + diry * offshore };
  }
  return point;
}

/**
 * The nearest water can sit in a cove the visibility graph cannot enter, because
 * the channel tangent crosses the headland and hulls are only joined nearby.
 * Walk further seaward and keep the landing whose route is shortest.
 */
function reachGoal(
  scene: Scene,
  graph: NavGraph,
  sketch: XY[][],
  from: XY,
  aim: XY,
  trace: boolean
): { goal: XY; path: XY[] | null; record?: NavRecord } {
  const away = dist(from, aim);
  const dirx = away >= 1 ? (aim.x - from.x) / away : 0;
  const diry = away >= 1 ? (aim.y - from.y) / away : -1;
  addPocket(scene, graph, from);
  addPocket(scene, graph, aim);
  let best: { goal: XY; path: XY[]; record?: NavRecord; meters: number } | null = null;
  for (let extra = 0; extra <= 4_000; extra += 800) {
    const goal = extra === 0 ? aim : { x: aim.x + dirx * extra, y: aim.y + diry * extra };
    if (landContains(scene, goal)) continue;
    scene.port = goal;
    addPocket(scene, graph, goal);
    const record = trace ? newNavRecord() : undefined;
    const path = navigate(scene, graph, boundaryPoint(sketch, goal), goal, sketch, record);
    if (!path) continue;
    const meters = pathLength(path);
    if (!best || meters < best.meters) best = { goal, path, record, meters };
    const geodesic = dist(boundaryPoint(sketch, goal), goal);
    if (extra === 0 || meters <= geodesic * 1.25) break;
  }
  if (best) {
    scene.port = best.goal;
    return { goal: best.goal, path: best.path, record: best.record };
  }
  scene.port = aim;
  return { goal: aim, path: null };
}

function segmentHitT(a: XY, b: XY, c: XY, d: XY): number | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const denom = abx * cdy - aby * cdx;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((c.x - a.x) * cdy - (c.y - a.y) * cdx) / denom;
  const u = ((c.x - a.x) * aby - (c.y - a.y) * abx) / denom;
  if (t <= 0.01 || t >= 0.99 || u < -0.001 || u > 1.001) return null;
  return t;
}

/** First place a harbor approach meets the shore, measured from the start of ab. */
function firstShoreT(scene: Scene, a: XY, b: XY): number | null {
  const len = dist(a, b);
  let best: number | null = null;
  for (const edge of edgesNear(scene, a, b, 1)) {
    if (edge.clearance <= 0) continue;
    const t = segmentHitT(a, b, edge.a, edge.b);
    if (t == null) continue;
    const fromEnd = (1 - t) * len;
    if (fromEnd > HARBOR_APPROACH_METERS || fromEnd < 40) continue;
    if (best == null || t < best) best = t;
  }
  return best;
}

function crossesLand(scene: Scene, a: XY, b: XY): boolean {
  const steps = Math.max(1, Math.ceil(dist(a, b) / 25));
  for (let i = 1; i < steps; i++) {
    if (landContains(scene, lerp(a, b, i / steps))) return true;
  }
  return false;
}

function pullWater(scene: Scene, path: XY[]): XY[] {
  if (path.length <= 2) return path;
  const out: XY[] = [path[0]!];
  let index = 0;
  while (index < path.length - 1) {
    let farthest = index + 1;
    for (let j = path.length - 1; j > index + 1; j--) {
      if (!crossesLand(scene, path[index]!, path[j]!)) {
        farthest = j;
        break;
      }
    }
    out.push(path[farthest]!);
    index = farthest;
  }
  return out;
}

/**
 * Water cells from `gate` to the cell nearest `target`. Null when the entrance
 * is closed or the detour is longer than a harbor approach should be.
 */
function threadWater(scene: Scene, gate: XY, target: XY): XY[] | null {
  const step = 80;
  const margin = 1_200;
  const minX = Math.min(gate.x, target.x) - margin;
  const minY = Math.min(gate.y, target.y) - margin;
  const cols = Math.ceil((Math.abs(gate.x - target.x) + margin * 2) / step) + 1;
  const rows = Math.ceil((Math.abs(gate.y - target.y) + margin * 2) / step) + 1;
  if (cols * rows > 80_000) return null;
  const at = (ix: number, iy: number): XY => ({
    x: minX + ix * step,
    y: minY + iy * step,
  });
  const clamp = (ix: number, iy: number) =>
    ix >= 0 && iy >= 0 && ix < cols && iy < rows;
  const water = (ix: number, iy: number) => clamp(ix, iy) && !landContains(scene, at(ix, iy));
  const cellOf = (point: XY) => ({
    ix: Math.round((point.x - minX) / step),
    iy: Math.round((point.y - minY) / step),
  });
  const start = cellOf(gate);
  if (!water(start.ix, start.iy)) return null;
  let goal = cellOf(target);
  if (!water(goal.ix, goal.iy)) {
    let found = false;
    for (let radius = 1; radius <= 8 && !found; radius++) {
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ix = goal.ix + dx;
          const iy = goal.iy + dy;
          if (!water(ix, iy)) continue;
          goal = { ix, iy };
          found = true;
          break;
        }
      }
    }
    if (!found) return null;
  }
  const size = cols * rows;
  const prev = new Int32Array(size);
  prev.fill(-1);
  const startId = start.iy * cols + start.ix;
  const goalId = goal.iy * cols + goal.ix;
  prev[startId] = -2;
  const queue: number[] = [startId];
  let head = 0;
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  while (head < queue.length) {
    tick(scene);
    const id = queue[head++]!;
    if (id === goalId) break;
    const ix = id % cols;
    const iy = (id - ix) / cols;
    for (const [dx, dy] of steps) {
      const nx = ix + dx;
      const ny = iy + dy;
      if (!water(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!water(ix + dx, iy) || !water(ix, iy + dy))) continue;
      const next = ny * cols + nx;
      if (prev[next] !== -1) continue;
      prev[next] = id;
      queue.push(next);
    }
  }
  if (prev[goalId] === -1) return null;
  const cells: XY[] = [];
  let cursor = goalId;
  while (cursor >= 0) {
    const ix = cursor % cols;
    const iy = (cursor - ix) / cols;
    cells.push(at(ix, iy));
    const from = prev[cursor]!;
    if (from === -2) break;
    cursor = from;
  }
  cells.reverse();
  cells[0] = gate;
  if (pathLength(cells) > HARBOR_THREAD_METERS) return null;
  const pulled = pullWater(scene, cells);
  if (!crossesLand(scene, pulled[pulled.length - 1]!, target)) pulled.push(target);
  return dedupe(pulled);
}

/**
 * A channel crossing can meet the beach before the dock. Keep the offshore
 * approach, then follow the water into the entrance. When the entrance is
 * not reachable, stop at the outer shore instead of drawing across land.
 */
/** Longest continuous land stretch on the approach, ignoring the dock at the end. */
function landRunMeters(scene: Scene, a: XY, b: XY): number {
  const len = dist(a, b);
  const from = Math.max(0, len - HARBOR_APPROACH_METERS);
  const to = len - 150;
  if (to - from < 40) return 0;
  let run = 0;
  let worst = 0;
  const step = 40;
  for (let along = from; along <= to; along += step) {
    if (landContains(scene, lerp(a, b, along / len))) {
      run += step;
      if (run > worst) worst = run;
    } else {
      run = 0;
    }
  }
  return worst;
}

function repairHarbor(scene: Scene, path: XY[]): XY[] {
  if (path.length < 2) return path;
  const a = path[path.length - 2]!;
  const b = path[path.length - 1]!;
  const run = landRunMeters(scene, a, b);
  if (run < 400) return path;
  const t = firstShoreT(scene, a, b);
  if (t == null) return path;
  const len = dist(a, b);
  const contact = lerp(a, b, t);
  const shore = nearestShorePoint(scene, scene.port) ?? b;
  if (dist(contact, shore) < 300) {
    const back = Math.min(40, t * len);
    return dedupe([...path.slice(0, -1), lerp(a, b, (t * len - back) / len)]);
  }
  const gateDist = Math.max(0, t * len - 200);
  const gate = lerp(a, b, gateDist / len);
  const threaded = threadWater(scene, gate, shore);
  if (!threaded) {
    const back = Math.min(40, t * len);
    return dedupe([...path.slice(0, -1), lerp(a, b, (t * len - back) / len)]);
  }
  return dedupe([...path.slice(0, -1), ...threaded]);
}

function nearestExit(scene: Scene, point: XY): XY | null {
  let best: XY | null = null;
  let bestDist = Infinity;
  for (const obstacle of scene.obstacles) {
    if (obstacle.kind !== "land" || !pointInRing(point, obstacle.ring)) continue;
    for (const vertex of obstacle.offset) {
      const span = dist(point, vertex);
      if (span < bestDist) {
        bestDist = span;
        best = vertex;
      }
    }
  }
  return best;
}

function toLngLat(path: XY[], refLng: number, refLat: number, exactEnd?: Position): Position[] {
  const coords = path.map((point) => unproject(point, refLng, refLat));
  if (exactEnd && path.length > 0) {
    const projected = project(exactEnd[0], exactEnd[1], refLng, refLat);
    if (dist(path[path.length - 1]!, projected) < 5) {
      coords[coords.length - 1] = [exactEnd[0], exactEnd[1]];
    }
  }
  if (coords.length === 0) return coords;
  const out: Position[] = [[coords[0]![0], coords[0]![1]]];
  for (let i = 1; i < coords.length; i++) {
    let lng = coords[i]![0];
    const prev = out[i - 1]![0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    // Store both sides of the antimeridian. A continuous longitude past ±180
    // draws the short way, but it hides the crossing from the line itself.
    out.push([wrapLng(lng), coords[i]![1]]);
  }
  out[0] = [wrapLng(out[0]![0]), out[0]![1]];
  return out;
}

function tangentAt(point: XY, hull: XY[], index: number): boolean {
  const n = hull.length;
  const prev = hull[(index + n - 1) % n]!;
  const curr = hull[index]!;
  const next = hull[(index + 1) % n]!;
  const prevSide = cross(point, curr, prev);
  const nextSide = cross(point, curr, next);
  if (prevSide * nextSide < -1) return false;
  return (prevSide >= -1 && nextSide >= -1) || (prevSide <= 1 && nextSide <= 1);
}

function connect(scene: Scene, graph: NavGraph, i: number, j: number) {
  if (i === j) return;
  const len = dist(graph.nodes[i]!, graph.nodes[j]!);
  if (len < 1 || len > scene.maxDistance) return;
  if (segmentBlocked(scene, graph.nodes[i]!, graph.nodes[j]!)) return;
  graph.adj[i]!.push({ to: j, len });
  graph.adj[j]!.push({ to: i, len });
}

function buildNavGraph(scene: Scene): NavGraph {
  const graph: NavGraph = {
    nodes: [],
    adj: [],
    groups: [],
    pockets: new Set(),
  };
  const addNode = (point: XY) => {
    graph.nodes.push(point);
    graph.adj.push([]);
    return graph.nodes.length - 1;
  };
  for (const obstacle of scene.obstacles) {
    if (obstacle.hull.length < 3) continue;
    const start = graph.nodes.length;
    for (const vertex of obstacle.hull) addNode(vertex);
    for (let i = 0; i < obstacle.hull.length; i++) {
      connect(scene, graph, start + i, start + ((i + 1) % obstacle.hull.length));
    }
    for (const mouth of obstacle.mouths) {
      const mid = addNode(mouth.mid);
      connect(scene, graph, mid, start + mouth.i);
      connect(scene, graph, mid, start + mouth.j);
    }
    graph.groups.push({
      start,
      count: obstacle.hull.length,
      hull: obstacle.hull,
      minX: obstacle.minX,
      minY: obstacle.minY,
      maxX: obstacle.maxX,
      maxY: obstacle.maxY,
    });
  }
  const neighbor = Math.min(scene.maxDistance, 12_000);
  for (let a = 0; a < graph.groups.length; a++) {
    const left = graph.groups[a]!;
    for (let b = a + 1; b < graph.groups.length; b++) {
      const right = graph.groups[b]!;
      const dx = Math.max(0, left.minX - right.maxX, right.minX - left.maxX);
      const dy = Math.max(0, left.minY - right.maxY, right.minY - left.maxY);
      if (Math.hypot(dx, dy) > neighbor) continue;
      for (let i = 0; i < left.count; i++) {
        for (let j = 0; j < right.count; j++) {
          tick(scene);
          const from = graph.nodes[left.start + i]!;
          const to = graph.nodes[right.start + j]!;
          if (!tangentAt(to, left.hull, i) || !tangentAt(from, right.hull, j)) continue;
          connect(scene, graph, left.start + i, right.start + j);
        }
      }
    }
  }
  return graph;
}

/** Shoreline of a bay whose hull contains the boat or the port. */
function addPocket(scene: Scene, graph: NavGraph, point: XY) {
  for (const obstacle of scene.obstacles) {
    if (obstacle.kind !== "land" || obstacle.offset.length < 3) continue;
    if (graph.pockets.has(obstacle.id)) continue;
    if (!pointInRing(point, obstacle.hull)) continue;
    graph.pockets.add(obstacle.id);
    const start = graph.nodes.length;
    for (const vertex of obstacle.offset) {
      graph.nodes.push(vertex);
      graph.adj.push([]);
    }
    const count = obstacle.offset.length;
    for (let i = 0; i < count; i++) {
      connect(scene, graph, start + i, start + ((i + 1) % count));
    }
    const reach = Math.min(scene.maxDistance, 15_000);
    for (let i = 0; i < count; i += 2) {
      const from = graph.nodes[start + i]!;
      for (const group of graph.groups) {
        if (group.hull === obstacle.hull) continue;
        if (
          from.x < group.minX - reach ||
          from.x > group.maxX + reach ||
          from.y < group.minY - reach ||
          from.y > group.maxY + reach
        ) {
          continue;
        }
        for (let j = 0; j < group.count; j++) {
          if (!tangentAt(from, group.hull, j)) continue;
          connect(scene, graph, start + i, group.start + j);
        }
      }
    }
  }
}

const LOCAL_LINK_METERS = 40_000;

function endpointNodes(graph: NavGraph, point: XY): number[] {
  const seen = new Uint8Array(graph.nodes.length);
  const ids: number[] = [];
  const add = (index: number) => {
    if (seen[index]) return;
    seen[index] = 1;
    ids.push(index);
  };
  for (let i = 0; i < graph.nodes.length; i++) {
    if (dist(point, graph.nodes[i]!) <= LOCAL_LINK_METERS) add(i);
  }
  for (const group of graph.groups) {
    for (let i = 0; i < group.count; i++) {
      if (tangentAt(point, group.hull, i)) add(group.start + i);
    }
  }
  return ids;
}

function segmentBlocked(scene: Scene, a: XY, b: XY): boolean {
  return hits(scene, a, b, false, undefined, false);
}

function sketchVertices(rings: XY[][]): XY[] {
  const vertices: XY[] = [];
  for (const ring of rings) for (const vertex of ring) vertices.push(vertex);
  return vertices;
}

function sketchTouchesLand(scene: Scene, rings: XY[][]): boolean {
  return sketchVertices(rings).some((vertex) => landContains(scene, vertex));
}

function sketchSeeds(graph: NavGraph, rings: XY[][]): number[] {
  const seen = new Uint8Array(graph.nodes.length);
  const ids: number[] = [];
  const add = (index: number) => {
    if (seen[index]) return;
    seen[index] = 1;
    ids.push(index);
  };
  const vertices = sketchVertices(rings);
  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i]!;
    for (const vertex of vertices) {
      if (dist(node, vertex) <= LOCAL_LINK_METERS) {
        add(i);
        break;
      }
    }
  }
  for (const vertex of vertices) {
    for (const group of graph.groups) {
      for (let i = 0; i < group.count; i++) {
        if (tangentAt(vertex, group.hull, i)) add(group.start + i);
      }
    }
  }
  return ids;
}

/** Straight segment from the closest sketch-boundary point, when that line is clear. */
function directFromSketch(scene: Scene, rings: XY[][], goal: XY): XY[] | null {
  const at = boundaryPoint(rings, goal);
  const span = dist(at, goal);
  if (span > scene.maxDistance) return null;
  const relaxA = sketchTouchesLand(scene, rings) ? 1_900 : START_RELAX_METERS;
  if (hits(scene, at, goal, true, [relaxA, HARBOR_RELAX_METERS])) return null;
  return [at, goal];
}

type NavRecord = {
  steps: number[];
  prev: Int32Array | null;
  depart: Array<XY | undefined>;
  virtualGoal: boolean;
};

function newNavRecord(): NavRecord {
  return { steps: [], prev: null, depart: [], virtualGoal: false };
}

/** Offshore hulls, tangent edges, and the graph walk. Viewer-only; routing ignores it. */
export type TangentRouteTrace = {
  nodes: Position[];
  steps: number[];
  prev: number[];
  depart: Array<Position | null>;
  hulls: Position[][];
  edges: Array<[number, number]>;
  edgesTruncated: boolean;
};

function round5(position: Position): Position {
  return [
    Math.round(position[0] * 1e5) / 1e5,
    Math.round(position[1] * 1e5) / 1e5,
  ];
}

function decimateRing(ring: Position[], maxPoints: number): Position[] {
  if (ring.length <= maxPoints) return ring;
  const step = Math.ceil(ring.length / maxPoints);
  const out: Position[] = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[i]!);
  const last = ring[ring.length - 1]!;
  const tail = out[out.length - 1]!;
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}

const TRACE_EDGE_CAP = 6000;

function snapshotTrace(
  scene: Scene,
  graph: NavGraph,
  record: NavRecord | undefined,
  goal: XY,
  refLng: number,
  refLat: number
): TangentRouteTrace {
  const nodes = graph.nodes.map((point) => round5(unproject(point, refLng, refLat)));
  if (record?.virtualGoal) nodes.push(round5(unproject(goal, refLng, refLat)));
  const depart: Array<Position | null> = graph.nodes.map((_, index) => {
    const at = record?.depart[index];
    return at ? round5(unproject(at, refLng, refLat)) : null;
  });
  if (record?.virtualGoal) depart.push(null);
  const hulls: Position[][] = [];
  for (const obstacle of scene.obstacles) {
    if (obstacle.kind !== "land" || obstacle.hull.length < 3) continue;
    const ring = decimateRing(
      obstacle.hull.map((point) => round5(unproject(point, refLng, refLat))),
      280
    );
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    hulls.push(ring);
  }
  const edges: Array<[number, number]> = [];
  const seenEdge = new Set<string>();
  let edgesTruncated = false;
  for (let from = 0; from < graph.adj.length; from++) {
    for (const edge of graph.adj[from]!) {
      const to = edge.to;
      if (to < 0 || to >= graph.nodes.length) continue;
      const lo = from < to ? from : to;
      const hi = from < to ? to : from;
      const key = `${lo}:${hi}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      if (edges.length >= TRACE_EDGE_CAP) {
        edgesTruncated = true;
        break;
      }
      edges.push([lo, hi]);
    }
    if (edgesTruncated) break;
  }
  return {
    nodes,
    steps: record?.steps ?? [],
    prev: record?.prev ? Array.from(record.prev) : [],
    depart,
    hulls,
    edges,
    edgesTruncated,
  };
}

function navigate(
  scene: Scene,
  graph: NavGraph,
  origin: XY,
  goal: XY,
  sketch?: XY[][],
  record?: NavRecord
): XY[] | null {
  const rings = (sketch ?? []).filter((ring) => ring.length >= 2);
  const fromSketch = rings.length > 0;
  if (fromSketch) {
    const direct = directFromSketch(scene, rings, goal);
    if (direct) return direct;
  } else if (!hits(scene, origin, goal, true) && dist(origin, goal) <= scene.maxDistance) {
    return [origin, goal];
  }
  const count = graph.nodes.length;
  let goalIndex = -1;
  for (let i = 0; i < count; i++) {
    if (dist(graph.nodes[i]!, goal) < 5) {
      goalIndex = i;
      break;
    }
  }
  const virtualGoal = goalIndex < 0;
  const size = count + (virtualGoal ? 1 : 0);
  if (virtualGoal) goalIndex = count;
  const best = new Float64Array(size);
  best.fill(Infinity);
  const prev = new Int32Array(size);
  prev.fill(-1);
  const heap = new MinHeap<number>();
  const push = (index: number, from: number, len: number) => {
    if (len >= best[index]! || len > scene.maxDistance * 1.5) return;
    best[index] = len;
    prev[index] = from;
    heap.push(len, index);
  };
  const departAt: Array<XY | undefined> = [];
  if (fromSketch) {
    const relaxA = sketchTouchesLand(scene, rings) ? 1_900 : START_RELAX_METERS;
    for (const index of sketchSeeds(graph, rings)) {
      const at = boundaryPoint(rings, graph.nodes[index]!);
      const span = dist(at, graph.nodes[index]!);
      if (span > scene.maxDistance || span < 1) continue;
      if (hits(scene, at, graph.nodes[index]!, true, [relaxA, 0], false)) continue;
      departAt[index] = at;
      push(index, -2, span);
    }
  } else {
    for (const index of endpointNodes(graph, origin)) {
      const span = dist(origin, graph.nodes[index]!);
      if (span > scene.maxDistance || hits(scene, origin, graph.nodes[index]!, true, undefined, false))
        continue;
      push(index, -2, span);
    }
  }
  const goalHop = new Float64Array(count);
  if (virtualGoal) {
    goalHop.fill(Infinity);
    if (!fromSketch) {
      const span = dist(origin, goal);
      if (span <= scene.maxDistance && !hits(scene, origin, goal, true)) push(goalIndex, -2, span);
    }
    for (const index of endpointNodes(graph, goal)) {
      const hop = dist(graph.nodes[index]!, goal);
      if (hop > scene.maxDistance || hits(scene, graph.nodes[index]!, goal, true, undefined, false))
        continue;
      goalHop[index] = hop;
    }
  }
  const seen = new Uint8Array(size);
  while (heap.size > 0) {
    tick(scene);
    const popped = heap.pop();
    if (!popped) break;
    const id = popped.value;
    if (seen[id] || popped.key > best[id]! + 0.5) continue;
    seen[id] = 1;
    record?.steps.push(id);
    if (id === goalIndex) break;
    if (id >= count) continue;
    for (const edge of graph.adj[id]!) {
      push(edge.to, id, best[id]! + edge.len);
    }
    if (virtualGoal && goalHop[id]! < Infinity) {
      push(goalIndex, id, best[id]! + goalHop[id]!);
    }
  }
  if (record) {
    record.prev = prev;
    record.depart = departAt;
    record.virtualGoal = virtualGoal;
  }
  if (!Number.isFinite(best[goalIndex]!)) return null;
  const path: XY[] = [];
  let cursor = goalIndex;
  while (cursor >= 0) {
    path.push(cursor === goalIndex && virtualGoal ? goal : graph.nodes[cursor]!);
    const from = prev[cursor]!;
    if (from === -2) {
      path.push(fromSketch ? departAt[cursor]! : origin);
      break;
    }
    cursor = from;
  }
  path.reverse();
  return path;
}

/**
 * Water route from `origin` to `port` around `landRings`, standing offshore.
 * `subjectRings` are obstacles the line may leave but not cross.
 * Returns null when every detour is longer than `maxDistanceMeters`.
 */
export function routeWaterPath(
  origin: Position,
  port: Position,
  landRings: Position[][],
  subjectRings: Position[][],
  maxDistanceMeters: number
): Position[] | null {
  const refLng = origin[0];
  const refLat = origin[1];
  const originXY = project(origin[0], origin[1], refLng, refLat);
  const portXY = project(port[0], port[1], refLng, refLat);
  const landXY = landRings.map((ring) => ringToXY(ring, refLng, refLat));
  const subjectXY = subjectRings.map((ring) => ringToXY(ring, refLng, refLat));
  const scene = buildScene(originXY, portXY, landXY, subjectXY, maxDistanceMeters);
  const goal = offshoreOfScene(scene, portXY, oceanPoint(landXY, portXY));
  scene.port = goal;
  scene.originOnLand = scene.obstacles.some(
    (obstacle) => obstacle.kind === "land" && pointInRing(originXY, obstacle.ring)
  );
  const graph = buildNavGraph(scene);
  addPocket(scene, graph, originXY);
  addPocket(scene, graph, portXY);
  addPocket(scene, graph, goal);
  const exit = scene.originOnLand ? nearestExit(scene, originXY) : null;
  const path = navigate(scene, graph, exit ?? originXY, goal);
  if (path && exit) path.unshift(originXY);
  if (!path) return null;
  const thinned = thin(scene, dedupe(path));
  const chosen = pathHits(scene, thinned) ? (pathHits(scene, path) ? null : path) : thinned;
  if (!chosen || pathLength(chosen) > maxDistanceMeters * 1.05) return null;
  return toLngLat(repairHarbor(scene, chosen), refLng, refLat, port);
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

function envelopesForBox(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Array<{ minX: number; minY: number; maxX: number; maxY: number }> {
  const spans: Array<[number, number]> = [];
  let cursor = minX;
  let guard = 0;
  while (cursor < maxX - 1e-8 && guard++ < 8) {
    const wrapped = wrapLng(cursor);
    const room = 180 - wrapped;
    const step = Math.min(maxX - cursor, room > 1e-6 ? room : maxX - cursor);
    const end = cursor + step;
    if (room > 1e-6 && Math.abs(step - room) <= 1e-4) {
      spans.push([wrapped, 179.999]);
    } else {
      const endWrapped = wrapLng(end);
      spans.push([Math.min(wrapped, endWrapped), Math.max(wrapped, endWrapped)]);
    }
    if (step <= 1e-8) break;
    cursor = end;
  }
  return spans.map(([lo, hi]) => ({
    minX: lo,
    minY: Math.max(-85, minY),
    maxX: hi,
    maxY: Math.min(85, maxY),
  }));
}

async function loadFeatures(
  source: FlatGeobufSource<Feature>,
  envelopes: Array<{ minX: number; minY: number; maxX: number; maxY: number }>,
  deadline?: number,
  maxFeatures = Infinity
): Promise<Feature[]> {
  const found: Feature[] = [];
  const seen = new Set<number>();
  for (const envelope of envelopes) {
    if (found.length >= maxFeatures) break;
    if (pastDeadline(deadline)) throw new RouteDeadline();
    const cleaned = cleanBBox([
      envelope.minX,
      envelope.minY,
      envelope.maxX,
      envelope.maxY,
    ]);
    const parts = splitBBoxAntimeridian(cleaned as [number, number, number, number]);
    for (const part of parts) {
      const env = bboxToEnvelope(part);
      const queryPlan = source.createPlan(env as never);
      for await (const feature of source.getFeaturesAsync(env as never, {
        queryPlan,
      })) {
        if (pastDeadline(deadline)) throw new RouteDeadline();
        if (found.length >= maxFeatures) return found;
        const offset = (feature.properties as { __offset?: unknown } | null)?.__offset;
        if (typeof offset === "number") {
          if (seen.has(offset)) continue;
          seen.add(offset);
        }
        found.push(feature);
      }
    }
  }
  return found;
}

/**
 * Index searches kept before a tangent route. Enough to cover the ports that
 * can win, without walking every harbor in the disk.
 */
const ROUGH_CAP = 12;

/** Shoreline farther than this from the index path is not worth a tangent edge. */
const SHORE_KEEP_METERS = 25_000;

/** How many shoreline rings are graphed for one port. */
const MAX_SHORE_RINGS = 80;

function metersToPolyline(lng: number, lat: number, path: Position[]): number {
  const scale = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1]!;
    const end = path[i]!;
    let ax = start[0];
    let bx = end[0];
    while (ax - lng > 180) ax -= 360;
    while (ax - lng < -180) ax += 360;
    while (bx - ax > 180) bx -= 360;
    while (bx - ax < -180) bx += 360;
    const px = 0;
    const py = lat * METERS_PER_DEG_LAT;
    const axm = (ax - lng) * METERS_PER_DEG_LAT * scale;
    const aym = start[1] * METERS_PER_DEG_LAT;
    const bxm = (bx - lng) * METERS_PER_DEG_LAT * scale;
    const bym = end[1] * METERS_PER_DEG_LAT;
    const dx = bxm - axm;
    const dy = bym - aym;
    const len2 = dx * dx + dy * dy;
    const t = len2 < 1 ? 0 : Math.max(0, Math.min(1, ((px - axm) * dx + (py - aym) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (axm + dx * t), py - (aym + dy * t)));
  }
  return best;
}

function ringGap(ring: Position[], path: Position[]): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minX) minX = lng;
    if (lng > maxX) maxX = lng;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  }
  if (!Number.isFinite(minX)) return Infinity;
  const samples: Position[] = [
    [minX, minY],
    [minX, maxY],
    [maxX, minY],
    [maxX, maxY],
    [(minX + maxX) / 2, (minY + maxY) / 2],
  ];
  let best = Infinity;
  for (const [lng, lat] of samples) best = Math.min(best, metersToPolyline(lng, lat, path));
  return best;
}

/** One corridor cannot spend the whole search budget. */
const PORT_BUDGET_MS = 7_000;

/** Polygon samples along a finished line. Coarser than this misses a cape. */
const LAND_SAMPLE_METERS = 80;

function lineMeters(coords: Position[]): number {
  let meters = 0;
  for (let i = 1; i < coords.length; i++) {
    let lng = coords[i]![0];
    while (lng - coords[i - 1]![0] > 180) lng -= 360;
    while (lng - coords[i - 1]![0] < -180) lng += 360;
    meters += distance(coords[i - 1]!, [lng, coords[i]![1]], { units: "meters" });
  }
  return meters;
}

/** Raw index paths are a cell-center scribble. A honed route is much sparser. */
function routeTooBent(coords: Position[], meters: number): boolean {
  return coords.length >= Math.max(24, Math.ceil(meters / 3_500));
}

const landPolygons = new Map<H3Index, Feature[]>();

/** Polygons the route actually enters. An index hit on a shoreline bbox is not enough. */
async function landUnderRoute(
  land: FlatGeobufSource<Feature>,
  coords: Position[],
  cache: Map<H3Index, boolean>,
  deadline?: number,
  stepMeters = 800
): Promise<Feature[]> {
  const found: Feature[] = [];
  const seen = new Set<Feature>();
  for (const [lng, lat] of indexedRouteSamples(land, coords, cache, deadline, stepMeters)) {
    if (pastDeadline(deadline)) throw new RouteDeadline();
    const cell = latLngToCell(lat, lng, 8);
    let features = landPolygons.get(cell);
    if (!features) {
      if (!cellBlocked(land, cell, cache, deadline)) continue;
      const [minX, minY, maxX, maxY] = bboxForCell(cell);
      features = [];
      const envelopes = splitBBoxAntimeridian(
        cleanBBox([minX, minY, maxX, maxY]) as [number, number, number, number]
      ).map((part) => bboxToEnvelope(part));
      for (const envelope of envelopes) {
        for await (const feature of land.getFeaturesAsync(envelope as never)) {
          features.push(feature);
        }
      }
      landPolygons.set(cell, features);
    }
    for (const feature of features) {
      const geometry = feature.geometry;
      if (
        !geometry ||
        (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") ||
        seen.has(feature) ||
        !booleanPointInPolygon([lng, lat], geometry)
      ) {
        continue;
      }
      seen.add(feature);
      found.push(feature);
    }
  }
  return found;
}

/**
 * Tangent water path. Ports in the search disk are cheap. Land is not: a
 * rough path is drawn from the FlatGeobuf index (an index miss is water),
 * and polygons are fetched only inside that corridor.
 */
export async function searchWaterPathByTangent(
  feature: Feature,
  points: FlatGeobufSource<Feature>,
  land: FlatGeobufSource<Feature>,
  options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
    deadline?: number;
    /** Record hulls, tangents, and the graph walk for the viewer. Routing is unchanged. */
    trace?: boolean;
  }
): Promise<WaterPathNearestResult & { traces?: Array<TangentRouteTrace | null> }> {
  if (!feature.geometry) {
    throw new Error("searchWaterPathByTangent: feature.geometry is required");
  }
  const maxResults = Math.min(
    MAX_WATER_PATH_RESULTS,
    Math.max(1, options?.maxResults ?? DEFAULT_WATER_PATH_MAX_RESULTS)
  );
  const requestedKm = options?.maxDistanceKm ?? DEFAULT_WATER_PATH_DISTANCE_KM;
  const maxDistanceMeters = Math.min(requestedKm, MAX_DISTANCE_TO_FEATURES_KM) * 1000;

  const subjectRings = exteriorRings(feature.geometry);
  const boundary = subjectRings.flat();
  if (boundary.length === 0 && feature.geometry.type === "Point") {
    boundary.push(feature.geometry.coordinates);
  }
  if (boundary.length === 0) {
    return { features: [], exceededLimit: false, candidates: [] };
  }

  let refLng = boundary[0]![0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let prev = refLng;
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
  refLng = (minX + maxX) / 2;
  const refLat = (minY + maxY) / 2;
  const latPad = metersToDegrees(maxDistanceMeters);
  const lngPad = latPad / Math.max(0.2, Math.cos((refLat * Math.PI) / 180));
  const envelopes = envelopesForBox(
    minX - lngPad,
    minY - latPad,
    maxX + lngPad,
    maxY + latPad
  );

  const deadline = options?.deadline;
  const tracing = options?.trace === true;
  const traces = new Map<number, TangentRouteTrace>();
  const pointFeatures = await loadFeatures(points, envelopes, deadline);

  const subjectXY = subjectRings.map((ring) => ringToXY(ring, refLng, refLat));
  const sketch =
    subjectXY.length > 0
      ? subjectXY
      : [[project(boundary[0]![0], boundary[0]![1], refLng, refLat)]];

  const homePad = metersToDegrees(12_000);
  const homeLng = homePad / Math.max(0.2, Math.cos((refLat * Math.PI) / 180));
  const homeEnvelopes = envelopesForBox(
    minX - homeLng,
    minY - homePad,
    maxX + homeLng,
    maxY + homePad
  );

  type Seed = {
    id: number;
    position: Position;
    properties: Record<string, unknown>;
    geodesic: number;
    portXY: XY;
  };
  const seeds: Seed[] = [];
  for (const pointFeature of pointFeatures) {
    for (const position of pointPositions(pointFeature.geometry)) {
      const portXY = project(position[0], position[1], refLng, refLat);
      const originXY = boundaryPoint(sketch, portXY);
      const geodesic = distance(
        unproject(originXY, refLng, refLat),
        unproject(portXY, refLng, refLat),
        { units: "meters" }
      );
      if (geodesic > maxDistanceMeters) continue;
      seeds.push({
        id: featureId(pointFeature, position),
        position,
        properties: publicProperties(
          pointFeature.properties as Record<string, unknown> | null,
          options?.includedColumns
        ),
        geodesic,
        portXY,
      });
    }
  }
  seeds.sort((a, b) => a.geodesic - b.geodesic);

  const routes: Array<{
    __id: number;
    meters: number;
    properties: Record<string, unknown>;
    geojsonLine: Feature<LineString>;
    /** Catalog coordinate, before an inland port is moved into the water. */
    catalog: Position;
    /** Point the search actually routed to. */
    goal: Position;
  }> = [];
  let routed = 0;
  let exceededLimit = false;
  const indexCache = new Map<H3Index, boolean>();

  const kthMeters = () => {
    if (routes.length < maxResults) return Infinity;
    return [...routes].sort((a, b) => a.meters - b.meters)[maxResults - 1]!.meters;
  };

  const clipFor = (
    windows: Array<{ minX: number; minY: number; maxX: number; maxY: number }>
  ): XY[] => {
    let loX = Infinity;
    let loY = Infinity;
    let hiX = -Infinity;
    let hiY = -Infinity;
    for (const window of windows) {
      for (const lng of [window.minX, window.maxX]) {
        for (const lat of [window.minY, window.maxY]) {
          const point = project(lng, lat, refLng, refLat);
          if (point.x < loX) loX = point.x;
          if (point.y < loY) loY = point.y;
          if (point.x > hiX) hiX = point.x;
          if (point.y > hiY) hiY = point.y;
        }
      }
    }
    return expandBox({ minX: loX, minY: loY, maxX: hiX, maxY: hiY }, 400);
  };

  const routeOne = async (seed: Seed, span: RoughSpan, portDeadline: number) => {
    const landEnvelopes = [
      ...homeEnvelopes,
      ...envelopesForBox(span.minX, span.minY, span.maxX, span.maxY),
    ];
    const landFeatures = await loadFeatures(land, landEnvelopes, portDeadline);
    const scored: Array<{ ring: Position[]; gap: number }> = [];
    for (const landFeature of landFeatures) {
      for (const ring of exteriorRings(landFeature.geometry)) {
        const gap = ringGap(ring, span.path);
        if (gap > SHORE_KEEP_METERS) continue;
        scored.push({ ring, gap });
      }
    }
    scored.sort((a, b) => a.gap - b.gap);
    const portScale = Math.max(0.2, Math.cos((seed.position[1] * Math.PI) / 180));
    const besidePort = (ring: Position[]) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [lng, lat] of ring) {
        if (lng < minX) minX = lng;
        if (lng > maxX) maxX = lng;
        if (lat < minY) minY = lat;
        if (lat > maxY) maxY = lat;
      }
      const lng = Math.max(minX, Math.min(seed.position[0], maxX));
      const lat = Math.max(minY, Math.min(seed.position[1], maxY));
      const dx = (lng - seed.position[0]) * METERS_PER_DEG_LAT * portScale;
      const dy = (lat - seed.position[1]) * METERS_PER_DEG_LAT;
      return dx * dx + dy * dy <= 4_000 * 4_000;
    };
    const kept = new Set<Position[]>();
    for (const item of scored) {
      if (kept.size >= MAX_SHORE_RINGS && !besidePort(item.ring)) continue;
      kept.add(item.ring);
    }
    const landRings = [...kept];
    const landXY = landRings.map((ring) => ringToXY(ring, refLng, refLat));
    const clip = clipFor(landEnvelopes);
    const scene = buildScene(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      landXY,
      subjectXY,
      maxDistanceMeters,
      { deadline: portDeadline, clip }
    );
    const graph = buildNavGraph(scene);
    for (const ring of sketch) {
      for (const vertex of ring) addPocket(scene, graph, vertex);
    }
    const aim = offshoreOfScene(scene, seed.portXY, oceanPoint(landXY, seed.portXY));
    const reached = reachGoal(scene, graph, sketch, seed.portXY, aim, tracing);
    const crosses = async (line: Position[]) => {
      const fine = await landUnderRoute(
        land,
        line,
        indexCache,
        portDeadline,
        LAND_SAMPLE_METERS
      );
      if (fine.length > 0) return fine;
      // A second phase. An island narrower than the sample step can sit
      // between the first set of points and still be drawn across.
      return landUnderRoute(land, line, indexCache, portDeadline, 200);
    };
    const goal = reached.goal;
    const raw = reached.path;
    const record = reached.record;
    let pictured = { scene, graph, record, goal };
    const storeTrace = () => {
      if (!tracing) return;
      traces.set(
        seed.id,
        snapshotTrace(pictured.scene, pictured.graph, pictured.record, pictured.goal, refLng, refLat)
      );
    };
    if (!raw) {
      const line = span.path;
      const meters = lineMeters(line);
      if (
        line.length < 2 ||
        meters > maxDistanceMeters ||
        meters <= 0 ||
        routeTooBent(line, meters) ||
        (await crosses(line)).length > 0
      ) {
        return;
      }
      const previous = routes.find((hit) => hit.__id === seed.id);
      if (previous && previous.meters <= meters) return;
      if (previous) routes.splice(routes.indexOf(previous), 1);
      storeTrace();
      routes.push({
        __id: seed.id,
        meters,
        properties: seed.properties,
        geojsonLine: lineFeature(line),
        catalog: seed.position,
        goal: unproject(pictured.goal, refLng, refLat),
      });
      routes.sort((a, b) => a.meters - b.meters);
      return;
    }
    scene.origin = raw[0]!;
    scene.originOnLand = landContains(scene, raw[0]!);
    scene.port = raw[raw.length - 1]!;
    const thinned = thin(scene, dedupe(raw));
    const chosen = pathHits(scene, thinned)
      ? pathHits(scene, raw)
        ? null
        : raw
      : thinned;
    if (!chosen) return;
    const finished = repairHarbor(scene, chosen);
    let coords = toLngLat(finished, refLng, refLat, seed.position);
    const blocking = await crosses(coords);
    if (coords.length < 2 || blocking.length > 0) {
      const extra: XY[][] = [];
      for (const feature of blocking) {
        for (const ring of exteriorRings(feature.geometry)) {
          extra.push(ringToXY(ring, refLng, refLat));
        }
      }
      if (extra.length > 0) {
        const scene2 = buildScene(
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          [...landXY, ...extra],
          subjectXY,
          maxDistanceMeters,
          { deadline: portDeadline, clip: null }
        );
        const graph2 = buildNavGraph(scene2);
        for (const ring of sketch) {
          for (const vertex of ring) addPocket(scene2, graph2, vertex);
        }
        const aim2 = offshoreOfScene(
          scene2,
          seed.portXY,
          oceanPoint([...landXY, ...extra], seed.portXY)
        );
        const reached2 = reachGoal(scene2, graph2, sketch, seed.portXY, aim2, tracing);
        const goal2 = reached2.goal;
        const raw2 = reached2.path;
        const record2 = reached2.record;
        if (raw2) {
          scene2.origin = raw2[0]!;
          scene2.originOnLand = landContains(scene2, raw2[0]!);
          scene2.port = raw2[raw2.length - 1]!;
          const thinned2 = thin(scene2, dedupe(raw2));
          const chosen2 = pathHits(scene2, thinned2)
            ? pathHits(scene2, raw2)
              ? null
              : raw2
            : thinned2;
          if (chosen2) {
            const again = toLngLat(
              repairHarbor(scene2, chosen2),
              refLng,
              refLat,
              seed.position
            );
            if (again.length >= 2 && (await crosses(again)).length === 0) {
              coords = again;
              pictured = { scene: scene2, graph: graph2, record: record2, goal: goal2 };
            }
          }
        }
      }
      if (coords.length < 2 || (await crosses(coords)).length > 0) {
        const smoothed = toLngLat(
          thin(
            scene,
            span.path.map((point) => project(point[0], point[1], refLng, refLat))
          ),
          refLng,
          refLat,
          seed.position
        );
        const smoothedMeters = lineMeters(smoothed);
        if (
          (await crosses(smoothed)).length === 0 &&
          !routeTooBent(smoothed, smoothedMeters)
        ) {
          coords = smoothed;
        } else if (
          (await crosses(span.path)).length === 0 &&
          !routeTooBent(span.path, lineMeters(span.path))
        ) {
          coords = span.path;
        }
      }
    }
    if (coords.length < 2 || (await crosses(coords)).length > 0) return;
    let meters = 0;
    for (let i = 1; i < coords.length; i++) {
      meters += distance(coords[i - 1]!, coords[i]!, { units: "meters" });
    }
    if (meters > maxDistanceMeters || meters <= 0 || routeTooBent(coords, meters)) return;
    const previous = routes.find((hit) => hit.__id === seed.id);
    if (previous && previous.meters <= meters) return;
    if (previous) routes.splice(routes.indexOf(previous), 1);
    storeTrace();
    routes.push({
      __id: seed.id,
      meters,
      properties: seed.properties,
      geojsonLine: lineFeature(coords),
      catalog: seed.position,
      goal: unproject(pictured.goal, refLng, refLat),
    });
    routes.sort((a, b) => a.meters - b.meters);
  };

  const planned: Array<{ seed: Seed; span: RoughSpan }> = [];
  try {
    for (const seed of seeds) {
      if (pastDeadline(deadline)) throw new RouteDeadline();
      if (planned.length >= ROUGH_CAP) {
        exceededLimit = true;
        break;
      }
      const origin = unproject(boundaryPoint(sketch, seed.portXY), refLng, refLat);
      planned.push({
        seed,
        span: roughCorridor(
          land,
          origin,
          seed.position,
          maxDistanceMeters,
          indexCache,
          deadline
        ),
      });
    }
  } catch (error) {
    if (!(error instanceof RouteDeadline)) throw error;
    exceededLimit = true;
  }
  planned.sort((a, b) => a.span.meters - b.span.meters);
  try {
    for (const item of planned) {
      if (pastDeadline(deadline)) throw new RouteDeadline();
      if (routes.length >= maxResults && item.seed.geodesic >= kthMeters()) continue;
      const bestMeters = routes[0]?.meters;
      if (
        bestMeters != null &&
        item.seed.geodesic > bestMeters * 1.8 &&
        item.seed.geodesic > bestMeters + 40_000
      ) {
        continue;
      }
      if (routed >= ROUTE_CAP) {
        exceededLimit = true;
        break;
      }
      routed++;
      const portDeadline = Math.min(
        deadline ?? Number.POSITIVE_INFINITY,
        Date.now() + PORT_BUDGET_MS
      );
      try {
        await routeOne(item.seed, item.span, portDeadline);
      } catch (error) {
        if (!(error instanceof RouteDeadline)) throw error;
        if (pastDeadline(deadline)) throw error;
      }
    }
  } catch (error) {
    if (!(error instanceof RouteDeadline)) throw error;
    exceededLimit = true;
  }

  const chosen = routes.slice(0, maxResults);
  const routedMeters = new Map(routes.map((route) => [route.__id, route.meters]));
  return {
    features: chosen,
    exceededLimit: exceededLimit || routes.length > maxResults,
    candidates: seeds.map((seed) => {
      const meters = routedMeters.get(seed.id);
      return {
        __id: seed.id,
        position: seed.position,
        properties: seed.properties,
        geodesicMeters: seed.geodesic,
        ...(meters != null ? { meters } : {}),
      };
    }),
    ...(tracing
      ? { traces: chosen.map((route) => traces.get(route.__id) ?? null) }
      : {}),
  };
}
