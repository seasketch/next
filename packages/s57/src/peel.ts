import { createReadStream, createWriteStream } from "fs";
import { readFile } from "fs/promises";
import readline from "readline";
import gdal from "gdal-async";

/**
 * Stop a smaller-scale chart where a larger-scale cell covers the same place.
 *
 * A feature of band B is split against each larger-scale cell that covers it
 * and that actually draws the same object class. The covered part ends at the
 * zoom before that cell's own features of the class appear. Ending it at the
 * cell's usage-band zoom instead leaves a gap: the small-scale contours are
 * gone, and the large-scale contours have not started. The class, not the
 * tile layer, decides: a harbour anchorage with a large SCAMIN starts after
 * the harbour's restricted areas, which share its layer.
 *
 * Geometry comes from gdal-async, which ships its own GDAL. The chart build
 * does not need the Python osgeo module.
 */

type Geometry = InstanceType<typeof gdal.Geometry>;

type Mask = {
  band: number;
  cell: string;
  geom: Geometry;
};

type Feature = {
  type: string;
  properties: Record<string, unknown>;
  geometry: { type?: string };
  tippecanoe: { minzoom: number; maxzoom: number; layer?: string };
};

function clean(geom: Geometry | null): Geometry | null {
  if (!geom || geom.isEmpty()) return null;
  if (!geom.isValid()) return geom.makeValid();
  return geom;
}

function pieces(geom: Geometry | null): Geometry[] {
  const cleaned = clean(geom);
  if (!cleaned) return [];
  if (cleaned.name !== "GEOMETRYCOLLECTION") return [cleaned];
  const children = (
    cleaned as unknown as { children: { count: () => number; get: (index: number) => Geometry } }
  ).children;
  const found: Geometry[] = [];
  for (let index = 0; index < children.count(); index += 1) {
    found.push(...pieces(children.get(index)));
  }
  return found;
}

/** Drop the lines a polygon intersection leaves on a cell boundary. */
function sameFamily(originalName: string, part: Geometry): boolean {
  const partName = part.name;
  if (originalName.includes("POINT")) return partName.includes("POINT");
  if (originalName.includes("LINE")) return partName.includes("LINE");
  if (originalName.includes("POLY")) return partName.includes("POLYGON");
  return true;
}

function emit(
  feature: Feature,
  geom: Geometry,
  maxzoom: number,
  family: string,
  write: (line: string) => void
): number {
  const minzoom = feature.tippecanoe.minzoom;
  if (minzoom > maxzoom) return 0;
  let written = 0;
  for (const part of pieces(geom)) {
    if (part.isEmpty() || !sameFamily(family, part)) continue;
    write(
      JSON.stringify({
        type: "Feature",
        properties: feature.properties,
        geometry: part.toObject(),
        tippecanoe: { ...feature.tippecanoe, maxzoom },
      }) + "\n"
    );
    written += 1;
  }
  return written;
}

async function readLines(file: string, onLine: (line: string) => void): Promise<void> {
  const lines = readline.createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) onLine(trimmed);
  }
}

function loadMasks(geojson: { features?: Array<Record<string, unknown>> }): Mask[] {
  const masks: Mask[] = [];
  for (const feature of geojson.features || []) {
    const props = (feature.properties || {}) as Record<string, unknown>;
    if (typeof props.band !== "number" || typeof props.cell !== "string" || !feature.geometry) {
      continue;
    }
    const geom = gdal.Geometry.fromGeoJson(feature.geometry as object);
    if (!geom || geom.isEmpty()) continue;
    masks.push({ band: props.band, cell: props.cell, geom });
  }
  return masks;
}

/** The S-57 object class, or the tile layer for a feature without one. */
function drawnAs(properties: Record<string, unknown>): string | null {
  if (typeof properties.obj === "string") return properties.obj;
  if (typeof properties.cls === "string") return properties.cls;
  return null;
}

/**
 * The chart itself: these hand over when the covering cell draws the class
 * at all. Matching them object by object would cost a geometry test per
 * sounding and per contour, and they carry no per-object SCAMIN to honour.
 */
export const WHOLE_CLASS = new Set(["DEPARE", "DRGARE", "UNSARE", "LNDARE", "DEPCNT", "SOUNDG", "COALNE", "SLCONS"]);

/** How far apart two cells may place the same buoy or landmark. About 300 m. */
const SAME_OBJECT = 0.003;

type Extent = { west: number; south: number; east: number; north: number; minzoom: number };

type Starts = {
  /** First zoom of each class in each cell. */
  byClass: Map<string, number>;
  /** Where each symbol-class feature of each cell sits, and when it appears. */
  extents: Map<string, Extent[]>;
};

function extentOf(geometry: unknown): Omit<Extent, "minzoom"> | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      west = Math.min(west, value[0]);
      east = Math.max(east, value[0]);
      south = Math.min(south, value[1]);
      north = Math.max(north, value[1]);
      return;
    }
    for (const child of value) visit(child);
  };
  visit((geometry as { coordinates?: unknown }).coordinates);
  return Number.isFinite(west) ? { west, south, east, north } : null;
}

async function classStarts(featuresPath: string): Promise<Starts> {
  const byClass = new Map<string, number>();
  const extents = new Map<string, Extent[]>();
  await readLines(featuresPath, (line) => {
    const feature = JSON.parse(line) as Feature;
    const cell = feature.properties.cell;
    const layer = drawnAs(feature.properties);
    if (typeof cell !== "string" || layer == null) return;
    const zoom = feature.tippecanoe?.minzoom;
    if (typeof zoom !== "number") return;
    const key = `${cell}\0${layer}`;
    const current = byClass.get(key);
    if (current == null || zoom < current) byClass.set(key, zoom);
    if (WHOLE_CLASS.has(layer)) return;
    const extent = extentOf(feature.geometry);
    if (!extent) return;
    if (!extents.has(key)) extents.set(key, []);
    extents.get(key)!.push({ ...extent, minzoom: zoom });
  });
  return { byClass, extents };
}

/**
 * The zoom the covering cell takes this object over. A buoy, light or
 * anchorage hands over when the covering cell's own copy of it appears, so a
 * per-object SCAMIN in the larger-scale cell does not leave a zoom with
 * neither. Null when the covering cell has no copy of it: the object stays
 * on its own chart, or goes to a larger-scale cell that does carry it.
 */
function handover(starts: Starts, key: string, layer: string, part: Geometry): number | null {
  const classStart = starts.byClass.get(key);
  if (classStart == null) return null;
  if (WHOLE_CLASS.has(layer)) return classStart;
  const candidates = starts.extents.get(key);
  if (!candidates) return null;
  const envelope = part.getEnvelope();
  let closest: Extent | undefined;
  let closestMismatch = Infinity;
  for (const other of candidates) {
    if (
      other.west > envelope.maxX + SAME_OBJECT ||
      other.east < envelope.minX - SAME_OBJECT ||
      other.south > envelope.maxY + SAME_OBJECT ||
      other.north < envelope.minY - SAME_OBJECT
    ) {
      continue;
    }
    // Two rocks 200 m apart can both be in range; the copy is the one whose
    // extent matches best, not whichever appears first.
    const mismatch =
      Math.abs(other.west - envelope.minX) +
      Math.abs(other.east - envelope.maxX) +
      Math.abs(other.south - envelope.minY) +
      Math.abs(other.north - envelope.maxY);
    if (mismatch < closestMismatch) {
      closest = other;
      closestMismatch = mismatch;
    }
  }
  return closest?.minzoom ?? null;
}

function cut(
  feature: Feature,
  geom: Geometry,
  band: number,
  layer: string,
  masks: Mask[],
  starts: Starts,
  maxZoom: number,
  family: string,
  write: (line: string) => void
): number {
  let remaining = clean(geom);
  if (!remaining) return 0;
  let written = 0;
  for (let higher = band + 1; higher <= 6; higher += 1) {
    const covering = masks.filter(
      (mask) => mask.band === higher && starts.byClass.has(`${mask.cell}\0${layer}`)
    );
    for (const mask of covering) {
      if (!remaining || remaining.isEmpty()) return written;
      const inside = clean(remaining.intersection(mask.geom));
      if (!inside || inside.isEmpty()) continue;
      const start = handover(starts, `${mask.cell}\0${layer}`, layer, inside);
      if (start == null) continue;
      written += emit(feature, inside, start - 1, family, write);
      remaining = clean(remaining.difference(mask.geom));
    }
  }
  if (remaining && !remaining.isEmpty()) written += emit(feature, remaining, maxZoom, family, write);
  return written;
}

/** Read GeoJSONSeq features and a coverage collection. Write the peeled GeoJSONSeq. */
export async function peelFeatures(
  featuresPath: string,
  masksPath: string,
  outPath: string,
  specPath: string
): Promise<number> {
  const spec = JSON.parse(await readFile(specPath, "utf8")) as { maxZoom: number };
  const maxZoom = spec.maxZoom;
  const masks = loadMasks(JSON.parse(await readFile(masksPath, "utf8")));
  const starts = await classStarts(featuresPath);
  const out = createWriteStream(outPath);
  let written = 0;
  const write = (line: string) => {
    out.write(line);
  };
  await readLines(featuresPath, (line) => {
    const feature = JSON.parse(line) as Feature;
    if (!feature.geometry) return;
    let geom: Geometry;
    try {
      geom = gdal.Geometry.fromGeoJson(feature.geometry);
    } catch {
      return;
    }
    if (!geom) return;
    const band = feature.properties.band;
    const layer = drawnAs(feature.properties);
    const family = geom.name;
    try {
      if (typeof band !== "number" || layer == null) {
        written += emit(feature, geom, feature.tippecanoe.maxzoom, family, write);
        return;
      }
      written += cut(feature, geom, band, layer, masks, starts, maxZoom, family, write);
    } catch {
      // A broken ring should not drop the whole cell.
      written += emit(feature, geom, maxZoom, family, write);
    }
  });
  await new Promise<void>((resolve, reject) => {
    out.end(() => resolve());
    out.on("error", reject);
  });
  return written;
}
