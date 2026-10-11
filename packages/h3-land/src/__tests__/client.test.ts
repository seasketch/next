import { describe, expect, it } from "vitest";
import {
  cellToChildren,
  cellToParent,
  getPentagons,
  getRes0Cells,
  isPentagon,
  latLngToCell,
} from "h3-js";
import { STATE_ENTIRE, STATE_PARTIAL } from "../constants";
import {
  DEFAULT_BLOCK_RECORDS,
  coalesceBlocks,
  openLandOccupancy,
  openLandOccupancyBytes,
} from "../client";
import {
  COARSE_RESOLUTION,
  OccupancyAccumulator,
  OccupancyArchive,
  buildRankTables,
  cellRank,
} from "../format";
import { cellToInt } from "../h3int";

const tables = buildRankTables();

function mixedArchive(count: number) {
  const acc = new OccupancyAccumulator();
  const parents = cellToChildren(getRes0Cells()[0]!, COARSE_RESOLUTION)
    .slice(0, count)
    .sort(
      (a, b) =>
        cellRank(a, COARSE_RESOLUTION, tables) - cellRank(b, COARSE_RESOLUTION, tables),
    );
  const marked = parents.map((parent) => cellToChildren(parent, 8)[0]!);
  for (const cell of marked) acc.add(cellToInt(cell), STATE_PARTIAL);
  const { bytes } = acc.finish();
  return { bytes: bytes.slice(), parents, marked };
}

function tracking(bytes: Uint8Array) {
  const ranges: Array<[number, number]> = [];
  const read = async (start: number, end: number) => {
    ranges.push([start, end]);
    if (end > bytes.byteLength) {
      throw new Error(`range ${start}-${end} is outside the archive`);
    }
    return bytes.subarray(start, end);
  };
  return { read, ranges };
}

describe("coalesceBlocks", () => {
  it("merges blocks when the hole is within the gap", () => {
    expect(coalesceBlocks([0, 2, 3, 8], 16, 16)).toEqual([[0, 2, 3], [8]]);
    expect(coalesceBlocks([5, 4], 4, 0)).toEqual([[4, 5]]);
    expect(coalesceBlocks([0, 2], 4, 0)).toEqual([[0], [2]]);
  });
});

describe("openLandOccupancyBytes", () => {
  it("answers from the planes when the parent is water or land", async () => {
    const parent = cellToParent(latLngToCell(37.8, -122.4, 8), COARSE_RESOLUTION);
    const acc = new OccupancyAccumulator();
    acc.markUniformEntire(cellToInt(parent));
    const bytes = acc.finish().bytes;
    const { read, ranges } = tracking(bytes);
    const land = openLandOccupancyBytes(bytes, { read, blockRecords: 4 });
    expect(await land.state(parent)).toBe("land");
    expect(await land.state(cellToChildren(parent, 8)[0]!)).toBe("land");
    const ocean = cellToParent(latLngToCell(0, -40, 8), COARSE_RESOLUTION);
    expect(await land.state(ocean)).toBe("water");
    expect(ranges).toEqual([]);
  });

  it("fetches one record-aligned block and reuses it", async () => {
    const { bytes, parents, marked } = mixedArchive(10);
    const archive = OccupancyArchive.open(bytes);
    const { read, ranges } = tracking(bytes);
    const land = openLandOccupancyBytes(bytes, {
      read,
      blockRecords: 4,
      coalesceGap: 0,
    });
    expect(await land.state(marked[5]!)).toBe("mixed");
    expect(await land.state(cellToChildren(parents[5]!, 8)[3]!)).toBe("water");
    expect(ranges).toEqual([
      [archive.recordsStart + 4 * land.stride, archive.recordsStart + 8 * land.stride],
    ]);
    expect(land.stats.requests).toBe(1);
    expect(land.stats.bytes).toBe(4 * land.stride);
    expect(land.stats.records).toBe(4);
    expect(land.stats.hits).toBe(1);

    await land.state(marked[6]!);
    expect(ranges).toHaveLength(1);
    expect(land.stats.hits).toBe(2);
  });

  it("classifies a coarser cell from the packed fine slots", async () => {
    const { bytes, marked } = mixedArchive(2);
    const land = openLandOccupancyBytes(bytes, {
      read: (start, end) => Promise.resolve(bytes.subarray(start, end)),
    });
    const fine = marked[0]!;
    expect(await land.state(cellToParent(fine, 7))).toBe("mixed");
    expect(await land.state(cellToParent(fine, 6))).toBe("mixed");
    const parent = cellToParent(fine, 6);
    const other = cellToChildren(parent, 7).find((child) => child !== cellToParent(fine, 7));
    expect(other).toBeTruthy();
    expect(await land.state(other!)).toBe("water");

    const pentagon = getPentagons(COARSE_RESOLUTION)[0]!;
    const pentagonFine = cellToChildren(pentagon, 8)[0]!;
    const acc = new OccupancyAccumulator();
    acc.add(cellToInt(pentagonFine), STATE_PARTIAL);
    const pentagonBytes = acc.finish().bytes.slice();
    const pentagonLand = openLandOccupancyBytes(pentagonBytes, {
      read: (start, end) => Promise.resolve(pentagonBytes.subarray(start, end)),
    });
    expect(await pentagonLand.state(pentagonFine)).toBe("mixed");
    expect(await pentagonLand.state(cellToParent(pentagonFine, 7))).toBe("mixed");
    expect(await pentagonLand.state(cellToParent(pentagonFine, 5))).toBe("mixed");
  });

  it("joins nearby blocks and leaves a wide gap as two requests", async () => {
    const { bytes, marked } = mixedArchive(16);
    const archive = OccupancyArchive.open(bytes);
    const { read, ranges } = tracking(bytes);
    const land = openLandOccupancyBytes(bytes, {
      read,
      blockRecords: 4,
      coalesceGap: 4,
    });
    await land.states([marked[0]!, marked[5]!]);
    expect(ranges).toEqual([
      [archive.recordsStart, archive.recordsStart + 8 * land.stride],
    ]);

    land.clearCache();
    await land.states([marked[0]!, marked[15]!]);
    expect(ranges.slice(1)).toEqual([
      [archive.recordsStart, archive.recordsStart + 4 * land.stride],
      [archive.recordsStart + 12 * land.stride, archive.recordsStart + 16 * land.stride],
    ]);
  });

  it("does not read past the last record", async () => {
    const { bytes, marked } = mixedArchive(3);
    const archive = OccupancyArchive.open(bytes);
    const { read, ranges } = tracking(bytes);
    const land = openLandOccupancyBytes(bytes, { read, blockRecords: 16 });
    expect(await land.state(marked[0]!)).toBe("mixed");
    expect(ranges).toEqual([
      [archive.recordsStart, archive.recordsStart + 3 * land.stride],
    ]);
  });

  it("drops blocks that no longer fit and loads them again", async () => {
    const { bytes, marked } = mixedArchive(12);
    const { read, ranges } = tracking(bytes);
    const land = openLandOccupancyBytes(bytes, {
      read,
      blockRecords: 4,
      coalesceGap: 0,
      cacheBytes: 4 * 601,
    });
    await land.state(marked[0]!);
    await land.state(marked[8]!);
    expect(land.stats.records).toBe(4);
    await land.state(marked[0]!);
    expect(ranges).toHaveLength(3);
    expect(land.stats.records).toBe(4);
  });

  it("folds a coarser cell from the fine record and matches the archive", async () => {
    const fine = latLngToCell(37.8, -122.4, 8);
    const mid = cellToParent(fine, 6);
    const parent = cellToParent(fine, COARSE_RESOLUTION);
    const acc = new OccupancyAccumulator();
    acc.add(cellToInt(fine), STATE_PARTIAL);
    const bytes = acc.finish().bytes;
    const archive = OccupancyArchive.open(bytes);
    const land = openLandOccupancyBytes(bytes, { blockRecords: 4 });
    expect(await land.state(fine)).toBe("mixed");
    expect(await land.state(mid)).toBe("mixed");
    expect(await land.state(parent)).toBe("mixed");
    const names = ["water", "mixed", "land"];
    for (const cell of [fine, mid, parent, cellToChildren(parent, 8)[1]!]) {
      expect(await land.state(cell)).toBe(names[archive.state(cell)]);
    }
  });

  it("loads one block for every child of a split", async () => {
    const { bytes, parents } = mixedArchive(2);
    const { read, ranges } = tracking(bytes);
    const land = openLandOccupancyBytes(bytes, { read, blockRecords: 4 });
    const children = await land.split(parents[0]!);
    expect(children).toHaveLength(isPentagon(parents[0]!) ? 6 : 7);
    expect(children.filter((child) => child.state === "mixed")).toHaveLength(1);
    expect(ranges).toHaveLength(1);

    const pentagon = getPentagons(4)[0]!;
    const branches = await land.split(pentagon);
    expect(branches).toHaveLength(6);
    expect(branches.every((child) => child.state === "water" || child.state === "mixed")).toBe(
      true,
    );
  });

  it("shares one in-flight block between callers", async () => {
    const { bytes, parents, marked } = mixedArchive(4);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ranges: Array<[number, number]> = [];
    const read = async (start: number, end: number) => {
      ranges.push([start, end]);
      await gate;
      return bytes.subarray(start, end);
    };
    const land = openLandOccupancyBytes(bytes, {
      read,
      blockRecords: 4,
      cacheBytes: 0,
    });
    const pending = Promise.all([
      land.state(marked[0]!),
      land.state(cellToChildren(parents[1]!, 8)[3]!),
    ]);
    expect(ranges).toHaveLength(1);
    release();
    const [mixed, water] = await pending;
    expect(mixed).toBe("mixed");
    expect(water).toBe("water");
  });

  it("sizes a resolution-9 block from that file's stride", async () => {
    const acc = new OccupancyAccumulator(9);
    const parent = cellToParent(latLngToCell(37.8, -122.4, 9), COARSE_RESOLUTION);
    const fine = cellToChildren(parent, 9)[0]!;
    acc.add(cellToInt(fine), STATE_PARTIAL);
    const bytes = acc.finish().bytes;
    const { read, ranges } = tracking(bytes);
    const land = openLandOccupancyBytes(bytes, { read, blockRecords: 4 });
    expect(land.stride).toBe(4202);
    expect(await land.state(cellToParent(fine, 8))).toBe("mixed");
    expect(ranges[0]![1] - ranges[0]![0]).toBe(land.stride);
  });

  it("rejects a bad magic and a cell past the fine resolution", async () => {
    const { bytes, marked } = mixedArchive(1);
    const broken = bytes.slice();
    broken[0] = 88;
    expect(() => openLandOccupancyBytes(broken)).toThrow(/magic/);
    const land = openLandOccupancyBytes(bytes);
    const tooFine = cellToChildren(marked[0]!, 9)[0]!;
    await expect(land.state(tooFine)).rejects.toThrow(/finer than this archive/);
  });
});

describe("openLandOccupancy", () => {
  it("reads the header and the planes, then a record block", async () => {
    const { bytes, marked } = mixedArchive(1);
    const archive = OccupancyArchive.open(bytes);
    const { read, ranges } = tracking(bytes);
    const land = await openLandOccupancy("https://example.test/land.h3ld", {
      read,
      blockRecords: DEFAULT_BLOCK_RECORDS,
    });
    expect(land.source).toBe("https://example.test/land.h3ld");
    expect(land.fineResolution).toBe(8);
    expect(land.stride).toBe(601);
    expect(ranges.map(([start]) => start)).toEqual([0, 28]);
    expect(land.stats.requests).toBe(2);
    expect(land.stats.bytes).toBe(archive.recordsStart);

    expect(await land.state(marked[0]!)).toBe("mixed");
    expect(ranges[2]).toEqual([
      archive.recordsStart,
      archive.recordsStart + land.stride,
    ]);
    land.clearCache();
    expect(land.stats.records).toBe(0);
  });
});
