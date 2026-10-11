import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import {
  cellToChildPos,
  cellToChildren,
  cellToParent,
  getBaseCellNumber,
  getPentagons,
  getRes0Cells,
  latLngToCell,
} from "h3-js";
import { STATE_ENTIRE, STATE_PARTIAL } from "../constants";
import {
  COARSE_RESOLUTION,
  FILE_STATE_NONE,
  FINE_RESOLUTION,
  OccupancyAccumulator,
  OccupancyArchive,
  RECORD_STRIDE,
  buildRankTables,
  cellRank,
  childPosition,
  descendantSlotBlock,
  parentAtCoarse,
} from "../format";
import { cellToInt, intToCell } from "../h3int";
import { packDatabase } from "../pack";

const require = createRequire(__filename);
const { DatabaseSync } = require("node:" + "sqlite") as typeof import("node:sqlite");

describe("cell ranks", () => {
  const tables = buildRankTables();

  it("assigns every resolution-1 cell a unique rank", () => {
    const seen = new Set<number>();
    for (const base of getRes0Cells()) {
      for (const cell of cellToChildren(base, 1)) {
        const rank = cellRank(cell, 1, tables);
        expect(seen.has(rank)).toBe(false);
        seen.add(rank);
      }
    }
    expect(seen.size).toBe(tables.prefix[1]![122]);
  });

  it("keeps the fine children of a hex cell in one child-position block", () => {
    const cell = latLngToCell(37.8, -122.4, 6);
    const parent = cellToParent(cell, COARSE_RESOLUTION);
    const pos = cellToChildPos(cell, COARSE_RESOLUTION);
    const span = 7 ** (FINE_RESOLUTION - 6);
    const positions = cellToChildren(cell, FINE_RESOLUTION).map((child) =>
      cellToChildPos(child, COARSE_RESOLUTION)
    );
    expect(Math.min(...positions)).toBe(pos * span);
    expect(Math.max(...positions)).toBe(pos * span + span - 1);
    expect(new Set(positions).size).toBe(span);
    expect(getBaseCellNumber(parent)).toBe(getBaseCellNumber(cell));
  });
});

describe("archive", () => {
  it("matches child positions from the H3 index bits", () => {
    const tables = buildRankTables();
    const cell = latLngToCell(37.8, -122.4, FINE_RESOLUTION);
    const h3 = cellToInt(cell);
    expect(intToCell(parentAtCoarse(h3))).toBe(cellToParent(cell, COARSE_RESOLUTION));
    expect(childPosition(h3, tables)).toBe(cellToChildPos(cell, COARSE_RESOLUTION));
  });

  it("keeps a uniform coarse cell out of the fine records", () => {
    const parent = cellToParent(latLngToCell(37.8, -122.4, FINE_RESOLUTION), COARSE_RESOLUTION);
    const acc = new OccupancyAccumulator();
    for (const child of cellToChildren(parent, FINE_RESOLUTION)) {
      acc.add(cellToInt(child), STATE_ENTIRE);
    }
    const { bytes, stats } = acc.finish();
    const archive = OccupancyArchive.open(bytes);
    expect(stats.mixedParents).toBe(0);
    expect(archive.state(parent)).toBe(STATE_ENTIRE);
    expect(archive.state(cellToParent(parent, 0))).toBe(STATE_PARTIAL);
    expect(archive.recordOffset(parent)).toBeNull();
    const child = cellToChildren(parent, FINE_RESOLUTION)[0]!;
    expect(archive.state(child)).toBe(STATE_ENTIRE);
    expect(archive.state(cellToParent(child, 6))).toBe(STATE_ENTIRE);
  });

  it("stores a single fine cell as a partial coarse record", () => {
    const cell = latLngToCell(-33.8, 151.2, FINE_RESOLUTION);
    const parent = cellToParent(cell, COARSE_RESOLUTION);
    const other = cellToChildren(parent, FINE_RESOLUTION).find((child) => child !== cell)!;
    const acc = new OccupancyAccumulator();
    acc.add(cellToInt(cell), STATE_PARTIAL);
    const { bytes } = acc.finish();
    const archive = OccupancyArchive.open(bytes);
    expect(archive.state(cell)).toBe(STATE_PARTIAL);
    expect(archive.state(other)).toBe(FILE_STATE_NONE);
    expect(archive.state(parent)).toBe(STATE_PARTIAL);
    expect(archive.state(cellToParent(cell, 6))).toBe(STATE_PARTIAL);
    expect(archive.recordOffset(parent)).toBe(archive.recordsStart);
    expect(archive.mixedCount).toBe(1);
  });

  it("orders two mixed records by coarse rank", () => {
    const first = latLngToCell(37.8, -122.4, FINE_RESOLUTION);
    const second = latLngToCell(-33.8, 151.2, FINE_RESOLUTION);
    const acc = new OccupancyAccumulator();
    acc.add(cellToInt(first), STATE_ENTIRE);
    acc.add(cellToInt(second), STATE_ENTIRE);
    const archive = OccupancyArchive.open(acc.finish().bytes);
    const parentA = cellToParent(first, COARSE_RESOLUTION);
    const parentB = cellToParent(second, COARSE_RESOLUTION);
    const offsetA = archive.recordOffset(parentA)!;
    const offsetB = archive.recordOffset(parentB)!;
    expect(offsetA).not.toBe(offsetB);
    expect(Math.abs(offsetA - offsetB)).toBe(RECORD_STRIDE);
    expect(archive.state(first)).toBe(STATE_ENTIRE);
    expect(archive.state(second)).toBe(STATE_ENTIRE);
  });

  it("round-trips a resolution-9 cell", () => {
    const cell = latLngToCell(37.8, -122.4, 9);
    const tables = buildRankTables();
    const h3 = cellToInt(cell);
    expect(intToCell(parentAtCoarse(h3))).toBe(cellToParent(cell, COARSE_RESOLUTION));
    expect(childPosition(h3, tables)).toBe(cellToChildPos(cell, COARSE_RESOLUTION));
    const acc = new OccupancyAccumulator(9);
    acc.add(h3, STATE_PARTIAL);
    const archive = OccupancyArchive.open(acc.finish().bytes);
    expect(archive.fineResolution).toBe(9);
    expect(archive.state(cell)).toBe(STATE_PARTIAL);
    expect(archive.state(cellToParent(cell, 8))).toBe(STATE_PARTIAL);
    expect(archive.state(cellToParent(cell, COARSE_RESOLUTION))).toBe(STATE_PARTIAL);
  });
  it("round-trips a cell under a resolution-4 pentagon", () => {
    const parent = getPentagons(COARSE_RESOLUTION)[0]!;
    const child = cellToChildren(parent, FINE_RESOLUTION)[10]!;
    const tables = buildRankTables();
    expect(childPosition(cellToInt(child), tables)).toBe(
      cellToChildPos(child, COARSE_RESOLUTION)
    );
    const acc = new OccupancyAccumulator();
    acc.add(cellToInt(child), STATE_ENTIRE);
    const archive = OccupancyArchive.open(acc.finish().bytes);
    expect(archive.state(child)).toBe(STATE_ENTIRE);
    expect(archive.state(parent)).toBe(STATE_PARTIAL);
  });
});

describe("descendant slots", () => {
  const tables = buildRankTables();

  it("covers each hex resolution-9 child of a resolution-7 cell once", () => {
    const cell = latLngToCell(37.8, -122.4, 7);
    const block = descendantSlotBlock(cellToInt(cell), 9, tables);
    const positions = cellToChildren(cell, 9).map((child) => cellToChildPos(child, 4));
    expect(block.count).toBe(positions.length);
    expect(Math.min(...positions)).toBe(block.start);
    expect(Math.max(...positions)).toBe(block.start + block.count - 1);
  });

  it("covers pentagon descendants as one contiguous block", () => {
    const cell = cellToChildren(getPentagons(4)[0]!, 7)[3]!;
    const block = descendantSlotBlock(cellToInt(cell), 9, tables);
    const positions = cellToChildren(cell, 9).map((child) => cellToChildPos(child, 4));
    expect(block.count).toBe(positions.length);
    expect(Math.min(...positions)).toBe(block.start);
    expect(Math.max(...positions) - Math.min(...positions) + 1).toBe(block.count);
  });
});

describe("packDatabase", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("reads H3 ids that do not fit in a JavaScript number", () => {
    const dir = mkdtempSync(join(tmpdir(), "h3-land-"));
    dirs.push(dir);
    const dbPath = join(dir, "cells.sqlite");
    const outPath = join(dir, "land.h3ld");
    const db = new DatabaseSync(dbPath);
    db.exec(
      "CREATE TABLE cells (h3 INTEGER PRIMARY KEY, state INTEGER NOT NULL) WITHOUT ROWID"
    );
    const cell = latLngToCell(37.8, -122.4, FINE_RESOLUTION);
    db.prepare("INSERT INTO cells (h3, state) VALUES (?, ?)").run(cellToInt(cell), STATE_ENTIRE);
    db.close();

    const stats = packDatabase(dbPath, outPath);
    expect(stats.entireCells).toBe(1);
    expect(stats.mixedParents).toBe(1);
    const archive = OccupancyArchive.open(new Uint8Array(readFileSync(outPath)));
    expect(archive.state(cell)).toBe(STATE_ENTIRE);
  });
});
