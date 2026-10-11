/**
 * Vector path from a port the bitmap cannot reach out to a cell the ocean
 * flood can. Land polygons are fetched a tile at a time, only where the
 * search actually steps, and rasterized so a step cannot jump a barrier.
 * The polyline is the channel; the bitmap search uses its far end as the goal.
 */
import { Position } from "geojson";

export type LandRings = Position[][];

const METERS_PER_DEGREE = 111_320;
/** Land test. Fine enough that a barrier island covers a cell. */
const RASTER_M = 40;
/** Search step. Wider than the raster so open water moves quickly. */
const STEP_M = 160;
const MAX_EXPAND = 60_000;
const MAX_TILES = 160;
/** Tile edge. Small enough that one fetch is a neighborhood, not a coastline. */
const TILE_DEG = 0.04;
const WEIGHT = 1.2;
const SEEK_STEPS = 40;

type RingXY = {
  pts: Array<[number, number]>;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

class Heap {
  private ix: number[] = [];
  private iy: number[] = [];
  private fs: number[] = [];
  private gs: number[] = [];

  get size(): number {
    return this.ix.length;
  }

  push(ix: number, iy: number, f: number, g: number): void {
    this.ix.push(ix);
    this.iy.push(iy);
    this.fs.push(f);
    this.gs.push(g);
    this.up(this.ix.length - 1);
  }

  pop(): { ix: number; iy: number; f: number; g: number } | null {
    const n = this.ix.length;
    if (n === 0) return null;
    const top = {
      ix: this.ix[0]!,
      iy: this.iy[0]!,
      f: this.fs[0]!,
      g: this.gs[0]!,
    };
    const last = n - 1;
    this.ix[0] = this.ix[last]!;
    this.iy[0] = this.iy[last]!;
    this.fs[0] = this.fs[last]!;
    this.gs[0] = this.gs[last]!;
    this.ix.pop();
    this.iy.pop();
    this.fs.pop();
    this.gs.pop();
    if (last > 0) this.down(0);
    return top;
  }

  private up(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.fs[i]! >= this.fs[parent]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private down(i: number): void {
    const n = this.ix.length;
    for (;;) {
      let best = i;
      const left = i * 2 + 1;
      const right = left + 1;
      if (left < n && this.fs[left]! < this.fs[best]!) best = left;
      if (right < n && this.fs[right]! < this.fs[best]!) best = right;
      if (best === i) break;
      this.swap(i, best);
      i = best;
    }
  }

  private swap(a: number, b: number): void {
    const ix = this.ix[a]!;
    const iy = this.iy[a]!;
    const f = this.fs[a]!;
    const g = this.gs[a]!;
    this.ix[a] = this.ix[b]!;
    this.iy[a] = this.iy[b]!;
    this.fs[a] = this.fs[b]!;
    this.gs[a] = this.gs[b]!;
    this.ix[b] = ix;
    this.iy[b] = iy;
    this.fs[b] = f;
    this.gs[b] = g;
  }
}

function insideRing(ring: RingXY, x: number, y: number): boolean {
  if (x < ring.minX || y < ring.minY || x > ring.maxX || y > ring.maxY) return false;
  let odd = false;
  const pts = ring.pts;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i]![1];
    const yj = pts[j]![1];
    if (yi > y === yj > y) continue;
    const xi = pts[i]![0];
    const xj = pts[j]![0];
    const cross = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (x < cross) odd = !odd;
  }
  return odd;
}

/** Land is the interior of a shell, and not the interior of a hole. */
function onLand(rings: RingXY[], x: number, y: number): boolean {
  let odd = false;
  for (const ring of rings) {
    if (insideRing(ring, x, y)) odd = !odd;
  }
  return odd;
}

function ringOf(pts: Array<[number, number]>): RingXY {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { pts, minX, minY, maxX, maxY };
}

export type RouteHarborOptions = {
  port: Position;
  /** Where the ocean flood is. The walk stops at the first cell that can reach it. */
  aim: Position;
  maxMeters: number;
  loadLand: (west: number, south: number, east: number, north: number) => Promise<LandRings[]>;
  /** True when this coordinate is bitmap water connected to the departure. */
  isEntry: (lng: number, lat: number) => Promise<boolean>;
  cancelled?: () => boolean;
  onProgress?: (text: string) => void;
};

/**
 * Polyline from the flood entry to the port, entry first. Null when no
 * channel reaches the flood inside the distance limit.
 */
export async function routeHarbor(options: RouteHarborOptions): Promise<Position[] | null> {
  const [portLng, portLat] = options.port;
  const cos = Math.cos((portLat * Math.PI) / 180);
  const xScale = METERS_PER_DEGREE * (Math.abs(cos) < 0.05 ? 0.05 : cos);
  const xOf = (lng: number): number => (lng - portLng) * xScale;
  const yOf = (lat: number): number => (lat - portLat) * METERS_PER_DEGREE;
  const lngOf = (x: number): number => portLng + x / xScale;
  const latOf = (y: number): number => portLat + y / METERS_PER_DEGREE;
  const aimX = xOf(options.aim[0]);
  const aimY = yOf(options.aim[1]);

  const land = new Set<string>();
  const loaded = new Set<string>();
  const loading = new Map<string, Promise<void>>();
  let tiles = 0;
  let capped = false;

  const rasterKey = (rx: number, ry: number): string => rx + "," + ry;
  const rxOf = (x: number): number => Math.round(x / RASTER_M);
  const ryOf = (y: number): number => Math.round(y / RASTER_M);

  const paint = (rings: RingXY[], west: number, south: number, east: number, north: number): void => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ring of rings) {
      if (ring.minX < minX) minX = ring.minX;
      if (ring.minY < minY) minY = ring.minY;
      if (ring.maxX > maxX) maxX = ring.maxX;
      if (ring.maxY > maxY) maxY = ring.maxY;
    }
    const clipW = Math.max(minX, xOf(west) - RASTER_M);
    const clipS = Math.max(minY, yOf(south) - RASTER_M);
    const clipE = Math.min(maxX, xOf(east) + RASTER_M);
    const clipN = Math.min(maxY, yOf(north) + RASTER_M);
    if (clipW > clipE || clipS > clipN) return;
    const rx0 = rxOf(clipW);
    const rx1 = rxOf(clipE);
    const ry0 = ryOf(clipS);
    const ry1 = ryOf(clipN);
    for (let ry = ry0; ry <= ry1; ry++) {
      const y = ry * RASTER_M;
      for (let rx = rx0; rx <= rx1; rx++) {
        const x = rx * RASTER_M;
        if (onLand(rings, x, y)) land.add(rasterKey(rx, ry));
      }
    }
  };

  const fetchTile = async (tx: number, ty: number): Promise<void> => {
    const id = tx + "," + ty;
    if (loaded.has(id)) return;
    if (tiles >= MAX_TILES) {
      capped = true;
      return;
    }
    tiles++;
    const west = tx * TILE_DEG;
    const south = ty * TILE_DEG;
    const east = west + TILE_DEG;
    const north = south + TILE_DEG;
    const polygons = await options.loadLand(west, south, east, north);
    for (const rings of polygons) {
      const xy: RingXY[] = [];
      for (const ring of rings) {
        if (ring.length < 4) continue;
        const open =
          ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1]
            ? ring.slice(0, -1)
            : ring;
        if (open.length < 3) continue;
        xy.push(ringOf(open.map((point) => [xOf(point[0]), yOf(point[1])])));
      }
      if (xy.length > 0) paint(xy, west, south, east, north);
    }
    loaded.add(id);
  };

  const ensureTile = (lng: number, lat: number): Promise<void> => {
    const tx = Math.floor(lng / TILE_DEG);
    const ty = Math.floor(lat / TILE_DEG);
    const id = tx + "," + ty;
    if (loaded.has(id)) return Promise.resolve();
    let pending = loading.get(id);
    if (!pending) {
      pending = fetchTile(tx, ty).finally(() => loading.delete(id));
      loading.set(id, pending);
    }
    return pending;
  };

  const blocked = (x: number, y: number): boolean => land.has(rasterKey(rxOf(x), ryOf(y)));

  const clearSegment = async (x0: number, y0: number, x1: number, y1: number): Promise<boolean> => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(length / RASTER_M));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      await ensureTile(lngOf(x), latOf(y));
      if (options.cancelled?.()) return false;
      if (capped || blocked(x, y)) return false;
    }
    return true;
  };

  await ensureTile(portLng, portLat);
  if (options.cancelled?.()) return null;

  let startIx = 0;
  let startIy = 0;
  if (blocked(0, 0)) {
    let found = false;
    for (let radius = 1; radius <= SEEK_STEPS && !found; radius++) {
      const edge: Array<[number, number]> = [];
      for (let i = -radius; i <= radius; i++) {
        edge.push([i, -radius], [i, radius], [-radius, i], [radius, i]);
      }
      for (const [ix, iy] of edge) {
        const x = ix * STEP_M;
        const y = iy * STEP_M;
        await ensureTile(lngOf(x), latOf(y));
        if (options.cancelled?.()) return null;
        if (!blocked(x, y)) {
          startIx = ix;
          startIy = iy;
          found = true;
          break;
        }
      }
    }
    if (!found) return null;
  }

  const keyOf = (ix: number, iy: number): string => ix + "," + iy;
  const startKey = keyOf(startIx, startIy);
  const gScore = new Map<string, number>();
  const prev = new Map<string, string>();
  gScore.set(startKey, 0);
  prev.set(startKey, "");
  const heap = new Heap();
  const startX = startIx * STEP_M;
  const startY = startIy * STEP_M;
  const aimOf = (x: number, y: number): number => Math.hypot(aimX - x, aimY - y);
  heap.push(startIx, startIy, WEIGHT * aimOf(startX, startY), 0);

  const trace = (ix: number, iy: number): Position[] => {
    const line: Position[] = [];
    let cursor = keyOf(ix, iy);
    const guard = new Set<string>();
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      const [sx, sy] = cursor.split(",").map(Number) as [number, number];
      line.push([lngOf(sx * STEP_M), latOf(sy * STEP_M)]);
      cursor = prev.get(cursor) ?? "";
    }
    const last = line[line.length - 1];
    if (!last || Math.hypot(xOf(last[0]) - 0, yOf(last[1]) - 0) > 1) {
      line.push([portLng, portLat]);
    }
    return line;
  };

  const neighbors: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  let expanded = 0;
  const closed = new Set<string>();
  while (heap.size > 0) {
    if (options.cancelled?.()) return null;
    if (expanded >= MAX_EXPAND) return null;
    const popped = heap.pop();
    if (!popped) break;
    const nodeKey = keyOf(popped.ix, popped.iy);
    if (closed.has(nodeKey)) continue;
    if (popped.g > (gScore.get(nodeKey) ?? Infinity) + 0.05) continue;
    closed.add(nodeKey);
    expanded++;
    if (expanded % 1500 === 0) {
      options.onProgress?.(`harbor · ${expanded.toLocaleString()} steps`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (options.cancelled?.()) return null;
    }
    const x = popped.ix * STEP_M;
    const y = popped.iy * STEP_M;
    if (await options.isEntry(lngOf(x), latOf(y))) return trace(popped.ix, popped.iy);
    for (const [dx, dy] of neighbors) {
      const nx = popped.ix + dx;
      const ny = popped.iy + dy;
      const nKey = keyOf(nx, ny);
      if (closed.has(nKey)) continue;
      const nxx = nx * STEP_M;
      const nyy = ny * STEP_M;
      if (dx !== 0 && dy !== 0) {
        const sideX = (popped.ix + dx) * STEP_M;
        const sideY = popped.iy * STEP_M;
        const sideX2 = popped.ix * STEP_M;
        const sideY2 = (popped.iy + dy) * STEP_M;
        await ensureTile(lngOf(sideX), latOf(sideY));
        await ensureTile(lngOf(sideX2), latOf(sideY2));
        if (capped) return null;
        if (blocked(sideX, sideY) || blocked(sideX2, sideY2)) continue;
      }
      if (!(await clearSegment(x, y, nxx, nyy))) {
        if (options.cancelled?.() || capped) return null;
        continue;
      }
      const step = Math.hypot(nxx - x, nyy - y);
      const nextG = popped.g + step;
      if (nextG > options.maxMeters) continue;
      const prevG = gScore.get(nKey);
      if (prevG != null && nextG >= prevG - 0.05) continue;
      gScore.set(nKey, nextG);
      prev.set(nKey, nodeKey);
      heap.push(nx, ny, nextG + WEIGHT * aimOf(nxx, nyy), nextG);
    }
  }
  return null;
}
