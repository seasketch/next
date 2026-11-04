import { execFile } from "child_process";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { mkdtemp, readdir, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import readline from "readline";
import {
  BAND_MIN_ZOOM,
  ENC_LAYER_BY_CLASS,
  ENC_MAX_ZOOM,
  EncFeatureMeta,
  SKIN_CLASSES,
  bandFromCellName,
  extendBounds,
  rewriteEncFeature,
} from "./layers";

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
    execFile(command, args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
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
  write: (line: string) => void,
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
    // GeoJSONSeq (RFC 8142) prefixes each record with an RS character.
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
    write(JSON.stringify(feature) + "\n");
    count += 1;
  }
  return count;
}

async function readCoverage(file: string, band: number | null): Promise<unknown[]> {
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
        properties: { band },
        geometry: parsed.geometry,
      });
    } catch {
      continue;
    }
  }
  return features;
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

function peelScript(): string {
  const beside = path.join(__dirname, "peel.py");
  if (existsSync(beside)) return beside;
  const source = path.resolve(process.cwd(), "src/enc/peel.py");
  if (existsSync(source)) return source;
  throw new Error("ENC coverage peel script was not found");
}

/**
 * Turn one or more S-57 base cells (plain `.000` files, or NOAA zip exchange
 * sets) into a single PMTiles archive.
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
  const work = await mkdtemp(path.join(tmpdir(), "enc-"));
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

    const jsonlPath = path.join(work, "features.geojsonl");
    const jsonl = createWriteStream(jsonlPath);
    const bounds: { value: [number, number, number, number] | null } = { value: null };
    const cells: EncCellSummary[] = [];
    const coverage: unknown[] = [];
    let featureCount = 0;
    const clip = options?.clip;

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
        await run(
          "ogr2ogr",
          ogrExportArgs(coverPath, cellPath, "M_COVR", clip, "CATCOV = 1")
        );
        coverage.push(...(await readCoverage(coverPath, band)));
      } catch {
        // A cell with no coverage polygon cannot mask the charts under it.
      }
      let cellFeatures = 0;
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
          ignoreScaleMinimum: SKIN_CLASSES.has(objectClass),
        };
        cellFeatures += await readFeatures(exportPath, meta, (line) => jsonl.write(line), bounds);
      }
      cells.push({ cell, band, layers, featureCount: cellFeatures });
      featureCount += cellFeatures;
    }
    await new Promise<void>((resolve, reject) => {
      jsonl.end(() => resolve());
      jsonl.on("error", reject);
    });
    if (featureCount === 0 || !bounds.value) {
      throw new Error("The S-57 cells did not contain any features the chart style draws");
    }

    const maskPath = path.join(work, "coverage.geojson");
    const specPath = path.join(work, "peel-spec.json");
    const peeledPath = path.join(work, "peeled.geojsonl");
    await writeFile(
      maskPath,
      JSON.stringify({ type: "FeatureCollection", features: coverage })
    );
    await writeFile(
      specPath,
      JSON.stringify({ bandMinZoom: BAND_MIN_ZOOM, maxZoom: ENC_MAX_ZOOM })
    );
    await run("python3", [peelScript(), jsonlPath, maskPath, peeledPath, specPath]);

    const pmtilesPath = path.join(work, "chart.pmtiles");
    await run("tippecanoe", [
      "-o",
      pmtilesPath,
      "--force",
      "--projection=EPSG:4326",
      "--minimum-zoom=0",
      `--maximum-zoom=${ENC_MAX_ZOOM}`,
      "--detect-shared-borders",
      "--no-tiny-polygon-reduction",
      "--drop-densest-as-needed",
      "--extend-zooms-if-still-dropping",
      "--maximum-tile-bytes=1500000",
      "--no-feature-limit",
      "--generate-ids",
      peeledPath,
    ]);
    // The caller reads the archive before the temp dir would be removed.
    // Keep the file by moving it out, then delete the work directory.
    const kept = path.join(tmpdir(), `enc-${Date.now()}.pmtiles`);
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
