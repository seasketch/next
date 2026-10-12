import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cellToBoundary,
  cellToChildren,
  cellToLatLng,
  cellToParent,
  gridDisk,
  latLngToCell,
} from "h3-js";
import type { Polygon } from "geojson";
import { BASE_RESOLUTION, STATE_ENTIRE, STATE_PARTIAL } from "../constants";
import { collectCoarse, collectRefine, measureGeometry } from "../classify";
import { clipRingsToCell, hexAreaM2, intersectionAreaM2 } from "../coverage";
import { LandStore } from "../db";
import { OccupancyArchive } from "../format";
import { cellToInt, intToCell } from "../h3int";
import { packDatabase } from "../pack";

describe("hierarchical land occupancy", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("clips a polygon to a cell without changing the intersection area", () => {
    const cell = latLngToCell(37.8, -122.4, BASE_RESOLUTION);
    const h3 = cellToInt(cell);
    const rings = polygonAround(cell, 3).coordinates;
    const clipped = clipRingsToCell(rings, h3);
    expect(clipped).not.toBeNull();
    const direct = intersectionAreaM2(h3, rings);
    const viaClip = intersectionAreaM2(h3, clipped!);
    expect(Math.abs(direct - viaClip) / direct).toBeLessThan(0.01);
  });

  it("demotes a sealed cell with unsealed neighbors and measures all of its children", () => {
    const cell = latLngToCell(37.8, -122.4, BASE_RESOLUTION);
    const h3 = cellToInt(cell);
    const polygon = polygonAround(cell, 1.4);
    const coarse = collectCoarse(polygon, BASE_RESOLUTION);
    expect(coarse.sealed.has(h3)).toBe(true);
    expect(coarse.overlap.size).toBeGreaterThan(0);

    const dir = mkdtempSync(join(tmpdir(), "h3-land-"));
    dirs.push(dir);
    const dbPath = join(dir, "land.sqlite");
    const archivePath = join(dir, "land.h3ld");
    const store = LandStore.open(
      dbPath,
      {
        input: "test",
        resolution: 9,
        epsilon: 0.001,
        bbox: "",
        sourcePath: "test",
        hierarchical: true,
      },
      true
    );
    store.applyCoarse(coarse.sealed, coarse.overlap);
    store.commit(1);
    expect(store.isSealed(h3)).toBe(true);
    store.finishCoarse();
    // Its neighbors are only overlapped, so the corner children two levels
    // down reach outside the sealed outline. The cell is refined instead.
    expect(store.isSealed(h3)).toBe(false);
    expect(store.isMixed(h3)).toBe(true);
    expect(store.entireCount).toBe(0);

    const covers = collectRefine(polygon, BASE_RESOLUTION, 9, (candidate) =>
      store.isMixed(candidate)
    );
    const children = cellToChildren(cell, 9);
    for (const child of children) expect(covers.has(cellToInt(child))).toBe(true);
    store.applyRefine(covers, 0.001);
    store.commit(1);
    store.finalize();
    store.close();

    const stats = packDatabase(dbPath, archivePath);
    expect(stats.entireCells).toBeGreaterThan(0);
    const archive = OccupancyArchive.open(new Uint8Array(readFileSync(archivePath)));
    // The polygon is 1.4 times the cell, so even the corner children, which
    // lie half outside the cell outline, are entirely land.
    for (const child of children) expect(archive.state(child)).toBe(STATE_ENTIRE);
    expect(archive.state(cell)).toBe(STATE_ENTIRE);

    const flat = measureGeometry(polygon, 9);
    for (const fine of flat.entire) {
      const id = intToCell(fine);
      if (cellToParent(id, BASE_RESOLUTION) === cell) expect(archive.state(id)).toBe(STATE_ENTIRE);
    }
    for (const [fine, cover] of flat.cover) {
      const id = intToCell(fine);
      if (cellToParent(id, BASE_RESOLUTION) !== cell) continue;
      if (cover > 1) expect(archive.state(id)).toBe(STATE_PARTIAL);
    }
  });

  it("keeps a sealed cell whose neighbors are all sealed", () => {
    const cell = latLngToCell(37.8, -122.4, BASE_RESOLUTION);
    const h3 = cellToInt(cell);
    const polygon = polygonAround(cell, 4);
    const coarse = collectCoarse(polygon, BASE_RESOLUTION);
    for (const neighbor of gridDisk(cell, 1)) {
      expect(coarse.sealed.has(cellToInt(neighbor))).toBe(true);
    }

    const dir = mkdtempSync(join(tmpdir(), "h3-land-"));
    dirs.push(dir);
    const dbPath = join(dir, "land.sqlite");
    const archivePath = join(dir, "land.h3ld");
    const store = LandStore.open(
      dbPath,
      {
        input: "test",
        resolution: 9,
        epsilon: 0.001,
        bbox: "",
        sourcePath: "test",
        hierarchical: true,
      },
      true
    );
    store.applyCoarse(coarse.sealed, coarse.overlap);
    store.commit(1);
    store.finishCoarse();
    expect(store.isSealed(h3)).toBe(true);
    const ring = gridDisk(cell, 1).filter((candidate) => candidate !== cell);
    for (const neighbor of ring) expect(store.isMixed(cellToInt(neighbor))).toBe(true);

    const covers = collectRefine(polygon, BASE_RESOLUTION, 9, (candidate) =>
      store.isMixed(candidate)
    );
    for (const fine of covers.keys()) {
      expect(cellToParent(intToCell(fine), BASE_RESOLUTION)).not.toBe(cell);
    }
    store.applyRefine(covers, 0.001);
    store.commit(1);
    store.finalize();
    store.close();

    packDatabase(dbPath, archivePath);
    const archive = OccupancyArchive.open(new Uint8Array(readFileSync(archivePath)));
    for (const parent of gridDisk(cell, 1)) {
      for (const child of cellToChildren(parent, 9)) {
        expect(archive.state(child)).toBe(STATE_ENTIRE);
      }
    }
  });

  it("lets two pieces make a fine child entire", () => {
    const cell = latLngToCell(37.8, -122.4, BASE_RESOLUTION);
    const h3 = cellToInt(cell);
    const { west, east } = splitThroughCenter(cell);
    const dir = mkdtempSync(join(tmpdir(), "h3-land-"));
    dirs.push(dir);
    const store = LandStore.open(
      join(dir, "land.sqlite"),
      {
        input: "test",
        resolution: 9,
        epsilon: 0.001,
        bbox: "",
        sourcePath: "test",
        hierarchical: true,
      },
      true
    );
    const first = collectCoarse(west, BASE_RESOLUTION);
    expect(first.sealed.has(h3)).toBe(false);
    expect(first.overlap.has(h3)).toBe(true);
    store.applyCoarse(first.sealed, first.overlap);
    store.commit(1);
    const second = collectCoarse(east, BASE_RESOLUTION);
    store.applyCoarse(second.sealed, second.overlap);
    store.commit(2);
    expect(store.isMixed(h3)).toBe(true);
    store.finishCoarse();
    store.applyRefine(collectRefine(west, BASE_RESOLUTION, 9, (candidate) => store.isMixed(candidate)), 0.001);
    store.applyRefine(collectRefine(east, BASE_RESOLUTION, 9, (candidate) => store.isMixed(candidate)), 0.001);
    store.commit(2);
    const summary = store.finalize();
    store.close();
    expect(summary.partial + summary.entire).toBeGreaterThan(0);
    expect(hexAreaM2(h3)).toBeGreaterThan(0);
    expect(STATE_PARTIAL).toBe(1);
    expect(STATE_ENTIRE).toBe(2);
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
