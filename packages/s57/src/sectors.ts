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
/** The first zoom a sector arc is legible at. */
export const SECTOR_MIN_ZOOM = 11;

const EARTH_CIRCUMFERENCE = 40075016.686;
const METRES_PER_DEGREE = 111320;

type LightFeature = {
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

/** Arc and leg features for one peeled LIGHTS point, or none. */
export function lightSectorFeatures(light: LightFeature): LightFeature[] {
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
  const out: LightFeature[] = [];
  for (let zoom = first; zoom <= last; zoom += 1) {
    const pixel = metresPerPixel(zoom, centre[1]);
    // The deepest zoom also covers overzoom, so it keeps that zoom's size.
    const range = { minzoom: zoom, maxzoom: zoom };
    const steps = Math.max(8, Math.ceil((end - start) / 4));
    const arc: number[][] = [];
    for (let step = 0; step <= steps; step += 1) {
      arc.push(offset(centre, start + ((end - start) * step) / steps, ARC_PIXELS * pixel));
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
          coordinates: [centre, offset(centre, bearing, LEG_PIXELS * pixel)],
        } as unknown as LightFeature["geometry"],
        tippecanoe: { layer: "light_sector", ...range },
      });
    }
  }
  return out;
}
