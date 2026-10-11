import distance from "@turf/distance";
import { gridDisk, latLngToCell } from "h3-js";
import { describe, expect, it } from "vitest";
import {
  portalBetween,
  pullString,
} from "../../src/h3/straightenWaterPath";

describe("pullString", () => {
  it("collapses a wide open channel to a straight line", () => {
    const origin: [number, number] = [0, 0];
    const end: [number, number] = [0, 0.2];
    const portals = [0.05, 0.1, 0.15].map((lat) => ({
      left: [-0.02, lat] as [number, number],
      right: [0.02, lat] as [number, number],
    }));
    const line = pullString(origin, portals, end);
    expect(line.length).toBe(2);
    expect(line[0]![1]).toBeCloseTo(0, 5);
    expect(line[1]![1]).toBeCloseTo(0.2, 5);
    const span = distance(line[0]!, line[1]!, { units: "meters" });
    const direct = distance(origin, end, { units: "meters" });
    expect(span).toBeGreaterThan(direct * 0.98);
    expect(span).toBeLessThan(direct * 1.02);
  });

  it("bends when later portals leave the straight line", () => {
    const origin: [number, number] = [0, 0];
    const end: [number, number] = [0.08, 0.2];
    const portals = [
      { left: [-0.01, 0.05] as [number, number], right: [0.01, 0.05] as [number, number] },
      { left: [0.04, 0.1] as [number, number], right: [0.07, 0.1] as [number, number] },
    ];
    const line = pullString(origin, portals, end);
    expect(line.length).toBeGreaterThanOrEqual(3);
    const bend = line[1]!;
    const corners = portals.flatMap((portal) => [portal.left, portal.right]);
    const nearCorner = corners.some(
      (corner) => distance(bend, corner, { units: "meters" }) < 30
    );
    expect(nearCorner).toBe(true);
  });
});

describe("portalBetween", () => {
  it("uses the shared edge of two neighboring fine cells", () => {
    const origin = latLngToCell(0, 0, 8);
    const neighbor = gridDisk(origin, 1).find((cell) => cell !== origin);
    expect(neighbor).toBeTruthy();
    const portal = portalBetween(origin, neighbor!);
    expect(portal).toBeTruthy();
    const width = distance(portal!.left, portal!.right, { units: "meters" });
    expect(width).toBeGreaterThan(300);
    expect(width).toBeLessThan(700);
  });
});
