import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from "fs";
import { dirname, join } from "path";
import { cpus, homedir } from "os";
import { encodeTileset } from "../src/tiler";
import { gdalWarpMosaic } from "../src/gdal";
import { listGmwSources } from "../src/gmw";

const ROOT = join(__dirname, "..");
const DEFAULT_ZIP = join(homedir(), "Downloads", "GMW-all_v4112.zip");
const DEFAULT_MOSAIC = join(ROOT, "fixtures", "gmw-global", "gmw-global.3857.tif");
const DEFAULT_OUT = join(ROOT, "demos", "tiles", "gmw-global");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

function positionalInput(): string | undefined {
  const argv = process.argv.slice(2);
  const takesValue = new Set([
    "--input",
    "--mosaic",
    "--out",
    "--maxzoom",
    "--minzoom",
    "--concurrency",
  ]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (takesValue.has(a)) {
      i++;
      continue;
    }
    if (a.startsWith("-")) continue;
    return a;
  }
  return undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function mosaicGmw(
  sources: string[],
  mosaicPath: string,
  nodata: number,
): Promise<{ elapsedMs: number; bytes: number }> {
  mkdirSync(dirname(mosaicPath), { recursive: true });
  if (existsSync(mosaicPath)) rmSync(mosaicPath, { force: true });
  const started = Date.now();
  console.error(
    `Warping ${sources.length} GMW cells into one sparse EPSG:3857 GeoTIFF:\n  ${mosaicPath}`,
  );
  await gdalWarpMosaic(sources, mosaicPath, [
    "-overwrite",
    "-t_srs",
    "EPSG:3857",
    "-r",
    "near",
    "-of",
    "GTiff",
    "-co",
    "TILED=YES",
    "-co",
    "COMPRESS=DEFLATE",
    "-co",
    "SPARSE_OK=YES",
    "-co",
    "BIGTIFF=YES",
    "-co",
    "NUM_THREADS=ALL_CPUS",
    "-wo",
    "SKIP_NOSOURCE=YES",
    "-wo",
    "NUM_THREADS=ALL_CPUS",
    "-srcnodata",
    String(nodata),
    "-dstnodata",
    String(nodata),
  ]);
  const elapsedMs = Date.now() - started;
  const bytes = statSync(mosaicPath).size;
  console.error(
    `Mosaic ${(bytes / 1e9).toFixed(2)} GB in ${(elapsedMs / 60000).toFixed(1)} min`,
  );
  return { elapsedMs, bytes };
}

async function main() {
  const zipOrDir = arg("input") ?? positionalInput() ?? DEFAULT_ZIP;
  const mosaicPath = arg("mosaic") ?? DEFAULT_MOSAIC;
  const outDir = arg("out") ?? DEFAULT_OUT;
  const maxzoom = Number(arg("maxzoom", "11"));
  const minzoom = Number(arg("minzoom", "0"));
  const concurrency = arg("concurrency")
    ? Number(arg("concurrency"))
    : Math.max(4, Math.min(cpus().length, 16));
  const nodata = 0;
  const rebuildMosaic = flag("rebuild-mosaic");
  const mosaicOnly = flag("mosaic-only");
  const keepExisting = flag("keep-existing");

  if (!existsSync(zipOrDir)) {
    throw new Error(
      `GMW source not found: ${zipOrDir}\nPass --input path/to/GMW-all_v4112.zip`,
    );
  }

  console.error(`Listing sources in ${zipOrDir}`);
  const sources = await listGmwSources(zipOrDir);
  console.error(`${sources.length} GMW 1° cells`);

  let mosaicElapsedMs = 0;
  let mosaicBytes = existsSync(mosaicPath) ? statSync(mosaicPath).size : 0;
  const reusedMosaic = existsSync(mosaicPath) && !rebuildMosaic;
  if (!existsSync(mosaicPath) || rebuildMosaic) {
    const mosaic = await mosaicGmw(
      sources.map((s) => s.path),
      mosaicPath,
      nodata,
    );
    mosaicElapsedMs = mosaic.elapsedMs;
    mosaicBytes = mosaic.bytes;
  } else {
    console.error(
      `Reusing mosaic ${(mosaicBytes / 1e9).toFixed(2)} GB at ${mosaicPath} (pass --rebuild-mosaic to redo)`,
    );
  }

  if (mosaicOnly) {
    console.log(JSON.stringify({ mosaicPath, mosaicBytes, mosaicElapsedMs }, null, 2));
    return;
  }

  const statsPath = join(outDir, "encode-stats.json");
  const tilejsonPath = join(outDir, "tilejson.json");
  const previousStats = keepExisting && existsSync(statsPath)
    ? JSON.parse(readFileSync(statsPath, "utf8"))
    : null;
  const previousTilejson = keepExisting && existsSync(tilejsonPath)
    ? JSON.parse(readFileSync(tilejsonPath, "utf8"))
    : null;

  if (existsSync(outDir) && !keepExisting) {
    console.error(`Removing previous tiles ${outDir}`);
    rmSync(outDir, { recursive: true, force: true });
  } else if (keepExisting) {
    console.error(`Keeping existing tiles in ${outDir} (encoding z${minzoom}–${maxzoom} only)`);
  }

  const result = await encodeTileset({
    input: mosaicPath,
    outputDir: outDir,
    layerName: "mangroves",
    units: "presence",
    minzoom,
    maxzoom,
    tilejsonMinzoom: previousTilejson?.minzoom ?? minzoom,
    startYear: 1985,
    nodata,
    offset: 0,
    scale: 1,
    resampling: "near",
    concurrency,
    tileUrl: "/tiles/gmw-global/{z}/{x}/{y}.mrt",
    coverageBboxes: sources.map((s) => s.mercator),
    onProgress: (m) => console.error(m),
  });

  const stats = {
    mosaicPath,
    mosaicBytes,
    mosaicElapsedMs: previousStats?.mosaicElapsedMs ?? mosaicElapsedMs,
    reusedMosaic,
    encodeElapsedMs: (previousStats?.encodeElapsedMs ?? 0) + result.elapsedMs,
    encodeElapsedMin: ((previousStats?.encodeElapsedMs ?? 0) + result.elapsedMs) / 60000,
    elapsedMs:
      (previousStats?.mosaicElapsedMs ?? mosaicElapsedMs) +
      (previousStats?.encodeElapsedMs ?? 0) +
      result.elapsedMs,
    sourceCount: sources.length,
    minzoom: previousStats ? Math.min(previousStats.minzoom, minzoom) : minzoom,
    maxzoom: previousStats ? Math.max(previousStats.maxzoom, maxzoom) : maxzoom,
    candidateTiles: (previousStats?.candidateTiles ?? 0) + result.candidateTiles,
    writtenTiles: (previousStats?.writtenTiles ?? 0) + result.tileCount,
    skippedEmpty: (previousStats?.skippedEmpty ?? 0) + result.skippedEmpty,
    bytesOut: (previousStats?.bytesOut ?? 0) + result.bytesOut,
    lastPass: {
      minzoom,
      maxzoom,
      candidateTiles: result.candidateTiles,
      writtenTiles: result.tileCount,
      skippedEmpty: result.skippedEmpty,
      bytesOut: result.bytesOut,
      encodeElapsedMs: result.elapsedMs,
    },
  };
  writeFileSync(join(outDir, "encode-stats.json"), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify({ ...stats, bands: result.bandIds }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
