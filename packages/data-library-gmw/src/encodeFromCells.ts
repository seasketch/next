import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readEnviByteBands, readEnviBands } from "../../raster-array/src/envi";
import { EncodePool } from "./encodePool";
import { gdalTranslate, runGdal } from "../../raster-array/src/gdal";
import { buildTileJson } from "../../raster-array/src/tilejson";
import {
  type GmwSource,
  unionWgs84,
} from "../../raster-array/src/gmw";
import {
  type BBox,
  bboxesIntersect,
  bufferedTileBounds3857,
  mercatorToLonLat,
} from "../../raster-array/src/webmercator";
import { bandIds } from "./runbook";
import { mapPool } from "./pool";
import type { OccupiedTile } from "./occupancy";

export type EncodeFromCellsResult = {
  tileCount: number;
  skippedEmpty: number;
  skippedExisting: number;
  candidateTiles: number;
  bytesOut: number;
  elapsedMs: number;
  bandIds: string[];
};

export function indexCells(sources: GmwSource[]): Map<string, GmwSource> {
  const index = new Map<string, GmwSource>();
  for (const source of sources) {
    const west = Math.round(source.wgs84[0]);
    const south = Math.round(source.wgs84[1]);
    index.set(`${west},${south}`, source);
  }
  return index;
}

export function sourcesForTile(
  tile: OccupiedTile,
  index: Map<string, GmwSource>,
  tileSize = 256,
  buffer = 1,
): GmwSource[] {
  const window = bufferedTileBounds3857(tile.z, tile.x, tile.y, tileSize, buffer);
  const { west, south, east, north } = lonLatEnvelope(window);
  const found = new Map<string, GmwSource>();
  const addRange = (lon0: number, lon1: number) => {
    const minLon = Math.floor(lon0);
    const maxLon = Math.floor(lon1 - 1e-9);
    const minLat = Math.floor(south);
    const maxLat = Math.floor(north - 1e-9);
    for (let lon = minLon; lon <= maxLon; lon++) {
      for (let lat = minLat; lat <= maxLat; lat++) {
        const source = index.get(`${lon},${lat}`);
        if (source) found.set(source.name, source);
      }
    }
  };
  if (west <= east) {
    addRange(west, east);
  } else {
    addRange(west, 180);
    addRange(-180, east);
  }
  if (found.size === 0) {
    // Fallback: scan by mercator intersection (antimeridian / pole tiles).
    for (const source of index.values()) {
      if (bboxesIntersect(window, source.mercator)) {
        found.set(source.name, source);
      }
    }
  }
  return [...found.values()];
}

function lonLatEnvelope(bbox: BBox): {
  west: number;
  south: number;
  east: number;
  north: number;
} {
  const corners = [
    mercatorToLonLat(bbox.minX, bbox.minY),
    mercatorToLonLat(bbox.minX, bbox.maxY),
    mercatorToLonLat(bbox.maxX, bbox.minY),
    mercatorToLonLat(bbox.maxX, bbox.maxY),
  ];
  const lons = corners.map((c) => c.lon);
  const lats = corners.map((c) => c.lat);
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };
}

export async function encodeFromCells(options: {
  sources: GmwSource[];
  tiles: OccupiedTile[];
  outputDir: string;
  minzoom?: number;
  maxzoom?: number;
  tileSize?: number;
  buffer?: number;
  nodata?: number;
  concurrency?: number;
  keepExisting?: boolean;
  /** Sources are already EPSG:3857 (after warpCellsToMercator). */
  mercatorSources?: boolean;
  gzipLevel?: number;
  startYear?: number;
  onProgress?: (message: string) => void;
}): Promise<EncodeFromCellsResult> {
  const tileSize = options.tileSize ?? 256;
  const buffer = options.buffer ?? 1;
  const nodata = options.nodata ?? 0;
  const concurrency = options.concurrency ?? 16;
  const keepExisting = options.keepExisting ?? false;
  const gzipLevel = options.gzipLevel ?? 6;
  const years = bandIds(options.startYear ?? 1985);
  const log = options.onProgress ?? (() => undefined);
  const started = Date.now();
  const index = indexCells(options.sources);
  const jobs = options.tiles.filter((t) => {
    if (options.minzoom != null && t.z < options.minzoom) return false;
    if (options.maxzoom != null && t.z > options.maxzoom) return false;
    return true;
  });

  mkdirSync(options.outputDir, { recursive: true });
  const work = join(tmpdir(), `gmw-encode-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const pool = new EncodePool(Math.min(concurrency, Math.max(2, jobs.length)));

  let tileCount = 0;
  let skippedEmpty = 0;
  let skippedExisting = 0;
  let bytesOut = 0;
  let done = 0;
  let lastLog = Date.now();
  const tick = () => {
    done++;
    const now = Date.now();
    if (now - lastLog > 4000 || done === jobs.length) {
      lastLog = now;
      const elapsed = (now - started) / 1000;
      const rate = done / Math.max(elapsed, 0.001);
      const remaining = (jobs.length - done) / Math.max(rate, 0.01);
      log(
        `  tiles ${done}/${jobs.length}  wrote ${tileCount}  skip ${skippedEmpty}  exist ${skippedExisting}  ${rate.toFixed(1)}/s  ETA ${fmtSec(remaining)}`,
      );
    }
  };

  try {
    await mapPool(jobs, concurrency, async (tile, i) => {
      const dest = join(
        options.outputDir,
        String(tile.z),
        String(tile.x),
        `${tile.y}.mrt`,
      );
      if (keepExisting && existsSync(dest)) {
        skippedExisting++;
        tick();
        return;
      }

      const cells = sourcesForTile(tile, index, tileSize, buffer);
      if (cells.length === 0) {
        skippedEmpty++;
        tick();
        return;
      }

      const window = bufferedTileBounds3857(
        tile.z,
        tile.x,
        tile.y,
        tileSize,
        buffer,
      );
      const outDim = tileSize + 2 * buffer;
      const enviPath = join(work, `t-${tile.z}-${tile.x}-${tile.y}-${i}`);
      try {
        await cutTileWindow({
          cells,
          enviPath,
          window,
          outDim,
          nodata,
          alreadyMercator: options.mercatorSources ?? false,
        });
      } catch {
        skippedEmpty++;
        rmEnvi(enviPath);
        try {
          rmSync(`${enviPath}.optfile`, { force: true });
        } catch {
          /* ignore */
        }
        tick();
        return;
      }

      const physical = readTileBands(enviPath);
      rmEnvi(enviPath);
      if (physical.length !== years.length) {
        throw new Error(
          `Expected ${years.length} bands in ${tile.z}/${tile.x}/${tile.y}, got ${physical.length}`,
        );
      }

      const mrt = await pool.encode({
        z: tile.z,
        x: tile.x,
        y: tile.y,
        tileSize,
        buffer,
        nodata,
        gzipLevel,
        years,
        bands: physical.map((band) =>
          Buffer.isBuffer(band) ? band : Buffer.from(band as Uint8Array),
        ),
      });
      if (!mrt) {
        skippedEmpty++;
        tick();
        return;
      }
      mkdirSync(join(options.outputDir, String(tile.z), String(tile.x)), {
        recursive: true,
      });
      writeFileSync(dest, mrt);
      bytesOut += mrt.length;
      tileCount++;
      tick();
    });
  } finally {
    await pool.close();
    rmSync(work, { recursive: true, force: true });
  }

  const bounds = unionWgs84(options.sources);
  const minzoom = options.minzoom ?? Math.min(...jobs.map((t) => t.z));
  const maxzoom = options.maxzoom ?? Math.max(...jobs.map((t) => t.z));
  const tilejson = buildTileJson({
    name: "mangroves",
    tiles: ["{z}/{x}/{y}.mrt"],
    minzoom,
    maxzoom,
    bounds,
    layers: [
      {
        id: "mangroves",
        bands: years,
        tileSize,
        buffer,
        units: "presence",
        scale: 1,
        offset: 0,
        range: [0, 1],
      },
    ],
  });
  writeFileSync(
    join(options.outputDir, "tilejson.json"),
    JSON.stringify(tilejson, null, 2),
  );

  const elapsedMs = Date.now() - started;
  log(
    `Wrote ${tileCount} tiles (${skippedEmpty} empty, ${skippedExisting} existing, ${(bytesOut / 1e6).toFixed(1)} MB) in ${fmtSec(elapsedMs / 1000)}`,
  );
  return {
    tileCount,
    skippedEmpty,
    skippedExisting,
    candidateTiles: jobs.length,
    bytesOut,
    elapsedMs,
    bandIds: years,
  };
}

async function cutTileWindow(options: {
  cells: GmwSource[];
  enviPath: string;
  window: BBox;
  outDim: number;
  nodata: number;
  alreadyMercator: boolean;
}): Promise<void> {
  const { cells, enviPath, window, outDim, nodata, alreadyMercator } = options;
  if (alreadyMercator && cells.length === 1) {
    await gdalTranslate(cells[0]!.path, enviPath, [
      "-q",
      "-of",
      "ENVI",
      "-co",
      "INTERLEAVE=BSQ",
      "-projwin",
      String(window.minX),
      String(window.maxY),
      String(window.maxX),
      String(window.minY),
      "-outsize",
      String(outDim),
      String(outDim),
      "-r",
      "near",
      "-a_nodata",
      String(nodata),
    ]);
    return;
  }
  const optPath = `${enviPath}.optfile`;
  writeFileSync(
    optPath,
    [
      "-q",
      "-overwrite",
      ...(alreadyMercator ? [] : ["-t_srs", "EPSG:3857"]),
      "-te",
      String(window.minX),
      String(window.minY),
      String(window.maxX),
      String(window.maxY),
      "-te_srs",
      "EPSG:3857",
      "-ts",
      String(outDim),
      String(outDim),
      "-r",
      "near",
      "-of",
      "ENVI",
      "-co",
      "INTERLEAVE=BSQ",
      "-srcnodata",
      String(nodata),
      "-dstnodata",
      String(nodata),
      "-wo",
      "SKIP_NOSOURCE=YES",
      "-wo",
      "NUM_THREADS=1",
      ...cells.map((c) => c.path),
      enviPath,
    ].join("\n") + "\n",
  );
  try {
    await runGdal(
      "gdalwarp",
      ["--optfile", optPath],
      `gdalwarp tile window`,
    );
  } finally {
    rmSync(optPath, { force: true });
  }
}

function readTileBands(enviPath: string): ArrayLike<number>[] {
  try {
    return readEnviByteBands(enviPath).bands;
  } catch {
    return readEnviBands(enviPath).bands;
  }
}

function rmEnvi(path: string): void {
  for (const p of [path, path + ".hdr", path + ".aux.xml"]) {
    try {
      rmSync(p, { force: true });
    } catch {
      /* ignore */
    }
  }
}

function fmtSec(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "?";
  const m = Math.floor(s / 60);
  const sec = Math.round(s - m * 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
