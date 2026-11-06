import { createReadStream, createWriteStream } from "fs";
import readline from "readline";
import gdal from "gdal-async";
import { areaCenterSymbol } from "./portrayal.js";

/**
 * Areas whose name or symbol the chart prints once, inside the area. Mapbox
 * labels a polygon once per tile it crosses, so a town spanning four tiles
 * would say its name four times. These get one interior point instead.
 */
export const LABELLED_AREAS = new Set([
  "LNDARE",
  "BUAARE",
  "ACHARE",
  "RESARE",
  "MIPARE",
  "DMPGRD",
  "PRCARE",
  "MARCUL",
  "CTNARE",
  "SBDARE",
  "WEDKLP",
  "WATTUR",
  "CBLARE",
  "DWRTPT",
  "SMCFAC",
  "SEAARE",
  "LNDRGN",
]);

/** Square degrees. Smaller slivers are what peeling leaves on a cell edge. */
const SMALLEST_LABELLED_AREA = 1e-7;

/**
 * A point inside the polygon: its centroid, or for a C-shaped town whose
 * centroid falls outside, the middle of the widest run across that latitude.
 */
function interiorPoint(geometry: gdal.Geometry): { x: number; y: number } | null {
  const centroid = geometry.centroid();
  if (geometry.contains(centroid)) return { x: centroid.x, y: centroid.y };
  const envelope = geometry.getEnvelope();
  const across = new gdal.LineString();
  across.points.add(new gdal.Point(envelope.minX - 1, centroid.y));
  across.points.add(new gdal.Point(envelope.maxX + 1, centroid.y));
  const runs = geometry.intersection(across);
  let best: { x: number; y: number } | null = null;
  let widest = 0;
  const visit = (part: gdal.Geometry) => {
    if (part instanceof gdal.LineString) {
      const length = part.getLength();
      if (length > widest) {
        widest = length;
        const middle = part.centroid();
        best = { x: middle.x, y: middle.y };
      }
    } else if (part instanceof gdal.GeometryCollection) {
      for (let index = 0; index < part.children.count(); index += 1) visit(part.children.get(index));
    }
  };
  visit(runs);
  return best;
}

export function wantsAreaLabel(properties: Record<string, unknown> | null | undefined): boolean {
  if (!properties || typeof properties !== "object") return false;
  const objectClass = properties.obj;
  if (typeof objectClass !== "string" || !LABELLED_AREAS.has(objectClass)) return false;
  if (objectClass === "ACHARE") return true;
  if (objectClass === "SBDARE") return typeof properties.seabed === "string";
  if (areaCenterSymbol(objectClass)) return true;
  return typeof properties.OBJNAM === "string" && properties.OBJNAM.length > 0;
}

/**
 * A name repeats no closer than this, in degrees: about 5 km. An area split
 * across harbour cells, or by a larger-scale cell under it, is one piece per
 * cell. Without it a town on a cell corner is named four times.
 */
export const LABEL_SPACING = 0.05;

type Zooms = { minzoom: number; maxzoom: number };

export type LabelCandidate = {
  key: string | null;
  area: number;
  x: number;
  y: number;
  zooms: Zooms;
  feature: { properties: Record<string, unknown>; tippecanoe: Record<string, unknown> };
};

/** Same name, same class. Seabed letters are a texture and repeat freely. */
function labelKey(properties: Record<string, unknown>): string | null {
  const objectClass = String(properties.obj);
  if (objectClass === "SBDARE") return null;
  const name = typeof properties.OBJNAM === "string" ? properties.OBJNAM : "";
  // Unnamed symbol areas are each their own mark. Named ones still collapse
  // when the same area is split across cells.
  if (!name && areaCenterSymbol(objectClass)) return null;
  return `${objectClass}\0${name}`;
}

function zoomsOf(tippecanoe: Record<string, unknown>): Zooms {
  const minzoom = typeof tippecanoe.minzoom === "number" ? tippecanoe.minzoom : 0;
  const maxzoom = typeof tippecanoe.maxzoom === "number" ? tippecanoe.maxzoom : 99;
  return { minzoom, maxzoom };
}

/**
 * Keep the label of the largest piece, and drop or shorten the zoom range of
 * nearby pieces with the same name where a kept label already shows.
 */
export function spaceLabels(candidates: LabelCandidate[]): LabelCandidate[] {
  const placed: LabelCandidate[] = [];
  const kept = new Map<string, LabelCandidate[]>();
  const sorted = [...candidates].sort((a, b) => b.area - a.area);
  for (const candidate of sorted) {
    if (candidate.key == null) {
      placed.push(candidate);
      continue;
    }
    const zooms = { ...candidate.zooms };
    for (const other of kept.get(candidate.key) || []) {
      if (Math.hypot(other.x - candidate.x, other.y - candidate.y) > LABEL_SPACING) continue;
      if (other.zooms.maxzoom < zooms.minzoom || other.zooms.minzoom > zooms.maxzoom) continue;
      if (other.zooms.minzoom <= zooms.minzoom) zooms.minzoom = other.zooms.maxzoom + 1;
      else if (other.zooms.maxzoom >= zooms.maxzoom) zooms.maxzoom = other.zooms.minzoom - 1;
      if (zooms.minzoom > zooms.maxzoom) break;
    }
    if (zooms.minzoom > zooms.maxzoom) continue;
    const label = { ...candidate, zooms };
    placed.push(label);
    if (!kept.has(candidate.key)) kept.set(candidate.key, []);
    kept.get(candidate.key)!.push(label);
  }
  return placed;
}

/**
 * Read peeled area features and write a label point for each labelled
 * polygon, with the polygon's own zoom range. Returns how many were written.
 */
export async function writeAreaLabels(peeledAreas: string, out: string): Promise<number> {
  const candidates: LabelCandidate[] = [];
  const lines = readline.createInterface({ input: createReadStream(peeledAreas), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"obj"')) continue;
    const feature = JSON.parse(line) as {
      properties: Record<string, unknown>;
      geometry: { type?: string };
      tippecanoe: Record<string, unknown>;
    };
    if (feature.geometry?.type !== "Polygon" && feature.geometry?.type !== "MultiPolygon") continue;
    if (!wantsAreaLabel(feature.properties)) continue;
    let point: { x: number; y: number } | null = null;
    let area = 0;
    try {
      const geometry = gdal.Geometry.fromGeoJson(feature.geometry) as gdal.Polygon;
      area = geometry.getArea();
      if (area < SMALLEST_LABELLED_AREA) continue;
      point = interiorPoint(geometry);
    } catch {
      continue;
    }
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    candidates.push({
      key: labelKey(feature.properties),
      area,
      x: point.x,
      y: point.y,
      zooms: zoomsOf(feature.tippecanoe),
      feature: { properties: feature.properties, tippecanoe: feature.tippecanoe },
    });
  }
  const stream = createWriteStream(out);
  let count = 0;
  for (const label of spaceLabels(candidates)) {
    stream.write(
      JSON.stringify({
        type: "Feature",
        properties: { ...label.feature.properties, labelpoint: true },
        geometry: { type: "Point", coordinates: [label.x, label.y] },
        tippecanoe: { ...label.feature.tippecanoe, ...label.zooms },
      }) + "\n"
    );
    count += 1;
  }
  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
  return count;
}
