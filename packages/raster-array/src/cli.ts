#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { encodeTileset } from "./tiler";
import { decodeMrtTile, getMrtHeaderLength } from "./mrt/decode";

function usage(): never {
  console.log(`@seasketch/raster-array — GeoTIFF/NetCDF → Mapbox Raster Tiles (MRT)

Usage:
  raster-array encode <input.tif|input.nc> <outdir> [options]
  raster-array inspect <tile.mrt>

Encode options:
  --layer <name>           Source-layer name (default: data)
  --units <str>            Units annotation for TileJSON
  --tile-size <n>          Interior tile size, power of two (default: 256)
  --buffer <n>             Edge buffer pixels (default: 1)
  --minzoom <n>            (default: 0)
  --maxzoom <n>            (default: native resolution, capped at 12)
  --start-year <yyyy>      Name bands as consecutive years
  --band-ids <a,b,c>       Explicit band ids (comma-separated)
  --offset <n> --scale <n> MRT encoding: value = offset + scale * code
  --bands-per-block <n|all>
                           Range-addressable chunks inside each .mrt (default: all)
  --resampling <near|bilinear|cubic|mode>
  --nodata <n>
  --subdataset <name|index>
  --tile-url <template>    TileJSON tiles URL (default: {z}/{x}/{y}.mrt)
  --keep-empty             Write all-nodata tiles too
  --concurrency <n>        Parallel gdal jobs (default: 4)

Full-globe GMW: mosaic the zip to one GeoTIFF, then encode it:
  npm run gmw:global
`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const [command, ...rest] = argv;
  if (!command) usage();
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "-h" || a === "--help") usage();
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { command, positional, flags };
}

function num(flags: Record<string, string | boolean>, key: string): number | undefined {
  const v = flags[key];
  if (v === undefined || typeof v === "boolean") return undefined;
  return Number(v);
}

async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  if (command === "inspect") {
    const file = positional[0];
    if (!file) usage();
    const buf = readFileSync(resolve(file));
    const headerLength = getMrtHeaderLength(buf);
    const tile = decodeMrtTile(buf);
    const summary = {
      file,
      bytes: buf.length,
      headerLength,
      zxy: `${tile.z}/${tile.x}/${tile.y}`,
      layers: Object.values(tile.layers).map((layer) => ({
        name: layer.name,
        units: layer.units,
        tileSize: layer.tileSize,
        buffer: layer.buffer,
        pixelFormat: layer.pixelFormat,
        bands: Object.keys(layer.bandData),
        blocks: layer.dataIndex.map((b) => ({
          bands: b.bands,
          bytes: b.lastByte - b.firstByte + 1,
          offset: b.offset,
          scale: b.scale,
          codec: b.codec,
        })),
      })),
    };
    const json = JSON.stringify(summary, null, 2);
    console.log(json);
    if (flags["out"] && typeof flags["out"] === "string") {
      writeFileSync(flags["out"], json);
    }
    return;
  }

  if (command === "encode") {
    const input = positional[0];
    const outputDir = positional[1];
    if (!input || !outputDir) usage();
    const bandIds =
      typeof flags["band-ids"] === "string"
        ? flags["band-ids"].split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const bandsPerBlockFlag = flags["bands-per-block"];
    const bandsPerBlock =
      bandsPerBlockFlag === "all" || bandsPerBlockFlag === undefined
        ? "all"
        : Number(bandsPerBlockFlag);

    const result = await encodeTileset({
      input: resolve(input),
      outputDir: resolve(outputDir),
      layerName: typeof flags.layer === "string" ? flags.layer : undefined,
      units: typeof flags.units === "string" ? flags.units : undefined,
      tileSize: num(flags, "tile-size"),
      buffer: num(flags, "buffer"),
      minzoom: num(flags, "minzoom"),
      maxzoom: num(flags, "maxzoom"),
      startYear: num(flags, "start-year"),
      bandIds,
      offset: num(flags, "offset"),
      scale: num(flags, "scale"),
      bandsPerBlock,
      resampling:
        typeof flags.resampling === "string"
          ? (flags.resampling as "near" | "bilinear" | "cubic" | "mode")
          : undefined,
      nodata: num(flags, "nodata"),
      tileUrl: typeof flags["tile-url"] === "string" ? flags["tile-url"] : undefined,
      skipEmpty: flags["keep-empty"] ? false : true,
      subdataset:
        flags.subdataset === undefined
          ? undefined
          : Number.isFinite(Number(flags.subdataset))
            ? Number(flags.subdataset)
            : String(flags.subdataset),
      concurrency: num(flags, "concurrency"),
      onProgress: (m) => console.error(m),
    });
    console.log(
      JSON.stringify(
        {
          tiles: result.tileCount,
          skippedEmpty: result.skippedEmpty,
          bands: result.bandIds,
          offset: result.offset,
          scale: result.scale,
          range: result.range,
          tilejson: `${resolve(outputDir)}/tilejson.json`,
        },
        null,
        2,
      ),
    );
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
