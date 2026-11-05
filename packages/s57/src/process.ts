import { execFile } from "child_process";
import { createReadStream, createWriteStream } from "fs";
import { mkdtemp, readdir, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import readline from "readline";
import {
  BAND_MIN_ZOOM,
  ENC_LAYER_BY_CLASS,
  ENC_MAX_ZOOM,
  EncFeatureMeta,
  ignoresScaleMinimum,
  bandFromCellName,
  extendBounds,
  rewriteEncFeature,
} from "./layers.js";
import { ChartFeature, clipDepthCoveredByLand } from "./landCover.js";
import { peelFeatures } from "./peel.js";
import { lightSectorFeatures } from "./sectors.js";
import { labelLightsFromStructures } from "./labels.js";
import { writeAreaLabels } from "./areaLabels.js";

export type EncClip = [number, number, number, number];

export type EncCellSummary = {
  cell: string;
  band: number | null;
  layers: string[];
  featureCount: number;
};

export type EncProcessResult = {
  pmtilesPath: string;
  cells: EncCellSummary[];
  bounds: [number, number, number, number];
  featureCount: number;
};

function run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = (stderr || stdout || error.message).trim();
        reject(new Error(`${command} failed: ${detail.slice(0, 2000)}`));
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

async function walk(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walk(full)));
    } else if (entry.isFile()) {
      found.push(full);
    }
  }
  return found;
}

function layerNames(ogrinfo: string): string[] {
  const names: string[] = [];
  for (const line of ogrinfo.split("\n")) {
    const match = line.match(/^\d+:\s+([A-Z0-9_]+)/);
    if (!match) continue;
    if (ENC_LAYER_BY_CLASS[match[1]]) names.push(match[1]);
  }
  return names;
}

async function readFeatures(
  file: string,
  meta: EncFeatureMeta,
  write: (feature: Record<string, unknown>) => void,
  bounds: { value: [number, number, number, number] | null }
): Promise<number> {
  const info = await stat(file);
  if (info.size === 0) return 0;
  let count = 0;
  const lines = readline.createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    const trimmed = line.replace(/^\u001e/, "").trim();
    if (!trimmed || trimmed === "{" || trimmed.startsWith('"type"')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const feature = rewriteEncFeature(parsed, meta);
    if (!feature) continue;
    bounds.value = extendBounds(bounds.value, feature.geometry);
    write(feature);
    count += 1;
  }
  return count;
}

async function readCoverage(
  file: string,
  band: number | null,
  cell: string
): Promise<unknown[]> {
  const info = await stat(file);
  if (info.size === 0 || band == null) return [];
  const features: unknown[] = [];
  const lines = readline.createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    const trimmed = line.replace(/^\u001e/, "").trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed) as { type?: string; geometry?: unknown };
      if (parsed.type !== "Feature" || !parsed.geometry) continue;
      features.push({
        type: "Feature",
        properties: { band, cell },
        geometry: parsed.geometry,
      });
    } catch {
      continue;
    }
  }
  return features;
}

async function writeLightSectors(peeledPoints: string, out: string): Promise<number> {
  const stream = createWriteStream(out);
  let count = 0;
  const lines = readline.createInterface({ input: createReadStream(peeledPoints), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"LIGHTS"') || !line.includes("SECTR1")) continue;
    for (const sector of lightSectorFeatures(JSON.parse(line))) {
      stream.write(JSON.stringify({ type: "Feature", ...sector }) + "\n");
      count += 1;
    }
  }
  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
  return count;
}

function ogrExportArgs(
  output: string,
  cellPath: string,
  layer: string,
  clip?: EncClip,
  where?: string
): string[] {
  const args = [
    "-f",
    "GeoJSONSeq",
    output,
    "-t_srs",
    "EPSG:4326",
    "-oo",
    "SPLIT_MULTIPOINT=ON",
    "-oo",
    "ADD_SOUNDG_DEPTH=ON",
  ];
  if (clip) {
    args.push("-clipsrc", String(clip[0]), String(clip[1]), String(clip[2]), String(clip[3]));
  }
  if (where) args.push("-where", where);
  args.push(cellPath, layer);
  return args;
}

/**
 * Turn one or more S-57 base cells (plain `.000` files, or NOAA zip exchange
 * sets) into a single PMTiles archive of Mapbox vector tiles.
 *
 * Where two cells cover the same place, the larger-scale cell replaces the
 * smaller-scale one from the zoom at which that larger scale is meant to be
 * read. `clip`, when set, cuts every feature to that box so an overview cell
 * does not pull the chart out to the whole coast.
 */
export async function processEncFiles(
  inputs: string[],
  options?: { clip?: EncClip }
): Promise<EncProcessResult> {
  if (inputs.length === 0) {
    throw new Error("No S-57 files were provided");
  }
  const work = await mkdtemp(path.join(tmpdir(), "s57-"));
  try {
    const cellsDir = path.join(work, "cells");
    const exportDir = path.join(work, "export");
    await run("mkdir", ["-p", cellsDir, exportDir]);
    let zipIndex = 0;
    const baseCells: string[] = [];
    for (const input of inputs) {
      const lower = input.toLowerCase();
      if (lower.endsWith(".zip")) {
        const dest = path.join(cellsDir, `zip-${zipIndex++}`);
        await run("mkdir", ["-p", dest]);
        await run("unzip", ["-o", "-q", input, "-d", dest]);
        for (const file of await walk(dest)) {
          if (file.toLowerCase().endsWith(".000")) baseCells.push(file);
        }
      } else if (lower.endsWith(".000")) {
        baseCells.push(input);
      } else {
        throw new Error(
          `${path.basename(input)} is not an S-57 zip or .000 cell. Encrypted S-63 cells are not supported.`
        );
      }
    }
    if (baseCells.length === 0) {
      throw new Error(
        "No S-57 base cells (.000) were found. Export unencrypted S-57. Encrypted S-63 exchange sets are not supported."
      );
    }

    const areasPath = path.join(work, "areas.geojsonl");
    const pointsPath = path.join(work, "points.geojsonl");
    const areas = createWriteStream(areasPath);
    const points = createWriteStream(pointsPath);
    const bounds: { value: [number, number, number, number] | null } = { value: null };
    const cells: EncCellSummary[] = [];
    const coverage: unknown[] = [];
    let featureCount = 0;
    let areaCount = 0;
    let pointCount = 0;
    const clip = options?.clip;
    // Soundings and buoys are points. They go in their own tiles so a dense
    // shoreline polygon cannot crowd them out of a harbour tile.
    const write = (feature: Record<string, unknown>) => {
      const geometry = feature.geometry as { type?: string; coordinates?: unknown };
      // A restricted area that fills a cell is the sanctuary (or a similar
      // zone) stamped on the whole chart. Its outline is the cell rectangle,
      // which reads as a tile seam. Keep the name, drop the frame.
      const properties = feature.properties as Record<string, unknown>;
      if (
        properties.cls === "regulated" &&
        (geometry.type === "Polygon" || geometry.type === "MultiPolygon")
      ) {
        const box = extendBounds(null, geometry);
        if (box) {
          const width = box[2] - box[0];
          const height = box[3] - box[1];
          // Clipping a cell-sized area leaves a hairline polygon on the
          // meridian. Stroking it draws a dashed line across the chart.
          if (Math.min(width, height) < 0.001) return;
        }
        if (box && box[2] - box[0] > 0.12 && box[3] - box[1] > 0.12) {
          const name = properties.OBJNAM;
          if (typeof name !== "string" || name.length === 0) return;
          feature = {
            type: "Feature",
            properties: { ...properties, cls: "place", obj: "SEAARE" },
            geometry: {
              type: "Point",
              coordinates: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2],
            },
            tippecanoe: {
              ...(feature.tippecanoe as Record<string, unknown>),
              layer: "place",
            },
          };
        }
      }
      const placed = feature.geometry as { type?: string };
      const line = JSON.stringify(feature) + "\n";
      if (placed.type === "Point" || placed.type === "MultiPoint") {
        points.write(line);
        pointCount += 1;
      } else {
        areas.write(line);
        areaCount += 1;
      }
    };

    for (const cellPath of baseCells) {
      const cell = path.basename(cellPath, path.extname(cellPath));
      const band = bandFromCellName(cell);
      let listed = "";
      try {
        const info = await run("ogrinfo", ["-ro", "-so", "-q", cellPath]);
        listed = info.stdout;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Could not read ${cell} as S-57. Encrypted S-63 cells and S-101 datasets are not supported. ${message}`
        );
      }
      const layers = layerNames(listed);
      const coverPath = path.join(exportDir, `${cell}-M_COVR.geojsonl`);
      try {
        await run("ogr2ogr", ogrExportArgs(coverPath, cellPath, "M_COVR", clip, "CATCOV = 1"));
        coverage.push(...(await readCoverage(coverPath, band, cell)));
      } catch {
        // A cell with no coverage polygon cannot mask the charts under it.
      }
      const pending: ChartFeature[] = [];
      for (const objectClass of layers) {
        const exportPath = path.join(exportDir, `${cell}-${objectClass}.geojsonl`);
        try {
          await run("ogr2ogr", ogrExportArgs(exportPath, cellPath, objectClass, clip));
        } catch {
          continue;
        }
        const meta: EncFeatureMeta = {
          cell,
          band,
          layer: ENC_LAYER_BY_CLASS[objectClass],
          objectClass,
          ignoreScaleMinimum: ignoresScaleMinimum(objectClass),
        };
        await readFeatures(exportPath, meta, (feature) => pending.push(feature as ChartFeature), bounds);
      }
      labelLightsFromStructures(pending);
      // Creek beds are shallow depth areas tucked into the shoreline. Close the
      // narrow ones and join the small fingers onto the land before tiling.
      const clipped = clipDepthCoveredByLand(pending);
      for (const feature of clipped) write(feature as Record<string, unknown>);
      const cellFeatures = clipped.length;
      cells.push({ cell, band, layers, featureCount: cellFeatures });
      featureCount += cellFeatures;
    }
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        areas.end(() => resolve());
        areas.on("error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        points.end(() => resolve());
        points.on("error", reject);
      }),
    ]);
    if (featureCount === 0 || !bounds.value) {
      throw new Error("The S-57 cells did not contain any features the chart style draws");
    }

    const maskPath = path.join(work, "coverage.geojson");
    const specPath = path.join(work, "peel-spec.json");
    const peeledAreas = path.join(work, "areas-peeled.geojsonl");
    const peeledPoints = path.join(work, "points-peeled.geojsonl");
    await writeFile(maskPath, JSON.stringify({ type: "FeatureCollection", features: coverage }));
    await writeFile(specPath, JSON.stringify({ bandMinZoom: BAND_MIN_ZOOM, maxZoom: ENC_MAX_ZOOM }));
    const areaLabelsPath = path.join(work, "area-labels.geojsonl");
    let areaLabelCount = 0;
    if (areaCount > 0) {
      await peelFeatures(areasPath, maskPath, peeledAreas, specPath);
      areaLabelCount = await writeAreaLabels(peeledAreas, areaLabelsPath);
    }
    const sectorsPath = path.join(work, "sectors.geojsonl");
    let sectorCount = 0;
    if (pointCount > 0) {
      await peelFeatures(pointsPath, maskPath, peeledPoints, specPath);
      // From the peeled lights, so an arc stops where its light does.
      sectorCount = await writeLightSectors(peeledPoints, sectorsPath);
    }

    const pmtilesPath = path.join(work, "chart.pmtiles");
    const parts: string[] = [];
    if (areaCount > 0) {
      const areasTiles = path.join(work, "areas.pmtiles");
      const areaRun = await run("tippecanoe", [
        "-o",
        areasTiles,
        "--force",
        "--projection=EPSG:4326",
        "--minimum-zoom=0",
        `--maximum-zoom=${ENC_MAX_ZOOM}`,
        "--full-detail=14",
        "--low-detail=12",
        "--detect-shared-borders",
        "--no-simplification-of-shared-nodes",
        "--no-tiny-polygon-reduction",
        // Coastal tiles are the dense ones. Dropping their largest polygons
        // to fit a byte budget leaves the shore blank and the next tile,
        // offshore, still holding the depth bands. Simplify instead.
        "--no-tile-size-limit",
        "--no-feature-limit",
        "--generate-ids",
        peeledAreas,
      ]);
      if (areaRun.stderr.trim()) console.warn(areaRun.stderr.trim().slice(0, 2000));
      parts.push(areasTiles);
    }
    if (pointCount > 0 || areaLabelCount > 0) {
      const pointTiles = path.join(work, "points.pmtiles");
      // No size limit: a harbour sounding or a buoy is never the feature
      // that should be thrown away to make a tile smaller.
      const pointRun = await run("tippecanoe", [
        "-o",
        pointTiles,
        "--force",
        "--projection=EPSG:4326",
        "--minimum-zoom=0",
        `--maximum-zoom=${ENC_MAX_ZOOM}`,
        "--no-tile-size-limit",
        "--no-feature-limit",
        // Tippecanoe otherwise keeps 1 point in 2.5 at each zoom below the
        // top, so rocks and soundings blink out and back as you zoom.
        "--drop-rate=1",
        "--generate-ids",
        ...(pointCount > 0 ? [peeledPoints] : []),
        ...(sectorCount > 0 ? [sectorsPath] : []),
        ...(areaLabelCount > 0 ? [areaLabelsPath] : []),
      ]);
      if (pointRun.stderr.trim()) console.warn(pointRun.stderr.trim().slice(0, 2000));
      parts.push(pointTiles);
    }
    if (parts.length === 1) {
      await run("mv", [parts[0], pmtilesPath]);
    } else {
      await run("tile-join", ["--force", "--no-tile-size-limit", "-o", pmtilesPath, ...parts]);
    }
    const kept = path.join(tmpdir(), `s57-${Date.now()}.pmtiles`);
    await run("mv", [pmtilesPath, kept]);
    return {
      pmtilesPath: kept,
      cells,
      bounds: bounds.value,
      featureCount,
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
