#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { cpus } from "os";
import { encodeTileset } from "../../raster-array/src/tiler";
import { packMrtPmtiles } from "../../raster-array/src/pmtiles/pack";
import { downloadPath, downloadProduct } from "./download";
import {
  PRODUCT_IDS,
  CrwProductId,
  archiveFilename,
  isCrwProductId,
  periodsFor,
  requireProduct,
  reusesStack,
  NATIVE_MAXZOOM,
  TILE_BUFFER,
  TILE_SIZE,
} from "./products";
import { stackProduct, warpedPath } from "./stack";
import {
  clearMrtTiles,
  loadOccupancy,
  saveOccupancy,
} from "./occupancy";
import { buildRunbook, formatRunbook } from "./runbook";
import { uploadProductArchive } from "./upload";
import { verifyProduct } from "./verify";

const ROOT = join(__dirname, "..");
const DEFAULT_WORK = join(ROOT, "work");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function workDir(): string {
  return arg("work") ?? DEFAULT_WORK;
}

function downloadsDir(): string {
  return arg("downloads") ?? join(workDir(), "downloads");
}

function productIdsFromArgs(): CrwProductId[] {
  const raw = arg("product") ?? "dhw-max";
  if (raw === "all") return [...PRODUCT_IDS];
  return raw.split(",").map((id) => {
    const trimmed = id.trim();
    if (!isCrwProductId(trimmed)) {
      throw new Error(
        `Unknown product "${trimmed}". Expected one of: ${PRODUCT_IDS.join(", ")}, all`,
      );
    }
    return trimmed;
  });
}

function requestedBands(id: CrwProductId): string[] {
  const product = requireProduct(id);
  const start = arg("start-date") ?? arg("start-year");
  const end = arg("end-date") ?? arg("end-year");
  return periodsFor(product, start, end);
}

function presentBands(id: CrwProductId): string[] {
  const product = requireProduct(id);
  const requested = requestedBands(id);
  const present = requested.filter((bandId) =>
    existsSync(downloadPath(downloadsDir(), product, bandId)),
  );
  if (present.length === 0) {
    throw new Error(
      `No downloaded files for ${id}. Run download first (${requested[0]}–${requested[requested.length - 1]}).`,
    );
  }
  return present;
}

function bandsForRunbook(id: CrwProductId): string[] {
  const product = requireProduct(id);
  const requested = requestedBands(id);
  const present = requested.filter((bandId) =>
    existsSync(downloadPath(downloadsDir(), product, bandId)),
  );
  return present.length ? present : requested;
}

function scratchDir(id: CrwProductId): string {
  return arg("scratch") ?? join(workDir(), "tiles", id);
}

function archivePath(id: CrwProductId): string {
  return arg("out") ?? join(workDir(), "dist", archiveFilename(requireProduct(id)));
}

function defaultConcurrency(): number {
  return arg("concurrency")
    ? Number(arg("concurrency"))
    : Math.max(4, Math.min(cpus().length, 16));
}

function usage(): never {
  console.log(`@seasketch/data-library-crw — CRW annual + daily DHW → MRT PMTiles

Usage:
  data-library-crw download [--product dhw-max|dhw-weekly-24|baa-max|baa-weekly-24|ssta-mean|ssta-weekly-24|sst-mean|sst-weekly-24|all]
  data-library-crw stack    [--product …]
  data-library-crw encode   [--product …] [--minzoom 0] [--maxzoom 5]
  data-library-crw pack     [--product …]
  data-library-crw runbook  [--product …]
  data-library-crw upload   [--product …] [--force]
  data-library-crw verify   [--product …]
  data-library-crw build    download + stack + encode + pack + runbook

Optional:
  --start-year 1986 --end-year 2025
  --start-date 2026-08-04 --end-date 2026-09-03
  --work packages/data-library-crw/work
`);
  process.exit(1);
}

async function cmdDownload() {
  for (const id of productIdsFromArgs()) {
    const product = requireProduct(id);
    if (product.aliasOf) {
      console.error(`${id} reuses ${product.aliasOf} downloads — skipping`);
      continue;
    }
    const bands = requestedBands(id);
    const results = await downloadProduct(product, bands, downloadsDir(), {
      concurrency: defaultConcurrency(),
      force: flag("force"),
      onProgress: (m) => console.error(m),
    });
    console.log(
      JSON.stringify(
        {
          product: id,
          bands: results.length,
          downloaded: results.filter((r) => !r.skipped && !r.missing).length,
          skipped: results.filter((r) => r.skipped && !r.missing).length,
          missing: results.filter((r) => r.missing).length,
          bytes: results.reduce((sum, r) => sum + r.bytes, 0),
        },
        null,
        2,
      ),
    );
  }
}

async function cmdStack() {
  for (const id of productIdsFromArgs()) {
    const product = requireProduct(id);
    if (reusesStack(product)) {
      console.error(`${id} reuses ${product.aliasOf} stack — skipping`);
      continue;
    }
    const bands = presentBands(id);
    const result = await stackProduct(
      product,
      bands,
      downloadsDir(),
      workDir(),
      {
        keepExisting: !flag("rebuild-stack"),
        concurrency: defaultConcurrency(),
        onProgress: (m) => console.error(m),
      },
    );
    console.log(JSON.stringify({ product: id, ...result }, null, 2));
  }
}

async function cmdEncode() {
  for (const id of productIdsFromArgs()) {
    const product = requireProduct(id);
    const bands = presentBands(id);
    const input = warpedPath(workDir(), product);
    if (!existsSync(input)) {
      throw new Error(`Warped raster missing: ${input}. Run stack first.`);
    }
    const outputDir = scratchDir(id);
    mkdirSync(outputDir, { recursive: true });
    const occupancy =
      loadOccupancy(outputDir) ??
      (product.aliasOf ? loadOccupancy(scratchDir(product.aliasOf)) : null) ??
      (product.reuseWarpsOf
        ? loadOccupancy(scratchDir(product.reuseWarpsOf))
        : null) ??
      (product.reuseOccupancyOf
        ? loadOccupancy(scratchDir(product.reuseOccupancyOf))
        : null);
    if (occupancy) {
      saveOccupancy(outputDir, occupancy);
      clearMrtTiles(outputDir);
      console.error(`Reusing occupancy allowlist (${occupancy.length} tiles)`);
    }
    const result = await encodeTileset({
      input,
      outputDir,
      layerName: product.layerName,
      units: product.units,
      tileSize: TILE_SIZE,
      buffer: TILE_BUFFER,
      minzoom: arg("minzoom") ? Number(arg("minzoom")) : 0,
      maxzoom: arg("maxzoom") ? Number(arg("maxzoom")) : NATIVE_MAXZOOM,
      bandIds: bands,
      offset: product.offset,
      scale: product.scale,
      nodata: product.nodata,
      bandsPerBlock: arg("bands-per-block")
        ? Number(arg("bands-per-block"))
        : product.bandsPerBlock,
      filters: product.filters,
      gzipLevel: 6,
      resampling: product.resampling,
      skipEmpty: true,
      onlyTiles: occupancy ?? undefined,
      concurrency: Math.min(6, defaultConcurrency()),
      onProgress: (m) => console.error(m),
    });
    const written = loadOccupancy(outputDir);
    if (written) saveOccupancy(outputDir, written);
    writeFileSync(
      join(outputDir, "encode-stats.json"),
      JSON.stringify({ product: id, bands, ...result }, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          product: id,
          tileCount: result.tileCount,
          skippedEmpty: result.skippedEmpty,
          bytesOut: result.bytesOut,
          range: result.range,
          elapsedMs: result.elapsedMs,
        },
        null,
        2,
      ),
    );
  }
}

async function cmdPack() {
  for (const id of productIdsFromArgs()) {
    const product = requireProduct(id);
    const scratch = scratchDir(id);
    const out = archivePath(id);
    mkdirSync(dirname(out), { recursive: true });
    const packed = await packMrtPmtiles({ tilesDir: scratch, outputPath: out });
    console.log(
      JSON.stringify(
        {
          product: id,
          output: packed.outputPath,
          tiles: packed.tileCount,
          bytes: packed.bytesOut,
        },
        null,
        2,
      ),
    );
  }
}

function cmdRunbook() {
  for (const id of productIdsFromArgs()) {
    const product = requireProduct(id);
    const bands = bandsForRunbook(id);
    const runbook = buildRunbook({
      product,
      bands,
      tilesHost: arg("tiles-host"),
    });
    const text = formatRunbook(runbook);
    const out =
      arg("out") ?? join(workDir(), "dist", `runbook-${product.id}.md`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    console.log(text);
    console.error(`Wrote ${out}`);
  }
}

async function cmdUpload() {
  for (const id of productIdsFromArgs()) {
    const product = requireProduct(id);
    const local = archivePath(id);
    const result = await uploadProductArchive(product, local, {
      force: flag("force"),
      envFile: arg("env-file"),
    });
    console.log(JSON.stringify({ product: id, ...result }, null, 2));
  }
}

async function cmdVerify() {
  for (const id of productIdsFromArgs()) {
    const product = requireProduct(id);
    const result = await verifyProduct({
      product,
      bands: presentBands(id),
      archive: archivePath(id),
      warped: warpedPath(workDir(), product),
    });
    console.log(JSON.stringify({ product: id, ...result }, null, 2));
    if (!result.ok) {
      throw new Error(
        `${id} verify failed: tile ${result.tileValue} vs gdal ${result.gdalValue} (delta ${result.delta})`,
      );
    }
  }
}

async function cmdBuild() {
  await cmdDownload();
  await cmdStack();
  await cmdEncode();
  await cmdPack();
  cmdRunbook();
}

async function main() {
  const command = process.argv[2];
  if (!command || command === "-h" || command === "--help") usage();
  if (command === "download") return cmdDownload();
  if (command === "stack") return cmdStack();
  if (command === "encode") return cmdEncode();
  if (command === "pack") return cmdPack();
  if (command === "runbook") return cmdRunbook();
  if (command === "upload") return cmdUpload();
  if (command === "verify") return cmdVerify();
  if (command === "build") return cmdBuild();
  usage();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
