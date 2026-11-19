import { codes } from "./labels.js";

/**
 * Sector lights as geometry. S-52 draws a sector as an arc about 20 mm from
 * the light with dashed legs along its limits, a fixed size on screen. A
 * vector tile holds metres, so each sector is written once per zoom with the
 * radius that zoom needs.
 */

/** Arc radius and leg length in CSS pixels. */
const ARC_PIXELS = 46;
const LEG_PIXELS = 64;
/** How far out each further ring of overlapping sectors sits. */
const RING_PIXELS = 12;
/** Sectors that share less than this many degrees only abut. */
const ABUT_DEGREES = 0.5;
/** The first zoom a sector arc is legible at. */
export const SECTOR_MIN_ZOOM = 11;

const EARTH_CIRCUMFERENCE = 40075016.686;
const METRES_PER_DEGREE = 111320;

export type LightFeature = {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[] };
  tippecanoe: { layer?: string; minzoom: number; maxzoom: number };
};

function metresPerPixel(zoom: number, latitude: number) {
  return (EARTH_CIRCUMFERENCE * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/** The point `metres` from the light along a true bearing. */
function offset([lng, lat]: number[], bearing: number, metres: number): number[] {
  const radians = (bearing * Math.PI) / 180;
  const north = Math.cos(radians) * metres;
  const east = Math.sin(radians) * metres;
  return [
    lng + east / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180)),
    lat + north / METRES_PER_DEGREE,
  ];
}

/**
 * The sector as seen from the light. SECTR1 and SECTR2 are bearings taken
 * from seaward toward the light, clockwise from SECTR1. Null for an
 * all-round light, which has no sector to draw.
 */
export function sectorBearings(properties: Record<string, unknown>): [number, number] | null {
  const first = Number(properties.SECTR1);
  const second = Number(properties.SECTR2);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  let sweep = (second - first + 360) % 360;
  if (sweep === 0) sweep = 360;
  if (sweep >= 359.9) return null;
  const start = (first + 180) % 360;
  return [start, start + sweep];
}

/** S-52 sector colour: white lights draw yellow. */
export function sectorColour(properties: Record<string, unknown>): string {
  const colour = codes(properties.COLOUR)[0];
  if (colour === 3) return "red";
  if (colour === 4) return "green";
  if (colour === 1 || colour === 6 || colour === 11) return "yellow";
  return "magenta";
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  for (const shift of [-360, 0, 360]) {
    const start = Math.max(a[0], b[0] + shift);
    const end = Math.min(a[1], b[1] + shift);
    if (end - start > ABUT_DEGREES) return true;
  }
  return false;
}

/**
 * The ring each sector light's arc sits on. Lights in one cell at one position
 * share a ring while their sectors only abut, as a red, white, and green
 * leading light does. A sector that overlaps one already on a ring moves out
 * to the next, so neither arc hides the other. Longer-range lights go first.
 */
export function sectorRings(lights: LightFeature[]): number[] {
  const rings = new Array<number>(lights.length).fill(0);
  const groups = new Map<string, number[]>();
  lights.forEach((light, index) => {
    if (!sectorBearings(light.properties)) return;
    const [lng, lat] = light.geometry.coordinates;
    const key = `${light.properties.cell}:${lng.toFixed(6)}:${lat.toFixed(6)}`;
    const group = groups.get(key);
    if (group) group.push(index);
    else groups.set(key, [index]);
  });
  const range = (light: LightFeature) => {
    const value = Number(light.properties.VALNMR);
    return Number.isFinite(value) ? value : 0;
  };
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => range(lights[b]) - range(lights[a]));
    const placed: Array<Array<[number, number]>> = [];
    for (const index of ordered) {
      const bearings = sectorBearings(lights[index].properties) as [number, number];
      let ring = placed.findIndex((sectors) => !sectors.some((other) => overlaps(bearings, other)));
      if (ring < 0) ring = placed.push([]) - 1;
      placed[ring].push(bearings);
      rings[index] = ring;
    }
  }
  return rings;
}

/** Arc and leg features for one peeled LIGHTS point, or none. `ring` is from `sectorRings`. */
export function lightSectorFeatures(light: LightFeature, ring = 0): LightFeature[] {
  if (light.properties.obj !== "LIGHTS" || light.geometry?.type !== "Point") return [];
  const bearings = sectorBearings(light.properties);
  if (!bearings) return [];
  const [start, end] = bearings;
  const centre = light.geometry.coordinates;
  const first = Math.max(light.tippecanoe.minzoom, SECTOR_MIN_ZOOM);
  const last = light.tippecanoe.maxzoom;
  const properties = {
    cls: "light_sector",
    obj: "LIGHTS",
    cell: light.properties.cell,
    band: light.properties.band,
    colour: sectorColour(light.properties),
  };
  const radius = ARC_PIXELS + ring * RING_PIXELS;
  const leg = Math.max(LEG_PIXELS, radius + LEG_PIXELS - ARC_PIXELS);
  const out: LightFeature[] = [];
  for (let zoom = first; zoom <= last; zoom += 1) {
    const pixel = metresPerPixel(zoom, centre[1]);
    // The deepest zoom also covers overzoom, so it keeps that zoom's size.
    const range = { minzoom: zoom, maxzoom: zoom };
    const steps = Math.max(8, Math.ceil((end - start) / 4));
    const arc: number[][] = [];
    for (let step = 0; step <= steps; step += 1) {
      arc.push(offset(centre, start + ((end - start) * step) / steps, radius * pixel));
    }
    out.push({
      properties: { ...properties, part: "arc" },
      geometry: { type: "LineString", coordinates: arc } as unknown as LightFeature["geometry"],
      tippecanoe: { layer: "light_sector", ...range },
    });
    for (const bearing of [start, end]) {
      out.push({
        properties: { ...properties, part: "leg" },
        geometry: {
          type: "LineString",
          coordinates: [centre, offset(centre, bearing, leg * pixel)],
        } as unknown as LightFeature["geometry"],
        tippecanoe: { layer: "light_sector", ...range },
      });
    }
  }
  return out;
}
