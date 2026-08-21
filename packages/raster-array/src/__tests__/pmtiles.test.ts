import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { encodeMrtTile } from "../mrt/encode";
import { decodeMrtTile } from "../mrt/decode";
import {
  deserializeDirectory,
  findTile,
  serializeDirectory,
  tileIdToZxy,
  zxyToTileId,
} from "../pmtiles/codec";
import { packMrtPmtiles } from "../pmtiles/pack";
import { openPmtiles, openPmtilesBytes } from "../pmtiles/read";
import { writePmtilesArchive } from "../pmtiles/write";
import { buildTileJson } from "../tilejson";

function tinyMrt(z: number, x: number, y: number, value: number): Buffer {
  return encodeMrtTile({
    z,
    x,
    y,
    layers: [
      {
        name: "cover",
        tileSize: 2,
        buffer: 0,
        offset: 0,
        scale: 1,
        bands: [{ id: "2000", values: Uint32Array.from([value, 0, 0, value]) }],
      },
    ],
  });
}

describe("Hilbert tile ids", () => {
  it("round-trips z/x/y used by the encoder", () => {
    const samples: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 0, 1],
      [3, 4, 5],
      [8, 72, 110],
      [12, 2048, 2047],
    ];
    for (const [z, x, y] of samples) {
      expect(tileIdToZxy(zxyToTileId(z, x, y))).toEqual([z, x, y]);
    }
  });
});

describe("directory codec", () => {
  it("round-trips entries including a leaf pointer", () => {
    const entries = [
      { tileId: 0, offset: 0, length: 10, runLength: 2 },
      { tileId: 10, offset: 10, length: 4, runLength: 0 },
    ];
    const again = deserializeDirectory(serializeDirectory(entries));
    expect(again).toEqual(entries);
    expect(findTile(again, 1)?.offset).toBe(0);
    expect(findTile(again, 10)?.runLength).toBe(0);
  });
});

describe("MRT PMTiles pack", () => {
  it("stores raw MRT bytes and serves them by z/x/y", () => {
    const a = tinyMrt(1, 0, 0, 1);
    const b = tinyMrt(1, 0, 1, 2);
    const written = writePmtilesArchive({
      tiles: [
        { z: 1, x: 0, y: 0, data: a },
        { z: 1, x: 0, y: 1, data: b },
      ],
      metadata: {
        format: "mrt",
        name: "cover",
        raster_layers: [{ id: "cover", fields: { bands: ["2000"] } }],
      },
      minzoom: 1,
      maxzoom: 1,
      bounds: [-180, -85, 180, 85],
    });

    expect(written.bytes.subarray(0, 7).toString("ascii")).toBe("PMTiles");
    expect(written.tileCount).toBe(2);
    expect(written.tileContents).toBe(2);

    const opened = openPmtilesBytes(written.bytes);
    expect(opened.metadata.format).toBe("mrt");
    expect(opened.header.tileCompression).toBe(1);
    expect(opened.header.tileType).toBe(0);
    expect(opened.getTile(1, 0, 0)?.equals(a)).toBe(true);
    expect(opened.getTile(1, 0, 1)?.equals(b)).toBe(true);
    expect(opened.getTile(1, 1, 0)).toBeNull();
    expect(decodeMrtTile(opened.getTile(1, 0, 1)!).layers.cover.bandData["2000"]![0]).toBe(2);

    const dir = mkdtempSync(join(tmpdir(), "mrt-open-"));
    const filePath = join(dir, "file-reader.mrt.pmtiles");
    writeFileSync(filePath, written.bytes);
    const fromFile = openPmtiles(filePath);
    expect(fromFile.getTile(1, 0, 0)?.equals(a)).toBe(true);
    expect(fromFile.getTile(1, 0, 1)?.equals(b)).toBe(true);
  });

  it("dedupes identical tile bodies", () => {
    const body = tinyMrt(2, 0, 0, 1);
    const written = writePmtilesArchive({
      tiles: [
        { z: 2, x: 0, y: 0, data: body },
        { z: 2, x: 0, y: 1, data: Buffer.from(body) },
      ],
      metadata: { format: "mrt" },
    });
    expect(written.tileContents).toBe(1);
    const opened = openPmtilesBytes(written.bytes);
    expect(opened.getTile(2, 0, 1)?.equals(body)).toBe(true);
  });

  it("splits into leaf directories when the root is forced small", () => {
    const tiles = [];
    for (let i = 0; i < 80; i++) {
      tiles.push({
        z: 7,
        x: i,
        y: 0,
        data: tinyMrt(7, i, 0, i + 1),
      });
    }
    const written = writePmtilesArchive({
      tiles,
      metadata: { format: "mrt" },
      targetRootBytes: 40,
    });
    const opened = openPmtilesBytes(written.bytes);
    expect(opened.header.leafDirectoryLength).toBeGreaterThan(0);
    expect(opened.getTile(7, 0, 0)?.equals(tiles[0]!.data)).toBe(true);
    expect(opened.getTile(7, 79, 0)?.equals(tiles[79]!.data)).toBe(true);
  });

  it("packs a {z}/{x}/{y}.mrt tree plus tilejson.json", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrt-pack-"));
    const tile = tinyMrt(3, 4, 5, 7);
    mkdirSync(join(dir, "3", "4"), { recursive: true });
    writeFileSync(join(dir, "3", "4", "5.mrt"), tile);
    writeFileSync(
      join(dir, "tilejson.json"),
      JSON.stringify(
        buildTileJson({
          name: "cover",
          tiles: ["{z}/{x}/{y}.mrt"],
          minzoom: 3,
          maxzoom: 3,
          bounds: [-81, 25, -80, 26],
          layers: [
            {
              id: "cover",
              bands: ["2000"],
              tileSize: 2,
              buffer: 0,
              scale: 1,
              offset: 0,
              range: [0, 1],
            },
          ],
        }),
      ),
    );
    const out = join(dir, "cover.mrt.pmtiles");
    const packed = await packMrtPmtiles({ tilesDir: dir, outputPath: out });
    expect(packed.tileCount).toBe(1);
    const opened = openPmtilesBytes(readFileSync(out));
    expect(opened.metadata.format).toBe("mrt");
    expect(opened.getTile(3, 4, 5)?.equals(tile)).toBe(true);
  });
});
