import { describe, expect, it } from "@jest/globals";
import { rasterBandStatsBySketch } from "./RasterValuesHistogram";

function band(overrides: { min: number; max: number; mean: number; count: number; invalid?: number }) {
  return {
    count: overrides.count,
    min: overrides.min,
    max: overrides.max,
    mean: overrides.mean,
    median: overrides.mean,
    range: overrides.max - overrides.min,
    histogram: [] as [number, number][],
    invalid: overrides.invalid ?? 0,
    sum: overrides.mean * overrides.count,
  };
}

describe("rasterBandStatsBySketch", () => {
  it("returns each collection sketch's raster stats and skips sketches with no pixels", () => {
    const rows = rasterBandStatsBySketch({
      metrics: [
        {
          type: "raster_stats",
          subject: { hash: "a", sketches: [1], geographies: [56] },
          value: { bands: [band({ min: -200, max: -10, mean: -80, count: 12 })] },
        },
        {
          type: "raster_stats",
          subject: { hash: "b", sketches: [2], geographies: [56] },
          value: { bands: [band({ min: -40, max: 5, mean: -12, count: 4 })] },
        },
        {
          type: "raster_stats",
          subject: { hash: "c", sketches: [3], geographies: [56] },
          value: { bands: [] },
        },
      ],
      childSketchIds: [1, 2, 3],
      sketchNameById: new Map([
        [1, "Shelf"],
        [2, "Lagoon"],
        [3, "Inland"],
      ]),
      sketchLabel: (id) => `Sketch #${id}`,
    });

    expect(rows.map((row) => row.sketchName)).toEqual(["Shelf", "Lagoon"]);
    expect(rows[0]?.stats.min).toBe(-200);
    expect(rows[0]?.stats.mean).toBe(-80);
    expect(rows[1]?.stats.max).toBe(5);
  });
});
