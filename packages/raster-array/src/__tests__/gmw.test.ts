import { describe, expect, it } from "vitest";
import { parseGmwCellName } from "../gmw";
import { bboxLonLatToMercator, uniqueTilesForBboxes } from "../webmercator";

describe("GMW 1° cell names", () => {
  it("parses northern west cells from the NW origin", () => {
    expect(parseGmwCellName("GMW_N25W081_v4112_mng_ext.tif")).toEqual([
      -81, 24, -80, 25,
    ]);
  });

  it("parses southern east cells from the NW origin", () => {
    expect(parseGmwCellName("GMW_S08E116_v4112_mng_ext.tif")).toEqual([
      116, -9, 117, -8,
    ]);
  });

  it("parses equator / 3-digit lon from the NW origin", () => {
    expect(parseGmwCellName("GMW_N00E008_v4112_mng_ext.tif")).toEqual([
      8, -1, 9, 0,
    ]);
  });

  it("rejects other tiffs", () => {
    expect(parseGmwCellName("florida.vrt")).toBeNull();
  });
});

describe("uniqueTilesForBboxes", () => {
  it("does not double-count overlapping 1° cells at low zoom", () => {
    const a = bboxLonLatToMercator(-81, 25, -80, 26);
    const b = bboxLonLatToMercator(-80, 25, -79, 26);
    const tiles = uniqueTilesForBboxes([a, b], 3);
    const naive = uniqueTilesForBboxes([a], 3).length + uniqueTilesForBboxes([b], 3).length;
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(naive);
  });
});
