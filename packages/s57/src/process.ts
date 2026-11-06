import { execFile } from "child_process";
import { createReadStream, createWriteStream } from "fs";
import { mkdtemp, readdir, rm, stat, writeFile } from "fs/promises";
import { cpus, tmpdir } from "os";
import path from "path";
import readline from "readline";
import {
  BAND_MIN_ZOOM,
  ENC_LAYER_BY_CLASS,
  ENC_SOURCES,
  EncSource,
  fitToSource,
  sourceForBand,
  ENC_MAX_ZOOM,
  EncFeatureMeta,
  ignoresScaleMinimum,
  bandFromCellName,
  extendBounds,
  rewriteEncFeature,
} from "./layers.js";
import { ChartFeature, clipDepthCoveredByLand } from "./landCover.js";
import { peelFeatures } from "./peel.js";
import { LightFeature, lightSectorFeatures, sectorRings } from "./sectors.js";
import { labelLightsFromStructures, placeTopmarks } from "./labels.js";
import { writeAreaLabels } from "./areaLabels.js";
import { cellEdge, outlineFeatures } from "./outlines.js";
import { trafficArrows } from "./traffic.js";

const READ_CONCURRENCY = Math.max(1, Math.min(8, cpus().length));

export type EncClip = [number, number, number, number];

export type EncCellSummary = {
  cell: string;
  band: number | null;
  layers: string[];
  featureCount: number;
};

export type EncArchive = {
  /** `ENC_SOURCES` id. */
  source: string;
  /** Last zoom in the archive. The map overzooms past it. */
  maxzoom: number;
  pmtilesPath: string;
};

export type EncProcessResult = {
  /** One PMTiles archive per scale group that has features, smallest scale first. */
  archives: EncArchive[];
  cells: EncCellSummary[];
  bounds: [number, number, number, number];
  featureCount: number;
};

function run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = (stderr || stdout || "").toString().trim();
        // Tippecanoe prints progress first; the cause is at the end.
        reject(new Error(`${command} failed (${error.message.split("\n")[0]}): ${detail.slice(-2000)}`));
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

function drained(stream: NodeJS.WritableStream & { writableNeedDrain?: boolean }): Promise<void> {
  if (!stream.writableNeedDrain) return Promise.resolve();
  return new Promise((resolve) => stream.once("drain", () => resolve()));
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
  const lights: LightFeature[] = [];
  const lines = readline.createInterface({ input: createReadStream(peeledPoints), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"LIGHTS"') || !line.includes("SECTR1")) continue;
    lights.push(JSON.parse(line));
  }
  const rings = sectorRings(lights);
  lights.forEach((light, index) => {
    for (const sector of lightSectorFeatures(light, rings[index])) {
      stream.write(JSON.stringify({ type: "Feature", ...sector }) + "\n");
      count += 1;
    }
  });
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

type SplitFile = { path: string; count: number };
type SplitFiles = { areas: SplitFile; points: SplitFile };

/** Sort features into one areas file and one points file per `ENC_SOURCES` group. */
async function splitBySource(
  work: string,
  inputs: { areas: string[]; points: string[] }
): Promise<Map<string, SplitFiles>> {
  const files = new Map<string, SplitFiles>();
  const streams = new Map<string, NodeJS.WritableStream & { writableNeedDrain?: boolean }>();
  for (const source of ENC_SOURCES) {
    const areas = { path: path.join(work, `${source.id}-areas.geojsonl`), count: 0 };
    const points = { path: path.join(work, `${source.id}-points.geojsonl`), count: 0 };
    files.set(source.id, { areas, points });
    streams.set(areas.path, createWriteStream(areas.path));
    streams.set(points.path, createWriteStream(points.path));
  }
  for (const kind of ["areas", "points"] as const) {
    for (const input of inputs[kind]) {
      const lines = readline.createInterface({ input: createReadStream(input), crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line.trim()) continue;
        const feature = JSON.parse(line) as {
          properties: Record<string, unknown>;
          tippecanoe: { minzoom: number; maxzoom: number };
        };
        const source = sourceForBand(feature.properties?.band);
        fitToSource(feature, source);
        const target = files.get(source.id)![kind];
        const stream = streams.get(target.path)!;
        stream.write(JSON.stringify(feature) + "\n");
        target.count += 1;
        await drained(stream);
      }
    }
  }
  await Promise.all(
    [...streams.values()].map(
      (stream) =>
        new Promise<void>((resolve, reject) => {
          stream.end(() => resolve());
          stream.on("error", reject);
        })
    )
  );
  return files;
}

/** Tile one scale group's areas and points into a single archive. */
async function tileSource(work: string, source: EncSource, files: SplitFiles): Promise<string> {
  const parts: string[] = [];
  const zooms = ["--minimum-zoom=0", `--maximum-zoom=${source.maxzoom}`];
  if (files.areas.count > 0) {
    const areasTiles = path.join(work, `${source.id}-areas.pmtiles`);
    const areaRun = await run("tippecanoe", [
      "-o",
      areasTiles,
      "--force",
      // Progress on a national chart is more output than execFile buffers.
      "--no-progress-indicator",
      "--projection=EPSG:4326",
      ...zooms,
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
      files.areas.path,
    ]);
    if (areaRun.stderr.trim()) console.warn(areaRun.stderr.trim().slice(0, 2000));
    parts.push(areasTiles);
  }
  if (files.points.count > 0) {
    const pointTiles = path.join(work, `${source.id}-points.pmtiles`);
    // No size limit: a harbour sounding or a buoy is never the feature
    // that should be thrown away to make a tile smaller.
    const pointRun = await run("tippecanoe", [
      "-o",
      pointTiles,
      "--force",
      "--no-progress-indicator",
      "--projection=EPSG:4326",
      ...zooms,
      "--no-tile-size-limit",
      "--no-feature-limit",
      // Tippecanoe otherwise keeps 1 point in 2.5 at each zoom below the
      // top, so rocks and soundings blink out and back as you zoom.
      "--drop-rate=1",
      "--generate-ids",
      files.points.path,
    ]);
    if (pointRun.stderr.trim()) console.warn(pointRun.stderr.trim().slice(0, 2000));
    parts.push(pointTiles);
  }
  if (parts.length === 1) return parts[0];
  const joined = path.join(work, `${source.id}.pmtiles`);
  await run("tile-join", ["--force", "--quiet", "--no-tile-size-limit", "-o", joined, ...parts]);
  return joined;
}

/**
 * Turn one or more S-57 base cells (plain `.000` files, or NOAA zip exchange
 * sets) into PMTiles archives of Mapbox vector tiles, one per scale group.
 *
 * Where two cells cover the same place, the larger-scale cell replaces the
 * smaller-scale one from the zoom at which that larger scale is meant to be
 * read. `clip`, when set, cuts every feature to that box so an overview cell
 * does not pull the chart out to the whole coast.
 */
export async function processEncFiles(
  inputs: string[],
  options?: { clip?: EncClip; onProgress?: (message: string) => void }
): Promise<EncProcessResult> {
  const progress = options?.onProgress ?? (() => undefined);
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

    const summaries: EncCellSummary[] = new Array(baseCells.length);
    let read = 0;
    const readCell = async (cellPath: string, index: number) => {
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
      // Indexed: two editions of one cell may be read at the same time.
      const coverPath = path.join(exportDir, `${index}-${cell}-M_COVR.geojsonl`);
      let cellCoverage: unknown[] = [];
      try {
        await run("ogr2ogr", ogrExportArgs(coverPath, cellPath, "M_COVR", clip, "CATCOV = 1"));
        cellCoverage = await readCoverage(coverPath, band, cell);
        coverage.push(...cellCoverage);
        await rm(coverPath, { force: true });
      } catch {
        // A cell with no coverage polygon cannot mask the charts under it.
      }
      const pending: ChartFeature[] = [];
      for (const objectClass of layers) {
        const exportPath = path.join(exportDir, `${index}-${cell}-${objectClass}.geojsonl`);
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
        // A national upload exports tens of gigabytes. Keep one cell at a time on disk.
        await rm(exportPath, { force: true });
      }
      labelLightsFromStructures(pending);
      // Creek beds are shallow depth areas tucked into the shoreline. Close the
      // narrow ones and join the small fingers onto the land before tiling.
      const clipped = clipDepthCoveredByLand(placeTopmarks(pending));
      const edge = cellEdge(cellCoverage as Array<{ geometry?: unknown }>, pending, clipped);
      clipped.push(...outlineFeatures(clipped, edge));
      clipped.push(...trafficArrows(clipped));
      for (const feature of clipped) write(feature as Record<string, unknown>);
      await Promise.all([drained(areas), drained(points)]);
      const cellFeatures = clipped.length;
      summaries[index] = { cell, band, layers, featureCount: cellFeatures };
      featureCount += cellFeatures;
      read += 1;
      if (read % 25 === 0 || read === baseCells.length) {
        progress(`Read ${read} of ${baseCells.length} cells`);
      }
    };
    // Each cell is a handful of ogr2ogr runs. Several at once keep the cores busy.
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(READ_CONCURRENCY, baseCells.length) }, async () => {
        while (next < baseCells.length) {
          const index = next;
          next += 1;
          await readCell(baseCells[index], index);
        }
      })
    );
    cells.push(...summaries);
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
      progress(`Handing over ${areaCount} lines and areas between chart scales`);
      await peelFeatures(areasPath, maskPath, peeledAreas, specPath);
      areaLabelCount = await writeAreaLabels(peeledAreas, areaLabelsPath);
    }
    const sectorsPath = path.join(work, "sectors.geojsonl");
    let sectorCount = 0;
    if (pointCount > 0) {
      progress(`Handing over ${pointCount} points between chart scales`);
      await peelFeatures(pointsPath, maskPath, peeledPoints, specPath);
      // From the peeled lights, so an arc stops where its light does.
      sectorCount = await writeLightSectors(peeledPoints, sectorsPath);
    }

    progress("Splitting the chart by scale");
    const split = await splitBySource(work, {
      areas: areaCount > 0 ? [peeledAreas] : [],
      points: [
        ...(pointCount > 0 ? [peeledPoints] : []),
        ...(sectorCount > 0 ? [sectorsPath] : []),
        ...(areaLabelCount > 0 ? [areaLabelsPath] : []),
      ],
    });
    const archives: EncArchive[] = [];
    for (const source of ENC_SOURCES) {
      const files = split.get(source.id);
      if (!files || (files.areas.count === 0 && files.points.count === 0)) continue;
      progress(`Tiling the ${source.id} charts`);
      const archive = await tileSource(work, source, files);
      const kept = path.join(tmpdir(), `s57-${Date.now()}-${source.id}.pmtiles`);
      await run("mv", [archive, kept]);
      archives.push({ source: source.id, maxzoom: source.maxzoom, pmtilesPath: kept });
    }
    return {
      archives,
      cells,
      bounds: bounds.value,
      featureCount,
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
