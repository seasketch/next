import { env } from "cloudflare:workers";
import { TileType } from "pmtiles";
import { describe, expect, it } from "vitest";
import { writePmtilesArchive } from "../../raster-array/src/pmtiles/write";
import { handleTilesBackendRequest, missingTileStatus } from "../src/tilesBackend";

describe("missingTileStatus", () => {
  it("uses 404 for raster archives and image requests", () => {
    expect(missingTileStatus(TileType.Png, "png")).toBe(404);
    expect(missingTileStatus(TileType.Jpeg, "pbf")).toBe(404);
    expect(missingTileStatus(TileType.Webp, "webp")).toBe(404);
    expect(missingTileStatus(TileType.Avif, "avif")).toBe(404);
    expect(missingTileStatus(TileType.Unknown, "png")).toBe(404);
    expect(missingTileStatus(TileType.Unknown, "mrt")).toBe(404);
    expect(missingTileStatus(TileType.Mvt, "png")).toBe(404);
  });

  it("keeps 204 for vector misses", () => {
    expect(missingTileStatus(TileType.Mvt, "mvt")).toBe(204);
    expect(missingTileStatus(TileType.Mvt, "pbf")).toBe(204);
    expect(missingTileStatus(TileType.Unknown, "pbf")).toBe(204);
    expect(missingTileStatus(TileType.Mlt, "mlt")).toBe(204);
  });
});

function holeyArchive(tileType: number): Uint8Array {
  const written = writePmtilesArchive({
    tiles: [{ z: 0, x: 0, y: 0, data: Buffer.from("present") }],
    metadata: {},
    minzoom: 0,
    maxzoom: 1,
  });
  const bytes = new Uint8Array(written.bytes);
  bytes[99] = tileType;
  return bytes;
}

describe("raster tile misses on TilesBackend", () => {
  it("returns 404 for a png archive miss and 204 for a vector miss", async () => {
    const pngName = "projects/raster-miss/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const mvtName = "projects/vector-miss/public/aaaaaaaa-bbbb-cccc-dddd-ffffffffffff";
    await env.TILES_BUCKET.put(`${pngName}.pmtiles`, holeyArchive(TileType.Png));
    await env.TILES_BUCKET.put(`${mvtName}.pmtiles`, holeyArchive(TileType.Mvt));

    const present = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${pngName}/0/0/0.png`),
      env,
    );
    expect(present.status).toBe(200);

    const rasterMiss = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${pngName}/1/0/0.png`),
      env,
    );
    expect(rasterMiss.status).toBe(404);
    expect(rasterMiss.headers.get("Cache-Control")).toMatch(/immutable/);

    const vectorMiss = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${mvtName}/1/0/0.mvt`),
      env,
    );
    expect(vectorMiss.status).toBe(204);
    expect(vectorMiss.headers.get("Cache-Control")).toMatch(/immutable/);
  });
});
