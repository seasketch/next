import { mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { encodeTileset } from "../src/tiler";
import { writeEnviBsq } from "../src/envi";
import { gdalBuildVrt, gdalTranslate, runGdal } from "../src/gdal";

const ROOT = join(__dirname, "..");
const GEN = join(ROOT, "fixtures", "generated");
const GMW_DIR = join(ROOT, "fixtures", "gmw");
const TILES = join(ROOT, "demos", "tiles");
const ZIP = join(homedir(), "Downloads", "GMW-all_v4112.zip");

function log(message: string) {
  console.error(message);
}

function growingBlob(samples: number, lines: number, bands: number): Buffer {
  const n = samples * lines;
  const buf = Buffer.alloc(n * bands);
  const cx = samples / 2;
  const cy = lines / 2;
  for (let b = 0; b < bands; b++) {
    const radius = 8 + b * 5;
    const r2 = radius * radius;
    for (let y = 0; y < lines; y++) {
      for (let x = 0; x < samples; x++) {
        const dx = x - cx;
        const dy = y - cy;
        buf[b * n + y * samples + x] = dx * dx + dy * dy <= r2 ? 1 : 0;
      }
    }
  }
  return buf;
}

function sstCube(samples: number, lines: number, bands: number): Buffer {
  const n = samples * lines;
  const buf = Buffer.alloc(n * bands * 4);
  const view = new DataView(buf.buffer);
  let o = 0;
  for (let b = 0; b < bands; b++) {
    const blobLon = -140 + b * 10;
    const blobLat = 5 * Math.sin((b / bands) * Math.PI * 2);
    for (let y = 0; y < lines; y++) {
      const lat = 90 - (y + 0.5) * (180 / lines);
      for (let x = 0; x < samples; x++) {
        const lon = -180 + (x + 0.5) * (360 / samples);
        const dlon = lon - blobLon;
        const dlat = lat - blobLat;
        const blob = 7 * Math.exp(-(dlon * dlon + dlat * dlat) / 400);
        const sst = 28 - Math.abs(lat) / 5 + blob;
        view.setFloat32(o, sst, true);
        o += 4;
      }
    }
  }
  return buf;
}

async function writeRaster(options: {
  name: string;
  samples: number;
  lines: number;
  west: number;
  north: number;
  xRes: number;
  yRes: number;
  bandNames: string[];
  dataType: 1 | 4;
  data: Buffer;
  nodata: number;
  alsoNetCdf?: boolean;
}): Promise<{ tif: string; nc?: string }> {
  mkdirSync(GEN, { recursive: true });
  const envi = join(GEN, options.name);
  writeEnviBsq({
    dataPath: envi,
    samples: options.samples,
    lines: options.lines,
    dataType: options.dataType,
    west: options.west,
    north: options.north,
    xRes: options.xRes,
    yRes: options.yRes,
    bandNames: options.bandNames,
    data: options.data,
    nodata: options.nodata,
  });
  const tif = join(GEN, `${options.name}.tif`);
  await gdalTranslate(envi, tif, [
    "-of",
    "GTiff",
    "-co",
    "COMPRESS=DEFLATE",
    "-co",
    "TILED=YES",
    "-a_nodata",
    String(options.nodata),
    "-a_srs",
    "EPSG:4326",
  ]);
  const out: { tif: string; nc?: string } = { tif };
  if (options.alsoNetCdf) {
    const nc = join(GEN, `${options.name}.nc`);
    await gdalTranslate(tif, nc, ["-of", "netCDF", "-a_nodata", String(options.nodata)]);
    out.nc = nc;
  }
  return out;
}

async function unzipGmw(files: string[]): Promise<string[]> {
  if (!existsSync(ZIP)) {
    throw new Error(`GMW zip not found at ${ZIP}`);
  }
  mkdirSync(GMW_DIR, { recursive: true });
  const extracted: string[] = [];
  for (const file of files) {
    const dest = join(GMW_DIR, file);
    if (existsSync(dest)) {
      extracted.push(dest);
      continue;
    }
    try {
      log(`Extracting ${file}`);
      await runGdal("unzip", ["-o", "-j", ZIP, file, "-d", GMW_DIR], `unzip ${file} failed`);
      if (existsSync(dest)) extracted.push(dest);
    } catch (err) {
      log(`Skipping ${file}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return extracted;
}

async function encodeNamed(
  name: string,
  input: string,
  extra: Omit<
    Parameters<typeof encodeTileset>[0],
    "input" | "outputDir" | "tileUrl" | "onProgress"
  >,
) {
  const outputDir = join(TILES, name);
  if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  log(`\n=== Encoding ${name} ===`);
  return encodeTileset({
    input,
    outputDir,
    tileUrl: `/tiles/${name}/{z}/{x}/{y}.mrt`,
    onProgress: log,
    ...extra,
  });
}

async function main() {
  const skipGmw = process.argv.includes("--skip-gmw");

  log("Building synthetic categorical raster (growing mangrove-like blob)…");
  const catYears = Array.from({ length: 12 }, (_, i) => String(2010 + i));
  const cat = await writeRaster({
    name: "categories",
    samples: 128,
    lines: 128,
    west: -81.6,
    north: 25.9,
    xRes: 0.005,
    yRes: 0.005,
    bandNames: catYears,
    dataType: 1,
    data: growingBlob(128, 128, 12),
    nodata: 0,
  });

  log("Building synthetic SST cube and NetCDF…");
  const months = Array.from({ length: 24 }, (_, i) => {
    const year = 2024 + Math.floor(i / 12);
    const month = (i % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
  const sst = await writeRaster({
    name: "sst",
    samples: 360,
    lines: 180,
    west: -180,
    north: 90,
    xRes: 1,
    yRes: 1,
    bandNames: months,
    dataType: 4,
    data: sstCube(360, 180, 24),
    nodata: -9999,
    alsoNetCdf: true,
  });

  await encodeNamed("categories-all", cat.tif, {
    layerName: "cover",
    startYear: 2010,
    tileSize: 256,
    buffer: 1,
    maxzoom: 8,
    resampling: "near",
    nodata: 0,
    bandsPerBlock: "all",
  });

  await encodeNamed("categories-split", cat.tif, {
    layerName: "cover",
    startYear: 2010,
    tileSize: 256,
    buffer: 1,
    maxzoom: 8,
    resampling: "near",
    nodata: 0,
    bandsPerBlock: 1,
  });

  await encodeNamed("sst", sst.nc ?? sst.tif, {
    layerName: "sst",
    units: "°C",
    bandIds: months,
    tileSize: 256,
    buffer: 1,
    maxzoom: 3,
    resampling: "bilinear",
    nodata: -9999,
    offset: 0,
    scale: 0.1,
    bandsPerBlock: "all",
  });

  if (skipGmw) {
    log("Skipping GMW (--skip-gmw)");
    return;
  }

  const gmwTiles = [
    "GMW_N25W081_v4112_mng_ext.tif",
    "GMW_N26W081_v4112_mng_ext.tif",
    "GMW_N22E088_v4112_mng_ext.tif",
    "GMW_N22E089_v4112_mng_ext.tif",
    "GMW_S08E116_v4112_mng_ext.tif",
  ];
  const extracted = await unzipGmw(gmwTiles);
  const floridaSrc = extracted.filter((p) => /N2[56]W081/.test(p));
  const sundarbansSrc = extracted.filter((p) => /N22E08[89]/.test(p));
  const borneoSrc = extracted.find((p) => /S08E116/.test(p));

  const gmwCommon = {
    layerName: "mangroves",
    startYear: 1985,
    tileSize: 256 as const,
    buffer: 1,
    maxzoom: 11,
    resampling: "near" as const,
    nodata: 0,
    bandsPerBlock: "all" as const,
    units: "presence",
    offset: 0,
    scale: 1,
  };

  if (floridaSrc.length) {
    const floridaVrt = join(GMW_DIR, "florida.vrt");
    await gdalBuildVrt(floridaVrt, floridaSrc);
    await encodeNamed("gmw-florida", floridaVrt, gmwCommon);
  } else {
    log("No Florida GMW tiles extracted");
  }

  if (sundarbansSrc.length) {
    const sundarbansVrt = join(GMW_DIR, "sundarbans.vrt");
    await gdalBuildVrt(sundarbansVrt, sundarbansSrc);
    await encodeNamed("gmw-sundarbans", sundarbansVrt, gmwCommon);
  } else {
    log("No Sundarbans GMW tiles extracted");
  }

  if (borneoSrc) {
    await encodeNamed("gmw-borneo", borneoSrc, gmwCommon);
  }

  log("\nFixtures ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
