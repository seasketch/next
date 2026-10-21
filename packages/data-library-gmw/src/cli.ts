#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join, resolve, basename } from "path";
import { cpus, homedir } from "os";
import { packMrtPmtiles } from "../../raster-array/src/pmtiles/pack";
import { listGmwSources } from "../../raster-array/src/gmw";
import { gdalInfo } from "../../raster-array/src/gdal";
import {
  buildOccupancy,
  loadOccupancy,
  saveOccupancy,
} from "./occupancy";
import { encodeFromCells } from "./encodeFromCells";
import { warpCellsToMercator } from "./warpCells";
import {
  ANALYSIS_SRS,
  isGeographicWgs84,
  mosaicGeographic,
} from "./analysisMosaic";
import {
  buildRunbook,
  formatRunbook,
  NATIVE_MAXZOOM,
  TEMPLATE_ID,
} from "./runbook";

const ROOT = join(__dirname, "..");
const EXTRACTED = join(homedir(), "Downloads", "GMW-all_v4112");
const DEFAULT_ZIP = join(homedir(), "Downloads", "GMW-all_v4112.zip");
const DEFAULT_WORK = join(ROOT, "work");
const PROTECTED_FIXTURE = join(
  ROOT,
  "..",
  "raster-array",
  "demos",
  "tiles",
  "gmw-global",
);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function defaultInput(): string {
  if (existsSync(EXTRACTED)) return EXTRACTED;
  return DEFAULT_ZIP;
}

function paths() {
  const work = arg("work") ?? DEFAULT_WORK;
  return {
    zipOrDir: arg("input") ?? defaultInput(),
    mosaicPath: arg("mosaic") ?? join(work, "gmw-global.4326.tif"),
    scratch: arg("scratch") ?? join(work, "tiles"),
    occupancy: arg("occupancy") ?? join(work, "occupancy.json"),
    cells3857: arg("cells-3857") ?? join(work, "cells-3857"),
    archive: arg("out") ?? join(work, "dist", "gmw-global.pmtiles"),
    analysis: join(work, "dist", "analysis.tif"),
    runbook: join(work, "dist", "runbook.md"),
    work,
  };
}

function assertSafeScratch(scratch: string): void {
  const resolved = resolve(scratch);
  if (basename(resolved) === "gmw-global") {
    throw new Error(
      `Refusing to write over the day-long globe fixture (${resolved}).\n` +
        `Use packages/data-library-gmw/work/tiles. A copy lives at ${PROTECTED_FIXTURE}.preserved-z0-12`,
    );
  }
}

function usage(): never {
  console.log(`@seasketch/data-library-gmw — GMW analysis raster + MRT PMTiles

Usage:
  data-library-gmw occupancy [--input zip|dir] [--occupancy path]
  data-library-gmw warp      [--input zip|dir] [--cells-3857 dir]
  data-library-gmw encode    [--input zip|dir] [--scratch dir] [--occupancy path]
                             [--minzoom n] [--maxzoom n] [--keep-existing]
  data-library-gmw pack      [--scratch dir] [--out gmw-global.pmtiles]
  data-library-gmw analysis  [--mosaic path] [--out analysis.tif]
  data-library-gmw mosaic    [--input zip|dir] [--mosaic path]   (analysis only)
  data-library-gmw runbook   [--release v4.1.2] [--out runbook.md]
  data-library-gmw build     occupancy + encode + pack + analysis + runbook

Display tiles are cut from 3857-warped 1° cells (occupied XYZ only).
Analysis is a sparse EPSG:4326 mosaic of the source cells — no Mercator warp.

The published product is two R2 objects:
  dataLibrary/gmw-global.pmtiles
  dataLibrary/${TEMPLATE_ID}/{release}/analysis.tif
`);
  process.exit(1);
}

async function cmdMosaic() {
  const { zipOrDir, mosaicPath } = paths();
  if (!existsSync(zipOrDir)) {
    throw new Error(`GMW source not found: ${zipOrDir}`);
  }
  const sources = await listGmwSources(zipOrDir);
  const mosaic = await mosaicGeographic(
    sources.map((s) => s.path),
    mosaicPath,
    0,
  );
  console.log(
    JSON.stringify(
      {
        mosaicPath,
        srs: ANALYSIS_SRS,
        ...mosaic,
        sourceCount: sources.length,
      },
      null,
      2,
    ),
  );
}

function defaultConcurrency(): number {
  return arg("concurrency")
    ? Number(arg("concurrency"))
    : Math.max(8, Math.min(cpus().length, 24));
}

async function cmdOccupancy() {
  const { zipOrDir, occupancy, work } = paths();
  if (!existsSync(zipOrDir)) {
    throw new Error(`GMW source not found: ${zipOrDir}`);
  }
  const sources = await listGmwSources(zipOrDir);
  const index = await buildOccupancy(sources, {
    minzoom: Number(arg("minzoom") ?? 0),
    maxzoom: Number(arg("maxzoom") ?? NATIVE_MAXZOOM),
    concurrency: defaultConcurrency(),
    workDir: join(work, "occupancy-tmp"),
    onProgress: (m) => console.error(m),
  });
  mkdirSync(dirname(occupancy), { recursive: true });
  saveOccupancy(occupancy, index);
  console.log(
    JSON.stringify(
      {
        occupancy,
        cellCount: index.cellCount,
        tiles: index.tiles.length,
        byZoom: index.byZoom,
        elapsedMs: index.elapsedMs,
      },
      null,
      2,
    ),
  );
}

async function cmdWarp() {
  const { zipOrDir, cells3857 } = paths();
  if (!existsSync(zipOrDir)) {
    throw new Error(`GMW source not found: ${zipOrDir}`);
  }
  const sources = await listGmwSources(zipOrDir);
  const warped = await warpCellsToMercator(sources, cells3857, {
    concurrency: Math.min(8, defaultConcurrency()),
    keepExisting: !flag("rebuild-warp"),
    onProgress: (m) => console.error(m),
  });
  console.log(
    JSON.stringify({ cells3857, count: warped.length }, null, 2),
  );
}

async function cmdEncode() {
  const { zipOrDir, scratch, occupancy, cells3857 } = paths();
  assertSafeScratch(scratch);
  if (!existsSync(zipOrDir)) {
    throw new Error(`GMW source not found: ${zipOrDir}`);
  }
  const geographic = await listGmwSources(zipOrDir);
  const occ = existsSync(occupancy)
    ? loadOccupancy(occupancy)
    : await (async () => {
        console.error("No occupancy file; building one…");
        await cmdOccupancy();
        return loadOccupancy(occupancy);
      })();

  const warped =
    existsSync(cells3857) && !flag("rebuild-warp")
      ? await warpCellsToMercator(geographic, cells3857, {
          concurrency: Math.min(8, defaultConcurrency()),
          keepExisting: true,
          onProgress: (m) => console.error(m),
        })
      : await (async () => {
          console.error("Warping 1° cells to EPSG:3857 (once per cell)…");
          return warpCellsToMercator(geographic, cells3857, {
            concurrency: Math.min(8, defaultConcurrency()),
            keepExisting: false,
            onProgress: (m) => console.error(m),
          });
        })();

  const result = await encodeFromCells({
    sources: warped,
    tiles: occ.tiles,
    outputDir: scratch,
    minzoom: arg("minzoom") ? Number(arg("minzoom")) : occ.minzoom,
    maxzoom: arg("maxzoom") ? Number(arg("maxzoom")) : occ.maxzoom,
    concurrency: defaultConcurrency(),
    keepExisting: flag("keep-existing"),
    mercatorSources: true,
    onProgress: (m) => console.error(m),
  });
  writeFileSync(
    join(scratch, "encode-stats.json"),
    JSON.stringify({ occupancy, ...result }, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}

async function cmdPack() {
  const { scratch, archive } = paths();
  const out = arg("out") ?? archive;
  const packed = await packMrtPmtiles({ tilesDir: scratch, outputPath: out });
  console.log(
    JSON.stringify(
      {
        output: packed.outputPath,
        tiles: packed.tileCount,
        bytes: packed.bytesOut,
      },
      null,
      2,
    ),
  );
}

async function ensureGeographicMosaic(): Promise<string> {
  const { zipOrDir, mosaicPath } = paths();
  if (existsSync(mosaicPath) && !flag("rebuild-mosaic")) {
    const info = await gdalInfo(mosaicPath);
    if (!isGeographicWgs84(info)) {
      throw new Error(
        `Refusing ${mosaicPath}: analysis must be ${ANALYSIS_SRS}, not a map projection. Pass --rebuild-mosaic.`,
      );
    }
    console.error(`Reusing mosaic ${mosaicPath}`);
    return mosaicPath;
  }
  if (!existsSync(zipOrDir)) {
    throw new Error(`GMW source not found: ${zipOrDir}`);
  }
  const sources = await listGmwSources(zipOrDir);
  await mosaicGeographic(
    sources.map((s) => s.path),
    mosaicPath,
    0,
  );
  return mosaicPath;
}

async function cmdAnalysis() {
  const { analysis } = paths();
  const mosaicPath = await ensureGeographicMosaic();
  const out = arg("out") ?? analysis;
  mkdirSync(dirname(out), { recursive: true });
  if (resolve(mosaicPath) !== resolve(out)) {
    copyFileSync(mosaicPath, out);
  }
  const info = await gdalInfo(out);
  if (!isGeographicWgs84(info)) {
    throw new Error(`Analysis output is not ${ANALYSIS_SRS}: ${out}`);
  }
  console.log(
    JSON.stringify(
      {
        analysis: out,
        srs: ANALYSIS_SRS,
        bytes: statSync(out).size,
      },
      null,
      2,
    ),
  );
}

function cmdRunbook() {
  const release = arg("release") ?? "v4.1.2";
  const runbook = buildRunbook({
    release,
    tilesHost: arg("tiles-host"),
    startYear: arg("start-year") ? Number(arg("start-year")) : undefined,
    bandCount: arg("band-count") ? Number(arg("band-count")) : undefined,
  });
  const text = formatRunbook(runbook);
  const { runbook: defaultOut } = paths();
  const out = arg("out") ?? defaultOut;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(text);
  console.error(`Wrote ${out}`);
}

async function cmdBuild() {
  const { occupancy, scratch } = paths();
  assertSafeScratch(scratch);
  if (!existsSync(occupancy) || flag("rebuild-occupancy")) {
    await cmdOccupancy();
  } else {
    console.error(`Reusing occupancy ${occupancy}`);
  }
  await cmdEncode();
  await cmdPack();
  await cmdAnalysis();
  cmdRunbook();
}

async function main() {
  const command = process.argv[2];
  if (!command || command === "-h" || command === "--help") usage();
  if (command === "occupancy") return cmdOccupancy();
  if (command === "warp") return cmdWarp();
  if (command === "encode") return cmdEncode();
  if (command === "pack") return cmdPack();
  if (command === "analysis") return cmdAnalysis();
  if (command === "mosaic") return cmdMosaic();
  if (command === "runbook") return cmdRunbook();
  if (command === "build") return cmdBuild();
  usage();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
