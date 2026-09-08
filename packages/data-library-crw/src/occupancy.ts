import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { collectMrtTilePaths } from "../../raster-array/src/pmtiles/pack";

export type OccupancyTile = { z: number; x: number; y: number };

export function occupancyPath(tilesDir: string): string {
  return join(tilesDir, "occupancy.json");
}

function isTile(value: unknown): value is OccupancyTile {
  if (value == null || typeof value !== "object") return false;
  const tile = value as Record<string, unknown>;
  return (
    typeof tile.z === "number" &&
    typeof tile.x === "number" &&
    typeof tile.y === "number"
  );
}

export function loadOccupancy(tilesDir: string): OccupancyTile[] | null {
  const jsonPath = occupancyPath(tilesDir);
  if (existsSync(jsonPath)) {
    const raw: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
    if (Array.isArray(raw) && raw.length > 0 && raw.every(isTile)) {
      return raw;
    }
  }
  if (!existsSync(tilesDir)) return null;
  const tiles = collectMrtTilePaths(tilesDir).map(({ z, x, y }) => ({ z, x, y }));
  return tiles.length ? tiles : null;
}

export function saveOccupancy(tilesDir: string, tiles: OccupancyTile[]): void {
  mkdirSync(tilesDir, { recursive: true });
  writeFileSync(occupancyPath(tilesDir), JSON.stringify(tiles));
}

export function clearMrtTiles(tilesDir: string): void {
  if (!existsSync(tilesDir)) return;
  for (const tile of collectMrtTilePaths(tilesDir)) {
    rmSync(tile.path);
  }
}
