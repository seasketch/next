import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { gdalTranslate } from "../../raster-array/src/gdal";
import { readEnviBsqBytes } from "../../raster-array/src/envi";
import type { GmwSource } from "../../raster-array/src/gmw";
import {
  bboxLonLatToMercator,
  tilesForBbox,
} from "../../raster-array/src/webmercator";
import { mapPool } from "./pool";

export type OccupiedTile = { z: number; x: number; y: number };

export type OccupancyIndex = {
  minzoom: number;
  maxzoom: number;
  tiles: OccupiedTile[];
  byZoom: Record<string, number>;
  cellCount: number;
  elapsedMs: number;
};

export function tileKey(tile: OccupiedTile): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function addParentTiles(
  tiles: Iterable<OccupiedTile>,
  minzoom: number,
): OccupiedTile[] {
  const seen = new Set<string>();
  const out: OccupiedTile[] = [];
  const add = (tile: OccupiedTile) => {
    const key = tileKey(tile);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(tile);
  };
  for (const tile of tiles) {
    let { z, x, y } = tile;
    while (z >= minzoom) {
      add({ z, x, y });
      if (z === minzoom) break;
      z -= 1;
      x >>= 1;
      y >>= 1;
    }
  }
  return out.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);
}

/**
 * Map occupied coarse pixels of a geographic cell onto XYZ tiles at `z`.
 * Pixel (col, row) is north-up, covering an equal lon/lat slice of the cell.
 */
export function occupiedPixelsToTiles(
  wgs84: [number, number, number, number],
  width: number,
  height: number,
  occupied: ArrayLike<boolean | number>,
  z: number,
): OccupiedTile[] {
  const [west, south, east, north] = wgs84;
  const xRes = (east - west) / width;
  const yRes = (north - south) / height;
  const seen = new Set<string>();
  const tiles: OccupiedTile[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!occupied[row * width + col]) continue;
      const pixelWest = west + col * xRes;
      const pixelEast = pixelWest + xRes;
      const pixelNorth = north - row * yRes;
      const pixelSouth = pixelNorth - yRes;
      for (const tile of tilesForBbox(
        bboxLonLatToMercator(pixelWest, pixelSouth, pixelEast, pixelNorth),
        z,
      )) {
        const key = `${tile.x}/${tile.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tiles.push(tile);
      }
    }
  }
  return tiles;
}

export function orBandsOccupied(
  bands: ArrayLike<number>[],
  nodata = 0,
): Uint8Array {
  const n = bands[0]?.length ?? 0;
  const out = new Uint8Array(n);
  for (const band of bands) {
    for (let i = 0; i < n; i++) {
      const v = band[i]!;
      if (v !== nodata && v !== 0) out[i] = 1;
    }
  }
  return out;
}

export async function occupancyForCell(
  source: GmwSource,
  workDir: string,
  size = 64,
): Promise<OccupiedTile[]> {
  mkdirSync(workDir, { recursive: true });
  const dest = join(workDir, source.name.replace(/\.tif$/i, ""));
  try {
    await gdalTranslate(source.path, dest, [
      "-q",
      "-of",
      "ENVI",
      "-r",
      "max",
      "-outsize",
      String(size),
      String(size),
    ]);
    const { header, bands } = readEnviBsqBytes(dest);
    const occupied = orBandsOccupied(bands, 0);
    return occupiedPixelsToTiles(
      source.wgs84,
      header.samples,
      header.lines,
      occupied,
      12,
    );
  } finally {
    for (const p of [dest, dest + ".hdr", dest + ".aux.xml"]) {
      try {
        rmSync(p, { force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

export async function buildOccupancy(
  sources: GmwSource[],
  options: {
    minzoom?: number;
    maxzoom?: number;
    concurrency?: number;
    workDir?: string;
    size?: number;
    onProgress?: (message: string) => void;
  } = {},
): Promise<OccupancyIndex> {
  const minzoom = options.minzoom ?? 0;
  const maxzoom = options.maxzoom ?? 12;
  const concurrency = options.concurrency ?? 16;
  const workDir = options.workDir ?? join(tmpdir(), "gmw-occupancy");
  const size = options.size ?? 64;
  const log = options.onProgress ?? (() => undefined);
  const started = Date.now();
  const z12: OccupiedTile[] = [];
  const seen = new Set<string>();
  let done = 0;
  let lastLog = 0;

  await mapPool(sources, concurrency, async (source) => {
    const tiles = await occupancyForCell(source, workDir, size);
    for (const tile of tiles) {
      const key = `${tile.x}/${tile.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      z12.push(tile);
    }
    done++;
    const now = Date.now();
    if (now - lastLog > 3000 || done === sources.length) {
      lastLog = now;
      log(`  occupancy ${done}/${sources.length} cells  z12 tiles ${z12.length}`);
    }
  });

  const tiles = addParentTiles(
    z12.filter((t) => t.z <= maxzoom),
    minzoom,
  ).filter((t) => t.z <= maxzoom);
  const byZoom: Record<string, number> = {};
  for (const tile of tiles) {
    byZoom[String(tile.z)] = (byZoom[String(tile.z)] ?? 0) + 1;
  }
  const elapsedMs = Date.now() - started;
  log(
    `Occupancy ${tiles.length} tiles z${minzoom}–${maxzoom} (z12 ${z12.length}) in ${(elapsedMs / 1000).toFixed(1)}s`,
  );
  return {
    minzoom,
    maxzoom,
    tiles,
    byZoom,
    cellCount: sources.length,
    elapsedMs,
  };
}

export function saveOccupancy(path: string, index: OccupancyIndex): void {
  writeFileSync(path, JSON.stringify(index));
}

export function loadOccupancy(path: string): OccupancyIndex {
  if (!existsSync(path)) {
    throw new Error(`Occupancy file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as OccupancyIndex;
}
