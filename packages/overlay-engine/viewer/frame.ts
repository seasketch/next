/**
 * Shared map chrome for the water-path viewers. The search pages call these
 * so a screenshot of any method shows the same sea, the same route colors,
 * and a framed solution.
 */
import expectedRoutesFile from "./expected-routes.json";
const PORTS_TILES =
  "https://tiles.seasketch.org/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676/{z}/{x}/{y}.mvt";

export const RANK_COLOR = ["#7c3aed", "#db2777", "#0891b2", "#64748b"];
export const CONSIDERED_COLOR = "#475569";

/** Archive classes. These sit on the tan/blue basemap, so each one has to read on its own. */
export const CLASS_COLOR = {
  water: "#1d6a9a",
  mixed: "#e3941a",
  land: "#2f9e44",
  inland: "#8aa0b4",
} as const;
export const CLASS_EDGE = {
  water: "#0c4a6e",
  mixed: "#9a3412",
  land: "#166534",
  inland: "#475569",
} as const;
export const CLASS_OPACITY = {
  water: 0.4,
  mixed: 0.62,
  land: 0.55,
  inland: 0.48,
} as const;

type LngLat = { 0: number; 1: number; length: number };

/** Recolor the light basemap so land and sea separate in a screenshot. */
export function paintBasemap(map: any): void {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const id = String(layer.id);
    const sourceLayer = String(layer["source-layer"] ?? "");
    const kind = `${id} ${sourceLayer}`;
    try {
      if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", "#efe4cf");
      } else if (
        layer.type === "fill" &&
        /water/.test(kind) &&
        !/waterway/.test(kind)
      ) {
        map.setPaintProperty(id, "fill-color", "#7eb6d6");
        map.setPaintProperty(id, "fill-opacity", 1);
      } else if (layer.type === "line" && /waterway/.test(kind)) {
        map.setPaintProperty(id, "line-color", "#6aa8cc");
        map.setPaintProperty(id, "line-opacity", 0.45);
      } else if (
        layer.type === "fill" &&
        /(^| )land( |$)|landcover|landuse|national-park|park|wetland/.test(kind)
      ) {
        if (id === "land" || sourceLayer === "land") {
          map.setPaintProperty(id, "fill-color", "#f4ead8");
          map.setPaintProperty(id, "fill-opacity", 1);
        } else {
          map.setPaintProperty(id, "fill-opacity", 0.08);
        }
      } else if (layer.type === "hillshade" || /hillshade/.test(id)) {
        map.setPaintProperty(id, "hillshade-exaggeration", 0.12);
      }
    } catch {
      // A layer in this style does not expose that paint property.
    }
  }
}

/** Catalog ports, drawn small and unlabeled. The result labels the ones that matter. */
export function addReferencePorts(map: any): void {
  if (!map.getSource("ports")) {
    map.addSource("ports", {
      type: "vector",
      tiles: [PORTS_TILES],
      minzoom: 0,
      maxzoom: 1,
    });
  }
  if (map.getLayer("ports")) return;
  map.addLayer({
    id: "ports",
    type: "circle",
    source: "ports",
    "source-layer": "WPI_Shapefile",
    paint: {
      "circle-radius": 3,
      "circle-color": "#475569",
      "circle-opacity": 0.4,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-opacity": 0.7,
    },
  });
}

export function rankColor(rank: number): string {
  return RANK_COLOR[Math.min(Math.max(rank - 1, 0), RANK_COLOR.length - 1)]!;
}

/** Shift neighboring labels onto different rows so a cluster stays readable. */
export function labelOffset(index: number): [number, number] {
  return [0.85, ((index % 4) - 1.5) * 1.35];
}

export function matchLabel(
  name: string,
  meters: number | null,
  reached: boolean,
): string {
  if (!reached || meters == null) return name || "port";
  return `${name || "port"} · ${(meters / 1000).toFixed(1)} km`;
}

/**
 * Frame the sketch, the routes, and the ports that were reached. Nearby
 * considered ports widen that frame a little; a port far outside the
 * solution does not pull the camera out to a regional view.
 */
export function fitSolution(
  map: any,
  positions: ReadonlyArray<LngLat | number[]>,
  nearby: ReadonlyArray<LngLat | number[]> = [],
): void {
  const finite = (position: LngLat | number[]) =>
    Number.isFinite(position[0]) && Number.isFinite(position[1]);
  const points = positions.filter(finite);
  if (points.length === 0) return;
  const origin = points[0]![0]!;
  const unwrap = (lng: number) => {
    let value = lng;
    while (value - origin > 180) value -= 360;
    while (origin - value > 180) value += 360;
    return value;
  };
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const position of points) {
    const lng = unwrap(position[0]!);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, position[1]!);
    north = Math.max(north, position[1]!);
  }
  const padLng = Math.max(0.05, (east - west) * 0.35);
  const padLat = Math.max(0.05, (north - south) * 0.35);
  for (const position of nearby) {
    if (!finite(position)) continue;
    const lng = unwrap(position[0]!);
    const lat = position[1]!;
    if (
      lng < west - padLng ||
      lng > east + padLng ||
      lat < south - padLat ||
      lat > north + padLat
    ) {
      continue;
    }
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  if (east - west < 0.02) {
    west -= 0.02;
    east += 0.02;
  }
  if (north - south < 0.02) {
    south -= 0.02;
    north += 0.02;
  }
  setBounds(map, west, south, east, north, { maxZoom: 10, duration: 700 });
}

/**
 * Frame a west/south/east/north box. Exposed on `window.setBounds` in the
 * ocean-bitmap viewer so a session can jump without fighting the map.
 */
export function setBounds(
  map: any,
  west: number,
  south: number,
  east: number,
  north: number,
  options?: { maxZoom?: number; duration?: number; padding?: object },
): void {
  if (![west, south, east, north].every((value) => Number.isFinite(value)))
    return;
  if (east < west) [west, east] = [east, west];
  if (north < south) [south, north] = [north, south];
  if (east - west < 1e-5) {
    west -= 0.01;
    east += 0.01;
  }
  if (north - south < 1e-5) {
    south -= 0.01;
    north += 0.01;
  }
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: options?.padding ?? {
        left: 390,
        top: 48,
        right: 64,
        bottom: 48,
      },
      maxZoom: options?.maxZoom ?? 15,
      duration: options?.duration ?? 500,
    },
  );
}

/** Ocean-bitmap results the other routers are checked against. */
export type ExpectedHit = {
  port: string;
  km: number;
};

export type ExpectedRoutesFile = {
  source: string;
  cellSizeDegrees: number;
  maxResults: number;
  maxKm: number;
  goalPool: number;
  /** Relative distance tolerance. 0.1 means the route may differ by 10%. */
  tolerance: number;
  cases: Record<string, ExpectedHit[]>;
};

function isExpectedFile(value: unknown): value is ExpectedRoutesFile {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.tolerance === "number" &&
    typeof record.cases === "object" &&
    record.cases !== null
  );
}

export const expectedRoutes: ExpectedRoutesFile = isExpectedFile(
  expectedRoutesFile,
)
  ? expectedRoutesFile
  : {
      source: "ocean-bitmap",
      cellSizeDegrees: 0.005,
      maxResults: 6,
      maxKm: 200,
      goalPool: 24,
      tolerance: 0.1,
      cases: {},
    };

/**
 * A hit matches when it is the expected port at this rank and its length is
 * within `tolerance` of the expected kilometres.
 */
export function expectedHitMatches(
  expected: ExpectedHit | undefined,
  port: string,
  km: number,
  tolerance = expectedRoutes.tolerance,
): boolean {
  if (!expected || expected.port !== port) return false;
  const scale = Math.abs(expected.km);
  if (scale === 0) return km === 0;
  return Math.abs(km - expected.km) <= scale * tolerance + 1e-6;
}

/** Mark each route button against the ocean-bitmap expectation for this sketch. */
export function markRouteList(container: ParentNode, sketchId: string): void {
  const hits = expectedRoutes.cases[sketchId];
  if (!hits) return;
  const buttons = container.querySelectorAll("button[data-rank]");
  buttons.forEach((node) => {
    if (!(node instanceof HTMLButtonElement)) return;
    const rank = Number(node.dataset.rank);
    const port = node.dataset.port ?? "";
    const meters = Number(node.dataset.meters);
    const km = meters / 1000;
    const expected = hits[rank - 1];
    const ok = expectedHitMatches(expected, port, km);
    const mark = document.createElement("span");
    mark.className = ok ? "expect ok" : "expect bad";
    mark.textContent = ok ? "✓" : "✕";
    if (expected) {
      mark.title = ok
        ? `matches ${expected.port} · ${expected.km} km`
        : `expected ${expected.port} · ${expected.km} km`;
    } else {
      mark.title = "no further ocean-bitmap hit was expected";
    }
    node.appendChild(mark);
  });
}

export function matchButton(
  rank: number,
  name: string,
  meters: number,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.rank = String(rank);
  button.dataset.port = name;
  button.dataset.meters = String(Math.round(meters));
  button.textContent = `${rank}. ${name || "port"} · ${(meters / 1000).toFixed(1)} km`;
  return button;
}

export function consideredItem(name: string, detail: string): HTMLLIElement {
  const item = document.createElement("li");
  item.dataset.port = name;
  item.textContent = `${name} · ${detail}`;
  return item;
}
