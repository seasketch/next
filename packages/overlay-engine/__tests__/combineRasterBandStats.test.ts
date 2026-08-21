import { describe, it, expect } from "vitest";
import {
  RasterBandStats,
  combineRasterBandStats,
} from "../src/metrics/metrics";

function makeBand(partial: Partial<RasterBandStats>): RasterBandStats {
  return {
    count: 0,
    min: NaN,
    max: NaN,
    mean: NaN,
    median: NaN,
    range: NaN,
    histogram: [],
    invalid: 0,
    sum: 0,
    ...partial,
  };
}

describe("combineRasterBandStats", () => {
  it("returns the single band unchanged when only one is provided", () => {
    const band = makeBand({
      count: 10,
      min: 1,
      max: 5,
      mean: 3,
      median: 3,
      range: 4,
      histogram: [
        [1, 2],
        [3, 5],
        [5, 3],
      ],
      invalid: 1,
      sum: 30,
    });

    const result = combineRasterBandStats([band]);
    expect(result).toBe(band);
  });

  it("combines two bands using count-weighted mean and sum", () => {
    const a = makeBand({
      count: 100,
      min: 0,
      max: 10,
      mean: 2,
      median: 2,
      range: 10,
      histogram: [[1, 100]],
      invalid: 2,
      sum: 200,
    });

    const b = makeBand({
      count: 50,
      min: 5,
      max: 15,
      mean: 10,
      median: 10,
      range: 10,
      histogram: [[10, 50]],
      invalid: 1,
      sum: 500,
    });

    const result = combineRasterBandStats([a, b])!;

    expect(result.count).toBe(150);
    expect(result.sum).toBe(700);
    expect(result.invalid).toBe(3);
    expect(result.min).toBe(0);
    expect(result.max).toBe(15);
    expect(result.range).toBe(15 - 0);

    // mean = totalSum / total *valid* count (count includes invalid pixels)
    expect(result.mean).toBeCloseTo(700 / (150 - 3), 6);

    // median cannot be combined, so implementation sets it to NaN
    expect(Number.isNaN(result.median)).toBe(true);

    // histogram merged by value and sorted
    expect(result.histogram).toEqual([
      [1, 100],
      [10, 50],
    ]);
  });

  it("keeps the combined mean within [min, max] when a fragment is entirely nodata", () => {
    // Regression test: a fragment fully outside the raster's valid data
    // contributes count === invalid with sum 0. Its pixels must not dilute
    // the combined mean (which previously fell below the combined min).
    const allNodata = makeBand({
      count: 10.956363636363637,
      invalid: 10.956363636363637,
      sum: 0,
    });

    const valid = makeBand({
      count: 54.278347107438016,
      invalid: 30.966611570247935,
      sum: 164.62451693069838,
      min: 5.947144985198975,
      max: 7.869998931884766,
      mean: 7.06187304965204,
      median: 7,
      range: 1.922853946685791,
      histogram: [[7, 23.31173553719008]],
    });

    const result = combineRasterBandStats([allNodata, valid])!;

    expect(result.min).toBeCloseTo(5.947144985198975, 6);
    expect(result.max).toBeCloseTo(7.869998931884766, 6);
    // mean = sum / (count - invalid) of the valid band only
    expect(result.mean).toBeCloseTo(7.06187304965204, 6);
    expect(result.mean).toBeGreaterThanOrEqual(result.min);
    expect(result.mean).toBeLessThanOrEqual(result.max);
  });

  it("merges overlapping histogram bins and keeps them sorted", () => {
    const a = makeBand({
      count: 10,
      min: 1,
      max: 2,
      mean: 1.5,
      median: 1.5,
      range: 1,
      histogram: [
        [1, 4],
        [2, 6],
      ],
      invalid: 0,
      sum: 15,
    });

    const b = makeBand({
      count: 5,
      min: 1,
      max: 2,
      mean: 1.8,
      median: 1.8,
      range: 1,
      histogram: [
        [1, 1],
        [2, 4],
      ],
      invalid: 1,
      sum: 9,
    });

    const result = combineRasterBandStats([a, b])!;

    expect(result.count).toBe(15);
    expect(result.sum).toBe(24);
    expect(result.invalid).toBe(1);
    expect(result.min).toBe(1);
    expect(result.max).toBe(2);
    expect(result.range).toBe(1);

    // Overlapping bins should have their counts summed
    expect(result.histogram).toEqual([
      [1, 5],
      [2, 10],
    ]);
  });

  it("handles bands with disjoint histogram values", () => {
    const a = makeBand({
      count: 3,
      min: 0,
      max: 1,
      mean: 1 / 3,
      median: NaN,
      range: 1,
      histogram: [
        [0, 2],
        [1, 1],
      ],
      invalid: 0,
      sum: 1,
    });

    const b = makeBand({
      count: 2,
      min: 10,
      max: 11,
      mean: 10.5,
      median: NaN,
      range: 1,
      histogram: [
        [10, 1],
        [11, 1],
      ],
      invalid: 0,
      sum: 21,
    });

    const result = combineRasterBandStats([a, b])!;

    expect(result.count).toBe(5);
    expect(result.sum).toBe(22);
    expect(result.min).toBe(0);
    expect(result.max).toBe(11);
    expect(result.range).toBe(11 - 0);

    // Histogram values should be merged and sorted across the disjoint ranges
    expect(result.histogram).toEqual([
      [0, 2],
      [1, 1],
      [10, 1],
      [11, 1],
    ]);
  });
});
