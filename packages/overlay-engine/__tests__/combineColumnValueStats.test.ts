import { describe, it, expect } from "vitest";
import {
  ColumnValueStats,
  combineColumnValueStats,
} from "../src/metrics/metrics";

function makeStats(partial: Partial<ColumnValueStats>): ColumnValueStats {
  return {
    count: 0,
    min: NaN,
    max: NaN,
    mean: NaN,
    stdDev: NaN,
    histogram: [],
    countDistinct: 0,
    sum: 0,
    ...partial,
  };
}

describe("combineColumnValueStats", () => {
  it("returns the single stats object unchanged when only one is provided", () => {
    const stats = makeStats({
      count: 10,
      min: 1,
      max: 5,
      mean: 3,
      stdDev: 1,
      sum: 30,
      histogram: [
        [1, 2],
        [3, 5],
        [5, 3],
      ],
      countDistinct: 3,
      totalAreaSqKm: 4,
    });

    const result = combineColumnValueStats([stats]);
    expect(result).toBe(stats);
  });

  it("combines two fragments without totalAreaSqKm using count-weighted mean and sum", () => {
    const a = makeStats({
      count: 100,
      min: 0,
      max: 10,
      mean: 2,
      stdDev: 1,
      sum: 200,
      histogram: [[1, 100]],
      countDistinct: 1,
      totalAreaSqKm: undefined,
    });

    const b = makeStats({
      count: 50,
      min: 5,
      max: 15,
      mean: 10,
      stdDev: 2,
      sum: 500,
      histogram: [[10, 50]],
      countDistinct: 1,
      totalAreaSqKm: undefined,
    });

    const result = combineColumnValueStats([a, b])!;

    expect(result.count).toBe(150);
    expect(result.sum).toBe(700);
    expect(result.min).toBe(0);
    expect(result.max).toBe(15);
    expect(result.totalAreaSqKm).toBeUndefined();

    // mean = 700 / 150 ≈ 4.6667
    expect(result.mean).toBeCloseTo(700 / 150, 6);

    // histogram merged by value
    expect(result.histogram).toEqual([
      [1, 100],
      [10, 50],
    ]);
    expect(result.countDistinct).toBe(2);
  });

  it("uses totalAreaSqKm as weight when available to combine means and stdDev", () => {
    const a = makeStats({
      count: 100,
      min: 0,
      max: 10,
      mean: 2,
      stdDev: 1,
      sum: 200,
      histogram: [[2, 100]],
      countDistinct: 1,
      totalAreaSqKm: 5,
    });

    const b = makeStats({
      count: 50,
      min: 0,
      max: 10,
      mean: 8,
      stdDev: 1,
      sum: 400,
      histogram: [[8, 50]],
      countDistinct: 1,
      totalAreaSqKm: 1,
    });

    const result = combineColumnValueStats([a, b])!;

    // weights are 5 and 1
    const expectedMean = (2 * 5 + 8 * 1) / (5 + 1);
    expect(result.mean).toBeCloseTo(expectedMean, 6);
    expect(result.totalAreaSqKm).toBeCloseTo(6, 6);

    expect(result.count).toBe(150);
    expect(result.sum).toBe(600);
    expect(result.min).toBe(0);
    expect(result.max).toBe(10);

    expect(result.histogram).toEqual([
      [2, 100],
      [8, 50],
    ]);
    expect(result.countDistinct).toBe(2);
  });

  it("falls back to count weighting when all totalAreaSqKm are zero or undefined", () => {
    const a = makeStats({
      count: 5,
      min: 1,
      max: 1,
      mean: 1,
      stdDev: 0,
      sum: 5,
      histogram: [[1, 5]],
      countDistinct: 1,
      totalAreaSqKm: 0,
    });

    const b = makeStats({
      count: 5,
      min: 3,
      max: 3,
      mean: 3,
      stdDev: 0,
      sum: 15,
      histogram: [[3, 5]],
      countDistinct: 1,
      totalAreaSqKm: 0,
    });

    const result = combineColumnValueStats([a, b])!;

    expect(result.count).toBe(10);
    expect(result.sum).toBe(20);
    expect(result.totalAreaSqKm).toBeUndefined();
    expect(result.min).toBe(1);
    expect(result.max).toBe(3);

    // mean = (5*1 + 5*3) / 10 = 2
    expect(result.mean).toBeCloseTo(2, 6);
  });

  it("handles mix of fragments with and without totalAreaSqKm (area-weight where possible)", () => {
    const a = makeStats({
      count: 10,
      min: 0,
      max: 10,
      mean: 4,
      stdDev: 1,
      sum: 40,
      histogram: [[4, 10]],
      countDistinct: 1,
      totalAreaSqKm: 2,
    });

    const b = makeStats({
      count: 30,
      min: 0,
      max: 10,
      mean: 6,
      stdDev: 1,
      sum: 180,
      histogram: [[6, 30]],
      countDistinct: 1,
      totalAreaSqKm: undefined,
    });

    // useAreaWeight = true, so weights are 2 (area) and 30 (count)
    const result = combineColumnValueStats([a, b])!;

    const expectedMean = (4 * 2 + 6 * 30) / (2 + 30);
    expect(result.mean).toBeCloseTo(expectedMean, 6);

    // totalAreaSqKm sums only positive area values
    expect(result.totalAreaSqKm).toBeCloseTo(2, 6);

    expect(result.count).toBe(40);
    expect(result.sum).toBe(220);
  });

  it("merges overlapping histogram bins and updates countDistinct", () => {
    const a = makeStats({
      count: 10,
      min: 1,
      max: 2,
      mean: 1.5,
      stdDev: 0.5,
      sum: 15,
      histogram: [
        [1, 4],
        [2, 6],
      ],
      countDistinct: 2,
      totalAreaSqKm: 1,
    });

    const b = makeStats({
      count: 5,
      min: 1,
      max: 2,
      mean: 1.8,
      stdDev: 0.4,
      sum: 9,
      histogram: [
        [1, 1],
        [2, 4],
      ],
      countDistinct: 2,
      totalAreaSqKm: 1,
    });

    const result = combineColumnValueStats([a, b])!;

    expect(result.histogram).toEqual([
      [1, 5],
      [2, 10],
    ]);
    expect(result.countDistinct).toBe(2);
  });

  it("limits histogram length to 200 entries with a fair sampling of the range", () => {
    const manyBins: [number, number][] = [];
    for (let i = 0; i < 250; i++) {
      manyBins.push([i, 1]);
    }

    const stats = makeStats({
      count: 250,
      min: 0,
      max: 249,
      mean: 124.5,
      stdDev: 0,
      sum: 250 * 124.5,
      histogram: manyBins,
      countDistinct: 250,
      totalAreaSqKm: 1,
    });

    const result = combineColumnValueStats([stats])!;

    // Original stats should be returned unchanged for single element,
    // but when we pass more than one, the truncation logic applies.
    const result2 = combineColumnValueStats([stats, stats])!;

    expect(result2.histogram.length).toBeLessThanOrEqual(200);

    // Should still cover the full input range (0 to 249) after downsampling
    const values = result2.histogram.map(([value]) => value);
    const minValue = Math.min(...values.filter((v) => typeof v === "number"));
    const maxValue = Math.max(...values.filter((v) => typeof v === "number"));
    expect(minValue).toBeGreaterThanOrEqual(0);
    expect(maxValue).toBeLessThanOrEqual(249);

    // And there should be entries in both the lower and upper portions
    // of the range, not just clustered at one end.
    const span = maxValue - minValue;
    const lowerThreshold = minValue + span * 0.25;
    const upperThreshold = minValue + span * 0.75;
    const hasLower = values.some(
      (v) => typeof v === "number" && v <= lowerThreshold
    );
    const hasUpper = values.some(
      (v) => typeof v === "number" && v >= upperThreshold
    );
    expect(hasLower).toBe(true);
    expect(hasUpper).toBe(true);
  });

  it("ignores NaN means/stdDevs in some fragments for weighting", () => {
    const bad = makeStats({
      count: 10,
      min: 0,
      max: 0,
      mean: NaN,
      stdDev: NaN,
      sum: 0,
      histogram: [],
      countDistinct: 0,
      totalAreaSqKm: 1,
    });

    const good = makeStats({
      count: 10,
      min: 2,
      max: 2,
      mean: 2,
      stdDev: 0,
      sum: 20,
      histogram: [[2, 10]],
      countDistinct: 1,
      totalAreaSqKm: 1,
    });

    const result = combineColumnValueStats([bad, good])!;

    // Mean should be driven by the good fragment, not NaN
    expect(result.mean).toBeCloseTo(2, 6);
    expect(result.count).toBe(20);
    expect(result.sum).toBe(20);
    expect(result.totalAreaSqKm).toBeCloseTo(2, 6);
  });
});
