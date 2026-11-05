import { createReadStream, createWriteStream } from "fs";
import { readFile } from "fs/promises";
import readline from "readline";
import gdal from "gdal-async";

/**
 * Stop a smaller-scale chart where a larger-scale cell covers the same place.
 *
 * A feature of band B is split against each larger-scale cell that covers it
 * and that actually draws the same layer. The covered part ends at the zoom
 * before that cell's own features of the layer appear. Ending it at the
 * cell's usage-band zoom instead leaves a gap: the small-scale contours are
 * gone, and the large-scale contours have not started.
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

async function layerStarts(featuresPath: string): Promise<Map<string, number>> {
  const starts = new Map<string, number>();
  await readLines(featuresPath, (line) => {
    const feature = JSON.parse(line) as Feature;
    const cell = feature.properties.cell;
    const layer = feature.properties.cls;
    if (typeof cell !== "string" || typeof layer !== "string") return;
    const zoom = feature.tippecanoe?.minzoom;
    if (typeof zoom !== "number") return;
    const key = `${cell}\0${layer}`;
    const current = starts.get(key);
    if (current == null || zoom < current) starts.set(key, zoom);
  });
  return starts;
}

function cut(
  feature: Feature,
  geom: Geometry,
  band: number,
  layer: string,
  masks: Mask[],
  starts: Map<string, number>,
  maxZoom: number,
  family: string,
  write: (line: string) => void
): number {
  let remaining = clean(geom);
  if (!remaining) return 0;
  let written = 0;
  for (let higher = band + 1; higher <= 6; higher += 1) {
    const covering = masks.filter(
      (mask) => mask.band === higher && starts.has(`${mask.cell}\0${layer}`)
    );
    for (const mask of covering) {
      if (!remaining || remaining.isEmpty()) return written;
      const inside = clean(remaining.intersection(mask.geom));
      if (inside && !inside.isEmpty()) {
        const start = starts.get(`${mask.cell}\0${layer}`);
        if (start != null) written += emit(feature, inside, start - 1, family, write);
      }
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
  const starts = await layerStarts(featuresPath);
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
    const layer = feature.properties.cls;
    const family = geom.name;
    try {
      if (typeof band !== "number" || typeof layer !== "string") {
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
