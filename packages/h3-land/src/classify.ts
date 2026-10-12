import {
  POLYGON_TO_CELLS_FLAGS,
  cellToChildren,
  gridDisk,
  polygonToCellsExperimental,
} from "h3-js";
import type { Geometry, MultiPolygon, Polygon } from "geojson";
import { DEFAULT_COVER_EPSILON, MIN_COVER_M2 } from "./constants";
import {
  DESCENDANT_REACH,
  Pt,
  bboxesOverlap,
  cellReachBbox,
  clipRingsToCell,
  clipToConvex,
  hexAreaM2,
  intersectionAreaM2,
  ringsBbox,
} from "./coverage";
import { cellToInt, intToCell } from "./h3int";

/**
 * h3-js runs on a fixed-size WebAssembly heap. A polygon with hundreds of
 * thousands of vertices, or one that produces millions of cells, exhausts it
 * and libh3 reports E_MEMORY_ALLOC (code 13). The polygon is then split along
 * its bounding box and each half is tried on its own.
 */
const MAX_SPLIT_DEPTH = 16;

function isH3MemoryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /memory allocation failed/i.test(message);
}

function toPts(ring: readonly number[][]): Pt[] {
  return ring.map((point) => [point[0]!, point[1]!]);
}

/**
 * Cut a polygon in two along the longer axis of its bounding box. Both halves
 * keep their holes. Returns the non-empty halves, or null when the polygon is
 * too thin to cut.
 */
export function splitRings(rings: readonly (readonly number[][])[]): number[][][][] | null {
  const outer = rings[0];
  if (!outer || outer.length < 4) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outer) {
    if (x! < minX) minX = x!;
    if (x! > maxX) maxX = x!;
    if (y! < minY) minY = y!;
    if (y! > maxY) maxY = y!;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!(Math.max(width, height) > 1e-9)) return null;
  const windows: Pt[][] =
    width >= height
      ? [
          [[minX, minY], [(minX + maxX) / 2, minY], [(minX + maxX) / 2, maxY], [minX, maxY]],
          [[(minX + maxX) / 2, minY], [maxX, minY], [maxX, maxY], [(minX + maxX) / 2, maxY]],
        ]
      : [
          [[minX, minY], [maxX, minY], [maxX, (minY + maxY) / 2], [minX, (minY + maxY) / 2]],
          [[minX, (minY + maxY) / 2], [maxX, (minY + maxY) / 2], [maxX, maxY], [minX, maxY]],
        ];
  const halves: number[][][][] = [];
  for (const window of windows) {
    const clippedOuter = clipToConvex(toPts(outer), window);
    if (clippedOuter.length < 3) continue;
    const half: number[][][] = [closeRing(clippedOuter)];
    for (let i = 1; i < rings.length; i++) {
      const hole = clipToConvex(toPts(rings[i]!), window);
      if (hole.length >= 3) half.push(closeRing(hole));
    }
    halves.push(half);
  }
  return halves.length > 0 ? halves : null;
}

/**
 * `polygonToCellsExperimental` that survives libh3 running out of heap by
 * splitting the polygon. Overlapping cells on the cut line are reported once.
 * Fully contained cells on the cut line are missed; they come back as
 * overlapping instead, which is conservative.
 */
function cellsFor(
  rings: readonly (readonly number[][])[],
  resolution: number,
  flag: string,
  depth = 0
): Iterable<string> {
  try {
    return polygonToCellsExperimental(rings as number[][][], resolution, flag, true);
  } catch (error) {
    if (!isH3MemoryError(error) || depth >= MAX_SPLIT_DEPTH) throw error;
    const halves = splitRings(rings);
    if (!halves) throw error;
    const out = new Set<string>();
    for (const half of halves) {
      for (const cell of cellsFor(half, resolution, flag, depth + 1)) out.add(cell);
    }
    return out;
  }
}

/**
 * V8 refuses a single Set past 2^24 entries. One resolution-9 land polygon
 * can contain more cells than that, so entire-cell ids are stored in chunks.
 */
const CELL_SET_CHUNK = 8_000_000;

export class CellSet {
  private readonly chunks: Set<bigint>[] = [];
  private tail = new Set<bigint>();
  size = 0;

  constructor(private readonly chunkSize = CELL_SET_CHUNK) {}

  add(value: bigint): void {
    if (this.has(value)) return;
    if (this.tail.size >= this.chunkSize) {
      this.chunks.push(this.tail);
      this.tail = new Set();
    }
    this.tail.add(value);
    this.size++;
  }

  has(value: bigint): boolean {
    if (this.tail.has(value)) return true;
    for (const chunk of this.chunks) {
      if (chunk.has(value)) return true;
    }
    return false;
  }

  [Symbol.iterator](): IterableIterator<bigint> {
    const chunks = this.chunks;
    const tail = this.tail;
    return (function* () {
      for (const chunk of chunks) yield* chunk;
      yield* tail;
    })();
  }
}

export type GeometryContribution = {
  /** Cells fully inside this geometry. One subdivided piece is enough. */
  entire: CellSet;
  /**
   * Area of this geometry inside cells it does not fully cover.
   * The caller sums these across pieces. A cell that only straddles a
   * subdivision boundary becomes entire once the pieces add up.
   */
  cover: Map<bigint, number>;
};

export function emptyContribution(): GeometryContribution {
  return { entire: new CellSet(), cover: new Map() };
}

export function nextCover(
  previous: number,
  added: number,
  cellArea: number,
  epsilon: number
):
  | { kind: "unchanged" }
  | { kind: "partial"; cover: number }
  | { kind: "entire"; cover: number } {
  if (!(added > MIN_COVER_M2)) return { kind: "unchanged" };
  const cover = previous + added;
  if (cover >= cellArea * (1 - epsilon)) return { kind: "entire", cover };
  return { kind: "partial", cover };
}

function closeRing(ring: readonly number[][]): number[][] {
  const out = ring.map((point) => [point[0]!, point[1]!]);
  if (out.length === 0) return out;
  const first = out[0]!;
  const last = out[out.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
  return out;
}

function eachPolygon(
  geometry: Geometry,
  visit: (rings: number[][][]) => void
): void {
  if (geometry.type === "Polygon") {
    visit(geometry.coordinates.map(closeRing));
    return;
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) visit(polygon.map(closeRing));
    return;
  }
  throw new Error(`unsupported geometry ${geometry.type}`);
}

function usable(rings: number[][][]): boolean {
  const outer = rings[0];
  return !!outer && outer.length >= 4;
}

/**
 * Classify one land polygon at `resolution`.
 *
 * `containmentFull` cells are entire: the piece covers them, so neighboring
 * pieces are not required. Remaining overlapping cells contribute intersection
 * area. Callers add that area across the non-overlapping subdivision and
 * promote a cell when the sum covers it.
 */
export function measureGeometry(
  geometry: Geometry,
  resolution: number,
  epsilon = DEFAULT_COVER_EPSILON
): GeometryContribution {
  const contribution = emptyContribution();
  eachPolygon(geometry, (rings) => {
    if (!usable(rings)) return;
    measureRings(rings, resolution, epsilon, contribution);
  });
  return contribution;
}

function measureRings(
  rings: number[][][],
  resolution: number,
  epsilon: number,
  into: GeometryContribution
): void {
  const full = cellsFor(rings, resolution, POLYGON_TO_CELLS_FLAGS.containmentFull);
  for (const index of full) into.entire.add(cellToInt(index));

  const overlapping = cellsFor(rings, resolution, POLYGON_TO_CELLS_FLAGS.containmentOverlapping);
  for (const index of overlapping) {
    const h3 = cellToInt(index);
    if (into.entire.has(h3)) continue;
    const area = intersectionAreaM2(h3, rings);
    const cellArea = hexAreaM2(h3);
    const decision = nextCover(into.cover.get(h3) ?? 0, area, cellArea, epsilon);
    if (decision.kind === "entire") {
      into.cover.delete(h3);
      into.entire.add(h3);
    } else if (decision.kind === "partial") {
      into.cover.set(h3, decision.cover);
    }
  }
}

export type CoarseHit = {
  /** Resolution-7 cells fully inside a single land piece. */
  sealed: CellSet;
  /** Area of land inside resolution-7 cells the pieces only overlap. */
  overlap: Map<bigint, number>;
};

/**
 * Classify one geometry at the base resolution. Fully contained cells are
 * sealed. Overlapping cells keep their area and are refined later, including
 * cells that are almost entirely covered: the 0.1% sliver can still make a
 * finer child mixed.
 */
export function collectCoarse(geometry: Geometry, baseResolution: number): CoarseHit {
  const sealed = new CellSet();
  const pieces: number[][][][] = [];
  eachPolygon(geometry, (rings) => {
    if (!usable(rings)) return;
    pieces.push(rings);
  });
  for (const rings of pieces) {
    const full = cellsFor(rings, baseResolution, POLYGON_TO_CELLS_FLAGS.containmentFull);
    for (const index of full) sealed.add(cellToInt(index));
  }
  const overlap = new Map<bigint, number>();
  for (const rings of pieces) {
    const overlapping = cellsFor(
      rings,
      baseResolution,
      POLYGON_TO_CELLS_FLAGS.containmentOverlapping
    );
    for (const index of overlapping) {
      const h3 = cellToInt(index);
      if (sealed.has(h3)) continue;
      const area = intersectionAreaM2(h3, rings);
      if (!(area > MIN_COVER_M2)) continue;
      overlap.set(h3, (overlap.get(h3) ?? 0) + area);
    }
  }
  return { sealed, overlap };
}

/**
 * Area this geometry adds to each fine child of a mixed base cell.
 *
 * Descendants reach outside the base cell's outline, so the polygon is
 * clipped to the base hexagon scaled by `DESCENDANT_REACH`, and the mixed
 * neighbors of every overlapping base cell are measured as well: a piece
 * that only touches the corner of a child may not overlap the parent at all.
 * Clipping first keeps a continental ring from being re-tested against every
 * child.
 */
export function collectRefine(
  geometry: Geometry,
  baseResolution: number,
  fineResolution: number,
  isMixed: (h3: bigint) => boolean
): Map<bigint, number> {
  const covers = new Map<bigint, number>();
  eachPolygon(geometry, (rings) => {
    if (!usable(rings)) return;
    const bbox = ringsBbox(rings);
    const overlapping = cellsFor(
      rings,
      baseResolution,
      POLYGON_TO_CELLS_FLAGS.containmentOverlapping
    );
    const parents = new Set<bigint>();
    for (const index of overlapping) {
      for (const candidate of gridDisk(index, 1)) {
        const parent = cellToInt(candidate);
        if (isMixed(parent)) parents.add(parent);
      }
    }
    for (const parent of parents) {
      if (!bboxesOverlap(cellReachBbox(parent, DESCENDANT_REACH), bbox)) continue;
      const clipped = clipRingsToCell(rings, parent, DESCENDANT_REACH);
      if (!clipped) continue;
      for (const child of cellToChildren(intToCell(parent), fineResolution)) {
        const h3 = cellToInt(child);
        const area = intersectionAreaM2(h3, clipped);
        if (!(area > MIN_COVER_M2)) continue;
        covers.set(h3, (covers.get(h3) ?? 0) + area);
      }
    }
  });
  return covers;
}

export function isPolygonGeometry(
  geometry: Geometry | null | undefined
): geometry is Polygon | MultiPolygon {
  return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}
