import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cellToBoundary, cellToLatLng, latLngToCell } from "h3-js";
import type { Polygon } from "geojson";
import { CellSet, measureGeometry, nextCover, splitRings } from "../classify";
import { STATE_ENTIRE, STATE_PARTIAL } from "../constants";
import { hexAreaM2, ringArea } from "../coverage";
import { LandStore, readCellState } from "../db";
import { cellToInt, intToCell } from "../h3int";

describe("nextCover", () => {
  it("ignores a touch and promotes when the pieces cover the cell", () => {
    expect(nextCover(0, 0.1, 1_000_000, 0.001)).toEqual({ kind: "unchanged" });
    expect(nextCover(0, 400_000, 1_000_000, 0.001)).toEqual({
      kind: "partial",
      cover: 400_000,
    });
    expect(nextCover(400_000, 599_500, 1_000_000, 0.001).kind).toBe("entire");
  });
});

describe("CellSet", () => {
  it("keeps growing after one chunk is full and ignores duplicates", () => {
    const cells = new CellSet(2);
    cells.add(1n);
    cells.add(2n);
    cells.add(2n);
    cells.add(3n);
    expect(cells.size).toBe(3);
    expect(cells.has(1n)).toBe(true);
    expect(cells.has(3n)).toBe(true);
    expect([...cells]).toEqual([1n, 2n, 3n]);
  });
});

describe("splitRings", () => {
  // A wide rectangle with a hole in the middle, so the cut passes through the hole.
  const outer = [
    [-122.6, 37.6],
    [-122.0, 37.6],
    [-122.0, 37.9],
    [-122.6, 37.9],
    [-122.6, 37.6],
  ];
  const hole = [
    [-122.4, 37.7],
    [-122.2, 37.7],
    [-122.2, 37.8],
    [-122.4, 37.8],
    [-122.4, 37.7],
  ];
  const pts = (ring: number[][]) => ring.map(([x, y]) => [x!, y!] as [number, number]);

  it("cuts along the longer axis and keeps the holes", () => {
    const halves = splitRings([outer, hole]);
    expect(halves).not.toBeNull();
    expect(halves!.length).toBe(2);
    for (const half of halves!) {
      expect(half.length).toBe(2);
      const [first, last] = [half[0]![0]!, half[0]![half[0]!.length - 1]!];
      expect(first).toEqual(last);
    }
    const area = (rings: number[][][]) =>
      ringArea(pts(rings[0]!)) - rings.slice(1).reduce((sum, r) => sum + ringArea(pts(r)), 0);
    const original = area([outer, hole]);
    const total = halves!.reduce((sum, half) => sum + area(half), 0);
    expect(total).toBeCloseTo(original, 9);
    const xs = halves!.map((half) => Math.max(...half[0]!.map((p) => p[0]!)));
    expect(Math.min(...xs)).toBeCloseTo(-122.3, 9);
  });

  it("returns null for a degenerate ring", () => {
    expect(splitRings([[[0, 0], [0, 0], [0, 0], [0, 0]]])).toBeNull();
    expect(splitRings([])).toBeNull();
  });
});

describe("measureGeometry", () => {
  const cell = latLngToCell(37.8, -122.4, 8);
  const h3 = cellToInt(cell);

  it("marks a polygon that contains the cell as entire", () => {
    const contribution = measureGeometry(polygonAround(cell, 2), 8);
    expect(contribution.entire.has(h3)).toBe(true);
    expect(contribution.cover.has(h3)).toBe(false);
  });

  it("marks a polygon inside the cell as partial", () => {
    const contribution = measureGeometry(polygonAround(cell, 0.3), 8);
    expect(contribution.entire.has(h3)).toBe(false);
    const cover = contribution.cover.get(h3);
    expect(cover).toBeDefined();
    expect(cover! / hexAreaM2(h3)).toBeLessThan(0.5);
    expect(cover! / hexAreaM2(h3)).toBeGreaterThan(0.01);
  });

  it("does not record a distant polygon against this cell", () => {
    const elsewhere = latLngToCell(0, 0, 8);
    const contribution = measureGeometry(polygonAround(elsewhere, 2), 8);
    expect(contribution.entire.has(h3)).toBe(false);
    expect(contribution.cover.has(h3)).toBe(false);
  });
});

describe("LandStore", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("promotes a cell split across two land pieces and resumes without double counting", () => {
    const cell = latLngToCell(37.8, -122.4, 8);
    const h3 = cellToInt(cell);
    const { west, east } = splitThroughCenter(cell);
    const dir = mkdtempSync(join(tmpdir(), "h3-land-"));
    dirs.push(dir);
    const output = join(dir, "land.sqlite");
    const params = {
      input: "test",
      resolution: 8,
      epsilon: 0.001,
      bbox: "",
      sourcePath: "test",
    };

    const first = LandStore.open(output, params, false);
    const westContribution = measureGeometry(west, 8);
    expect(westContribution.entire.has(h3)).toBe(false);
    expect(westContribution.cover.has(h3)).toBe(true);
    first.apply(westContribution);
    first.commit(1);
    first.close();

    const second = LandStore.open(output, params, false);
    expect(second.nextFeature).toBe(1);
    second.apply(measureGeometry(east, 8));
    expect(second.oversizeCount).toBe(0);
    second.commit(2);
    const summary = second.finalize();
    second.close();

    expect(readCellState(output, h3)).toBe(STATE_ENTIRE);
    expect(intToCell(h3)).toBe(cell);
    expect(summary.entire).toBeGreaterThan(0);
  });

  it("keeps a cell partial when one piece does not cover it", () => {
    const cell = latLngToCell(37.8, -122.4, 8);
    const h3 = cellToInt(cell);
    const dir = mkdtempSync(join(tmpdir(), "h3-land-"));
    dirs.push(dir);
    const output = join(dir, "land.sqlite");
    const store = LandStore.open(
      output,
      { input: "test", resolution: 8, epsilon: 0.001, bbox: "", sourcePath: "test" },
      false
    );
    store.apply(measureGeometry(polygonAround(cell, 0.3), 8));
    store.commit(1);
    const summary = store.finalize();
    store.close();
    expect(summary.partial).toBe(1);
    expect(summary.entire).toBe(0);
    expect(readCellState(output, h3)).toBe(STATE_PARTIAL);
  });
});

function polygonAround(cell: string, factor: number): Polygon {
  const [lat, lng] = cellToLatLng(cell);
  const ring = cellToBoundary(cell, true).map(([x, y]) => [
    lng + (x - lng) * factor,
    lat + (y - lat) * factor,
  ]);
  ring.push(ring[0]!);
  return { type: "Polygon", coordinates: [ring] };
}

function splitThroughCenter(cell: string): { west: Polygon; east: Polygon } {
  const [lat, lng] = cellToLatLng(cell);
  const boundary = cellToBoundary(cell, true);
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [x, y] of boundary) {
    minLng = Math.min(minLng, x);
    maxLng = Math.max(maxLng, x);
    minLat = Math.min(minLat, y);
    maxLat = Math.max(maxLat, y);
  }
  const pad = 0.02;
  const south = minLat - pad;
  const north = maxLat + pad;
  return {
    west: {
      type: "Polygon",
      coordinates: [
        [
          [minLng - pad, south],
          [lng, south],
          [lng, north],
          [minLng - pad, north],
          [minLng - pad, south],
        ],
      ],
    },
    east: {
      type: "Polygon",
      coordinates: [
        [
          [lng, south],
          [maxLng + pad, south],
          [maxLng + pad, north],
          [lng, north],
          [lng, south],
        ],
      ],
    },
  };
}
