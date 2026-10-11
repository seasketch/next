/**
 * Client-side H3 A* to the nearest port.
 *
 * Served by viewer/serve.ts at /astar and bundled on request. The search runs
 * in the browser on the H3 land archive through @seasketch/h3-land/client:
 * land cells are walls, a mixed cell costs a multiple of its length, water
 * costs its length. The walk addresses cells by H3 local IJ slot, and the
 * six neighbor offsets are added directly. Archive reads fill a patch of
 * slots, then the loop stays on that typed array. A run is either recorded so it can be replayed one
 * expansion at a time, or timed cold with nothing drawn. After A* returns, a
 * line-of-sight pull drops vertices whose straight shortcut stays off land,
 * then each remaining bend slides toward the chord until it is tangent to land.
 */
import { Feature, Position } from "geojson";
import {
  cellToBoundary,
  cellToLatLng,
  cellToLocalIj,
  getHexagonEdgeLengthAvg,
  gridDisk,
  latLngToCell,
  localIjToCell,
  polygonToCells,
} from "h3-js";
import { LandOccupancy, LandState, openLandOccupancy } from "@seasketch/h3-land/client";
import {
  addReferencePorts,
  CLASS_COLOR,
  CLASS_EDGE,
  CLASS_OPACITY,
  consideredItem,
  CONSIDERED_COLOR,
  fitSolution,
  labelOffset,
  markRouteList,
  matchButton,
  matchLabel,
  paintBasemap,
  rankColor,
} from "./frame";

declare const mapboxgl: any;

const ARCHIVES: Record<number, string> = {
  8: "https://tiles.seasketch.org/h3-land/v1/land-res8.h3ld",
  9: "https://tiles.seasketch.org/h3-land/v1/land-res9.h3ld",
};
const MAPBOX_TOKEN =
  new URLSearchParams(location.search).get("token") ||
  localStorage.getItem("mapboxToken") ||
  "";
const EARTH_RADIUS = 6371008.8;
const RAD = Math.PI / 180;
/** Expansions between yields to the event loop, so progress and cancel work. */
const YIELD_EVERY = 4096;
/**
 * Neighbor steps in H3 local IJ coordinates. These six offsets are the
 * neighbors everywhere except on a pentagon, so the walk is array indexing.
 */
const DI = [1, 0, -1, 0, 1, -1];
const DJ = [0, 1, 0, -1, 1, -1];
const KIND_UNKNOWN = 0;
const KIND_LAND = 1;
const KIND_MIXED = 2;
const KIND_WATER = 3;
/** How many IJ steps around an unclassified cell are read in one archive call. */
const CLASSIFY_PATCH = 8;

type Port = { name: string; country: string; lng: number; lat: number };

type Node = {
  index: number;
  cell: string;
  /** Local IJ coordinates relative to the search origin. Neighbors are DI/DJ. */
  i: number;
  j: number;
  state: LandState;
  ux: number;
  uy: number;
  uz: number;
  g: number;
  /** Geographic meters walked from the start, without the mixed multiplier. */
  travel: number;
  h: number;
  parent: number;
  closed: boolean;
  /** Step that discovered the cell. -1 for the start cells. */
  discovered: number;
  /** Step that expanded the cell. -1 if it never left the frontier. */
  expanded: number;
};

type Step = { node: number; discovered: number[] };

type SearchOptions = {
  resolution: number;
  mixedCost: number;
  /** Stop when the cheapest frontier entry costs more than this. */
  maxMeters: number;
  maxExpansions: number;
  maxGoals: number;
  /** Ports to keep after pull. The walk may visit more until the Kth pulled length is safe. */
  maxResults: number;
  trace: boolean;
  cancelled: () => boolean;
  onProgress?: (info: { expansions: number; frontier: number }) => void;
};

type Stop = "found" | "exhausted" | "distance" | "expansions" | "cancelled";

type Route = {
  rank: number;
  port: Port;
  node: Node;
  path: number[];
  /** Cell-center polyline after line-of-sight pulling, plus the port. */
  pulled: Position[];
  pathMeters: number;
  hexMeters: number;
  cost: number;
  /** Expansion that reached the goal, as a step index. */
  step: number;
};

type SearchResult = {
  nodes: Node[];
  steps: Step[];
  starts: number[];
  goals: Map<string, Port>;
  routes: Route[];
  expansions: number;
  classified: number;
  statesCalls: number;
  /** Time spent turning IJ slots into archive states. Included in searchMs. */
  classifyMs: number;
  searchMs: number;
  pullMs: number;
  stop: Stop;
};

function archiveFor(resolution: number): string {
  return ARCHIVES[resolution <= 8 ? 8 : 9]!;
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** Great-circle distance from the dot product of two unit vectors. */
function metersFromDot(dot: number): number {
  const clamped = dot > 1 ? 1 : dot < -1 ? -1 : dot;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt((1 - clamped) / 2));
}

function unit(lat: number, lng: number): [number, number, number] {
  const la = lat * RAD;
  const lo = lng * RAD;
  const c = Math.cos(la);
  return [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)];
}

function metersBetweenNodes(a: Node, b: Node): number {
  return metersFromDot(a.ux * b.ux + a.uy * b.uy + a.uz * b.uz);
}

function unwrapToward(from: Position, to: Position): Position {
  let lng = to[0]!;
  while (lng - from[0]! > 180) lng -= 360;
  while (lng - from[0]! < -180) lng += 360;
  return [lng, to[1]!];
}

function metersBetween(a: Position, b: Position): number {
  const dest = unwrapToward(a, b);
  const [ax, ay, az] = unit(a[1]!, a[0]!);
  const [bx, by, bz] = unit(dest[1]!, dest[0]!);
  return metersFromDot(ax * bx + ay * by + az * bz);
}

function lineLength(coords: Position[]): number {
  let meters = 0;
  for (let i = 1; i < coords.length; i++) meters += metersBetween(coords[i - 1]!, coords[i]!);
  return meters;
}

/** Cells a straight line crosses, sampled at a fraction of the hex edge. */
function cellsAlong(a: Position, b: Position, resolution: number): string[] {
  const dest = unwrapToward(a, b);
  const span = metersBetween(a, dest);
  const step = Math.max(25, getHexagonEdgeLengthAvg(resolution, "m") * 0.35);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (lng: number, lat: number) => {
    const cell = latLngToCell(lat, wrapLng(lng), resolution);
    if (seen.has(cell)) return;
    seen.add(cell);
    out.push(cell);
  };
  add(a[0]!, a[1]!);
  if (span < 1) return out;
  for (let d = step; d < span; d += step) {
    const t = d / span;
    add(a[0]! + (dest[0]! - a[0]!) * t, a[1]! + (dest[1]! - a[1]!) * t);
  }
  add(dest[0]!, dest[1]!);
  return out;
}

/**
 * Drop vertices when the straight line between the rest stays off land.
 * Mixed cells are allowed: they were passable in the search. Land is not.
 */
async function segmentClear(
  from: Position,
  to: Position,
  resolution: number,
  classify: (cells: string[]) => Promise<Map<string, LandState>>
): Promise<boolean> {
  const states = await classify(cellsAlong(from, to, resolution));
  for (const state of states.values()) {
    if (state === "land") return false;
  }
  return true;
}

async function straighten(
  coords: Position[],
  resolution: number,
  classify: (cells: string[]) => Promise<Map<string, LandState>>
): Promise<Position[]> {
  if (coords.length < 3) return coords;
  const pulled: Position[] = [coords[0]!];
  let i = 0;
  while (i < coords.length - 1) {
    let best = i + 1;
    for (let j = coords.length - 1; j > i + 1; j--) {
      if (await segmentClear(coords[i]!, coords[j]!, resolution, classify)) {
        best = j;
        break;
      }
    }
    pulled.push(coords[best]!);
    i = best;
  }
  return pulled;
}

/** Closest point on segment AC to B, in a frame unwrapped around A. */
function projectOnSegment(a: Position, b: Position, c: Position): Position {
  const toB = unwrapToward(a, b);
  const toC = unwrapToward(a, c);
  const acx = toC[0]! - a[0]!;
  const acy = toC[1]! - a[1]!;
  const denom = acx * acx + acy * acy;
  if (denom < 1e-18) return toC;
  let u = ((toB[0]! - a[0]!) * acx + (toB[1]! - a[1]!) * acy) / denom;
  if (u < 0) u = 0;
  if (u > 1) u = 1;
  return [a[0]! + acx * u, a[1]! + acy * u];
}

/**
 * Slide each bend toward the chord A–C until a segment just hits land.
 * That puts the vertex on a tangent instead of a deep-water hex center.
 */
async function tighten(
  coords: Position[],
  resolution: number,
  classify: (cells: string[]) => Promise<Map<string, LandState>>
): Promise<Position[]> {
  if (coords.length < 3) return coords;
  const out = coords.map((coord) => [coord[0]!, coord[1]!] as Position);
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1]!;
      const b = unwrapToward(a, out[i]!);
      const c = unwrapToward(a, out[i + 1]!);
      const target = projectOnSegment(a, b, c);
      if (metersBetween(b, target) < 20) continue;
      let lo = 0;
      let hi = 1;
      let best = b;
      for (let step = 0; step < 14; step++) {
        const mid = (lo + hi) / 2;
        const at: Position = [b[0]! + (target[0]! - b[0]!) * mid, b[1]! + (target[1]! - b[1]!) * mid];
        if (
          (await segmentClear(a, at, resolution, classify)) &&
          (await segmentClear(at, c, resolution, classify))
        ) {
          best = at;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      if (metersBetween(b, best) > 15) {
        out[i] = [wrapLng(best[0]!), best[1]!];
        moved = true;
      }
    }
    if (!moved) break;
  }
  return straighten(out, resolution, classify);
}

function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}

class Frontier {
  private keys: number[] = [];
  private values: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, value: number): void {
    const keys = this.keys;
    const values = this.values;
    let i = keys.length;
    keys.push(key);
    values.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent]! <= key) break;
      keys[i] = keys[parent]!;
      values[i] = values[parent]!;
      i = parent;
    }
    keys[i] = key;
    values[i] = value;
  }

  pop(): number {
    const keys = this.keys;
    const values = this.values;
    const top = values[0]!;
    const lastKey = keys.pop()!;
    const lastValue = values.pop()!;
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        if (left >= n) break;
        const right = left + 1;
        const child = right < n && keys[right]! < keys[left]! ? right : left;
        if (keys[child]! >= lastKey) break;
        keys[i] = keys[child]!;
        values[i] = values[child]!;
        i = child;
      }
      keys[i] = lastKey;
      values[i] = lastValue;
    }
    return top;
  }
}

function coordinatesOf(feature: Feature): Position[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  if (geometry.type === "LineString") return geometry.coordinates;
  return [];
}

function centroidOf(feature: Feature): Position {
  const coords = coordinatesOf(feature);
  if (coords.length === 0) return [0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lng, lat] of coords) {
    const [ux, uy, uz] = unit(lat, lng);
    x += ux;
    y += uy;
    z += uz;
  }
  const lng = Math.atan2(y, x) / RAD;
  const lat = Math.atan2(z, Math.hypot(x, y)) / RAD;
  return [lng, lat];
}

function wrapRing(ring: Position[]): Position[] {
  return ring.map(([lng, lat]) => [wrapLng(lng), lat]);
}

function startCells(feature: Feature, resolution: number): string[] {
  const geometry = feature.geometry;
  const cells = new Set<string>();
  if (geometry.type === "Point") {
    cells.add(latLngToCell(geometry.coordinates[1]!, geometry.coordinates[0]!, resolution));
  } else if (geometry.type === "Polygon") {
    for (const cell of polygonToCells(geometry.coordinates.map(wrapRing), resolution, true)) {
      cells.add(cell);
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const cell of polygonToCells(polygon.map(wrapRing), resolution, true)) cells.add(cell);
    }
  }
  if (cells.size === 0) {
    const [lng, lat] = centroidOf(feature);
    cells.add(latLngToCell(lat, lng, resolution));
  }
  return [...cells];
}

async function search(
  land: LandOccupancy,
  feature: Feature,
  ports: Port[],
  options: SearchOptions
): Promise<SearchResult> {
  const started = performance.now();
  const resolution = options.resolution;
  const nodes: Node[] = [];
  const steps: Step[] = [];
  let statesCalls = 0;
  let classified = 0;
  let classifyMs = 0;
  let countClassify = true;

  const classify = async (cells: string[]): Promise<Map<string, LandState>> => {
    if (cells.length === 0) return new Map();
    const t0 = performance.now();
    statesCalls++;
    classified += cells.length;
    const states = await land.states(cells);
    if (countClassify) classifyMs += performance.now() - t0;
    return states;
  };

  // Goals: the nearest ports by great circle, each snapped to the closest
  // non-land cell within two rings of the port's own cell.
  const origin = centroidOf(feature);
  const originCell = latLngToCell(origin[1]!, wrapLng(origin[0]!), resolution);
  const [ox, oy, oz] = unit(origin[1]!, origin[0]!);
  const ranked = ports
    .map((port) => {
      const [px, py, pz] = unit(port.lat, port.lng);
      return { port, meters: metersFromDot(ox * px + oy * py + oz * pz) };
    })
    .filter((item) => item.meters <= options.maxMeters)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, options.maxGoals);
  const disks = ranked.map((item) =>
    gridDisk(latLngToCell(item.port.lat, item.port.lng, resolution), 2)
  );
  const diskStates = await classify(disks.flat());
  const goals = new Map<string, Port>();
  const allGoals = new Map<string, Port>();
  const geodesicOf = new Map<Port, number>();
  let goalUnits: number[] = [];
  ranked.forEach((item, i) => {
    const [px, py, pz] = unit(item.port.lat, item.port.lng);
    let best: string | null = null;
    let bestDot = -Infinity;
    for (const cell of disks[i]!) {
      if (diskStates.get(cell) === "land" || goals.has(cell)) continue;
      const [lat, lng] = cellToLatLng(cell);
      const [cx, cy, cz] = unit(lat, lng);
      const dot = cx * px + cy * py + cz * pz;
      if (dot > bestDot) {
        bestDot = dot;
        best = cell;
      }
    }
    if (!best) return;
    let key = best;
    try {
      key = localIjToCell(originCell, cellToLocalIj(originCell, best));
    } catch {
      return;
    }
    if (goals.has(key)) return;
    goals.set(key, item.port);
    allGoals.set(key, item.port);
    geodesicOf.set(item.port, item.meters);
  });
  if (goals.size === 0) {
    throw new Error("no port within range has a non-land cell at this resolution");
  }
  const rebuildGoalUnits = () => {
    goalUnits = [];
    for (const cell of goals.keys()) {
      const [lat, lng] = cellToLatLng(cell);
      goalUnits.push(...unit(lat, lng));
    }
  };
  rebuildGoalUnits();

  const heuristic = (ux: number, uy: number, uz: number): number => {
    const goalCount = goalUnits.length / 3;
    let bestDot = -Infinity;
    for (let i = 0; i < goalCount; i++) {
      const dot = ux * goalUnits[i * 3]! + uy * goalUnits[i * 3 + 1]! + uz * goalUnits[i * 3 + 2]!;
      if (dot > bestDot) bestDot = dot;
    }
    return metersFromDot(bestDot);
  };

  // Dense window in local IJ. Slot (i, j) is a byte, and its six neighbors
  // are (i + DI[k], j + DJ[k]). gridDisk is not called from the walk.
  const originIj = cellToLocalIj(originCell, originCell);
  const spacing = getHexagonEdgeLengthAvg(resolution, "m") * Math.sqrt(3);
  const rings = Math.ceil(options.maxMeters / spacing) + 4;
  const side = rings * 2 + 1;
  if (side * side > 8_000_000) {
    throw new Error(
      `This window is ${(side * side).toLocaleString()} cells. Use a coarser resolution or a shorter limit.`
    );
  }
  const baseI = originIj.i - rings;
  const baseJ = originIj.j - rings;
  const kinds = new Uint8Array(side * side);
  const nodeOf = new Int32Array(side * side);
  nodeOf.fill(-1);
  const cellOf = new Map<number, string>();
  const slotOf = (i: number, j: number): number => {
    const x = i - baseI;
    const y = j - baseJ;
    if (x < 0 || y < 0 || x >= side || y >= side) return -1;
    return y * side + x;
  };

  const classifyPatch = async (i0: number, j0: number): Promise<void> => {
    const t0 = performance.now();
    const pendingSlots: number[] = [];
    const pendingCells: string[] = [];
    for (let dj = -CLASSIFY_PATCH; dj <= CLASSIFY_PATCH; dj++) {
      for (let di = -CLASSIFY_PATCH; di <= CLASSIFY_PATCH; di++) {
        const slot = slotOf(i0 + di, j0 + dj);
        if (slot < 0 || kinds[slot] !== KIND_UNKNOWN) continue;
        let cell: string;
        try {
          cell = localIjToCell(originCell, { i: i0 + di, j: j0 + dj });
        } catch {
          kinds[slot] = KIND_LAND;
          continue;
        }
        kinds[slot] = 255;
        pendingSlots.push(slot);
        pendingCells.push(cell);
      }
    }
    if (pendingCells.length > 0) {
      countClassify = false;
      let states: Map<string, LandState>;
      try {
        states = await classify(pendingCells);
      } finally {
        countClassify = true;
      }
      for (let n = 0; n < pendingSlots.length; n++) {
        const slot = pendingSlots[n]!;
        const state = states.get(pendingCells[n]!) ?? "water";
        if (state === "land") {
          kinds[slot] = KIND_LAND;
        } else {
          kinds[slot] = state === "mixed" ? KIND_MIXED : KIND_WATER;
          cellOf.set(slot, pendingCells[n]!);
        }
      }
    }
    classifyMs += performance.now() - t0;
  };

  const makeNode = (cell: string, state: LandState, i: number, j: number, discovered: number): Node => {
    const [lat, lng] = cellToLatLng(cell);
    const [ux, uy, uz] = unit(lat, lng);
    const node: Node = {
      index: nodes.length,
      cell,
      i,
      j,
      state,
      ux,
      uy,
      uz,
      g: Infinity,
      travel: Infinity,
      h: state === "land" ? 0 : heuristic(ux, uy, uz),
      parent: -1,
      closed: state === "land",
      discovered,
      expanded: -1,
    };
    nodes.push(node);
    return node;
  };

  const ensure = (slot: number, i: number, j: number, discovered: number): number => {
    const existing = nodeOf[slot]!;
    if (existing >= 0) return existing;
    const cell = cellOf.get(slot);
    if (!cell) throw new Error("classified cell has no index");
    const state: LandState = kinds[slot] === KIND_MIXED ? "mixed" : "water";
    const node = makeNode(cell, state, i, j, discovered);
    nodeOf[slot] = node.index;
    return node.index;
  };

  // Start cells: every cell of the sketch that is not land.
  const candidates = startCells(feature, resolution);
  const startStates = await classify(candidates);
  let frontier = new Frontier();
  const starts: number[] = [];
  for (const cell of candidates) {
    const state = startStates.get(cell) ?? "water";
    if (state === "land") continue;
    let ij: { i: number; j: number };
    try {
      ij = cellToLocalIj(originCell, cell);
    } catch {
      continue;
    }
    const slot = slotOf(ij.i, ij.j);
    if (slot < 0) continue;
    kinds[slot] = state === "mixed" ? KIND_MIXED : KIND_WATER;
    cellOf.set(slot, cell);
    const node = makeNode(cell, state, ij.i, ij.j, -1);
    nodeOf[slot] = node.index;
    node.g = 0;
    node.travel = 0;
    starts.push(node.index);
    frontier.push(node.h, node.index);
  }
  if (starts.length === 0) {
    throw new Error("the start is entirely land at this resolution");
  }

  let expansions = 0;
  const routes: Route[] = [];
  let stop: Stop = "exhausted";
  let hitDistance = false;
  let pullMs = 0;
  const trace = options.trace;

  const routeTo = (node: Node, port: Port): Route => {
    const path: number[] = [];
    let pathMeters = 0;
    let cursor: Node | null = node;
    while (cursor) {
      path.push(cursor.index);
      const parent: Node | null = cursor.parent >= 0 ? nodes[cursor.parent]! : null;
      if (parent) pathMeters += metersBetweenNodes(cursor, parent);
      cursor = parent;
    }
    path.reverse();
    return {
      rank: routes.length + 1,
      port,
      node,
      path,
      pulled: [],
      pathMeters,
      hexMeters: pathMeters,
      cost: node.g,
      step: node.expanded,
    };
  };

  // A reached goal leaves the goal set, so "distance to the nearest goal"
  // grows for every open cell. Recompute it and rebuild the frontier so the
  // ordering stays consistent. Closed cells already hold exact costs.
  const retarget = () => {
    rebuildGoalUnits();
    const next = new Frontier();
    for (const node of nodes) {
      if (node.closed || node.g === Infinity) continue;
      node.h = heuristic(node.ux, node.uy, node.uz);
      next.push(node.g + node.h, node.index);
    }
    frontier = next;
  };

  const pullRoute = async (route: Route): Promise<void> => {
    const t0 = performance.now();
    countClassify = false;
    try {
      const raw: Position[] = route.path.map((index) => centerOf(nodes[index]!));
      const portAt: Position = [route.port.lng, route.port.lat];
      if (raw.length === 0 || metersBetween(raw[raw.length - 1]!, portAt) > 1) raw.push(portAt);
      route.pulled = await tighten(await straighten(raw, resolution, classify), resolution, classify);
      route.pathMeters = lineLength(route.pulled);
    } finally {
      countClassify = true;
      pullMs += performance.now() - t0;
    }
  };

  /** Pulled length of the current Kth result, or infinity until K routes exist. */
  const cutoff = (): number => {
    if (routes.length < options.maxResults) return Infinity;
    const lengths = routes.map((route) => route.pathMeters).sort((a, b) => a - b);
    return lengths[options.maxResults - 1]!;
  };

  /** Drop unfound ports whose geodesic cannot beat the Kth pulled length. */
  const dropHopeless = (): void => {
    const cut = cutoff();
    if (!Number.isFinite(cut)) return;
    for (const [cell, port] of goals) {
      if ((geodesicOf.get(port) ?? 0) >= cut - 1) goals.delete(cell);
    }
  };

  while (frontier.size > 0) {
    const node = nodes[frontier.pop()]!;
    if (node.closed) continue;
    // Mixed-weighted g is not kilometers. Walked meters plus the remaining
    // geodesic is the bound the 350 km cutoff is about.
    if (node.travel + node.h > options.maxMeters) {
      hitDistance = true;
      node.closed = true;
      continue;
    }
    node.closed = true;
    node.expanded = steps.length;
    const step: Step | null = trace ? { node: node.index, discovered: [] } : null;
    if (step) steps.push(step);
    expansions++;
    const port = goals.get(node.cell);
    if (port) {
      const route = routeTo(node, port);
      routes.push(route);
      goals.delete(node.cell);
      await pullRoute(route);
      dropHopeless();
      if (goals.size === 0) {
        stop = "found";
        break;
      }
      retarget();
    }
    if (expansions >= options.maxExpansions) {
      stop = "expansions";
      break;
    }

    let aborted = false;
    for (let direction = 0; direction < 6; direction++) {
      const ni = node.i + DI[direction]!;
      const nj = node.j + DJ[direction]!;
      const slot = slotOf(ni, nj);
      if (slot < 0) continue;
      if (kinds[slot] === KIND_UNKNOWN) {
        await classifyPatch(ni, nj);
        if (options.cancelled()) {
          aborted = true;
          break;
        }
      }
      const kind = kinds[slot]!;
      if (kind !== KIND_WATER && kind !== KIND_MIXED) continue;
      const existing = nodeOf[slot]!;
      if (existing >= 0 && nodes[existing]!.closed) continue;
      const created = existing < 0;
      const id = created ? ensure(slot, ni, nj, node.expanded) : existing;
      if (created && step) step.discovered.push(id);
      const next = nodes[id]!;
      const meters = metersBetweenNodes(node, next);
      const travel = node.travel + meters;
      if (travel > options.maxMeters) continue;
      const g = node.g + (next.state === "mixed" ? meters * options.mixedCost : meters);
      if (g < next.g) {
        next.g = g;
        next.travel = travel;
        next.parent = node.index;
        frontier.push(g + next.h, next.index);
      }
    }
    if (aborted) {
      stop = "cancelled";
      break;
    }

    if (expansions % YIELD_EVERY === 0) {
      options.onProgress?.({ expansions, frontier: frontier.size });
      await yieldToBrowser();
      if (options.cancelled()) {
        stop = "cancelled";
        break;
      }
    }
  }
  if (stop === "exhausted" && hitDistance) stop = "distance";
  for (const route of routes) {
    if (route.pulled.length === 0) await pullRoute(route);
  }
  routes.sort((a, b) => a.pathMeters - b.pathMeters || a.hexMeters - b.hexMeters);
  routes.splice(options.maxResults);
  routes.forEach((route, index) => {
    route.rank = index + 1;
  });

  return {
    nodes,
    steps,
    starts,
    goals: allGoals,
    routes,
    expansions,
    classified,
    statesCalls,
    classifyMs,
    searchMs: performance.now() - started - pullMs,
    pullMs,
    stop,
  };
}

async function fetchPorts(lng: number, lat: number, km: number): Promise<Port[]> {
  const response = await fetch(`/api/ports?lng=${lng}&lat=${lat}&km=${km}`);
  if (!response.ok) throw new Error(`ports request failed: ${response.status}`);
  return (await response.json()) as Port[];
}

function boundaryRing(cell: string): Position[] {
  const raw = cellToBoundary(cell, true);
  const centerLat = cellToLatLng(cell)[0];
  const ring: Position[] = [[raw[0]![0]!, raw[0]![1]!]];
  for (let i = 1; i < raw.length; i++) {
    let lng = raw[i]![0]!;
    const prev = ring[ring.length - 1]![0]!;
    while (lng - prev > 180) lng -= 360;
    while (prev - lng > 180) lng += 360;
    ring.push([lng, raw[i]![1]!]);
  }
  let closeLng = ring[0]![0]!;
  const prev = ring[ring.length - 1]![0]!;
  while (closeLng - prev > 180) closeLng -= 360;
  while (prev - closeLng > 180) closeLng += 360;
  if (Math.abs(closeLng - ring[0]![0]!) > 180) {
    const pole = centerLat >= 0 ? 89.999999 : -89.999999;
    ring.push([closeLng, raw[0]![1]!]);
    ring.push([closeLng, pole]);
    ring.push([ring[0]![0]!, pole]);
  }
  ring.push(ring[0]!);
  return ring;
}

function unwrapLine(coords: Position[]): Position[] {
  if (coords.length === 0) return [];
  const out: Position[] = [[coords[0]![0]!, coords[0]![1]!]];
  for (let i = 1; i < coords.length; i++) {
    let lng = coords[i]![0]!;
    const prev = out[out.length - 1]![0]!;
    while (lng - prev > 180) lng -= 360;
    while (prev - lng > 180) lng += 360;
    out.push([lng, coords[i]![1]!]);
  }
  return out;
}

function centerOf(node: Node): Position {
  const [lat, lng] = cellToLatLng(node.cell);
  return [lng, lat];
}

function km(meters: number): string {
  return (meters / 1000).toFixed(1) + " km";
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
}

const ui = {
  resolution: el<HTMLSelectElement>("resolution"),
  archiveNote: el<HTMLSpanElement>("archive-note"),
  sketch: el<HTMLSelectElement>("sketch"),
  pickStart: el<HTMLInputElement>("pick-start"),
  mixedCost: el<HTMLInputElement>("mixed-cost"),
  maxKm: el<HTMLInputElement>("max-km"),
  maxExpansions: el<HTMLInputElement>("max-expansions"),
  maxGoals: el<HTMLInputElement>("max-goals"),
  maxResults: el<HTMLInputElement>("max-results"),
  run: el<HTMLButtonElement>("run"),
  benchmark: el<HTMLButtonElement>("benchmark"),
  benchmarkRuns: el<HTMLInputElement>("benchmark-runs"),
  cancel: el<HTMLButtonElement>("cancel"),
  status: el<HTMLParagraphElement>("status"),
  error: el<HTMLParagraphElement>("error"),
  player: el<HTMLDivElement>("player"),
  toStart: el<HTMLButtonElement>("to-start"),
  back: el<HTMLButtonElement>("back"),
  play: el<HTMLButtonElement>("play"),
  forward: el<HTMLButtonElement>("forward"),
  toEnd: el<HTMLButtonElement>("to-end"),
  speed: el<HTMLSelectElement>("speed"),
  slider: el<HTMLInputElement>("slider"),
  readout: el<HTMLDivElement>("readout"),
  routes: el<HTMLDivElement>("routes"),
  benchTable: el<HTMLDivElement>("bench-table"),
};

function readOptions(): Omit<SearchOptions, "trace" | "cancelled" | "onProgress"> {
  return {
    resolution: Number(ui.resolution.value),
    mixedCost: Math.max(1, Number(ui.mixedCost.value) || 10),
    maxMeters: Math.max(1, Number(ui.maxKm.value) || 350) * 1000,
    maxExpansions: Math.max(1, Number(ui.maxExpansions.value) || 1_000_000),
    maxGoals: Math.max(1, Number(ui.maxGoals.value) || 32),
    maxResults: Math.max(1, Number(ui.maxResults.value) || 3),
  };
}

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11",
  center: [-119.83, 33.95],
  zoom: 9,
});
map.addControl(new mapboxgl.NavigationControl(), "top-right");

const empty = { type: "FeatureCollection", features: [] };
const sketchById = new Map<string, Feature>();
let customStart: Feature | null = null;
let cancelRequested = false;
let busy = false;

function currentStart(): Feature | null {
  if (customStart) return customStart;
  return sketchById.get(ui.sketch.value) ?? null;
}

function renderStart(): void {
  const source = map.getSource("start");
  if (!source) return;
  const feature = currentStart();
  source.setData(feature ? { type: "FeatureCollection", features: [feature] } : empty);
}

function flyTo(feature: Feature): void {
  const coords = coordinatesOf(feature);
  if (coords.length === 0) return;
  if (feature.geometry.type === "Point") {
    map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 9) });
    return;
  }
  const lngs = coords.map((coord) => coord[0]!);
  const lats = coords.map((coord) => coord[1]!);
  let west = Math.min(...lngs);
  let east = Math.max(...lngs);
  if (east - west > 180) {
    const shifted = lngs.map((lng) => (lng < 0 ? lng + 360 : lng));
    west = Math.min(...shifted);
    east = Math.max(...shifted);
  }
  map.fitBounds(
    [
      [west, Math.min(...lats)],
      [east, Math.max(...lats)],
    ],
    { padding: 120, maxZoom: 11, duration: 1200 }
  );
}

/** Replay state for the recorded search. */
class Player {
  cursor = 0;
  playing = false;
  private openAfter: number[];
  private frame = 0;

  constructor(readonly result: SearchResult) {
    const openAfter = [result.starts.length];
    for (const step of result.steps) {
      let open = openAfter[openAfter.length - 1]! - 1;
      for (const index of step.discovered) {
        if (result.nodes[index]!.state !== "land") open++;
      }
      openAfter.push(open);
    }
    this.openAfter = openAfter;
  }

  get length(): number {
    return this.result.steps.length;
  }

  private setPhase(index: number, phase: number): void {
    if (phase === 0) map.removeFeatureState({ source: "cells", id: index }, "phase");
    else map.setFeatureState({ source: "cells", id: index }, { phase });
  }

  private forward(): void {
    const step = this.result.steps[this.cursor]!;
    if (this.cursor > 0) this.setPhase(this.result.steps[this.cursor - 1]!.node, 2);
    this.setPhase(step.node, 3);
    for (const index of step.discovered) {
      this.setPhase(index, this.result.nodes[index]!.state === "land" ? 4 : 1);
    }
    this.cursor++;
  }

  private backward(): void {
    const step = this.result.steps[this.cursor - 1]!;
    for (const index of step.discovered) this.setPhase(index, 0);
    this.setPhase(step.node, 1);
    if (this.cursor - 1 > 0) this.setPhase(this.result.steps[this.cursor - 2]!.node, 3);
    this.cursor--;
  }

  reset(): void {
    map.removeFeatureState({ source: "cells" });
    for (const index of this.result.starts) this.setPhase(index, 1);
    this.cursor = 0;
  }

  seek(target: number): void {
    const clamped = Math.max(0, Math.min(this.length, Math.round(target)));
    // Going back is one undo per step; replaying from zero is cheaper when
    // the target is closer to the start than to the cursor.
    if (clamped < this.cursor && clamped < this.cursor - clamped) this.reset();
    while (this.cursor < clamped) this.forward();
    while (this.cursor > clamped) this.backward();
    this.render();
  }

  render(): void {
    const { nodes, steps } = this.result;
    ui.slider.value = String(this.cursor);
    const pathSource = map.getSource("path");
    const lines: Position[][] = [];
    let current: Node | null = null;
    if (this.cursor > 0 && this.cursor < this.length) {
      current = nodes[steps[this.cursor - 1]!.node]!;
      const chain: Position[] = [];
      let walk: Node | null = current;
      while (walk) {
        chain.push(centerOf(walk));
        walk = walk.parent >= 0 ? nodes[walk.parent]! : null;
      }
      if (chain.length > 1) lines.push(unwrapLine(chain));
    } else if (this.cursor > 0) {
      current = nodes[steps[this.cursor - 1]!.node]!;
    }
    pathSource?.setData({
      type: "FeatureCollection",
      features: lines.map((line) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: line },
      })),
    });
    map.getSource("result")?.setData(routeCollection(this.result, this.cursor));
    const parts = [`step ${this.cursor.toLocaleString()} / ${this.length.toLocaleString()}`];
    parts.push(`${this.openAfter[this.cursor]!.toLocaleString()} open`);
    if (current) {
      parts.push(
        `${current.state} · g ${km(current.g)} · h ${km(current.h)} · f ${km(current.g + current.h)}`
      );
      parts.push(current.cell);
    }
    ui.readout.textContent = parts.join("\n");
    ui.play.textContent = this.playing ? "Pause" : "Play";
  }

  togglePlay(): void {
    if (this.playing) {
      this.playing = false;
      cancelAnimationFrame(this.frame);
      this.render();
      return;
    }
    if (this.cursor >= this.length) this.seek(0);
    this.playing = true;
    const tick = () => {
      if (!this.playing) return;
      const perFrame = Number(ui.speed.value) || 1;
      const target = Math.min(this.length, this.cursor + perFrame);
      while (this.cursor < target) this.forward();
      this.render();
      if (this.cursor >= this.length) {
        this.playing = false;
        this.render();
        return;
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    this.playing = false;
    cancelAnimationFrame(this.frame);
  }
}

let player: Player | null = null;

function fail(error: unknown): void {
  ui.error.textContent = error instanceof Error ? error.message : String(error);
}

function setBusy(next: boolean): void {
  busy = next;
  ui.run.disabled = next;
  ui.benchmark.disabled = next;
  ui.cancel.disabled = !next;
}

function describe(result: SearchResult, land: LandOccupancy, extra: string[] = []): string {
  const lines: string[] = [];
  if (result.routes.length === 0) {
    lines.push(`no port reached (${result.stop})`);
  } else {
    for (const route of result.routes) {
      lines.push(
        `${route.rank}. ${route.port.name} (${route.port.country}) · pulled ${km(route.pathMeters)} · hex ${km(route.hexMeters)} · ${route.pulled.length}/${route.path.length} verts`
      );
    }
    if (result.stop === "distance") lines.push("stopped: remaining routes exceed the km limit");
    else if (result.stop !== "found") lines.push(`stopped: ${result.stop}`);
  }
  lines.push(
    `${result.expansions.toLocaleString()} expansions · ${result.nodes.length.toLocaleString()} cells discovered`
  );
  lines.push(
    `${result.classified.toLocaleString()} cells classified in ${result.statesCalls.toLocaleString()} states() calls`
  );
  lines.push(
    `${land.stats.requests} archive requests · ${(land.stats.bytes / 1024).toFixed(0)} KB · ${land.stats.records.toLocaleString()} records cached`
  );
  const walkMs = Math.max(0, result.searchMs - result.classifyMs);
  lines.push(
    `walk ${walkMs.toFixed(0)} ms · grid ${result.classifyMs.toFixed(0)} ms · pull ${result.pullMs.toFixed(0)} ms`
  );
  return lines.concat(extra).join("\n");
}

/** Draws the recorded run and returns how long that took. */
function showTrace(result: SearchResult): number {
  const built = performance.now();
  const features = result.nodes.map((node) => ({
    type: "Feature",
    id: node.index,
    properties: { s: node.state === "water" ? 0 : node.state === "mixed" ? 1 : 2 },
    geometry: { type: "Polygon", coordinates: [boundaryRing(node.cell)] },
  }));
  map.getSource("cells").setData({ type: "FeatureCollection", features });
  const reached = new Set(result.routes.map((route) => route.node.cell));
  const reachedRoute = new Map(result.routes.map((route) => [route.port.name, route]));
  const marks: Feature[] = [];
  for (const [cell, port] of result.goals) {
    const [lat, lng] = cellToLatLng(cell);
    const route = reachedRoute.get(port.name);
    const hit = reached.has(cell);
    marks.push({
      type: "Feature",
      properties: {
        kind: "goal",
        name: port.name,
        reached: hit,
        color: hit && route ? rankColor(route.rank) : CONSIDERED_COLOR,
        label: matchLabel(port.name, route?.pathMeters ?? null, hit),
        offset: labelOffset(hit && route ? route.rank - 1 : marks.length),
      },
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
  }
  for (const index of result.starts) {
    marks.push({
      type: "Feature",
      properties: { kind: "start" },
      geometry: { type: "Polygon", coordinates: [boundaryRing(result.nodes[index]!.cell)] },
    });
  }
  map.getSource("marks").setData({ type: "FeatureCollection", features: marks });
  map.getSource("result").setData(routeCollection(result, result.steps.length));
  player?.stop();
  player = new Player(result);
  ui.slider.max = String(player.length);
  ui.player.hidden = false;
  player.reset();
  player.seek(player.length);
  renderRouteButtons(result);
  return performance.now() - built;
}

function routeCollection(result: SearchResult, cursor: number) {
  return {
    type: "FeatureCollection" as const,
    features: result.routes
      .filter((route) => route.path.length > 1 && cursor > route.step)
      .map((route) => ({
        type: "Feature" as const,
        properties: { rank: route.rank, port: route.port.name, meters: Math.round(route.pathMeters) },
        geometry: {
          type: "LineString" as const,
          coordinates: unwrapLine(route.pulled.length > 1 ? route.pulled : route.path.map((index) => centerOf(result.nodes[index]!))),
        },
      })),
  };
}

function renderRouteButtons(result: SearchResult): void {
  ui.routes.replaceChildren();
  for (const route of result.routes) {
    ui.routes.appendChild(matchButton(route.rank, route.port.name, route.pathMeters));
  }
  markRouteList(ui.routes, ui.sketch.value);
  const matched = new Set(result.routes.map((route) => route.port.name));
  const candidates = document.getElementById("candidates");
  if (!candidates) return;
  candidates.replaceChildren();
  for (const port of result.goals.values()) {
    if (matched.has(port.name)) continue;
    candidates.appendChild(consideredItem(port.name, "considered"));
  }
}

function clearTrace(): void {
  player?.stop();
  player = null;
  ui.player.hidden = true;
  ui.routes.replaceChildren();
  document.getElementById("candidates")?.replaceChildren();
  for (const id of ["cells", "path", "result", "marks"]) map.getSource(id)?.setData(empty);
}

async function runAnimated(): Promise<void> {
  const feature = currentStart();
  if (!feature) return;
  const options = readOptions();
  setBusy(true);
  cancelRequested = false;
  clearTrace();
  ui.error.textContent = "";
  ui.status.textContent = "opening archive…";
  try {
    const [lng, lat] = centroidOf(feature);
    const land = await openLandOccupancy(archiveFor(options.resolution));
    const ports = await fetchPorts(lng!, lat!, options.maxMeters / 1000);
    ui.status.textContent = `searching · ${ports.length} ports in range`;
    const result = await search(land, feature, ports, {
      ...options,
      trace: true,
      cancelled: () => cancelRequested,
      onProgress: (info) => {
        ui.status.textContent = `searching · ${info.expansions.toLocaleString()} expansions · ${info.frontier.toLocaleString()} in frontier`;
      },
    });
    const drawMs = showTrace(result);
    const frame: Position[] = coordinatesOf(feature);
    for (const route of result.routes) frame.push(...route.pulled);
    const reachedCells = new Set(result.routes.map((route) => route.node.cell));
    const nearby: Position[] = [];
    for (const cell of result.goals.keys()) {
      const [lat, lng] = cellToLatLng(cell);
      const position: Position = [lng, lat];
      if (reachedCells.has(cell)) frame.push(position);
      else nearby.push(position);
    }
    fitSolution(map, frame, nearby);
    ui.status.textContent = describe(result, land, [
      `resolution ${options.resolution} · ${result.goals.size} goal cells`,
      `trace drawn in ${drawMs.toFixed(0)} ms`,
    ]);
  } catch (error) {
    fail(error);
    ui.status.textContent = "the search failed";
  } finally {
    setBusy(false);
  }
}

type BenchRow = {
  run: number;
  openMs: number;
  searchMs: number;
  pullMs: number;
  expansions: number;
  classified: number;
  statesCalls: number;
  requests: number;
  kb: number;
  port: string;
  cost: number;
};

function renderBench(rows: BenchRow[], resolution: number): void {
  const header = ["run", "open ms", "search ms", "pull ms", "expansions", "classified", "states()", "requests", "KB", "port", "cost"];
  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  for (const label of header) {
    const cell = document.createElement("th");
    cell.textContent = label;
    head.appendChild(cell);
  }
  const body = table.createTBody();
  const addRow = (values: Array<string | number>, strong = false) => {
    const row = body.insertRow();
    for (const value of values) {
      const cell = row.insertCell();
      cell.textContent = typeof value === "number" ? value.toLocaleString() : value;
      if (strong) cell.style.fontWeight = "650";
    }
  };
  for (const row of rows) {
    addRow([
      row.run,
      Math.round(row.openMs),
      Math.round(row.searchMs),
      Math.round(row.pullMs),
      row.expansions,
      row.classified,
      row.statesCalls,
      row.requests,
      Math.round(row.kb),
      row.port,
      Number.isFinite(row.cost) ? km(row.cost) : "—",
    ]);
  }
  if (rows.length > 1) {
    const mid = Math.floor(rows.length / 2);
    const opens = rows.map((row) => row.openMs).sort((a, b) => a - b);
    const searches = rows.map((row) => row.searchMs).sort((a, b) => a - b);
    const pulls = rows.map((row) => row.pullMs).sort((a, b) => a - b);
    addRow(
      ["median", Math.round(opens[mid]!), Math.round(searches[mid]!), Math.round(pulls[mid]!), "", "", "", "", "", "", ""],
      true
    );
  }
  const caption = document.createElement("p");
  caption.textContent = `resolution ${resolution} · each run opens a new archive reader with an empty cache; the browser's HTTP cache may still serve the bytes`;
  ui.benchTable.replaceChildren(caption, table);
}

async function runBenchmark(): Promise<void> {
  const feature = currentStart();
  if (!feature) return;
  const options = readOptions();
  const runs = Math.max(1, Math.min(50, Number(ui.benchmarkRuns.value) || 3));
  setBusy(true);
  cancelRequested = false;
  ui.error.textContent = "";
  ui.benchTable.replaceChildren();
  const rows: BenchRow[] = [];
  try {
    const [lng, lat] = centroidOf(feature);
    const ports = await fetchPorts(lng!, lat!, options.maxMeters / 1000);
    for (let run = 1; run <= runs; run++) {
      ui.status.textContent = `benchmark run ${run} / ${runs}…`;
      const t0 = performance.now();
      const land = await openLandOccupancy(archiveFor(options.resolution));
      const t1 = performance.now();
      const result = await search(land, feature, ports, {
        ...options,
        trace: false,
        cancelled: () => cancelRequested,
      });
      rows.push({
        run,
        openMs: t1 - t0,
        searchMs: result.searchMs,
        pullMs: result.pullMs,
        expansions: result.expansions,
        classified: result.classified,
        statesCalls: result.statesCalls,
        requests: land.stats.requests,
        kb: land.stats.bytes / 1024,
        port:
          result.routes.length > 0
            ? result.routes.map((route) => route.port.name).join(", ")
            : `none (${result.stop})`,
        cost: result.routes[0]?.cost ?? Infinity,
      });
      renderBench(rows, options.resolution);
      if (cancelRequested) break;
    }
    ui.status.textContent = `benchmark finished · ${rows.length} run${rows.length === 1 ? "" : "s"}`;
  } catch (error) {
    fail(error);
    ui.status.textContent = "the benchmark failed";
  } finally {
    setBusy(false);
  }
}

function updateArchiveNote(): void {
  const resolution = Number(ui.resolution.value);
  ui.archiveNote.textContent = `land-res${resolution <= 8 ? 8 : 9}.h3ld`;
}

map.on("load", async () => {
  paintBasemap(map);
  for (const id of ["cells", "path", "result", "marks", "start"]) {
    map.addSource(id, { type: "geojson", data: empty });
  }
  const closedColor = [
    "match",
    ["get", "s"],
    0,
    CLASS_COLOR.water,
    1,
    CLASS_COLOR.mixed,
    CLASS_COLOR.land,
  ];
  map.addLayer({
    id: "cells-fill",
    type: "fill",
    source: "cells",
    paint: {
      "fill-color": [
        "match",
        ["coalesce", ["feature-state", "phase"], 0],
        1,
        "#facc15",
        2,
        closedColor,
        3,
        "#ef4444",
        4,
        CLASS_COLOR.land,
        "#000000",
      ],
      "fill-opacity": [
        "match",
        ["coalesce", ["feature-state", "phase"], 0],
        1,
        0.45,
        2,
        [
          "match",
          ["get", "s"],
          0,
          CLASS_OPACITY.water,
          1,
          CLASS_OPACITY.mixed,
          CLASS_OPACITY.land,
        ],
        3,
        0.55,
        4,
        CLASS_OPACITY.land,
        0,
      ],
    },
  });
  map.addLayer({
    id: "cells-line",
    type: "line",
    source: "cells",
    paint: {
      "line-color": ["match", ["get", "s"], 0, CLASS_EDGE.water, 1, CLASS_EDGE.mixed, CLASS_EDGE.land],
      "line-width": 1,
      "line-opacity": ["case", [">", ["coalesce", ["feature-state", "phase"], 0], 0], 0.8, 0],
    },
  });
  map.addLayer({
    id: "start-fill",
    type: "fill",
    source: "start",
    paint: { "fill-color": "#111827", "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: "start-line",
    type: "line",
    source: "start",
    paint: { "line-color": "#111827", "line-width": 2, "line-dasharray": [1.2, 1] },
  });
  map.addLayer({
    id: "start-point",
    type: "circle",
    source: "start",
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 6, "circle-color": "#111827", "circle-stroke-color": "#fff", "circle-stroke-width": 2 },
  });
  map.addLayer({
    id: "marks-start",
    type: "line",
    source: "marks",
    filter: ["==", ["get", "kind"], "start"],
    paint: { "line-color": "#111827", "line-width": 1.5 },
  });
  map.addLayer({
    id: "result-casing",
    type: "line",
    source: "result",
    paint: { "line-color": "#f8fafc", "line-width": 9, "line-opacity": 0.95 },
  });
  map.addLayer({
    id: "result-line",
    type: "line",
    source: "result",
    paint: {
      "line-color": ["match", ["get", "rank"], 1, "#7c3aed", 2, "#db2777", 3, "#0891b2", "#64748b"],
      "line-width": 5,
      "line-opacity": 1,
    },
  });
  map.addLayer({
    id: "path-line",
    type: "line",
    source: "path",
    paint: { "line-color": "#ef4444", "line-width": 2.5 },
  });
  addReferencePorts(map);
  map.addLayer({
    id: "marks-goal",
    type: "circle",
    source: "marks",
    filter: ["==", ["get", "kind"], "goal"],
    paint: {
      "circle-radius": ["case", ["get", "reached"], 7, 5],
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "marks-goal-label",
    type: "symbol",
    source: "marks",
    filter: ["==", ["get", "kind"], "goal"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": ["case", ["get", "reached"], 13, 11],
      "text-anchor": "left",
      "text-offset": ["get", "offset"],
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#1c2430", "text-halo-color": "#f8fafc", "text-halo-width": 1.6 },
  });
  map.on("click", "result-line", (event: any) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    const props = feature.properties;
    new mapboxgl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(`<strong>${props.port}</strong><br>${(props.meters / 1000).toFixed(1)} km`)
      .addTo(map);
  });
  map.on("click", "cells-fill", (event: any) => {
    const feature = event.features && event.features[0];
    if (!feature || !player) return;
    const node = player.result.nodes[feature.id];
    if (!node) return;
    const lines = [
      `<strong>${node.state}</strong>`,
      `<code>${node.cell}</code>`,
      node.expanded >= 0 ? `expanded at step ${node.expanded + 1}` : "never expanded",
      node.discovered >= 0 ? `discovered at step ${node.discovered + 1}` : "start cell",
      Number.isFinite(node.g) ? `g ${km(node.g)} · h ${km(node.h)}` : `h ${km(node.h)}`,
    ];
    new mapboxgl.Popup().setLngLat(event.lngLat).setHTML(lines.join("<br>")).addTo(map);
  });
  map.on("click", (event: any) => {
    if (!ui.pickStart.checked || busy) return;
    customStart = {
      type: "Feature",
      properties: { name: "custom" },
      geometry: { type: "Point", coordinates: [event.lngLat.lng, event.lngLat.lat] },
    };
    clearTrace();
    renderStart();
    ui.status.textContent = `start ${event.lngLat.lng.toFixed(4)}, ${event.lngLat.lat.toFixed(4)}`;
  });

  const listed = (await fetch("/api/sketches").then((response) => response.json())) as Array<{
    id: string;
    feature: Feature;
  }>;
  for (const item of listed) sketchById.set(item.id, item.feature);
  for (const id of sketchById.keys()) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    ui.sketch.appendChild(option);
  }
  ui.sketch.value = "gull-island";
  renderStart();
  flyTo(currentStart()!);
});

ui.sketch.addEventListener("change", () => {
  customStart = null;
  clearTrace();
  renderStart();
  const feature = currentStart();
  if (feature) flyTo(feature);
  ui.status.textContent = ui.sketch.value;
  ui.error.textContent = "";
});
ui.pickStart.addEventListener("change", () => {
  map.getCanvas().style.cursor = ui.pickStart.checked ? "crosshair" : "";
  if (!ui.pickStart.checked && customStart) {
    customStart = null;
    clearTrace();
    renderStart();
  }
});
ui.resolution.addEventListener("change", updateArchiveNote);
ui.run.addEventListener("click", () => void runAnimated());
ui.benchmark.addEventListener("click", () => void runBenchmark());
ui.cancel.addEventListener("click", () => {
  cancelRequested = true;
});
ui.toStart.addEventListener("click", () => player?.seek(0));
ui.toEnd.addEventListener("click", () => player?.seek(player.length));
ui.back.addEventListener("click", () => player?.seek(player.cursor - 1));
ui.forward.addEventListener("click", () => player?.seek(player.cursor + 1));
ui.play.addEventListener("click", () => player?.togglePlay());
ui.slider.addEventListener("input", () => {
  if (!player) return;
  if (player.playing) player.togglePlay();
  player.seek(Number(ui.slider.value));
});
document.addEventListener("keydown", (event) => {
  if (!player || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
    return;
  }
  if (event.key === "ArrowRight") {
    player.seek(player.cursor + (event.shiftKey ? 10 : 1));
    event.preventDefault();
  } else if (event.key === "ArrowLeft") {
    player.seek(player.cursor - (event.shiftKey ? 10 : 1));
    event.preventDefault();
  } else if (event.key === " ") {
    player.togglePlay();
    event.preventDefault();
  }
});
updateArchiveNote();
