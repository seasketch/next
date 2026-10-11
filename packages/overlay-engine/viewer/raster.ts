/**
 * Map for the ocean-bitmap search. The walk itself is in bitmapSearch.ts.
 */
import { Feature, Polygon, Position } from "geojson";
import { openLandOccupancy } from "@seasketch/h3-land/client";
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
  setBounds,
} from "./frame";
import {
  ExitReport,
  Grid,
  Node,
  Port,
  RANK_COLOR,
  SearchOptions,
  SearchResult,
  archiveFor,
  centroid,
  geometryRings,
  kindName,
  km,
  landPolygonsFrom,
  sampleResolution,
  searchBitmap,
  wrapLng,
} from "../src/h3/bitmapSearch";
import { ExitRaster } from "../src/h3/vectorExit";

const landPolygons = landPolygonsFrom();
// Open the land source while the page settles so the first exit does not pay for it.
landPolygons.warm?.().catch((error) => console.warn("land polygons", error));

declare const mapboxgl: any;

const MAPBOX_TOKEN =
  new URLSearchParams(location.search).get("token") ||
  localStorage.getItem("mapboxToken") ||
  "";

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
}

const SETTINGS_KEY = "ocean-bitmap-settings";

type SavedSettings = {
  degrees?: string;
  margin?: string;
  sketch?: string;
  pickStart?: boolean;
  start?: [number, number] | null;
  maxResults?: string;
  maxKm?: string;
  maxExpansions?: string;
  maxGoals?: string;
  runs?: string;
  center?: [number, number] | null;
  zoom?: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function savedString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function savedPair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const lng = value[0];
  const lat = value[1];
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function loadSettings(): SavedSettings {
  try {
    const record = asRecord(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null"),
    );
    if (!record) return {};
    const zoom = record.zoom;
    return {
      degrees: savedString(record, "degrees"),
      margin: savedString(record, "margin"),
      sketch: savedString(record, "sketch"),
      pickStart: record.pickStart === true,
      start: savedPair(record.start),
      maxResults: savedString(record, "maxResults"),
      maxKm: savedString(record, "maxKm"),
      maxExpansions: savedString(record, "maxExpansions"),
      maxGoals: savedString(record, "maxGoals"),
      runs: savedString(record, "runs"),
      center: savedPair(record.center),
      zoom: typeof zoom === "number" && Number.isFinite(zoom) ? zoom : null,
    };
  } catch {
    return {};
  }
}

const ui = {
  degrees: el<HTMLSelectElement>("degrees"),
  margin: el<HTMLInputElement>("margin"),
  sketch: el<HTMLSelectElement>("sketch"),
  pickStart: el<HTMLInputElement>("pick-start"),
  maxResults: el<HTMLInputElement>("max-results"),
  maxKm: el<HTMLInputElement>("max-km"),
  maxExpansions: el<HTMLInputElement>("max-expansions"),
  maxGoals: el<HTMLInputElement>("max-goals"),
  runs: el<HTMLInputElement>("benchmark-runs"),
  run: el<HTMLButtonElement>("run"),
  benchmark: el<HTMLButtonElement>("benchmark"),
  cancel: el<HTMLButtonElement>("cancel"),
  status: el<HTMLParagraphElement>("status"),
  error: el<HTMLParagraphElement>("error"),
  routes: el<HTMLDivElement>("routes"),
  player: el<HTMLDivElement>("player"),
  toStart: el<HTMLButtonElement>("to-start"),
  back: el<HTMLButtonElement>("back"),
  play: el<HTMLButtonElement>("play"),
  forward: el<HTMLButtonElement>("forward"),
  toEnd: el<HTMLButtonElement>("to-end"),
  speed: el<HTMLSelectElement>("speed"),
  slider: el<HTMLInputElement>("slider"),
  readout: el<HTMLDivElement>("readout"),
  bench: el<HTMLDivElement>("bench-table"),
  archiveNote: el<HTMLSpanElement>("archive-note"),
  fitExit: el<HTMLButtonElement>("fit-exit"),
  debugPort: el<HTMLSelectElement>("debug-port"),
  dbgPolys: el<HTMLInputElement>("dbg-polys"),
  dbgTiles: el<HTMLInputElement>("dbg-tiles"),
  dbgRaster: el<HTMLInputElement>("dbg-raster"),
  dbgChain: el<HTMLInputElement>("dbg-chain"),
  dbgProbes: el<HTMLInputElement>("dbg-probes"),
  dbgVisited: el<HTMLInputElement>("dbg-visited"),
  debugNote: el<HTMLParagraphElement>("debug-note"),
};

const saved = loadSettings();

function restoreChoice(
  select: HTMLSelectElement,
  value: string | undefined,
): void {
  if (!value) return;
  for (const option of Array.from(select.options)) {
    if (option.value === value) {
      select.value = value;
      return;
    }
  }
}

function restoreText(input: HTMLInputElement, value: string | undefined): void {
  if (value == null) return;
  input.value = value;
}

restoreChoice(ui.degrees, saved.degrees);
restoreText(ui.margin, saved.margin);
restoreText(ui.maxResults, saved.maxResults);
restoreText(ui.maxKm, saved.maxKm);
restoreText(ui.maxExpansions, saved.maxExpansions);
restoreText(ui.maxGoals, saved.maxGoals);
restoreText(ui.runs, saved.runs);
ui.pickStart.checked = saved.pickStart === true;

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11",
  center: saved.center ?? [-119.83, 33.95],
  zoom: saved.zoom ?? 9,
});
map.addControl(new mapboxgl.NavigationControl(), "top-right");

const empty = { type: "FeatureCollection", features: [] as Feature[] };
const sketches = new Map<string, Feature>();
let customStart: Feature | null = null;
let persistReady = false;

function saveSettings(): void {
  if (!persistReady) return;
  const center = map.getCenter();
  const point =
    customStart?.geometry?.type === "Point"
      ? customStart.geometry.coordinates
      : null;
  const lng = point?.[0];
  const lat = point?.[1];
  const payload: SavedSettings = {
    degrees: ui.degrees.value,
    margin: ui.margin.value,
    sketch: ui.sketch.value || saved.sketch,
    pickStart: ui.pickStart.checked,
    start:
      typeof lng === "number" && typeof lat === "number" ? [lng, lat] : null,
    maxResults: ui.maxResults.value,
    maxKm: ui.maxKm.value,
    maxExpansions: ui.maxExpansions.value,
    maxGoals: ui.maxGoals.value,
    runs: ui.runs.value,
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  } catch {
    // The page still works if storage is unavailable.
  }
}
let cancelRequested = false;
let busy = false;
let player: Player | null = null;
let lastResult: SearchResult | null = null;
let selectedExit: string | null = null;

function readOptions(): Omit<
  SearchOptions,
  "trace" | "cancelled" | "onProgress"
> {
  return {
    degrees: Number(ui.degrees.value) || 0.01,
    margin: Math.max(0, Math.min(3, Number(ui.margin.value) || 0)),
    maxMeters: Math.max(1, Number(ui.maxKm.value) || 350) * 1000,
    maxExpansions: Math.max(1, Number(ui.maxExpansions.value) || 250_000),
    maxGoals: Math.max(1, Number(ui.maxGoals.value) || 24),
    maxResults: Math.max(1, Number(ui.maxResults.value) || 3),
  };
}

function currentOrigin(): Position | null {
  if (customStart?.geometry?.type === "Point") {
    const [lng, lat] = customStart.geometry.coordinates;
    return [lng!, lat!];
  }
  const feature = sketches.get(ui.sketch.value);
  return feature ? centroid(feature) : null;
}

/** Boundary of the selected sketch. A clicked point start has none. */
function currentRings(): Position[][] | undefined {
  if (customStart) return undefined;
  const feature = sketches.get(ui.sketch.value);
  if (!feature) return undefined;
  const rings = geometryRings(feature);
  return rings.length > 0 ? rings : undefined;
}

function updateArchiveNote(): void {
  const resolution = sampleResolution(Number(ui.degrees.value) || 0.01);
  ui.archiveNote.textContent = `land sample r${resolution}`;
}

function source(id: string): { setData: (data: unknown) => void } | undefined {
  return map.getSource(id) as { setData: (data: unknown) => void } | undefined;
}

function cellRing(grid: Grid, index: number): Position[] {
  const ix = index % grid.cols;
  const iy = (index - ix) / grid.cols;
  const west = grid.originLng + ix * grid.degrees;
  const south = grid.originLat + iy * grid.degrees;
  const east = west + grid.degrees;
  const north = south + grid.degrees;
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

function drawBitmap(result: SearchResult): void {
  const features: Feature<Polygon>[] = [];
  const { grid } = result;
  for (let index = 0; index < grid.kinds.length; index++) {
    const kind = grid.kinds[index]!;
    const name = kindName(kind);
    if (!name) continue;
    features.push({
      type: "Feature",
      properties: { kind: name },
      geometry: { type: "Polygon", coordinates: [cellRing(grid, index)] },
    });
  }
  source("bitmap")?.setData({ type: "FeatureCollection", features });
  source("cells")?.setData({
    type: "FeatureCollection",
    features: result.nodes.map((node, id) => ({
      type: "Feature" as const,
      id,
      properties: {},
      geometry: {
        type: "Polygon" as const,
        coordinates: [cellRing(grid, node.index)],
      },
    })),
  });
}

function drawGoals(result: SearchResult, cursor: number): void {
  source("goals")?.setData({
    type: "FeatureCollection",
    features: result.goals.map((goal, index) => {
      const route = result.routes.find((item) => item.port.name === goal.name);
      const reached = !!route && cursor >= route.step;
      return {
        type: "Feature" as const,
        properties: {
          name: goal.name,
          reached,
          color: reached && route ? rankColor(route.rank) : CONSIDERED_COLOR,
          label: matchLabel(goal.name, route?.pathMeters ?? null, reached),
          offset: labelOffset(reached && route ? route.rank - 1 : index),
        },
        geometry: { type: "Point" as const, coordinates: [goal.lng, goal.lat] },
      };
    }),
  });
  const marks: Feature[] = [];
  for (const goal of result.goals) {
    if (!goal.target) continue;
    const [lng, lat] = goal.target;
    const half = result.grid.degrees / 2;
    marks.push({
      type: "Feature",
      properties: { name: goal.name },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [lng - half, lat - half],
            [lng + half, lat - half],
            [lng + half, lat + half],
            [lng - half, lat + half],
            [lng - half, lat - half],
          ],
        ],
      },
    });
    const approach =
      goal.approach && goal.approach.length >= 2
        ? goal.approach
        : ([
            [goal.lng, goal.lat],
            [lng, lat],
          ] as Position[]);
    marks.push({
      type: "Feature",
      properties: { name: goal.name },
      geometry: { type: "LineString", coordinates: approach },
    });
  }
  source("targets")?.setData({ type: "FeatureCollection", features: marks });
}

function exitOf(result: SearchResult, name: string | null): ExitReport | null {
  if (!name) return result.exits[0] ?? null;
  return (
    result.exits.find((item) => item.port === name) ?? result.exits[0] ?? null
  );
}

function rasterImage(
  raster: ExitRaster,
  showVisited: boolean,
): { url: string; coordinates: Position[] } | null {
  if (raster.width < 1 || raster.height < 1) return null;
  const canvas = document.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(raster.width, raster.height);
  const data = image.data;
  for (let i = 0; i < raster.kinds.length; i++) {
    const kind = raster.kinds[i]!;
    const visit = raster.visited[i]!;
    const o = i * 4;
    if (kind === 0) {
      data[o + 3] = 0;
      continue;
    }
    if (visit === 2) {
      data[o] = 219;
      data[o + 1] = 39;
      data[o + 2] = 119;
      data[o + 3] = 210;
    } else if (kind === 2) {
      data[o] = 47;
      data[o + 1] = 158;
      data[o + 2] = 68;
      data[o + 3] = showVisited && visit === 1 ? 200 : 140;
    } else {
      data[o] = 29;
      data[o + 1] = 106;
      data[o + 2] = 154;
      data[o + 3] = showVisited && visit === 1 ? 170 : 90;
    }
  }
  ctx.putImageData(image, 0, 0);
  const [west, south, east, north] = raster.bounds;
  return {
    url: canvas.toDataURL("image/png"),
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
  };
}

function setExitRaster(
  image: { url: string; coordinates: Position[] } | null,
): void {
  if (map.getLayer("exit-raster")) map.removeLayer("exit-raster");
  if (map.getSource("exit-raster")) map.removeSource("exit-raster");
  if (!image || !ui.dbgRaster.checked) return;
  map.addSource("exit-raster", {
    type: "image",
    url: image.url,
    coordinates: image.coordinates,
  });
  map.addLayer(
    {
      id: "exit-raster",
      type: "raster",
      source: "exit-raster",
      paint: { "raster-opacity": 0.55 },
    },
    map.getLayer("sketch") ? "sketch" : undefined,
  );
}

function applyDebugVisibility(): void {
  const vis = (on: boolean) => (on ? "visible" : "none");
  if (map.getLayer("exit-polys"))
    map.setLayoutProperty("exit-polys", "visibility", vis(ui.dbgPolys.checked));
  if (map.getLayer("exit-polys-line"))
    map.setLayoutProperty(
      "exit-polys-line",
      "visibility",
      vis(ui.dbgPolys.checked),
    );
  if (map.getLayer("exit-tiles"))
    map.setLayoutProperty("exit-tiles", "visibility", vis(ui.dbgTiles.checked));
  if (map.getLayer("exit-chain"))
    map.setLayoutProperty("exit-chain", "visibility", vis(ui.dbgChain.checked));
  if (map.getLayer("exit-probes"))
    map.setLayoutProperty(
      "exit-probes",
      "visibility",
      vis(ui.dbgProbes.checked),
    );
  if (map.getLayer("exit-raster"))
    map.setLayoutProperty(
      "exit-raster",
      "visibility",
      vis(ui.dbgRaster.checked),
    );
}

function drawExitDebug(result: SearchResult, name: string | null): void {
  const exit = exitOf(result, name);
  selectedExit = exit?.port ?? null;
  const debug = exit?.debug ?? null;
  const polys =
    debug?.features.map((feature, id) => ({
      type: "Feature" as const,
      id,
      properties: {},
      geometry: feature.geometry,
    })) ?? [];
  source("exit-polys")?.setData({ type: "FeatureCollection", features: polys });
  source("exit-tiles")?.setData({
    type: "FeatureCollection",
    features:
      debug?.tiles.map((box, id) => {
        const [west, south, east, north] = box;
        return {
          type: "Feature" as const,
          id,
          properties: {},
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
              ],
            ],
          },
        };
      }) ?? [],
  });
  source("exit-chain")?.setData({
    type: "FeatureCollection",
    features:
      debug && debug.chain.length >= 2
        ? [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: debug.chain,
              },
            },
          ]
        : [],
  });
  source("exit-probes")?.setData({
    type: "FeatureCollection",
    features:
      exit?.probes.map((probe, id) => ({
        type: "Feature" as const,
        id,
        properties: { ok: probe.ok },
        geometry: { type: "Point" as const, coordinates: probe.position },
      })) ?? [],
  });
  setExitRaster(
    debug ? rasterImage(debug.raster, ui.dbgVisited.checked) : null,
  );
  applyDebugVisibility();
  if (!exit) {
    ui.debugNote.textContent =
      "No vector exit on this search. Open ports skip the land file.";
    return;
  }
  const stats = exit.stats;
  const lines = [
    `${exit.port} · ${exit.method}${exit.phase && exit.phase !== "none" ? `/${exit.phase}` : ""}${exit.found ? "" : " · no target"} · ${Math.round(exit.ms)} ms`,
  ];
  if (stats) {
    lines.push(
      `${stats.tiles} tiles · ${stats.features} polygons · ${stats.vertices.toLocaleString()} verts · ${stats.expansions.toLocaleString()} cells`,
    );
    lines.push(
      `fetch ${Math.round(stats.fetchMs)} · paint ${Math.round(stats.rasterMs)} · probes ${Math.round(stats.probeMs)} · ${km(exit.waterMeters)} water · ${km(exit.landMeters)} land`,
    );
  }
  ui.debugNote.textContent = lines.join("\n");
}

function fillDebugPorts(result: SearchResult): void {
  ui.debugPort.replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = result.exits.length
    ? `${result.exits.length} ports`
    : "no exits";
  ui.debugPort.appendChild(blank);
  for (const exit of result.exits) {
    const option = document.createElement("option");
    option.value = exit.port;
    option.textContent = `${exit.port} · ${exit.method}${exit.found ? "" : " · miss"}`;
    ui.debugPort.appendChild(option);
  }
  if (selectedExit) ui.debugPort.value = selectedExit;
}

function focusExit(name: string | null, zoom = false): void {
  if (!lastResult) return;
  selectedExit = name;
  if (name) ui.debugPort.value = name;
  drawExitDebug(lastResult, name);
  if (zoom) fitSelectedExit();
}

function fitSelectedExit(): void {
  if (!lastResult) return;
  const exit = exitOf(lastResult, selectedExit);
  if (!exit) {
    fit(lastResult);
    return;
  }
  const points: Position[] = [[exit.lng, exit.lat]];
  const goal = lastResult.goals.find((item) => item.name === exit.port);
  if (goal?.target) points.push(goal.target);
  if (goal?.approach) points.push(...goal.approach);
  if (exit.debug?.chain.length) points.push(...exit.debug.chain);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    west = Math.min(west, point[0]!);
    east = Math.max(east, point[0]!);
    south = Math.min(south, point[1]!);
    north = Math.max(north, point[1]!);
  }
  setBounds(map, west, south, east, north, { maxZoom: 15, duration: 400 });
}

function parseBounds(args: unknown[]): [number, number, number, number] | null {
  const first = args[0];
  if (Array.isArray(first) && Array.isArray(first[0])) {
    const a = first[0] as number[];
    const b = first[1] as number[];
    return [a[0]!, a[1]!, b[0]!, b[1]!];
  }
  if (Array.isArray(first) && typeof first[0] === "number") {
    const box = first as number[];
    if (box.length >= 4) return [box[0]!, box[1]!, box[2]!, box[3]!];
  }
  if (args.length >= 4 && args.every((value) => typeof value === "number")) {
    return args as [number, number, number, number];
  }
  return null;
}

function describe(result: SearchResult): string {
  const lines = [
    `shore ${Math.round(result.shoreMs)} ms · classify ${Math.round(result.classifyMs)} ms · search ${Math.round(result.searchMs)} ms · smooth ${Math.round(result.smoothMs)} ms`,
    `${result.reachable.toLocaleString()} reachable · ${result.ocean.toLocaleString()} water · ${result.land.toLocaleString()} land · ${result.mixed.toLocaleString()} mixed`,
    `${result.starts.toLocaleString()} departure cells · ${result.expansions.toLocaleString()} expansions · ${result.classified.toLocaleString()} cells · ${result.requests} requests · ${Math.round(result.bytes / 1024)} KB`,
    `stopped: ${result.stop}`,
  ];
  if (result.exits.length > 0) {
    lines.push(
      `vector exits ${Math.round(result.exitMs)} ms: ` +
        result.exits
          .map(
            (exit) =>
              `${exit.port}${exit.found ? "" : " (not found)"} ${exit.method}${exit.phase && exit.phase !== "none" ? `/${exit.phase}` : ""} ${Math.round(exit.ms)} ms (${exit.stats ? `${exit.stats.tiles} tiles, ${exit.stats.features} polygons, ${km(exit.waterMeters)} water, ${km(exit.landMeters)} land` : "no stats"})`,
          )
          .join(" · "),
    );
  }
  return lines.join("\n");
}

function showRoutes(result: SearchResult): void {
  ui.routes.replaceChildren();
  for (const route of result.routes) {
    const button = matchButton(route.rank, route.port.name, route.pathMeters);
    button.addEventListener("click", () => focusExit(route.port.name, true));
    ui.routes.appendChild(button);
  }
  markRouteList(ui.routes, ui.sketch.value);
  const matched = new Set(result.routes.map((route) => route.port.name));
  const candidates = el<HTMLUListElement>("candidates");
  candidates.replaceChildren();
  for (const goal of result.goals) {
    if (matched.has(goal.name)) continue;
    const item = consideredItem(goal.name, "considered");
    item.style.cursor = "pointer";
    item.addEventListener("click", () => focusExit(goal.name, true));
    candidates.appendChild(item);
  }
}

class Player {
  cursor = 0;
  playing = false;
  private frame = 0;

  constructor(readonly result: SearchResult) {}

  get length(): number {
    return this.result.steps.length;
  }

  private setPhase(id: number, phase: number): void {
    map.setFeatureState({ source: "cells", id }, { phase });
  }

  private forward(): void {
    const step = this.result.steps[this.cursor]!;
    if (this.cursor > 0)
      this.setPhase(this.result.steps[this.cursor - 1]!.node, 2);
    this.setPhase(step.node, 3);
    for (const index of step.discovered) this.setPhase(index, 1);
    this.cursor++;
  }

  private backward(): void {
    const step = this.result.steps[this.cursor - 1]!;
    for (const index of step.discovered) this.setPhase(index, 0);
    this.setPhase(step.node, 1);
    if (this.cursor - 1 > 0)
      this.setPhase(this.result.steps[this.cursor - 2]!.node, 3);
    this.cursor--;
  }

  reset(): void {
    map.removeFeatureState({ source: "cells" });
    this.cursor = 0;
  }

  /** Jump to the last frame without replaying every expansion. */
  finish(): void {
    const { steps, nodes } = this.result;
    const phase = new Uint8Array(nodes.length);
    for (let s = 0; s < steps.length; s++) {
      const step = steps[s]!;
      if (s > 0) phase[steps[s - 1]!.node] = 2;
      phase[step.node] = 3;
      for (const id of step.discovered) phase[id] = 1;
    }
    for (let id = 0; id < phase.length; id++) {
      const value = phase[id]!;
      if (value !== 0) this.setPhase(id, value);
    }
    this.cursor = steps.length;
    this.render();
  }

  seek(target: number): void {
    const clamped = Math.max(0, Math.min(this.length, Math.round(target)));
    if (clamped < this.cursor && clamped < this.cursor - clamped) this.reset();
    while (this.cursor < clamped) this.forward();
    while (this.cursor > clamped) this.backward();
    this.render();
  }

  render(): void {
    const { nodes, steps, routes, grid } = this.result;
    ui.slider.max = String(this.length);
    ui.slider.value = String(this.cursor);
    const atEnd = this.length === 0 || this.cursor >= this.length;
    let current: Node | null = null;
    const chain: Position[] = [];
    if (this.cursor > 0 && !atEnd) {
      current = nodes[steps[this.cursor - 1]!.node]!;
      const guard = new Set<number>();
      let walk: Node | null = current;
      while (walk && !guard.has(walk.index)) {
        guard.add(walk.index);
        const ix = walk.index % grid.cols;
        const iy = (walk.index - ix) / grid.cols;
        chain.push([
          grid.originLng + (ix + 0.5) * grid.degrees,
          grid.originLat + (iy + 0.5) * grid.degrees,
        ]);
        walk = walk.parent >= 0 ? nodes[walk.parent]! : null;
      }
      chain.reverse();
    } else if (this.cursor > 0) {
      current = nodes[steps[this.cursor - 1]!.node]!;
    }
    source("current")?.setData(
      chain.length > 1
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: chain },
          }
        : empty,
    );
    source("raw")?.setData({
      type: "FeatureCollection",
      features: atEnd
        ? routes.map((route) => ({
            type: "Feature" as const,
            properties: {},
            geometry: { type: "LineString" as const, coordinates: route.raw },
          }))
        : [],
    });
    source("routes")?.setData({
      type: "FeatureCollection",
      features: routes
        .filter((route) => this.cursor >= route.step)
        .map((route) => ({
          type: "Feature" as const,
          properties: {
            port: route.port.name,
            meters: route.pathMeters,
            color: RANK_COLOR[Math.min(route.rank - 1, RANK_COLOR.length - 1)],
          },
          geometry: {
            type: "LineString" as const,
            coordinates: route.smoothed,
          },
        })),
    });
    drawGoals(this.result, this.cursor);
    const parts = [
      `step ${this.cursor.toLocaleString()} / ${this.length.toLocaleString()}`,
    ];
    if (current && !atEnd) {
      parts.push(
        `g ${km(current.g)} · h ${km(current.h)} · f ${km(current.g + current.h)}`,
      );
    } else if (atEnd) {
      parts.push(
        "grid path hidden · gray is the raw centerline · color is pulled tight",
      );
    }
    ui.readout.textContent = parts.join("\n");
    ui.play.textContent = this.playing ? "Pause" : "Play";
  }

  toggle(): void {
    if (this.playing) {
      this.playing = false;
      cancelAnimationFrame(this.frame);
      this.render();
      return;
    }
    if (this.cursor >= this.length) this.seek(0);
    this.playing = true;
    ui.play.textContent = "Pause";
    const tick = () => {
      if (!this.playing) return;
      const speed = Math.max(1, Number(ui.speed.value) || 1);
      this.seek(Math.min(this.length, this.cursor + speed));
      if (this.cursor >= this.length) {
        this.playing = false;
        this.render();
        return;
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
}

function fit(result: SearchResult): void {
  const points: Position[] = [result.start];
  const feature = customStart ?? sketches.get(ui.sketch.value);
  if (feature?.geometry && "coordinates" in feature.geometry) {
    const walk = (value: unknown): void => {
      if (!Array.isArray(value)) return;
      if (
        value.length >= 2 &&
        typeof value[0] === "number" &&
        typeof value[1] === "number"
      ) {
        points.push([value[0], value[1]]);
        return;
      }
      for (const item of value) walk(item);
    };
    walk(feature.geometry.coordinates);
  }
  for (const route of result.routes) points.push(...route.smoothed);
  const nearby: Position[] = [];
  for (const goal of result.goals) {
    const position: Position = [goal.lng, goal.lat];
    if (goal.reached) points.push(position);
    else nearby.push(position);
  }
  fitSolution(map, points, nearby);
}

function setBusy(next: boolean): void {
  busy = next;
  ui.run.disabled = next;
  ui.benchmark.disabled = next;
  ui.cancel.disabled = !next;
  ui.sketch.disabled = next;
}

async function fetchPorts(
  lng: number,
  lat: number,
  km: number,
): Promise<Port[]> {
  const response = await fetch(
    `/api/ports?lng=${wrapLng(lng)}&lat=${lat}&km=${km}`,
  );
  if (!response.ok) throw new Error(`ports request failed: ${response.status}`);
  return (await response.json()) as Port[];
}

async function runSearch(trace: boolean): Promise<SearchResult> {
  const origin = currentOrigin();
  if (!origin) throw new Error("Choose a start.");
  const options = readOptions();
  const resolution = sampleResolution(options.degrees);
  const opened = performance.now();
  const land = await openLandOccupancy(archiveFor(resolution));
  const openMs = performance.now() - opened;
  ui.status.textContent = `archive open ${Math.round(openMs)} ms`;
  const ports = await fetchPorts(
    origin[0],
    origin[1],
    options.maxMeters / 1000,
  );
  const result = await searchBitmap(land, origin, ports, {
    ...options,
    rings: currentRings(),
    landPolygons,
    trace,
    cancelled: () => cancelRequested,
    onProgress: (text) => {
      ui.status.textContent = text;
    },
  });
  (result as SearchResult & { openMs?: number }).openMs = openMs;
  return result;
}

function rememberOpen(
  result: SearchResult,
  openMs: number,
): SearchResult & { openMs: number } {
  return Object.assign(result, { openMs });
}

async function runAnimated(): Promise<void> {
  cancelRequested = false;
  ui.error.textContent = "";
  player = null;
  ui.player.hidden = true;
  ui.routes.replaceChildren();
  el<HTMLUListElement>("candidates").replaceChildren();
  for (const id of [
    "bitmap",
    "cells",
    "goals",
    "targets",
    "raw",
    "routes",
    "current",
    "exit-polys",
    "exit-tiles",
    "exit-chain",
    "exit-probes",
  ])
    source(id)?.setData(empty);
  setExitRaster(null);
  setBusy(true);
  try {
    const result = await runSearch(true);
    lastResult = result;
    (window as unknown as { lastSearch: SearchResult }).lastSearch = result;
    const first =
      result.routes[0]?.port.name ??
      result.exits.find((item) => item.debug)?.port ??
      result.exits[0]?.port ??
      null;
    selectedExit = first;
    fillDebugPorts(result);
    drawExitDebug(result, first);
    ui.status.textContent = describe(result);
    showRoutes(result);
    if (result.steps.length > 0) {
      drawBitmap(result);
      player = new Player(result);
      ui.player.hidden = false;
      ui.slider.max = String(player.length);
      player.finish();
    } else {
      drawBitmap(result);
      drawGoals(result, 0);
    }
    const feature = customStart ?? sketches.get(ui.sketch.value);
    source("sketch")?.setData(
      feature ? { type: "FeatureCollection", features: [feature] } : empty,
    );
    fit(result);
  } catch (error) {
    ui.error.textContent =
      error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false);
  }
}

async function runBenchmark(): Promise<void> {
  cancelRequested = false;
  ui.error.textContent = "";
  setBusy(true);
  const runs = Math.max(1, Number(ui.runs.value) || 1);
  const rows: Array<SearchResult & { openMs: number }> = [];
  try {
    for (let i = 0; i < runs; i++) {
      ui.status.textContent = `benchmark ${i + 1} / ${runs}`;
      const opened = performance.now();
      const origin = currentOrigin();
      if (!origin) throw new Error("Choose a start.");
      const options = readOptions();
      const land = await openLandOccupancy(
        archiveFor(sampleResolution(options.degrees)),
      );
      const openMs = performance.now() - opened;
      const ports = await fetchPorts(
        origin[0],
        origin[1],
        options.maxMeters / 1000,
      );
      const result = await searchBitmap(land, origin, ports, {
        ...options,
        rings: currentRings(),
        landPolygons,
        trace: false,
        cancelled: () => cancelRequested,
      });
      rows.push(rememberOpen(result, openMs));
      if (cancelRequested) break;
    }
    const table = document.createElement("table");
    const head = document.createElement("tr");
    for (const label of [
      "run",
      "open",
      "shore",
      "classify",
      "search",
      "smooth",
      "expansions",
      "cells",
      "port",
    ]) {
      const cell = document.createElement("th");
      cell.textContent = label;
      head.appendChild(cell);
    }
    table.appendChild(head);
    rows.forEach((row, index) => {
      const tr = document.createElement("tr");
      const values = [
        String(index + 1),
        String(Math.round(row.openMs)),
        String(Math.round(row.shoreMs)),
        String(Math.round(row.classifyMs)),
        String(Math.round(row.searchMs)),
        String(Math.round(row.smoothMs)),
        row.expansions.toLocaleString(),
        row.classified.toLocaleString(),
        row.routes.map((route) => route.port.name).join(", "),
      ];
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        tr.appendChild(cell);
      }
      table.appendChild(tr);
    });
    if (rows.length > 1) {
      const median = (values: number[]) =>
        [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
      const tr = document.createElement("tr");
      for (const value of [
        "median",
        String(Math.round(median(rows.map((row) => row.openMs)))),
        String(Math.round(median(rows.map((row) => row.shoreMs)))),
        String(Math.round(median(rows.map((row) => row.classifyMs)))),
        String(Math.round(median(rows.map((row) => row.searchMs)))),
        String(Math.round(median(rows.map((row) => row.smoothMs)))),
        "",
        "",
        "",
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        tr.appendChild(cell);
      }
      table.appendChild(tr);
    }
    const note = document.createElement("p");
    note.textContent =
      "Each run opens a fresh archive. Shore walks each port across land and mixed cells to water connected to the departure, including the cells read for that walk. Classify is cells read during the search and the string pull. Search is A*, smooth is the corridor string pull. Ports are fetched once per run and are not in these columns.";
    ui.bench.replaceChildren(table, note);
    const last = rows[rows.length - 1];
    if (last) ui.status.textContent = describe(last);
  } catch (error) {
    ui.error.textContent =
      error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false);
  }
}

function flyToFeature(feature: Feature): void {
  const origin = centroid(feature);
  map.flyTo({ center: origin, zoom: 9, duration: 600 });
}

map.on("load", async () => {
  paintBasemap(map);
  for (const id of [
    "sketch",
    "bitmap",
    "cells",
    "goals",
    "targets",
    "raw",
    "routes",
    "current",
    "exit-polys",
    "exit-tiles",
    "exit-chain",
    "exit-probes",
  ]) {
    map.addSource(id, { type: "geojson", data: empty });
  }
  map.addLayer({
    id: "bitmap",
    type: "fill",
    source: "bitmap",
    paint: {
      "fill-color": [
        "match",
        ["get", "kind"],
        "land",
        CLASS_COLOR.land,
        "mixed",
        CLASS_COLOR.mixed,
        "inland",
        CLASS_COLOR.inland,
        "water",
        CLASS_COLOR.water,
        "#94a3b8",
      ],
      "fill-opacity": [
        "match",
        ["get", "kind"],
        "land",
        CLASS_OPACITY.land,
        "mixed",
        CLASS_OPACITY.mixed,
        "inland",
        CLASS_OPACITY.inland,
        "water",
        CLASS_OPACITY.water,
        0.3,
      ],
    },
  });
  map.addLayer({
    id: "bitmap-line",
    type: "line",
    source: "bitmap",
    paint: {
      "line-color": [
        "match",
        ["get", "kind"],
        "land",
        CLASS_EDGE.land,
        "mixed",
        CLASS_EDGE.mixed,
        "inland",
        CLASS_EDGE.inland,
        "water",
        CLASS_EDGE.water,
        "#64748b",
      ],
      "line-width": 0.6,
      "line-opacity": 0.45,
    },
  });
  map.addLayer({
    id: "cells",
    type: "fill",
    source: "cells",
    paint: { "fill-color": "#000000", "fill-opacity": 0 },
  });
  map.addLayer({
    id: "cells-line",
    type: "line",
    source: "cells",
    paint: {
      "line-color": [
        "case",
        ["==", ["feature-state", "phase"], 3],
        "#ef4444",
        ["==", ["feature-state", "phase"], 1],
        "#ca8a04",
        "#1e293b",
      ],
      "line-width": [
        "case",
        ["==", ["feature-state", "phase"], 3],
        2.4,
        ["==", ["feature-state", "phase"], 1],
        1.6,
        0.8,
      ],
      "line-opacity": [
        "case",
        ["==", ["coalesce", ["feature-state", "phase"], 0], 0],
        0,
        0.8,
      ],
    },
  });
  map.addLayer({
    id: "exit-polys",
    type: "fill",
    source: "exit-polys",
    paint: { "fill-color": "#14532d", "fill-opacity": 0.22 },
  });
  map.addLayer({
    id: "exit-polys-line",
    type: "line",
    source: "exit-polys",
    paint: { "line-color": "#166534", "line-width": 1.2, "line-opacity": 0.85 },
  });
  map.addLayer({
    id: "exit-tiles",
    type: "line",
    source: "exit-tiles",
    paint: {
      "line-color": "#9f1239",
      "line-width": 1,
      "line-dasharray": [2, 1],
      "line-opacity": 0.7,
    },
  });
  map.addLayer({
    id: "sketch",
    type: "fill",
    source: "sketch",
    paint: { "fill-color": "#1e293b", "fill-opacity": 0.14 },
  });
  map.addLayer({
    id: "sketch-line",
    type: "line",
    source: "sketch",
    paint: {
      "line-color": "#0f172a",
      "line-width": 2,
      "line-dasharray": [1.4, 1],
    },
  });
  map.addLayer({
    id: "raw",
    type: "line",
    source: "raw",
    paint: {
      "line-color": "#64748b",
      "line-width": 1.25,
      "line-opacity": 0.45,
    },
  });
  // Under the route, so a target cell in a shared channel does not cover the line.
  map.addLayer({
    id: "targets",
    type: "fill",
    source: "targets",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#111827", "fill-opacity": 0.28 },
  });
  map.addLayer({
    id: "targets-box",
    type: "line",
    source: "targets",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": "#111827", "line-width": 1.5 },
  });
  map.addLayer({
    id: "routes-casing",
    type: "line",
    source: "routes",
    paint: { "line-color": "#f8fafc", "line-width": 9, "line-opacity": 0.95 },
  });
  map.addLayer({
    id: "routes",
    type: "line",
    source: "routes",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 5,
      "line-opacity": 1,
    },
  });
  map.addLayer({
    id: "current",
    type: "line",
    source: "current",
    paint: { "line-color": "#dc2626", "line-width": 2.5, "line-opacity": 0.85 },
  });
  // The shore approach is a linestring in the same source. It stays out of the
  // fill layer, which would close it and paint the inlet as a polygon.
  map.addLayer({
    id: "targets-line",
    type: "line",
    source: "targets",
    filter: ["==", ["geometry-type"], "LineString"],
    paint: {
      "line-color": "#111827",
      "line-width": 2,
      "line-dasharray": [1.1, 0.7],
    },
  });
  map.addLayer({
    id: "exit-chain",
    type: "line",
    source: "exit-chain",
    paint: {
      "line-color": "#db2777",
      "line-width": 2,
      "line-opacity": 0.85,
    },
  });
  map.addLayer({
    id: "exit-probes",
    type: "circle",
    source: "exit-probes",
    paint: {
      "circle-radius": 3.5,
      "circle-color": ["case", ["get", "ok"], "#15803d", "#9f1239"],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1,
    },
  });
  map.addLayer({
    id: "goals",
    type: "circle",
    source: "goals",
    paint: {
      "circle-radius": ["case", ["get", "reached"], 7, 5],
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "goals-label",
    type: "symbol",
    source: "goals",
    layout: {
      "text-field": ["get", "label"],
      "text-size": ["case", ["get", "reached"], 13, 11],
      "text-anchor": "left",
      "text-offset": ["get", "offset"],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": "#1c2430",
      "text-halo-color": "#f8fafc",
      "text-halo-width": 1.6,
    },
  });
  addReferencePorts(map);
  for (const id of [
    "routes-casing",
    "routes",
    "current",
    "goals",
    "goals-label",
  ]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
  map.on(
    "click",
    "cells",
    (event: {
      lngLat: { lng: number; lat: number };
      features?: Array<{ id?: number }>;
    }) => {
      if (ui.pickStart.checked) return;
      const feature = event.features && event.features[0];
      if (!feature || feature.id == null || !player) return;
      const node = player.result.nodes[feature.id];
      if (!node) return;
      const lines = [
        node.expanded >= 0
          ? `expanded at step ${node.expanded + 1}`
          : "on the frontier",
        Number.isFinite(node.g)
          ? `g ${km(node.g)} · h ${km(node.h)} · f ${km(node.g + node.h)}`
          : "",
      ].filter(Boolean);
      new mapboxgl.Popup()
        .setLngLat(event.lngLat)
        .setHTML(lines.join("<br>"))
        .addTo(map);
    },
  );
  map.on(
    "click",
    (event: {
      lngLat: { lng: number; lat: number };
      point: { x: number; y: number };
    }) => {
      if (!ui.pickStart.checked || busy) return;
      customStart = {
        type: "Feature",
        properties: { name: "custom" },
        geometry: {
          type: "Point",
          coordinates: [event.lngLat.lng, event.lngLat.lat],
        },
      };
      source("sketch")?.setData({
        type: "FeatureCollection",
        features: [customStart],
      });
      ui.status.textContent = `start ${event.lngLat.lng.toFixed(4)}, ${event.lngLat.lat.toFixed(4)}`;
      saveSettings();
    },
  );

  const listed = (await fetch("/api/sketches").then((response) =>
    response.json(),
  )) as Array<{
    id: string;
    feature: Feature;
  }>;
  for (const item of listed) {
    sketches.set(item.id, item.feature);
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.id;
    ui.sketch.appendChild(option);
  }
  const sketchId =
    saved.sketch && sketches.has(saved.sketch) ? saved.sketch : "gull-island";
  ui.sketch.value = sketchId;
  updateArchiveNote();
  const restoredPoint = saved.start ?? null;
  if (restoredPoint) {
    customStart = {
      type: "Feature",
      properties: { name: "custom" },
      geometry: { type: "Point", coordinates: restoredPoint },
    };
    source("sketch")?.setData({
      type: "FeatureCollection",
      features: [customStart],
    });
    ui.status.textContent = `start ${restoredPoint[0].toFixed(4)}, ${restoredPoint[1].toFixed(4)}`;
  } else {
    const feature = sketches.get(sketchId);
    if (feature)
      source("sketch")?.setData({
        type: "FeatureCollection",
        features: [feature],
      });
    ui.status.textContent = sketchId;
  }
  if (ui.pickStart.checked) map.getCanvas().style.cursor = "crosshair";
  if (!saved.center) {
    const feature = customStart ?? sketches.get(sketchId);
    if (feature) flyToFeature(feature);
  }
  persistReady = true;
  saveSettings();
  map.on("moveend", saveSettings);
});

ui.degrees.addEventListener("change", () => {
  updateArchiveNote();
  saveSettings();
});
ui.sketch.addEventListener("change", () => {
  customStart = null;
  player = null;
  ui.player.hidden = true;
  ui.routes.replaceChildren();
  el<HTMLUListElement>("candidates").replaceChildren();
  const feature = sketches.get(ui.sketch.value);
  if (feature && map.getSource("sketch")) {
    source("sketch")?.setData({
      type: "FeatureCollection",
      features: [feature],
    });
    source("bitmap")?.setData(empty);
    source("cells")?.setData(empty);
    source("goals")?.setData(empty);
    source("targets")?.setData(empty);
    source("routes")?.setData(empty);
    source("raw")?.setData(empty);
    source("current")?.setData(empty);
    source("exit-polys")?.setData(empty);
    source("exit-tiles")?.setData(empty);
    source("exit-chain")?.setData(empty);
    source("exit-probes")?.setData(empty);
    setExitRaster(null);
    lastResult = null;
    selectedExit = null;
    ui.debugPort.replaceChildren();
    ui.debugNote.textContent =
      "After a search, pick a port. setBounds(west,south,east,north) is on window.";
    flyToFeature(feature);
  }
  ui.status.textContent = ui.sketch.value;
  ui.error.textContent = "";
  saveSettings();
});
ui.pickStart.addEventListener("change", () => {
  map.getCanvas().style.cursor = ui.pickStart.checked ? "crosshair" : "";
  saveSettings();
});
for (const input of [
  ui.margin,
  ui.maxResults,
  ui.maxKm,
  ui.maxExpansions,
  ui.maxGoals,
  ui.runs,
]) {
  input.addEventListener("input", saveSettings);
}
ui.run.addEventListener("click", () => void runAnimated());
ui.benchmark.addEventListener("click", () => void runBenchmark());
ui.fitExit.addEventListener("click", () => fitSelectedExit());
ui.debugPort.addEventListener("change", () => {
  focusExit(ui.debugPort.value || null, false);
});
for (const box of [
  ui.dbgPolys,
  ui.dbgTiles,
  ui.dbgRaster,
  ui.dbgChain,
  ui.dbgProbes,
  ui.dbgVisited,
]) {
  box.addEventListener("change", () => {
    if (!lastResult) {
      applyDebugVisibility();
      return;
    }
    drawExitDebug(lastResult, selectedExit);
  });
}
ui.cancel.addEventListener("click", () => {
  cancelRequested = true;
});

const host = window as unknown as {
  setBounds: (...args: unknown[]) => void;
  fitExit: (name?: string) => void;
  lastSearch: SearchResult | null;
};
host.setBounds = (...args: unknown[]) => {
  const box = parseBounds(args);
  if (!box) {
    console.warn(
      "setBounds(west, south, east, north) or setBounds([west,south,east,north])",
    );
    return;
  }
  setBounds(map, box[0], box[1], box[2], box[3]);
};
host.fitExit = (name?: string) => {
  if (name) focusExit(name, true);
  else fitSelectedExit();
};
host.lastSearch = null;
ui.play.addEventListener("click", () => player?.toggle());
ui.back.addEventListener("click", () => {
  if (!player) return;
  player.playing = false;
  player.seek(player.cursor - 1);
});
ui.forward.addEventListener("click", () => {
  if (!player) return;
  player.playing = false;
  player.seek(player.cursor + 1);
});
ui.toStart.addEventListener("click", () => {
  if (!player) return;
  player.playing = false;
  player.seek(0);
});
ui.toEnd.addEventListener("click", () => {
  if (!player) return;
  player.playing = false;
  player.seek(player.length);
});
ui.slider.addEventListener("input", () => {
  if (!player) return;
  player.playing = false;
  player.seek(Number(ui.slider.value));
});
window.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement
  )
    return;
  if (!player || ui.player.hidden) return;
  if (event.key === " ") {
    event.preventDefault();
    player.toggle();
  } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    player.playing = false;
    const jump = event.shiftKey ? 10 : 1;
    player.seek(player.cursor + (event.key === "ArrowRight" ? jump : -jump));
  }
});
updateArchiveNote();
