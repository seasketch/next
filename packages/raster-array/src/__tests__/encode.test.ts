import { describe, expect, it } from "vitest";
import { encodeMrtTile, encodeSample, decodeSample } from "../mrt/encode";
import { decodeMrtTile, getMrtHeaderLength } from "../mrt/decode";
import { MRT_NODATA } from "../mrt/types";

function fill(n: number, value: number): Uint32Array {
  return Uint32Array.from({ length: n }, () => value);
}

describe("MRT v1 encode/decode", () => {
  it("round-trips a 2×2 tile with one band", () => {
    const values = Uint32Array.from([1, 2, 3, 4]);
    const buf = encodeMrtTile({
      z: 3,
      x: 4,
      y: 5,
      layers: [
        {
          name: "mangrove",
          units: "presence",
          tileSize: 2,
          buffer: 0,
          offset: 0,
          scale: 1,
          bands: [{ id: "2000", values }],
        },
      ],
    });

    expect(buf[0]).toBe(0x0d);
    expect(getMrtHeaderLength(buf)).toBeGreaterThan(5);
    expect(getMrtHeaderLength(buf)).toBeLessThan(buf.length);

    const tile = decodeMrtTile(buf);
    expect(tile).toMatchObject({ z: 3, x: 4, y: 5 });
    const layer = tile.layers.mangrove;
    expect(layer).toBeDefined();
    expect(layer.units).toBe("presence");
    expect(layer.tileSize).toBe(2);
    expect(layer.buffer).toBe(0);
    expect(layer.dataIndex[0]?.offset).toBe(0);
    expect(layer.dataIndex[0]?.scale).toBe(1);
    expect(layer.dataIndex[0]?.codec).toBe("gzip_data");
    expect([...layer.bandData["2000"]!]).toEqual([1, 2, 3, 4]);
  });

  it("stores nodata as 0xffffffff", () => {
    const values = Uint32Array.from([MRT_NODATA, 1, MRT_NODATA, 1]);
    const buf = encodeMrtTile({
      z: 0,
      x: 0,
      y: 0,
      layers: [
        {
          name: "data",
          tileSize: 2,
          buffer: 0,
          bands: [{ id: "a", values }],
        },
      ],
    });
    const decoded = decodeMrtTile(buf).layers.data.bandData["a"]!;
    expect([...decoded]).toEqual([MRT_NODATA, 1, MRT_NODATA, 1]);
  });

  it("packs several bands in one block by default", () => {
    const buf = encodeMrtTile({
      z: 1,
      x: 0,
      y: 0,
      layers: [
        {
          name: "t",
          tileSize: 2,
          buffer: 0,
          bands: [
            { id: "1985", values: fill(4, 1) },
            { id: "1986", values: fill(4, 2) },
            { id: "1987", values: fill(4, 3) },
          ],
        },
      ],
    });
    const layer = decodeMrtTile(buf).layers.t;
    expect(layer.dataIndex).toHaveLength(1);
    expect(layer.dataIndex[0]?.bands).toEqual(["1985", "1986", "1987"]);
    expect([...layer.bandData["1985"]!]).toEqual([1, 1, 1, 1]);
    expect([...layer.bandData["1986"]!]).toEqual([2, 2, 2, 2]);
    expect([...layer.bandData["1987"]!]).toEqual([3, 3, 3, 3]);
  });

  it("can emit one range-addressable block per band", () => {
    const buf = encodeMrtTile({
      z: 1,
      x: 0,
      y: 0,
      layers: [
        {
          name: "t",
          tileSize: 2,
          buffer: 0,
          bandsPerBlock: 1,
          bands: [
            { id: "a", values: fill(4, 9) },
            { id: "b", values: fill(4, 8) },
          ],
        },
      ],
    });
    const layer = decodeMrtTile(buf).layers.t;
    expect(layer.dataIndex).toHaveLength(2);
    expect(layer.dataIndex[0]?.bands).toEqual(["a"]);
    expect(layer.dataIndex[1]?.bands).toEqual(["b"]);
    expect(layer.dataIndex[0]!.lastByte).toBeLessThan(layer.dataIndex[1]!.firstByte);
    expect([...layer.bandData["a"]!]).toEqual([9, 9, 9, 9]);
    expect([...layer.bandData["b"]!]).toEqual([8, 8, 8, 8]);
  });

  it("includes buffer pixels in the sample count", () => {
    const dim = 4 + 2 * 1;
    const values = fill(dim * dim, 7);
    const buf = encodeMrtTile({
      z: 2,
      x: 1,
      y: 1,
      layers: [
        {
          name: "buffered",
          tileSize: 4,
          buffer: 1,
          bands: [{ id: "0", values }],
        },
      ],
    });
    const layer = decodeMrtTile(buf).layers.buffered;
    expect(layer.buffer).toBe(1);
    expect(layer.bandData["0"]!.length).toBe(36);
  });

  it("stores offset/scale as protobuf floats (GL JS 3.4 fields 5/6)", () => {
    const buf = encodeMrtTile({
      z: 0,
      x: 0,
      y: 0,
      layers: [
        {
          name: "sst",
          tileSize: 2,
          buffer: 0,
          offset: 10,
          scale: 0.1,
          bands: [{ id: "2024-01", values: fill(4, 125) }],
        },
      ],
    });
    const block = decodeMrtTile(buf).layers.sst.dataIndex[0]!;
    expect(block.offset).toBeCloseTo(10);
    expect(block.scale).toBeCloseTo(0.1);
  });

  it("quantizes physical values with offset/scale", () => {
    expect(encodeSample(12.5, 0, 0.1)).toBe(125);
    expect(decodeSample(125, 0, 0.1)).toBeCloseTo(12.5);
    expect(encodeSample(Number.NaN, 0, 1)).toBe(MRT_NODATA);
    expect(encodeSample(0, 0, 1, 0)).toBe(MRT_NODATA);
    expect(decodeSample(MRT_NODATA, 0, 1)).toBeNull();
  });

  it("rejects a non-power-of-two tileSize", () => {
    expect(() =>
      encodeMrtTile({
        z: 0,
        x: 0,
        y: 0,
        layers: [
          {
            name: "x",
            tileSize: 3,
            buffer: 0,
            bands: [{ id: "a", values: fill(9, 1) }],
          },
        ],
      }),
    ).toThrow(/power of two/);
  });
});
