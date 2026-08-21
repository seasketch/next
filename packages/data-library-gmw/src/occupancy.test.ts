import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGmwCellName } from "../../raster-array/src/gmw";
import {
  addParentTiles,
  occupiedPixelsToTiles,
  orBandsOccupied,
  tileKey,
} from "./occupancy";
import { indexCells, sourcesForTile } from "./encodeFromCells";
import { bboxLonLatToMercator } from "../../raster-array/src/webmercator";

describe("occupancy helpers", () => {
  it("adds parent tiles down to z0", () => {
    const tiles = addParentTiles([{ z: 3, x: 4, y: 5 }], 0);
    assert.deepEqual(
      tiles.map(tileKey),
      ["0/0/0", "1/1/1", "2/2/2", "3/4/5"],
    );
  });

  it("maps an occupied coarse pixel onto the z12 tiles that cover it", () => {
    const wgs84 = parseGmwCellName("GMW_N25W081_v4112_mng_ext.tif")!;
    const occupied = new Uint8Array(4);
    occupied[0] = 1;
    const tiles = occupiedPixelsToTiles(wgs84, 2, 2, occupied, 8);
    assert.ok(tiles.length > 0);
    assert.ok(tiles.every((t) => t.z === 8));
  });

  it("ORs any non-nodata year into occupancy", () => {
    const a = Uint8Array.from([0, 0, 0, 1]);
    const b = Uint8Array.from([0, 1, 0, 0]);
    assert.deepEqual([...orBandsOccupied([a, b])], [0, 1, 0, 1]);
  });
});

describe("cell index", () => {
  it("finds the NW-named cell that actually covers a Florida tile", () => {
    const wgs84 = parseGmwCellName("GMW_N25W081_v4112_mng_ext.tif")!;
    const source = {
      name: "GMW_N25W081_v4112_mng_ext.tif",
      path: "/dev/null",
      wgs84,
      mercator: bboxLonLatToMercator(...wgs84),
    };
    const index = indexCells([source]);
    assert.equal(index.get("-81,24")?.name, source.name);
    const tiles = occupiedPixelsToTiles(
      wgs84,
      1,
      1,
      Uint8Array.from([1]),
      10,
    );
    assert.ok(tiles.length > 0);
    const hit = sourcesForTile(tiles[0]!, index);
    assert.equal(hit[0]?.name, source.name);
  });
});
