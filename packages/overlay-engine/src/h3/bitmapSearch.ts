/**
 * Client-side ocean-bitmap search, the method used by
 * https://github.com/arcnautical/maritime-routing
 *
 * Cells are classified from the land archive as the search reaches them, so a
 * fine grid does not read the whole window. Land and mixed are walls. A* walks
 * eight neighbors. A diagonal is open only when both cells beside it are
 * water, so the segment cannot clip a land or mixed corner. Edge length
 * follows latitude, and the heuristic is the great-circle distance to the
 * nearest remaining port cell. After a port is reached, the cell chain is
 * string-pulled: a bend is dropped when every cell the straight segment
 * touches is water, however far the grid path bowed. An offshore 8-connected
 * elbow may slide toward the chord only while both new legs stay water.
 *
 * A polygon or line does not start at its centroid. Every water cell the
 * boundary crosses is a departure with cost zero, so each port leaves from the
 * boundary cell that minimizes the water path. The drawn string begins at the
 * point on that boundary, inside the chosen cell, closest to the next bend.
 *
 * Land polygons are split at ±180 before they are written into the resolution-9
 * archive, and the cells on that cut are left out, so they read as water. A
 * bitmap cell on the cut stays water only when a short walk east and west,
 * still in that same archive, fails to find land on both sides. Land on both
 * sides is the missing strip, and the cell becomes a wall.
 *
 * A port is not the nearest water cell. That cell may be a lake, or mixed
 * cells may stand between the point and the sea. Water connected to the
 * departure is the ocean. Each port may cross a few kilometers of land, and a
 * longer stretch of mixed cells, to an ocean cell. Mixed distance counts more
 * than water, so the walk stays in a channel, but a nearer mouth still beats
 * a thinner gap at the far end of a sound. Water along the way, including a
 * sealed inlet, spends neither budget. A cell already claimed by another port
 * yields the neighboring ocean cell, so the next port stays in that entrance.
 * The search itself stays on ocean water. The crossing is appended after the
 * string pull, so the line reaches the point.
 *
 * The walk is recorded so it can be replayed, or timed cold with nothing drawn.
 */
import { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { latLngToCell } from "h3-js";
import { LandOccupancy, LandState } from "@seasketch/h3-land/client";
import { createSource, FlatGeobufSource } from "fgb-source";
import {
  findVectorExit,
  INLAND_WATER,
  LandPolygons,
  VectorExitDebug,
  VectorExitStats,
} from "./vectorExit";

export const LAND_POLYGONS_URL = "https://uploads.seasketch.org/land-big-2.fgb";

/**
 * Land polygons from the OSM land FlatGeobuf, opened on first use. Boxes
 * may sit outside ±180; they are wrapped and split at the antimeridian.
 */
/** Land polygons from a source the caller already opened. */
export function landPolygonsFromSource(
  land: FlatGeobufSource<Feature<Polygon | MultiPolygon>>,
): LandPolygons {
  return {
    async fetch(minLng, minLat, maxLng, maxLat) {
      const west = wrapLng(minLng);
      const east = wrapLng(maxLng);
      const boxes =
        maxLng - minLng >= 360
          ? [[-180, 180]]
          : west <= east
            ? [[west, east]]
            : [
                [west, 180],
                [-180, east],
              ];
      const out: Array<Feature<Polygon | MultiPolygon>> = [];
      for (const [minX, maxX] of boxes) {
        for await (const feature of land.getFeaturesAsync({
          minX: minX!,
          minY: minLat,
          maxX: maxX!,
          maxY: maxLat,
        } as never)) {
          out.push(feature);
        }
      }
      return out;
    },
  };
}

export function landPolygonsFrom(url = LAND_POLYGONS_URL): LandPolygons {
  let source: Promise<
    FlatGeobufSource<Feature<Polygon | MultiPolygon>>
  > | null = null;
  const open = () =>
    (source ??= createSource<Feature<Polygon | MultiPolygon>>(url, {
      pageSize: "1MB",
      maxCacheSize: "256MB",
    }));
  return {
    async warm() {
      await open();
    },
    async fetch(minLng, minLat, maxLng, maxLat) {
      const land = await open();
      const west = wrapLng(minLng);
      const east = wrapLng(maxLng);
      const boxes =
        maxLng - minLng >= 360
          ? [[-180, 180]]
          : west <= east
            ? [[west, east]]
            : [
                [west, 180],
                [-180, east],
              ];
      const out: Array<Feature<Polygon | MultiPolygon>> = [];
      for (const [minX, maxX] of boxes) {
        for await (const feature of land.getFeaturesAsync({
          minX: minX!,
          minY: minLat,
          maxX: maxX!,
          maxY: maxLat,
        } as never)) {
          out.push(feature);
        }
      }
      return out;
    },
  };
}

const ARCHIVES: Record<number, string> = {
  8: "https://tiles.seasketch.org/h3-land/v1/land-res8.h3ld",
  9: "https://tiles.seasketch.org/h3-land/v1/land-res9.h3ld",
};
const EARTH_RADIUS = 6371008.8;
const RAD = Math.PI / 180;
const METERS_PER_DEGREE = 111_320;
const UNKNOWN = 0;
const LAND = 1;
const MIXED = 2;
const INLAND = 3;
const WATER = 4;
/**
 * How close a bitmap cell must sit to ±180 before the cut is checked, and how
 * far along that parallel the check walks. The unclaimed strip is about 2 km
 * wide where a coast crosses the antimeridian. Step is one resolution-9 cell.
 */
const SEAM_REACH = 0.015;
const SEAM_BRIDGE = 0.024;
const SEAM_STEP = 0.002;

export function kindName(
  kind: number,
): "land" | "mixed" | "inland" | "water" | null {
  if (kind === LAND) return "land";
  if (kind === MIXED) return "mixed";
  if (kind === INLAND) return "inland";
  if (kind === WATER) return "water";
  return null;
}
/** How far a start may sit from the nearest water cell. */
const SNAP_METERS = 30_000;
/**
 * Land between a port and ocean water. Short of a peninsula.
 * Mixed cells get a wider budget: a narrow mouth is mixed for its whole
 * length, and that length is not a land crossing.
 */
const SHORE_METERS = 3_000;
const MIXED_SHORE_METERS = 8_000;
/**
 * A port the shore walk cannot reach is routed out over the land polygons
 * (see vectorExit.ts). The raster is this fine and reaches this far from
 * the port. One meter of land costs `EXIT_LAND_COST` meters of water, so a
 * channel is followed to the sea and land is crossed only when the polygons
 * leave no other way.
 */
const EXIT_STEP_METERS = 80;
const EXIT_REACH_METERS = 50_000;
const EXIT_LAND_COST = 80;
const EXIT_MAX_LAND_METERS = 20_000;
/** Off a dock or a town lot into polygon water. After that the water-first walk stays wet. */
const EXIT_SPLASH_METERS = 2_500;
/** About 1,300 km² of raster, a fifth of a second, before a port is given up. */
const EXIT_MAX_EXPANSIONS = 200_000;
/** Exits in flight at once. Their land fetches overlap; bitmap reads are serialized. */
const EXIT_CONCURRENCY = 4;
/**
 * A mixed meter counts as this many meters of water when the shore walk picks
 * a path. High enough that the walk stays in a channel instead of cutting a
 * point, and low enough that the near entrance still beats a long trip to a
 * thinner gap.
 */
const MIXED_STEP_WEIGHT = 4;
const CLASSIFY_PATCH = 16;
const YIELD_EVERY = 2_048;
export const RANK_COLOR = ["#7c3aed", "#db2777", "#0891b2", "#64748b"];
const DIRS: Array<[number, number, boolean]> = [
  [1, 0, false],
  [-1, 0, false],
  [0, 1, false],
  [0, -1, false],
  [1, 1, true],
  [1, -1, true],
  [-1, 1, true],
  [-1, -1, true],
];

export type Port = {
  name: string;
  country: string;
  lng: number;
  lat: number;
  /** Stable feature id, when the caller has one. The viewer omits it. */
  id?: number;
  properties?: Record<string, unknown>;
};

type RankedPort = Port & { geodesic: number; lng: number; lat: number };
/**
 * `approach` runs from the center of the goal cell to the catalog point.
 * `tail` is its length. A port on its own ocean cell has a two-point approach.
 */
type Goal = RankedPort & { approach: Position[]; tail: number };

/** One bitmap cell the exit asked about: flood water or not. */
export type ProbeDecision = { position: Position; ok: boolean };

/** How each port in the goal pool got its target cell. */
export type ExitReport = {
  port: string;
  lng: number;
  lat: number;
  /**
   * `open`: the port sits on flood water. `vector`: routed out over the land
   * polygons. `shore`: the budgeted bitmap walk. `none`: nothing worked.
   */
  method: "open" | "vector" | "shore" | "none";
  /** False when the port ended with no target. */
  found: boolean;
  /** The walk ran twice because a port in flight at the same time took its cell. */
  retried?: boolean;
  /** `water` followed polygon water; `land` crossed filled land. */
  phase?: "water" | "land" | "none";
  landMeters: number;
  waterMeters: number;
  ms: number;
  stats: VectorExitStats | null;
  probes: ProbeDecision[];
  /** Set on traced runs for vector exits. */
  debug: VectorExitDebug | null;
};

export type Node = {
  index: number;
  g: number;
  h: number;
  parent: number;
  expanded: number;
};

type Step = { node: number; discovered: number[] };

export type Route = {
  rank: number;
  port: Port;
  pathMeters: number;
  rawMeters: number;
  raw: Position[];
  smoothed: Position[];
  rawVerts: number;
  smoothVerts: number;
  step: number;
};

type Stop = "found" | "exhausted" | "distance" | "expansions" | "cancelled";

export type SearchOptions = {
  degrees: number;
  margin: number;
  maxMeters: number;
  maxExpansions: number;
  maxGoals: number;
  maxResults: number;
  /**
   * Outer rings of a polygon, or the parts of a line. When set, every route
   * leaves the boundary instead of `origin`. A point start omits this.
   */
  rings?: Position[][];
  /** Land polygons for ports the shore walk cannot reach. Without it those ports are skipped. */
  landPolygons?: LandPolygons;
  /** Record the grid walk, the raw centerline, and exit rasters. Off for the worker. */
  trace?: boolean;
  cancelled: () => boolean;
  onProgress?: (text: string) => void;
};

export type Grid = {
  originLng: number;
  originLat: number;
  degrees: number;
  cols: number;
  rows: number;
  /** 0 ocean, 1 land, 2 mixed, 3 inland water. */
  kinds: Uint8Array;
};

export type SearchResult = {
  grid: Grid;
  nodes: Node[];
  steps: Step[];
  routes: Route[];
  goals: Array<{
    lng: number;
    lat: number;
    name: string;
    reached: boolean;
    /** Center of the ocean cell the search aims at, or null if this port was not given one. */
    target: Position | null;
    /** Shore crossing from that ocean cell to the catalog point. */
    approach: Position[] | null;
  }>;
  start: Position;
  /** Water cells seeded at cost zero. One for a point start. */
  starts: number;
  expansions: number;
  classified: number;
  uniqueCells: number;
  classifyMs: number;
  /** Ocean label plus the walk from each port. Includes cells read for that. */
  shoreMs: number;
  /** How every port in the goal pool got its target, and the time the pool took. Part of shoreMs. */
  exits: ExitReport[];
  exitMs: number;
  searchMs: number;
  smoothMs: number;
  /** Water cells connected to the departure. */
  reachable: number;
  requests: number;
  bytes: number;
  stop: Stop;
  land: number;
  mixed: number;
  inland: number;
  ocean: number;
};

class MinHeap {
  private ids: number[] = [];
  private fs: number[] = [];
  private gs: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, f: number, g: number): void {
    this.ids.push(id);
    this.fs.push(f);
    this.gs.push(g);
    this.up(this.ids.length - 1);
  }

  pop(): { id: number; f: number; g: number } | null {
    if (this.ids.length === 0) return null;
    const out = { id: this.ids[0]!, f: this.fs[0]!, g: this.gs[0]! };
    const last = this.ids.length - 1;
    if (last > 0) {
      this.ids[0] = this.ids[last]!;
      this.fs[0] = this.fs[last]!;
      this.gs[0] = this.gs[last]!;
    }
    this.ids.pop();
    this.fs.pop();
    this.gs.pop();
    if (this.ids.length > 0) this.down(0);
    return out;
  }

  private better(i: number, j: number): boolean {
    const df = this.fs[i]! - this.fs[j]!;
    if (Math.abs(df) > 0.001) return df < 0;
    return this.gs[i]! < this.gs[j]!;
  }

  private up(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.better(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private down(i: number): void {
    const n = this.ids.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.better(left, smallest)) smallest = left;
      if (right < n && this.better(right, smallest)) smallest = right;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b]!, this.ids[a]!];
    [this.fs[a], this.fs[b]] = [this.fs[b]!, this.fs[a]!];
    [this.gs[a], this.gs[b]] = [this.gs[b]!, this.gs[a]!];
  }
}

function yieldToBrowser(): Promise<void> {
  const scheduler = (
    globalThis as { scheduler?: { yield?: () => Promise<void> } }
  ).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}

export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function cutDistance(lng: number): number {
  const wrapped = wrapLng(lng);
  return 180 - Math.abs(wrapped);
}

/** Longitudes stepping west, then east, out to the far side of the cut. */
function seamSampleLngs(lng: number): number[] {
  const wrapped = wrapLng(lng);
  const samples: number[] = [];
  const steps = Math.round(SEAM_BRIDGE / SEAM_STEP);
  for (let step = 1; step <= steps; step++) {
    const delta = step * SEAM_STEP;
    samples.push(wrapLng(wrapped - delta), wrapLng(wrapped + delta));
  }
  return samples;
}

function metersBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLng = (lng2 - lng1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)));
}

function lineMeters(line: Position[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    total += metersBetween(
      line[i - 1]![1]!,
      line[i - 1]![0]!,
      line[i]![1]!,
      line[i]![0]!,
    );
  }
  return total;
}

export function km(meters: number): string {
  return (meters / 1000).toFixed(1) + " km";
}

export const WATER_PATH_RESOLUTION_DEGREES = {
  low: 0.02,
  medium: 0.01,
  high: 0.005,
} as const;

export type WaterPathResolution = keyof typeof WATER_PATH_RESOLUTION_DEGREES;

export function sampleResolution(degrees: number): number {
  return degrees <= 0.02 ? 9 : 8;
}

export function archiveFor(resolution: number): string {
  return ARCHIVES[resolution]!;
}

export function centroid(feature: Feature): Position {
  const geometry = feature.geometry;
  if (!geometry) throw new Error("sketch has no geometry");
  if (geometry.type === "Point")
    return [geometry.coordinates[0]!, geometry.coordinates[1]!];
  const ring =
    geometry.type === "Polygon"
      ? (geometry.coordinates[0] ?? [])
      : geometry.type === "MultiPolygon"
        ? (geometry.coordinates[0]?.[0] ?? [])
        : geometry.type === "LineString"
          ? geometry.coordinates
          : [];
  if (ring.length === 0) throw new Error("sketch has no coordinates");
  let prev = ring[0]![0]!;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of ring) {
    let x = lng!;
    while (x - prev > 180) x -= 360;
    while (x - prev < -180) x += 360;
    prev = x;
    sumLng += x;
    sumLat += lat!;
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

/** Outer rings of a polygon, or the parts of a line. Empty for a point. */
export function geometryRings(feature: Feature): Position[][] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0];
    return ring && ring.length > 0 ? [ring] : [];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon) => polygon[0])
      .filter((ring): ring is Position[] => !!ring && ring.length > 0);
  }
  if (geometry.type === "LineString")
    return geometry.coordinates.length > 0 ? [geometry.coordinates] : [];
  if (geometry.type === "MultiLineString")
    return geometry.coordinates.filter((line) => line.length > 0);
  return [];
}

function unwrapLng(lng: number, refLng: number): number {
  let x = lng;
  while (x - refLng > 180) x -= 360;
  while (refLng - x > 180) x += 360;
  return x;
}

type XY = { x: number; y: number };

function project(lng: number, lat: number, refLng: number, refLat: number): XY {
  const cos = Math.max(0.2, Math.cos(refLat * RAD));
  return {
    x: (unwrapLng(lng, refLng) - refLng) * METERS_PER_DEGREE * cos,
    y: (lat - refLat) * METERS_PER_DEGREE,
  };
}

function unproject(point: XY, refLng: number, refLat: number): Position {
  const cos = Math.max(0.2, Math.cos(refLat * RAD));
  return [
    refLng + point.x / (METERS_PER_DEGREE * cos),
    refLat + point.y / METERS_PER_DEGREE,
  ];
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

/** Closest point on the subject boundary to `target`, in the local frame of `ref`. */
function closestOnRings(
  rings: Position[][],
  target: Position,
  ref: Position,
): Position {
  const at = project(target[0]!, target[1]!, ref[0]!, ref[1]!);
  let best: XY | null = null;
  let bestDist = Infinity;
  for (const ring of rings) {
    if (ring.length === 0) continue;
    if (ring.length === 1) {
      const point = project(ring[0]![0]!, ring[0]![1]!, ref[0]!, ref[1]!);
      const span = Math.hypot(point.x - at.x, point.y - at.y);
      if (span < bestDist) {
        bestDist = span;
        best = point;
      }
      continue;
    }
    for (let i = 0; i < ring.length - 1; i++) {
      const start = project(ring[i]![0]!, ring[i]![1]!, ref[0]!, ref[1]!);
      const end = project(ring[i + 1]![0]!, ring[i + 1]![1]!, ref[0]!, ref[1]!);
      const point = closestOnSegment(start, end, at);
      const span = Math.hypot(point.x - at.x, point.y - at.y);
      if (span < bestDist) {
        bestDist = span;
        best = point;
      }
    }
  }
  return best ? unproject(best, ref[0]!, ref[1]!) : target;
}

function inCell(point: Position, cell: Position, degrees: number): boolean {
  const dlng = Math.abs(unwrapLng(point[0]!, cell[0]!) - cell[0]!);
  return (
    dlng <= degrees * 0.51 && Math.abs(point[1]! - cell[1]!) <= degrees * 0.51
  );
}

function intoFrame(lng: number, originLng: number, span: number): number {
  let x = lng;
  while (x < originLng - 1) x += 360;
  while (x > originLng + span + 1) x -= 360;
  return x;
}

function makeWindow(
  lng: number,
  lat: number,
  maxMeters: number,
  degrees: number,
  cover: Position[] = [],
): Grid {
  const latPad = maxMeters / METERS_PER_DEGREE;
  const lonPad = latPad / Math.max(0.2, Math.cos(lat * RAD));
  let south = lat - latPad;
  let north = lat + latPad;
  let west = lng - lonPad;
  let east = lng + lonPad;
  for (const [rawLng, rawLat] of cover) {
    const x = unwrapLng(rawLng!, lng);
    west = Math.min(west, x);
    east = Math.max(east, x);
    south = Math.min(south, rawLat!);
    north = Math.max(north, rawLat!);
  }
  south = Math.max(-80, south);
  north = Math.min(80, north);
  const originLat = Math.floor(south / degrees) * degrees;
  const originLng = Math.floor(west / degrees) * degrees;
  const rows = Math.max(2, Math.ceil((north - originLat) / degrees));
  const cols = Math.max(2, Math.ceil((east - originLng) / degrees));
  return {
    originLng,
    originLat,
    degrees,
    cols,
    rows,
    kinds: new Uint8Array(cols * rows),
  };
}

export async function searchBitmap(
  land: LandOccupancy,
  origin: Position,
  ports: Port[],
  options: SearchOptions,
): Promise<SearchResult> {
  const sampleRes = sampleResolution(options.degrees);
  const rings = options.rings?.filter((ring) => ring.length > 0) ?? [];
  const cover = rings.flat();
  const grid = makeWindow(
    origin[0],
    origin[1],
    options.maxMeters,
    options.degrees,
    cover,
  );
  const { cols, rows, degrees, originLng, originLat } = grid;
  const count = cols * rows;
  const span = cols * degrees;

  const locate = (lng: number, lat: number): number => {
    const ix = Math.floor((lng - originLng) / degrees);
    const iy = Math.floor((lat - originLat) / degrees);
    if (ix < 0 || iy < 0 || ix >= cols || iy >= rows) return -1;
    return iy * cols + ix;
  };
  const cellLng = (index: number): number => {
    const ix = index % cols;
    return originLng + (ix + 0.5) * degrees;
  };
  const cellLat = (index: number): number => {
    const iy = (index - (index % cols)) / cols;
    return originLat + (iy + 0.5) * degrees;
  };
  const centerOf = (index: number): Position => [
    cellLng(index),
    cellLat(index),
  ];
  const edgeMeters = (iy: number, ny: number, diagonal: boolean): number => {
    const avgLat = originLat + ((iy + ny) / 2 + 0.5) * degrees;
    const latM = degrees * METERS_PER_DEGREE;
    const lonM = latM * Math.cos(avgLat * RAD);
    return diagonal ? Math.hypot(latM, lonM) : iy === ny ? lonM : latM;
  };
  // The segment between two cell centers passes through the shared corner.
  // Both side cells have to be water, or the step cuts the barrier.
  const cornerOpen = (
    ix: number,
    iy: number,
    dx: number,
    dy: number,
  ): boolean => {
    const ax = ix + dx;
    const ay = iy;
    const bx = ix;
    const by = iy + dy;
    if (ax < 0 || ay < 0 || ax >= cols || ay >= rows) return false;
    if (bx < 0 || by < 0 || bx >= cols || by >= rows) return false;
    return (
      grid.kinds[ay * cols + ax] === WATER &&
      grid.kinds[by * cols + bx] === WATER
    );
  };
  const ensureCorner = async (
    ix: number,
    iy: number,
    dx: number,
    dy: number,
  ): Promise<boolean> => {
    const unknown: number[] = [];
    for (const [sx, sy] of [
      [ix + dx, iy],
      [ix, iy + dy],
    ] as const) {
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) return false;
      const side = sy * cols + sx;
      if (grid.kinds[side] === UNKNOWN) unknown.push(side);
    }
    if (unknown.length > 0) await classifyList(unknown, false);
    return cornerOpen(ix, iy, dx, dy);
  };
  /** Every cell the segment between two centers touches, including a grazed corner. */
  const touchedCells = (a: number, b: number): number[] => {
    const ax = a % cols;
    const ay = (a - ax) / cols;
    const bx = b % cols;
    const by = (b - bx) / cols;
    const dx = bx - ax;
    const dy = by - ay;
    const nx = Math.abs(dx);
    const ny = Math.abs(dy);
    const signX = Math.sign(dx);
    const signY = Math.sign(dy);
    let x = ax;
    let y = ay;
    const cells = [a];
    let ix = 0;
    let iy = 0;
    while (ix < nx || iy < ny) {
      const crossX = (2 * ix + 1) * ny;
      const crossY = (2 * iy + 1) * nx;
      if (crossX < crossY) {
        x += signX;
        ix++;
      } else if (crossY < crossX) {
        y += signY;
        iy++;
      } else {
        cells.push(y * cols + (x + signX));
        cells.push((y + signY) * cols + x);
        x += signX;
        y += signY;
        ix++;
        iy++;
      }
      cells.push(y * cols + x);
    }
    return cells;
  };

  let landCount = 0;
  let mixedCount = 0;
  let waterCount = 0;
  let classifiedCount = 0;
  let uniqueCells = 0;
  let classifyMs = 0;
  const seenH3 = new Set<string>();

  const closeAntimeridianSeam = async (indexes: number[]): Promise<void> => {
    const holes = [
      ...new Set(
        indexes.filter(
          (index) =>
            grid.kinds[index] === WATER &&
            cutDistance(cellLng(index)) <= SEAM_REACH,
        ),
      ),
    ];
    if (holes.length === 0) return;
    const perHole: string[][] = holes.map((index) => {
      const lat = cellLat(index);
      return seamSampleLngs(cellLng(index)).map((lng) =>
        latLngToCell(lat, lng, sampleRes),
      );
    });
    const queried = [...new Set(perHole.flat())];
    for (const cell of queried) {
      if (seenH3.has(cell)) continue;
      seenH3.add(cell);
      uniqueCells++;
    }
    const states = await land.states(queried);
    const grounded = (cell: string): LandState | null => {
      const state = states.get(cell) ?? "water";
      return state === "water" ? null : state;
    };
    for (let hole = 0; hole < holes.length; hole++) {
      const cells = perHole[hole]!;
      let west: LandState | null = null;
      let east: LandState | null = null;
      for (let i = 0; i < cells.length; i += 2) {
        west = west ?? grounded(cells[i]!);
        east = east ?? grounded(cells[i + 1]!);
        if (west && east) break;
      }
      if (!west || !east) continue;
      const index = holes[hole]!;
      waterCount--;
      if (west === "land" && east === "land") {
        grid.kinds[index] = LAND;
        landCount++;
      } else {
        grid.kinds[index] = MIXED;
        mixedCount++;
      }
    }
  };

  const classifyList = async (
    indexes: number[],
    yieldAfter = true,
  ): Promise<void> => {
    const need = indexes.filter((index) => grid.kinds[index] === UNKNOWN);
    if (need.length === 0) return;
    const started = performance.now();
    const chunk = 6_000;
    for (let offset = 0; offset < need.length; offset += chunk) {
      const slice = need.slice(offset, offset + chunk);
      const cells = slice.map((index) =>
        latLngToCell(cellLat(index), wrapLng(cellLng(index)), sampleRes),
      );
      const unique: string[] = [];
      for (const cell of cells) {
        if (seenH3.has(cell)) continue;
        seenH3.add(cell);
        unique.push(cell);
        uniqueCells++;
      }
      const states =
        unique.length > 0
          ? await land.states(unique)
          : new Map<string, LandState>();
      for (let i = 0; i < slice.length; i++) {
        const index = slice[i]!;
        if (grid.kinds[index] !== UNKNOWN) continue;
        const state = states.get(cells[i]!) ?? "water";
        if (state === "land") {
          grid.kinds[index] = LAND;
          landCount++;
        } else if (state === "mixed") {
          grid.kinds[index] = MIXED;
          mixedCount++;
        } else {
          grid.kinds[index] = WATER;
          waterCount++;
        }
      }
      if (sampleRes === 9) await closeAntimeridianSeam(slice);
      classifiedCount += slice.length;
      if (yieldAfter) {
        options.onProgress?.(
          `reading ${classifiedCount.toLocaleString()} cells`,
        );
        await yieldToBrowser();
      }
      if (options.cancelled()) break;
    }
    classifyMs += performance.now() - started;
  };

  const classifyPatch = async (
    index: number,
    radius = CLASSIFY_PATCH,
    yieldAfter = true,
  ): Promise<void> => {
    if (grid.kinds[index] !== UNKNOWN) return;
    const ix = index % cols;
    const iy = (index - ix) / cols;
    const need: number[] = [];
    for (let dy = -radius; dy <= radius; dy++) {
      const ny = iy + dy;
      if (ny < 0 || ny >= rows) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = ix + dx;
        if (nx < 0 || nx >= cols) continue;
        const nIndex = ny * cols + nx;
        if (grid.kinds[nIndex] === UNKNOWN) need.push(nIndex);
      }
    }
    if (need.length === 0) return;
    await classifyList(need, yieldAfter);
  };

  const snapCells = Math.max(
    8,
    Math.ceil(SNAP_METERS / (degrees * METERS_PER_DEGREE)),
  );
  const snap = async (lng: number, lat: number): Promise<number> => {
    const ix0 = Math.floor((lng - originLng) / degrees);
    const iy0 = Math.floor((lat - originLat) / degrees);
    const queue: Array<[number, number]> = [[ix0, iy0]];
    const seen = new Set<number>();
    let head = 0;
    while (head < queue.length) {
      const [ix, iy] = queue[head++]!;
      if (ix >= 0 && iy >= 0 && ix < cols && iy < rows) {
        const index = iy * cols + ix;
        if (grid.kinds[index] === UNKNOWN) await classifyPatch(index);
        if (options.cancelled()) return -1;
        if (grid.kinds[index] === WATER) return index;
      }
      for (const [dx, dy] of DIRS) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nIndex = ny * cols + nx;
        if (seen.has(nIndex)) continue;
        if (Math.max(Math.abs(nx - ix0), Math.abs(ny - iy0)) > snapCells)
          continue;
        seen.add(nIndex);
        queue.push([nx, ny]);
      }
    }
    return -1;
  };

  // Cells the boundary crosses. Sampled at half a cell so a long edge cannot
  // skip a column. Land cells are walked out to the nearest water.
  const boundaryCells = (): number[] => {
    const indexes = new Set<number>();
    const push = (lng: number, lat: number) => {
      const index = locate(intoFrame(lng, originLng, span), lat);
      if (index >= 0) indexes.add(index);
    };
    for (const ring of rings) {
      if (ring.length === 1) {
        push(ring[0]![0]!, ring[0]![1]!);
        continue;
      }
      for (let i = 0; i < ring.length - 1; i++) {
        const aLng = ring[i]![0]!;
        let bLng = ring[i + 1]![0]!;
        while (bLng - aLng > 180) bLng -= 360;
        while (aLng - bLng > 180) bLng += 360;
        const aLat = ring[i]![1]!;
        const bLat = ring[i + 1]![1]!;
        const steps = Math.max(
          1,
          Math.ceil(
            Math.max(Math.abs(bLng - aLng), Math.abs(bLat - aLat)) /
              (degrees * 0.5),
          ),
        );
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          push(aLng + (bLng - aLng) * t, aLat + (bLat - aLat) * t);
        }
      }
    }
    return [...indexes];
  };

  const departureCells = async (): Promise<number[]> => {
    if (rings.length === 0) {
      const index = await snap(origin[0], origin[1]);
      return index < 0 ? [] : [index];
    }
    const crossed = boundaryCells();
    await classifyList(crossed);
    if (options.cancelled()) return [];
    const starts = new Set<number>();
    for (const index of crossed) {
      if (grid.kinds[index] === WATER) {
        starts.add(index);
        continue;
      }
      // A land or mixed boundary cell contributes its nearest water cell,
      // not every water cell inside the snap radius.
      const snapped = await snap(cellLng(index), cellLat(index));
      if (options.cancelled()) return [];
      if (snapped >= 0) starts.add(snapped);
    }
    return [...starts];
  };

  const startIndexes = await departureCells();
  if (options.cancelled()) {
    return emptyResult(
      grid,
      origin,
      classifyMs,
      land,
      "cancelled",
      landCount,
      mixedCount,
      0,
      waterCount,
    );
  }
  if (startIndexes.length === 0) {
    throw new Error("The start is more than 30 km from open water.");
  }

  const distanceToSubject = (lat: number, lng: number): number => {
    if (rings.length === 0)
      return metersBetween(origin[1], origin[0], lat, lng);
    const point = closestOnRings(rings, [lng, lat], origin);
    return metersBetween(point[1]!, point[0]!, lat, lng);
  };

  const framePort = (port: Port): RankedPort | null => {
    const lng = intoFrame(port.lng, originLng, span);
    const lat = port.lat;
    const geodesic = distanceToSubject(lat, lng);
    if (geodesic > options.maxMeters) return null;
    return { ...port, lng, lat, geodesic };
  };
  const ranked = ports
    .map(framePort)
    .filter((port): port is RankedPort => port != null)
    .sort((a, b) => a.geodesic - b.geodesic);

  // 0 unseen, 1 water connected to the departure, 2 a lake or sealed inlet.
  // The connection is a search toward the departure, not a fill of the sea.
  // A body that runs out of water without meeting it stays sealed.
  const mark = new Uint8Array(count);
  let reachable = 0;
  const startLat: number[] = [];
  const startLng: number[] = [];
  for (const index of startIndexes) {
    if (mark[index]) continue;
    mark[index] = 1;
    reachable++;
    startLat.push(cellLat(index));
    startLng.push(cellLng(index));
  }
  const nearestStart = (lat: number, lng: number): number => {
    let best = Infinity;
    for (let i = 0; i < startLat.length; i++) {
      const distance = metersBetween(lat, lng, startLat[i]!, startLng[i]!);
      if (distance < best) best = distance;
    }
    return best;
  };
  const joinsOcean = async (seed: number): Promise<void> => {
    if (mark[seed] !== 0) return;
    const gScore = new Map<number, number>();
    gScore.set(seed, 0);
    const heap = new MinHeap();
    heap.push(seed, nearestStart(cellLat(seed), cellLng(seed)), 0);
    const visited: number[] = [];
    let joined = false;
    while (heap.size > 0 && !joined) {
      const popped = heap.pop();
      if (!popped) break;
      const index = popped.id;
      if (mark[index] === 1) {
        joined = true;
        break;
      }
      if (mark[index] === 2) continue;
      if (popped.g > (gScore.get(index) ?? Infinity) + 0.05) continue;
      // Farther than the limit, this water does not connect. Keep it sealed so
      // the next cell does not start the walk over.
      if (popped.g > options.maxMeters) {
        mark[index] = 2;
        return;
      }
      mark[index] = 2;
      visited.push(index);
      if (visited.length % YIELD_EVERY === 0) {
        options.onProgress?.(
          `labeling ocean · ${visited.length.toLocaleString()} cells`,
        );
        await yieldToBrowser();
        if (options.cancelled()) return;
      }
      const ix = index % cols;
      const iy = (index - ix) / cols;
      const neighbors: Array<[number, number, boolean]> = [];
      for (const [dx, dy, diagonal] of DIRS) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nIndex = ny * cols + nx;
        if (mark[nIndex] === 1) {
          if (diagonal) {
            const open = await ensureCorner(ix, iy, dx, dy);
            if (options.cancelled()) return;
            if (!open) continue;
          }
          joined = true;
          break;
        }
        if (mark[nIndex] === 2) continue;
        neighbors.push([nIndex, ny, diagonal]);
        if (grid.kinds[nIndex] === UNKNOWN)
          await classifyPatch(nIndex, 8, false);
        if (options.cancelled()) return;
      }
      if (joined) break;
      for (const [nIndex, ny, diagonal] of neighbors) {
        if (mark[nIndex] === 1) {
          const nx = nIndex % cols;
          if (diagonal) {
            const open = await ensureCorner(ix, iy, nx - ix, ny - iy);
            if (options.cancelled()) return;
            if (!open) continue;
          }
          joined = true;
          break;
        }
        if (mark[nIndex] === 2 || grid.kinds[nIndex] !== WATER) continue;
        const nx = nIndex % cols;
        if (diagonal) {
          const open = await ensureCorner(ix, iy, nx - ix, ny - iy);
          if (options.cancelled()) return;
          if (!open) continue;
        }
        const nextG = popped.g + edgeMeters(iy, ny, diagonal);
        const prev = gScore.get(nIndex);
        if (prev != null && nextG >= prev - 0.05) continue;
        gScore.set(nIndex, nextG);
        heap.push(
          nIndex,
          nextG + nearestStart(cellLat(nIndex), cellLng(nIndex)),
          nextG,
        );
      }
    }
    if (!joined) return;
    for (const index of visited) {
      mark[index] = 1;
      reachable++;
    }
  };

  // Water spends neither budget. One cell is always in range, so a coarse
  // grid can still step onto the neighbor.
  const cellSpan = degrees * METERS_PER_DEGREE * Math.SQRT2 * 1.01;
  const landReach = Math.max(SHORE_METERS, cellSpan);
  const mixedReach = Math.max(MIXED_SHORE_METERS, cellSpan);
  // Any land loses to a path with none, which keeps a port on the sound side of
  // a peninsula. Among those, mixed steps are dearer than water.
  const shoreRank = (land: number): number => land * 1_000_000;
  const segmentWater = (a: number, b: number): boolean => {
    for (const index of touchedCells(a, b)) {
      if (grid.kinds[index] !== WATER) return false;
    }
    return true;
  };
  const compressShore = (shore: number[]): number[] => {
    if (shore.length <= 2) return shore;
    const out = [shore[0]!];
    let i = 0;
    while (i < shore.length - 1) {
      let best = i + 1;
      for (let j = shore.length - 1; j > i + 1; j--) {
        if (!segmentWater(shore[i]!, shore[j]!)) continue;
        best = j;
        break;
      }
      out.push(shore[best]!);
      i = best;
    }
    return out;
  };
  const shoreApproach = async (
    lng: number,
    lat: number,
    taken: (index: number) => boolean,
  ): Promise<{ index: number; shore: number[] } | null> => {
    const ix0 = Math.floor((lng - originLng) / degrees);
    const iy0 = Math.floor((lat - originLat) / degrees);
    if (ix0 < 0 || iy0 < 0 || ix0 >= cols || iy0 >= rows) return null;
    const root = iy0 * cols + ix0;
    const parent = new Map<number, number>();
    const bestRank = new Map<number, number>();
    const bestDist = new Map<number, number>();
    const landOf = new Map<number, number>();
    const mixedOf = new Map<number, number>();
    const closed = new Set<number>();
    parent.set(root, -1);
    bestRank.set(root, 0);
    bestDist.set(root, 0);
    landOf.set(root, 0);
    mixedOf.set(root, 0);
    const heap = new MinHeap();
    heap.push(root, 0, 0);
    while (heap.size > 0) {
      const popped = heap.pop();
      if (!popped) break;
      const index = popped.id;
      if (closed.has(index)) continue;
      if (Math.abs(popped.f - (bestRank.get(index) ?? Infinity)) > 1) continue;
      if (popped.g > (bestDist.get(index) ?? Infinity) + 0.05) continue;
      closed.add(index);
      // Shore so far, plus a straight line to the departure, is the shortest
      // route this cell could still produce.
      if (
        popped.g + nearestStart(cellLat(index), cellLng(index)) >
        options.maxMeters
      )
        continue;
      const land = landOf.get(index) ?? 0;
      const mixed = mixedOf.get(index) ?? 0;
      if (grid.kinds[index] === UNKNOWN) await classifyList([index], false);
      if (options.cancelled()) return null;
      if (grid.kinds[index] === WATER && mark[index] !== 2) {
        if (mark[index] === 0) await joinsOcean(index);
        if (options.cancelled()) return null;
        if (mark[index] === 1) {
          const chain = (ocean: number): number[] => {
            const shore: number[] = [];
            const guard = new Set<number>();
            let cursor = ocean;
            while (cursor >= 0 && !guard.has(cursor)) {
              guard.add(cursor);
              shore.push(cursor);
              cursor = parent.get(cursor) ?? -1;
            }
            return compressShore(shore);
          };
          if (!taken(index)) return { index, shore: chain(index) };
          // Same entrance, one cell over. Do not walk out to sea.
          const ix = index % cols;
          const iy = (index - ix) / cols;
          const around: Array<[number, number, boolean]> = [];
          const unknown: number[] = [];
          for (const [dx, dy, diagonal] of DIRS) {
            const nx = ix + dx;
            const ny = iy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const nIndex = ny * cols + nx;
            around.push([nIndex, ny, diagonal]);
            if (grid.kinds[nIndex] === UNKNOWN) unknown.push(nIndex);
          }
          if (unknown.length > 0) {
            await classifyList(unknown, false);
            if (options.cancelled()) return null;
          }
          let best = -1;
          let bestToPort = Infinity;
          for (const [nIndex, ny, diagonal] of around) {
            if (
              grid.kinds[nIndex] !== WATER ||
              mark[nIndex] !== 1 ||
              taken(nIndex)
            )
              continue;
            const nx = nIndex % cols;
            if (diagonal && !cornerOpen(ix, iy, nx - ix, ny - iy)) continue;
            const toPort = metersBetween(
              cellLat(nIndex),
              cellLng(nIndex),
              lat,
              lng,
            );
            if (toPort < bestToPort) {
              best = nIndex;
              bestToPort = toPort;
            }
          }
          if (best >= 0) {
            parent.set(best, index);
            return { index: best, shore: chain(best) };
          }
          continue;
        }
      }
      const ix = index % cols;
      const iy = (index - ix) / cols;
      const pending: Array<[number, number, boolean]> = [];
      const unknown: number[] = [];
      for (const [dx, dy, diagonal] of DIRS) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nIndex = ny * cols + nx;
        if (closed.has(nIndex)) continue;
        pending.push([nIndex, ny, diagonal]);
        if (grid.kinds[nIndex] === UNKNOWN) unknown.push(nIndex);
      }
      if (unknown.length > 0) {
        await classifyList(unknown, false);
        if (options.cancelled()) return null;
      }
      for (const [nIndex, ny, diagonal] of pending) {
        const step = edgeMeters(iy, ny, diagonal);
        const kind = grid.kinds[nIndex]!;
        if (diagonal && kind === WATER && grid.kinds[index] === WATER) {
          const nx = nIndex % cols;
          if (!cornerOpen(ix, iy, nx - ix, ny - iy)) continue;
        }
        const nextLand = land + (kind === WATER || kind === MIXED ? 0 : step);
        const nextMixed = mixed + (kind === MIXED ? step : 0);
        if (nextLand > landReach || nextMixed > mixedReach) continue;
        const nextDist =
          (bestDist.get(index) ?? 0) +
          (kind === MIXED ? step * MIXED_STEP_WEIGHT : step);
        const nextRank = shoreRank(nextLand);
        const prevRank = bestRank.get(nIndex);
        const prevDist = bestDist.get(nIndex);
        if (prevRank != null && prevDist != null) {
          if (nextRank > prevRank + 0.05) continue;
          if (nextRank >= prevRank - 0.05 && nextDist >= prevDist - 0.05)
            continue;
        }
        bestRank.set(nIndex, nextRank);
        bestDist.set(nIndex, nextDist);
        landOf.set(nIndex, nextLand);
        mixedOf.set(nIndex, nextMixed);
        parent.set(nIndex, index);
        heap.push(nIndex, nextRank, nextDist);
      }
    }
    return null;
  };

  const goals = new Map<number, Goal>();
  const targetAt = new Map<string, Position>();
  const approachAt = new Map<string, Position[]>();
  const exits: ExitReport[] = [];
  let exitMs = 0;
  let shoreMs = 0;
  const shoreStarted = performance.now();
  const classifyAtShore = classifyMs;

  /**
   * Exits run a few at a time so the land fetches overlap, but the bitmap is
   * one shared structure: every read or label of it goes through this lock.
   */
  let lockChain: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const next = lockChain.then(work, work);
    lockChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  /** Water that joins the ocean flood from the departure. Reads and labels as needed. */
  const floodWater = async (index: number): Promise<boolean> => {
    if (grid.kinds[index] === UNKNOWN) await classifyList([index], false);
    if (grid.kinds[index] !== WATER || mark[index] === 2) return false;
    if (mark[index] === 0) await joinsOcean(index);
    return mark[index] === 1;
  };

  /** A free flood-water neighbor of a cell another port already holds. */
  const freeNeighbor = async (
    index: number,
    lng: number,
    lat: number,
  ): Promise<number> => {
    const ix = index % cols;
    const iy = (index - ix) / cols;
    let best = -1;
    let bestToPort = Infinity;
    for (const [dx, dy, diagonal] of DIRS) {
      const nx = ix + dx;
      const ny = iy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nIndex = ny * cols + nx;
      if (goals.has(nIndex) || !(await floodWater(nIndex))) continue;
      if (diagonal && !cornerOpen(ix, iy, dx, dy)) continue;
      const toPort = metersBetween(cellLat(nIndex), cellLng(nIndex), lat, lng);
      if (toPort < bestToPort) {
        best = nIndex;
        bestToPort = toPort;
      }
    }
    return best;
  };

  /**
   * A bitmap cell may end a vector approach when it is flood water that no
   * committed port holds. Answers are kept per bitmap cell and returned
   * synchronously once known, since the fine raster asks about one bitmap
   * cell many times. Ports in flight at the same time cannot see each other,
   * so a conflict can still surface at commit; the walk is then run again.
   */
  const exitProbe = () => {
    const answers = new Map<number, number>();
    const decisions: ProbeDecision[] = [];
    const cached = (index: number, answer: number): number => {
      if (answer >= 0 && goals.has(answer)) return -1;
      return answer;
    };
    const probe = (lng: number, lat: number): number | Promise<number> => {
      const index = locate(lng, lat);
      if (index < 0) return -1;
      const known = answers.get(index);
      if (known !== undefined) return cached(index, known);
      return exclusive(async () => {
        const again = answers.get(index);
        if (again !== undefined) return cached(index, again);
        const ok = await floodWater(index);
        let answer = -1;
        if (ok && !goals.has(index)) answer = index;
        else if (
          !ok &&
          (grid.kinds[index] === WATER || grid.kinds[index] === INLAND)
        ) {
          answer = INLAND_WATER;
        }
        answers.set(index, answer);
        if (options.trace) decisions.push({ position: centerOf(index), ok });
        return cached(index, answer);
      });
    };
    return { probe, decisions };
  };

  type Prepared = {
    port: RankedPort;
    goalIndex: number;
    approach: Position[];
    report: ExitReport;
  };

  /** Everything about one port except which cell it finally gets. */
  const prepare = async (port: RankedPort): Promise<Prepared> => {
    const started = performance.now();
    const report: ExitReport = {
      port: port.name,
      lng: port.lng,
      lat: port.lat,
      method: "none",
      found: false,
      landMeters: 0,
      waterMeters: 0,
      ms: 0,
      stats: null,
      probes: [],
      debug: null,
    };
    const own = locate(port.lng, port.lat);
    // A port on flood water needs no approach at all.
    if (
      own >= 0 &&
      !goals.has(own) &&
      (await exclusive(() => floodWater(own)))
    ) {
      report.method = "open";
      report.found = true;
      report.ms = performance.now() - started;
      return {
        port,
        goalIndex: own,
        approach: [centerOf(own), [port.lng, port.lat]],
        report,
      };
    }
    if (options.landPolygons) {
      const { probe, decisions } = exitProbe();
      const exit = await findVectorExit(port, options.landPolygons, probe, {
        reachMeters: Math.min(EXIT_REACH_METERS, options.maxMeters),
        stepMeters: EXIT_STEP_METERS,
        landCost: EXIT_LAND_COST,
        maxLandMeters: EXIT_MAX_LAND_METERS,
        splashMeters: EXIT_SPLASH_METERS,
        maxExpansions: EXIT_MAX_EXPANSIONS,
        debug: options.trace,
        cancelled: options.cancelled,
        onProgress: options.onProgress,
      });
      report.probes = decisions;
      if (exit) {
        report.method = "vector";
        report.stats = exit.stats;
        report.debug = exit.debug;
        report.phase = exit.phase;
        report.landMeters = exit.landMeters;
        report.waterMeters = exit.waterMeters;
        if (exit.goal >= 0) {
          report.found = true;
          report.ms = performance.now() - started;
          // The accepted water cell is on the approach; the goal cell center leads it.
          return {
            port,
            goalIndex: exit.goal,
            approach: [centerOf(exit.goal), ...exit.approach],
            report,
          };
        }
      }
    }
    // Last resort: the budgeted walk over the bitmap itself.
    const found = await exclusive(() =>
      shoreApproach(port.lng, port.lat, (index) => goals.has(index)),
    );
    if (found) {
      report.method = "shore";
      report.found = true;
      report.ms = performance.now() - started;
      return {
        port,
        goalIndex: found.index,
        approach: [...found.shore.map(centerOf), [port.lng, port.lat]],
        report,
      };
    }
    report.ms = performance.now() - started;
    return { port, goalIndex: -1, approach: [], report };
  };

  /**
   * Give the port its cell. When a port committed meanwhile holds it, take a
   * free neighbor in the same water, or walk again now that every earlier
   * port is settled.
   */
  const commit = async (prepared: Prepared): Promise<void> => {
    const { port } = prepared;
    let { goalIndex, approach, report } = prepared;
    // The pool filled while this one was in flight.
    if (goals.size >= options.maxGoals) return;
    if (goalIndex >= 0 && goals.has(goalIndex)) {
      const other = await exclusive(() =>
        freeNeighbor(goalIndex, port.lng, port.lat),
      );
      if (other >= 0) {
        approach = [centerOf(other), ...approach.slice(1)];
        goalIndex = other;
      } else {
        const retried = await prepare(port);
        retried.report.ms += report.ms;
        retried.report.retried = true;
        report = retried.report;
        goalIndex = goals.has(retried.goalIndex) ? -1 : retried.goalIndex;
        approach = retried.approach;
      }
    }
    if (goalIndex >= 0) {
      const tail = lineMeters(approach);
      if (tail > options.maxMeters) goalIndex = -1;
      else goals.set(goalIndex, { ...port, approach, tail });
    }
    report.found = goalIndex >= 0;
    exits.push(report);
    if (goalIndex < 0) return;
    const key = port.name + port.lng;
    targetAt.set(key, centerOf(goalIndex));
    approachAt.set(key, approach);
  };

  if (ranked.length > 0 && options.maxGoals > 0) {
    // Ports go out in rank order and are committed in rank order. A port is
    // only started while the pool could still need it.
    const queue = [...ranked];
    const pending: Array<Promise<Prepared>> = [];
    let done = 0;
    const started = performance.now();
    while (true) {
      while (
        pending.length < EXIT_CONCURRENCY &&
        queue.length > 0 &&
        goals.size + pending.length < options.maxGoals &&
        !options.cancelled()
      ) {
        pending.push(prepare(queue.shift()!));
      }
      if (pending.length === 0) break;
      const prepared = await pending.shift()!;
      if (options.cancelled()) break;
      await commit(prepared);
      done++;
      options.onProgress?.(
        `exits · ${done} ports · ${goals.size} goals · ${Math.round(performance.now() - started)} ms`,
      );
    }
    await Promise.all(pending);
    exitMs = performance.now() - started;
  }
  shoreMs = performance.now() - shoreStarted;
  classifyMs = classifyAtShore;
  if (options.cancelled()) {
    return emptyResult(
      grid,
      origin,
      classifyMs,
      land,
      "cancelled",
      landCount,
      mixedCount,
      0,
      waterCount,
      shoreMs,
      reachable,
    );
  }

  const nodeOf = new Int32Array(count).fill(-1);
  const nodes: Node[] = [];
  const steps: Step[] = [];
  const routes: Route[] = [];
  let smoothMs = 0;
  const trace = options.trace;

  const ensure = (index: number): number => {
    let id = nodeOf[index]!;
    if (id >= 0) return id;
    id = nodes.length;
    nodeOf[index] = id;
    nodes.push({ index, g: Infinity, h: 0, parent: -1, expanded: -1 });
    return id;
  };

  const heuristic = (index: number): number => {
    let best = Infinity;
    const lat = cellLat(index);
    const lng = cellLng(index);
    for (const [goalIndex] of goals) {
      const distance = metersBetween(
        lat,
        lng,
        cellLat(goalIndex),
        cellLng(goalIndex),
      );
      if (distance < best) best = distance;
    }
    return Number.isFinite(best) ? best : 0;
  };
  // Water still to a goal cell, plus the crossing from that cell to its port.
  const routeBound = (index: number): number => {
    let best = Infinity;
    const lat = cellLat(index);
    const lng = cellLng(index);
    for (const [goalIndex, goal] of goals) {
      const distance =
        metersBetween(lat, lng, cellLat(goalIndex), cellLng(goalIndex)) +
        goal.tail;
      if (distance < best) best = distance;
    }
    return Number.isFinite(best) ? best : 0;
  };

  const kthMeters = (): number => {
    if (routes.length < options.maxResults) return Infinity;
    return [...routes].sort((a, b) => a.pathMeters - b.pathMeters)[
      options.maxResults - 1
    ]!.pathMeters;
  };

  const corridorClear = async (a: number, b: number): Promise<boolean> => {
    const ax = a % cols;
    const ay = (a - ax) / cols;
    const bx = b % cols;
    const by = (b - bx) / cols;
    const margin = options.margin;
    const samples: number[] = [];
    const seen = new Set<number>();
    for (const index of touchedCells(a, b)) {
      const ix = index % cols;
      const iy = (index - ix) / cols;
      // Clearance applies to the passage. The snapped start and the port sit
      // against land, so the halo is not required within `margin` steps of
      // either end — otherwise every chord into a harbor fails. The cells the
      // segment touches are still required to be water, including a corner.
      const fromA = Math.max(Math.abs(ix - ax), Math.abs(iy - ay));
      const fromB = Math.max(Math.abs(ix - bx), Math.abs(iy - by));
      const fromEnd = Math.min(fromA, fromB);
      const halo = fromEnd >= margin ? margin : 0;
      for (let dy = -halo; dy <= halo; dy++) {
        const ny = iy + dy;
        if (ny < 0 || ny >= rows) return false;
        for (let dx = -halo; dx <= halo; dx++) {
          const nx = ix + dx;
          if (nx < 0 || nx >= cols) return false;
          const sample = ny * cols + nx;
          if (seen.has(sample)) continue;
          seen.add(sample);
          samples.push(sample);
        }
      }
    }
    await classifyList(samples);
    for (const index of samples) {
      if (grid.kinds[index] !== WATER) return false;
    }
    return true;
  };

  // On a shortest grid path, line of sight from a vertex reaches a prefix of
  // the later vertices and then stops at the next obstacle. Gallop to that
  // vertex. A clear channel collapses in a few probes; a shore-hugging span
  // stops at the next cell.
  const pull = async (keys: number[]): Promise<number[]> => {
    const n = keys.length;
    if (n <= 2) return keys.slice();
    const out: number[] = [];
    let i = 0;
    while (i < n - 1) {
      let best = i + 1;
      let step = 1;
      while (best < n - 1) {
        const probe = Math.min(n - 1, best + step);
        if (await corridorClear(keys[i]!, keys[probe]!)) {
          best = probe;
          if (best === n - 1) break;
          step *= 2;
          continue;
        }
        if (step === 1) break;
        let lo = best + 1;
        let hi = probe - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (await corridorClear(keys[i]!, keys[mid]!)) {
            best = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        break;
      }
      out.push(keys[i]!);
      i = best;
    }
    out.push(keys[n - 1]!);
    return out;
  };

  /**
   * An 8-connected leftover elbow can sit far offshore. Slide it toward
   * the chord only while both new legs stay water. Never invent a hop
   * that has not been corridor-checked — a tighter geodesic is often land.
   */
  const slideToward = async (
    a: number,
    b: number,
    c: number,
  ): Promise<number> => {
    const ax = a % cols;
    const ay = (a - ax) / cols;
    const bx = b % cols;
    const by = (b - bx) / cols;
    const cx = c % cols;
    const cy = (c - cx) / cols;
    const acx = cx - ax;
    const acy = cy - ay;
    const ac2 = acx * acx + acy * acy;
    if (ac2 < 1) return b;
    let t = ((bx - ax) * acx + (by - ay) * acy) / ac2;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const gx = Math.max(0, Math.min(cols - 1, Math.round(ax + t * acx)));
    const gy = Math.max(0, Math.min(rows - 1, Math.round(ay + t * acy)));
    const target = gy * cols + gx;
    if (target === b) return b;
    const ray = touchedCells(b, target);
    const clearAt = async (point: number): Promise<boolean> =>
      (await corridorClear(a, point)) && (await corridorClear(point, c));
    let first = -1;
    for (let i = 0; i < ray.length; i++) {
      if (await clearAt(ray[i]!)) {
        first = i;
        break;
      }
    }
    if (first < 0) return b;
    let lo = first;
    let hi = ray.length - 1;
    let best = ray[first]!;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const point = ray[mid]!;
      if (await clearAt(point)) {
        best = point;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  };

  const allWater = async (keys: number[]): Promise<boolean> => {
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(await corridorClear(keys[i]!, keys[i + 1]!))) return false;
    }
    return true;
  };

  const relax = async (keys: number[]): Promise<number[]> => {
    let pts = keys.slice();
    if (pts.length <= 2) return pts;
    for (let pass = 0; pass < 3; pass++) {
      const next: number[] = [pts[0]!];
      let changed = false;
      for (let i = 1; i < pts.length - 1; i++) {
        const a = next[next.length - 1]!;
        const b = pts[i]!;
        const c = pts[i + 1]!;
        if (await corridorClear(a, c)) {
          changed = true;
          continue;
        }
        const slid = await slideToward(a, b, c);
        if (slid !== b) changed = true;
        if (slid !== a) next.push(slid);
      }
      next.push(pts[pts.length - 1]!);
      pts = next;
      if (!changed) break;
    }
    return pts;
  };

  const taut = async (keys: number[]): Promise<number[]> => {
    const pulled = await pull(keys);
    const relaxed = await pull(await relax(pulled));
    if (await allWater(relaxed)) return relaxed;
    return pulled;
  };

  const finishAshore = (line: Position[], port: Goal): void => {
    const goal: Position = [port.lng, port.lat];
    const approach = port.approach;
    // The port already sits on its ocean cell.
    if (approach.length <= 2) {
      line[line.length - 1] = goal;
      if (line.length === 1) line.push(goal);
      return;
    }
    // The goal cell center is already the last point on the line.
    for (let i = 1; i < approach.length; i++) line.push(approach[i]!);
  };

  const toLine = (keys: number[], port: Goal): Position[] => {
    const goal: Position = [port.lng, port.lat];
    const line = keys.map(centerOf);
    if (line.length === 0) {
      return rings.length > 0
        ? [closestOnRings(rings, goal, origin), goal]
        : [origin, goal];
    }
    const cell = line[0]!;
    const nextShore = port.approach.length > 2 ? port.approach[1]! : goal;
    const toward = line.length > 1 ? line[1]! : nextShore;
    if (rings.length === 0) {
      line[0] = origin;
      finishAshore(line, port);
      return line;
    }
    // The winning cell is the best grid departure. Inside that cell, the
    // point facing the next bend is the boundary location. A point facing
    // the bend from some other cell means land turned the path, so stay on
    // the ring where this cell sits. A snap from inland keeps the water cell
    // so the string does not cut across the land in between.
    const facing = closestOnRings(rings, toward, origin);
    const beside = closestOnRings(rings, cell, origin);
    const point = inCell(facing, cell, degrees) ? facing : beside;
    const hop = metersBetween(point[1]!, point[0]!, cell[1]!, cell[0]!);
    if (hop > degrees * METERS_PER_DEGREE * 1.5) line.unshift(point);
    else line[0] = point;
    finishAshore(line, port);
    return line;
  };

  const pathOf = (id: number): number[] => {
    const keys: number[] = [];
    const guard = new Set<number>();
    let cursor = id;
    while (cursor >= 0 && !guard.has(cursor)) {
      guard.add(cursor);
      keys.push(nodes[cursor]!.index);
      cursor = nodes[cursor]!.parent;
    }
    keys.reverse();
    return keys;
  };

  const takeGoal = async (id: number, step: number) => {
    const index = nodes[id]!.index;
    const goal = goals.get(index);
    if (!goal) return;
    goals.delete(index);
    const keys = pathOf(id);
    const classifyBefore = classifyMs;
    const started = performance.now();
    const smoothedKeys = await taut(keys);
    smoothMs += performance.now() - started - (classifyMs - classifyBefore);
    const smoothed = toLine(smoothedKeys, goal);
    const raw = trace ? toLine(keys, goal) : smoothed;
    const pathMeters = lineMeters(smoothed);
    if (pathMeters > options.maxMeters) return;
    routes.push({
      rank: routes.length + 1,
      port: goal,
      pathMeters,
      rawMeters: lineMeters(raw),
      raw,
      smoothed,
      rawVerts: raw.length,
      smoothVerts: smoothed.length,
      step,
    });
    const cutoff = kthMeters();
    if (Number.isFinite(cutoff)) {
      for (const [cell, candidate] of [...goals]) {
        if (candidate.geodesic >= cutoff - 1) goals.delete(cell);
      }
    }
  };

  const heap = new MinHeap();
  for (const index of startIndexes) {
    const id = ensure(index);
    const node = nodes[id]!;
    if (node.g === 0) continue;
    node.g = 0;
    node.h = heuristic(index);
    node.parent = -1;
    heap.push(id, node.h, 0);
    if (goals.has(index)) await takeGoal(id, 0);
  }

  let expansions = 0;
  let stop: Stop = "exhausted";
  let hitDistance = false;
  const searchStarted = performance.now();
  const classifyAtSearch = classifyMs;
  while (heap.size > 0 && goals.size > 0) {
    if (expansions >= options.maxExpansions) {
      stop = "expansions";
      break;
    }
    if (expansions > 0 && expansions % YIELD_EVERY === 0) {
      options.onProgress?.(
        `searching · ${expansions.toLocaleString()} expansions`,
      );
      await yieldToBrowser();
      if (options.cancelled()) {
        stop = "cancelled";
        break;
      }
    }
    const popped = heap.pop();
    if (!popped) break;
    const node = nodes[popped.id]!;
    if (node.expanded >= 0 || popped.g > node.g + 0.001) continue;
    const hNow = heuristic(node.index);
    if (popped.f + 0.5 < node.g + hNow) {
      heap.push(popped.id, node.g + hNow, node.g);
      continue;
    }
    if (node.g + routeBound(node.index) > options.maxMeters) {
      hitDistance = true;
      continue;
    }
    node.expanded = trace ? steps.length : expansions;
    node.h = hNow;
    expansions++;
    const discovered: number[] = [];
    if (goals.has(node.index))
      await takeGoal(popped.id, trace ? steps.length + 1 : expansions);
    const ix = node.index % cols;
    const iy = (node.index - ix) / cols;
    let aborted = false;
    for (const [dx, dy, diagonal] of DIRS) {
      const nx = ix + dx;
      const ny = iy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nIndex = ny * cols + nx;
      if (grid.kinds[nIndex] === UNKNOWN) await classifyPatch(nIndex);
      if (options.cancelled()) {
        aborted = true;
        break;
      }
      if (grid.kinds[nIndex] !== WATER) continue;
      if (diagonal) {
        const open = await ensureCorner(ix, iy, dx, dy);
        if (options.cancelled()) {
          aborted = true;
          break;
        }
        if (!open) continue;
      }
      const nextId = nodeOf[nIndex]!;
      if (nextId >= 0 && nodes[nextId]!.expanded >= 0) continue;
      const id = nextId >= 0 ? nextId : ensure(nIndex);
      const next = nodes[id]!;
      const tentative = node.g + edgeMeters(iy, ny, diagonal);
      if (tentative > options.maxMeters || tentative >= next.g) continue;
      const created = !Number.isFinite(next.g);
      next.g = tentative;
      next.parent = popped.id;
      next.h = heuristic(nIndex);
      heap.push(id, next.g + next.h, next.g);
      if (created && trace) discovered.push(id);
    }
    if (aborted) {
      stop = "cancelled";
      break;
    }
    if (trace) steps.push({ node: popped.id, discovered });
    if (goals.size === 0) {
      stop = "found";
      break;
    }
  }
  if (stop === "exhausted" && hitDistance) stop = "distance";
  if (goals.size === 0) stop = "found";

  routes.sort(
    (a, b) => a.pathMeters - b.pathMeters || a.rawMeters - b.rawMeters,
  );
  routes.splice(options.maxResults);
  routes.forEach((route, index) => {
    route.rank = index + 1;
  });

  const reached = new Set(
    routes.map((route) => route.port.name + route.port.lng),
  );
  return {
    grid,
    nodes,
    steps,
    routes,
    goals: ranked.slice(0, options.maxGoals).map((port) => ({
      lng: port.lng,
      lat: port.lat,
      name: port.name,
      reached: reached.has(port.name + port.lng),
      target: targetAt.get(port.name + port.lng) ?? null,
      approach: approachAt.get(port.name + port.lng) ?? null,
    })),
    start: origin,
    starts: startIndexes.length,
    expansions,
    classified: classifiedCount,
    uniqueCells,
    classifyMs,
    shoreMs,
    exits,
    exitMs,
    searchMs:
      performance.now() -
      searchStarted -
      smoothMs -
      (classifyMs - classifyAtSearch),
    smoothMs,
    reachable,
    requests: land.stats.requests,
    bytes: land.stats.bytes,
    stop,
    land: landCount,
    mixed: mixedCount,
    inland: 0,
    ocean: waterCount,
  };
}

function emptyResult(
  grid: Grid,
  origin: Position,
  classifyMs: number,
  land: LandOccupancy,
  stop: Stop,
  landCount: number,
  mixedCount: number,
  inland: number,
  ocean: number,
  shoreMs = 0,
  reachable = 0,
): SearchResult {
  return {
    grid,
    nodes: [],
    steps: [],
    routes: [],
    goals: [],
    start: origin,
    starts: 0,
    expansions: 0,
    classified: grid.cols * grid.rows,
    uniqueCells: 0,
    classifyMs,
    shoreMs,
    exits: [],
    exitMs: 0,
    searchMs: 0,
    smoothMs: 0,
    reachable,
    requests: land.stats.requests,
    bytes: land.stats.bytes,
    stop,
    land: landCount,
    mixed: mixedCount,
    inland,
    ocean,
  };
}
