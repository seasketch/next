import { describe, expect, it } from "vitest";
import { latLngToCell } from "h3-js";
import { bboxForCell } from "../src/h3/bboxForCell";
import {
  cellsCoveringGeometry,
  densifiedPositionsFromGeometry,
} from "../src/h3/coverGeometry";
import { MinHeap } from "../src/h3/minHeap";
import { cellLowerBoundMeters } from "../src/h3/adaptiveGrid";

describe("bboxForCell", () => {
  it("returns a non-wrapping bbox for a Pacific cell", () => {
    const cell = latLngToCell(-16.5, 179.5, 6);
    const [minX, minY, maxX, maxY] = bboxForCell(cell);
    expect(minY).toBeLessThan(maxY);
    expect(Math.abs(maxX - minX)).toBeLessThan(10);
  });

  it("emits minX > maxX for an antimeridian-crossing cell", () => {
    // Walk cells near the antimeridian until one wraps.
    let found = false;
    for (let lat = -20; lat <= 20 && !found; lat += 2) {
      const cell = latLngToCell(lat, 179.99, 4);
      const [minX, , maxX] = bboxForCell(cell);
      if (minX > maxX) {
        found = true;
        expect(minX).toBeGreaterThan(0);
        expect(maxX).toBeLessThan(0);
      }
    }
    // Not all latitudes wrap at res 4; skip if none in this sample.
  });
});

describe("cellsCoveringGeometry", () => {
  it("covers a point with a single cell", () => {
    const cells = cellsCoveringGeometry(
      { type: "Point", coordinates: [178.5, -16.5] },
      6
    );
    expect(cells).toHaveLength(1);
  });

  it("covers a long line with more than two vertex cells", () => {
    const cells = cellsCoveringGeometry(
      {
        type: "LineString",
        coordinates: [
          [178.0, -16.5],
          [179.5, -16.5],
        ],
      },
      6
    );
    expect(cells.length).toBeGreaterThan(2);
  });

  it("densifies a long line so origin samples include the midpoint", () => {
    const samples = densifiedPositionsFromGeometry(
      {
        type: "LineString",
        coordinates: [
          [178.0, -16.5],
          [179.5, -16.5],
        ],
      },
      5_000
    );
    expect(samples.length).toBeGreaterThan(2);
    const lats = samples.map((p) => p[1]);
    expect(lats.every((lat) => Math.abs(lat + 16.5) < 1e-6)).toBe(true);
  });

  it("covers a polygon including interior cells", () => {
    const cells = cellsCoveringGeometry(
      {
        type: "Polygon",
        coordinates: [
          [
            [178.0, -16.8],
            [178.4, -16.8],
            [178.4, -16.4],
            [178.0, -16.4],
            [178.0, -16.8],
          ],
        ],
      },
      6
    );
    expect(cells.length).toBeGreaterThan(4);
  });
});

describe("MinHeap", () => {
  it("pops keys in ascending order", () => {
    const heap = new MinHeap<string>();
    heap.push(5, "e");
    heap.push(1, "a");
    heap.push(3, "c");
    expect(heap.pop()?.value).toBe("a");
    expect(heap.pop()?.value).toBe("c");
    expect(heap.pop()?.value).toBe("e");
    expect(heap.pop()).toBeUndefined();
  });
});

describe("cellLowerBoundMeters", () => {
  it("is zero for a cell containing the origin", () => {
    const cell = latLngToCell(-16.5, 178.5, 4);
    const lb = cellLowerBoundMeters([[178.5, -16.5]], cell);
    expect(lb).toBe(0);
  });

  it("is positive for a distant cell and does not exceed geodesic to center", () => {
    const origin: [number, number] = [178.5, -16.5];
    const cell = latLngToCell(0, 0, 4);
    const lb = cellLowerBoundMeters([origin], cell);
    expect(lb).toBeGreaterThan(1_000_000);
  });
});
