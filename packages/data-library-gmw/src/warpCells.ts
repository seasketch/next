import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { gdalWarp } from "../../raster-array/src/gdal";
import type { GmwSource } from "../../raster-array/src/gmw";
import { mapPool } from "./pool";

export async function warpCellsToMercator(
  sources: GmwSource[],
  destDir: string,
  options: {
    concurrency?: number;
    nodata?: number;
    keepExisting?: boolean;
    onProgress?: (message: string) => void;
  } = {},
): Promise<GmwSource[]> {
  const concurrency = options.concurrency ?? 8;
  const nodata = options.nodata ?? 0;
  const keepExisting = options.keepExisting ?? true;
  const log = options.onProgress ?? (() => undefined);
  mkdirSync(destDir, { recursive: true });
  const started = Date.now();
  let done = 0;
  let skipped = 0;
  const warped: GmwSource[] = new Array(sources.length);

  await mapPool(sources, concurrency, async (source, i) => {
    const dest = join(destDir, source.name.replace(/\.tif$/i, ".3857.tif"));
    if (keepExisting && existsSync(dest)) {
      skipped++;
    } else {
      await gdalWarp(source.path, dest, [
        "-q",
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
        "NUM_THREADS=ALL_CPUS",
        "-wo",
        "NUM_THREADS=ALL_CPUS",
        "-srcnodata",
        String(nodata),
        "-dstnodata",
        String(nodata),
      ]);
    }
    warped[i] = { ...source, path: dest };
    done++;
    if (done === sources.length || done % 25 === 0) {
      log(
        `  warp ${done}/${sources.length} cells` +
          (skipped ? ` (${skipped} reused)` : ""),
      );
    }
  });

  log(
    `Warped ${sources.length} cells to EPSG:3857 in ${((Date.now() - started) / 1000).toFixed(1)}s → ${destDir}`,
  );
  return warped;
}
