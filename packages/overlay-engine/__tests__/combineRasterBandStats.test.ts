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

    // mean = totalSum / totalCount
    expect(result.mean).toBeCloseTo(700 / 150, 6);

    // median cannot be combined, so implementation sets it to NaN
    expect(Number.isNaN(result.median)).toBe(true);

    // histogram merged by value and sorted
    expect(result.histogram).toEqual([
      [1, 100],
      [10, 50],
    ]);
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
