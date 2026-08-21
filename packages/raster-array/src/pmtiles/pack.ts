import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import type { RasterArrayTileJson } from "../tilejson";
import {
  writePmtilesArchive,
  writePmtilesArchiveToFile,
  type WrittenPmtiles,
} from "./write";

export type PackMrtPmtilesOptions = {
  /** Directory of `{z}/{x}/{y}.mrt` plus optional `tilejson.json`. */
  tilesDir: string;
  outputPath: string;
  metadata?: Record<string, unknown>;
};

export type PackMrtPmtilesResult = Omit<WrittenPmtiles, "bytes"> & {
  outputPath: string;
};

export type MrtTilePath = {
  z: number;
  x: number;
  y: number;
  path: string;
};

export function collectMrtTilePaths(tilesDir: string): MrtTilePath[] {
  const tiles: MrtTilePath[] = [];
  if (!existsSync(tilesDir)) {
    throw new Error(`Tiles directory not found: ${tilesDir}`);
  }
  for (const zName of readdirSync(tilesDir)) {
    if (!/^\d+$/.test(zName)) continue;
    const zDir = join(tilesDir, zName);
    if (!statSync(zDir).isDirectory()) continue;
    for (const xName of readdirSync(zDir)) {
      if (!/^\d+$/.test(xName)) continue;
      const xDir = join(zDir, xName);
      if (!statSync(xDir).isDirectory()) continue;
      for (const file of readdirSync(xDir)) {
        if (!file.endsWith(".mrt")) continue;
        const y = Number(file.slice(0, -4));
        if (!Number.isInteger(y)) continue;
        tiles.push({
          z: Number(zName),
          x: Number(xName),
          y,
          path: join(xDir, file),
        });
      }
    }
  }
  return tiles;
}

/** @deprecated Prefer collectMrtTilePaths + packMrtPmtiles for large trees. */
export function collectMrtTiles(
  tilesDir: string,
): Array<{ z: number; x: number; y: number; data: Buffer }> {
  return collectMrtTilePaths(tilesDir).map((tile) => ({
    z: tile.z,
    x: tile.x,
    y: tile.y,
    data: readFileSync(tile.path),
  }));
}

export function readTileJsonMetadata(
  tilesDir: string,
): RasterArrayTileJson | undefined {
  const path = join(tilesDir, "tilejson.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as RasterArrayTileJson;
}

/**
 * Pack a slippy-map MRT tree into one PMTiles v3 archive.
 * Streams tile bytes from disk so a globe-sized tree does not need 2× RAM.
 */
export async function packMrtPmtiles(
  options: PackMrtPmtilesOptions,
): Promise<PackMrtPmtilesResult> {
  const tiles = collectMrtTilePaths(options.tilesDir);
  if (tiles.length === 0) {
    throw new Error(`No .mrt tiles in ${options.tilesDir}`);
  }
  const tilejson = options.metadata ?? readTileJsonMetadata(options.tilesDir);
  if (!tilejson) {
    throw new Error(
      `No TileJSON metadata: pass metadata or put tilejson.json in ${options.tilesDir}`,
    );
  }
  const metadata = {
    ...tilejson,
    format: "mrt",
    tiles: ["{z}/{x}/{y}.mrt"],
  };
  mkdirSync(dirname(options.outputPath), { recursive: true });

  // Small fixtures stay on the in-memory path (tests compare bytes).
  const totalBytes = tiles.reduce((n, t) => n + statSync(t.path).size, 0);
  if (totalBytes < 32 * 1024 * 1024) {
    const written = writePmtilesArchive({
      tiles: tiles.map((t) => ({
        z: t.z,
        x: t.x,
        y: t.y,
        data: readFileSync(t.path),
      })),
      metadata,
      minzoom: numberField(tilejson, "minzoom"),
      maxzoom: numberField(tilejson, "maxzoom"),
      bounds: boundsField(tilejson),
      center: centerField(tilejson),
    });
    writeFileSync(options.outputPath, written.bytes);
    return {
      outputPath: options.outputPath,
      tileCount: written.tileCount,
      addressedTiles: written.addressedTiles,
      tileEntries: written.tileEntries,
      tileContents: written.tileContents,
      bytesOut: written.bytesOut,
    };
  }

  return writePmtilesArchiveToFile({
    tiles,
    outputPath: options.outputPath,
    metadata,
    minzoom: numberField(tilejson, "minzoom"),
    maxzoom: numberField(tilejson, "maxzoom"),
    bounds: boundsField(tilejson),
    center: centerField(tilejson),
  });
}

function numberField(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = obj[key];
  return typeof value === "number" ? value : undefined;
}

function boundsField(
  obj: Record<string, unknown>,
): [number, number, number, number] | undefined {
  const value = obj.bounds;
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  if (!value.every((n) => typeof n === "number")) return undefined;
  return value as [number, number, number, number];
}

function centerField(
  obj: Record<string, unknown>,
): [number, number, number] | undefined {
  const value = obj.center;
  if (!Array.isArray(value) || value.length < 2) return undefined;
  if (!value.every((n) => typeof n === "number")) return undefined;
  return [
    value[0] as number,
    value[1] as number,
    (value[2] as number | undefined) ?? 0,
  ];
}
