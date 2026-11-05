import { createReadStream, createWriteStream } from "fs";
import readline from "readline";
import gdal from "gdal-async";

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
  "SBDARE",
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

function wantsLabel(properties: Record<string, unknown>): boolean {
  const objectClass = properties.obj;
  if (typeof objectClass !== "string" || !LABELLED_AREAS.has(objectClass)) return false;
  if (objectClass === "ACHARE") return true;
  if (objectClass === "SBDARE") return typeof properties.seabed === "string";
  return typeof properties.OBJNAM === "string" && properties.OBJNAM.length > 0;
}

/**
 * Read peeled area features and write a label point for each labelled
 * polygon, with the polygon's own zoom range. Returns how many were written.
 */
export async function writeAreaLabels(peeledAreas: string, out: string): Promise<number> {
  const stream = createWriteStream(out);
  let count = 0;
  const lines = readline.createInterface({ input: createReadStream(peeledAreas), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"obj"')) continue;
    const feature = JSON.parse(line) as {
      properties: Record<string, unknown>;
      geometry: { type?: string };
      tippecanoe: Record<string, unknown>;
    };
    if (feature.geometry?.type !== "Polygon" && feature.geometry?.type !== "MultiPolygon") continue;
    if (!wantsLabel(feature.properties)) continue;
    let point: { x: number; y: number } | null = null;
    try {
      const geometry = gdal.Geometry.fromGeoJson(feature.geometry) as gdal.Polygon;
      if (geometry.getArea() < SMALLEST_LABELLED_AREA) continue;
      point = interiorPoint(geometry);
    } catch {
      continue;
    }
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    stream.write(
      JSON.stringify({
        type: "Feature",
        properties: { ...feature.properties, labelpoint: true },
        geometry: { type: "Point", coordinates: [point.x, point.y] },
        tippecanoe: feature.tippecanoe,
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
