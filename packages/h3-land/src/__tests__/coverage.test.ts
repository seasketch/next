import { describe, expect, it } from "vitest";
import {
  cellToBoundary,
  cellToChildren,
  cellToLatLng,
  getPentagons,
  gridDisk,
  latLngToCell,
} from "h3-js";
import {
  DESCENDANT_REACH,
  clipRingsToCell,
  clipToConvex,
  hexAreaM2,
  intersectionAreaM2,
  ringArea,
  type Pt,
} from "../coverage";
import { cellToInt } from "../h3int";

describe("DESCENDANT_REACH", () => {
  const parents = [
    latLngToCell(37.8, -122.4, 7),
    latLngToCell(-54.9, -67.5, 7),
    latLngToCell(71.2, 179.9, 7),
    latLngToCell(0.1, 0.1, 7),
    ...getPentagons(7).slice(0, 3),
    ...gridDisk(getPentagons(7)[0]!, 1),
  ];
  const bigSquare = (cell: string) => {
    const [lat, lng] = cellToLatLng(cell);
    const d = 0.2;
    return [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]];
  };

  it("leaves the six corner children half outside the unscaled outline", () => {
    const parent = parents[0]!;
    const ring = cellToBoundary(parent, true);
    ring.push(ring[0]!);
    let halfOut = 0;
    for (const child of cellToChildren(parent, 9)) {
      const h3 = cellToInt(child);
      const inside = intersectionAreaM2(h3, [ring]) / hexAreaM2(h3);
      if (inside < 0.6) halfOut++;
    }
    expect(halfOut).toBe(6);
  });

  it("scales the outline enough to hold every child two levels down", () => {
    for (const parent of parents) {
      const clipped = clipRingsToCell(bigSquare(parent), cellToInt(parent), DESCENDANT_REACH);
      expect(clipped).not.toBeNull();
      for (const child of cellToChildren(parent, 9)) {
        const h3 = cellToInt(child);
        const fraction = intersectionAreaM2(h3, clipped!) / hexAreaM2(h3);
        expect(fraction).toBeGreaterThan(0.9995);
      }
    }
  });
});

describe("clipToConvex", () => {
  it("cuts a unit square in half", () => {
    const square: Pt[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(ringArea(square)).toBeCloseTo(1, 8);
    const west: Pt[] = [
      [0, -1],
      [0.5, -1],
      [0.5, 2],
      [0, 2],
    ];
    expect(ringArea(clipToConvex(square, west))).toBeCloseTo(0.5, 8);
  });
});

describe("intersectionAreaM2", () => {
  const cell = latLngToCell(37.8, -122.4, 8);
  const h3 = cellToInt(cell);

  it("covers the whole cell when the polygon is the cell boundary", () => {
    const ring = cellToBoundary(cell, true);
    ring.push(ring[0]!);
    const area = intersectionAreaM2(h3, [ring]);
    expect(area / hexAreaM2(h3)).toBeGreaterThan(0.999);
  });

  it("partitions the cell across a line through its center", () => {
    const { west, east } = splitThroughCenter(cell);
    const total = hexAreaM2(h3);
    const westArea = intersectionAreaM2(h3, [west]);
    const eastArea = intersectionAreaM2(h3, [east]);
    expect(westArea / total).toBeGreaterThan(0.2);
    expect(westArea / total).toBeLessThan(0.8);
    expect(eastArea / total).toBeGreaterThan(0.2);
    expect(eastArea / total).toBeLessThan(0.8);
    expect((westArea + eastArea) / total).toBeGreaterThan(0.999);
    expect((westArea + eastArea) / total).toBeLessThan(1.001);
  });
});

function splitThroughCenter(cell: string): { west: number[][]; east: number[][] } {
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
    west: [
      [minLng - pad, south],
      [lng, south],
      [lng, north],
      [minLng - pad, north],
      [minLng - pad, south],
    ],
    east: [
      [lng, south],
      [maxLng + pad, south],
      [maxLng + pad, north],
      [lng, north],
      [lng, south],
    ],
  };
}
