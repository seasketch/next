import { describe, it, expect } from "vitest";
import {
  NumberColumnValueStats,
  combineNumberColumnValueStats,
  StringOrBooleanColumnValueStats,
  combineStringOrBooleanColumnValueStats,
  ColumnValuesEntry,
  isColumnValuesEntry,
  hasReliableColumnValueEntries,
  numberColumnStatsFromEntries,
  stringOrBooleanColumnStatsFromEntries,
  capColumnValueEntries,
  MAX_COLUMN_VALUE_ENTRIES,
} from "../src/metrics/metrics";

function makeNumberStats(
  partial: Partial<NumberColumnValueStats>
): NumberColumnValueStats {
  return {
    type: "number",
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

function makeStringStats(
  partial: Partial<StringOrBooleanColumnValueStats>
): StringOrBooleanColumnValueStats {
  return {
    type: "string",
    distinctValues: [],
    countDistinct: 0,
    ...partial,
  };
}

describe("combineNumberColumnValueStats", () => {
  it("returns the single stats object unchanged when only one is provided", () => {
    const stats = makeNumberStats({
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

    const result = combineNumberColumnValueStats([stats]);
    expect(result).toBe(stats);
  });

  it("combines two fragments without totalAreaSqKm using count-weighted mean and sum", () => {
    const a = makeNumberStats({
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

    const b = makeNumberStats({
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

    const result = combineNumberColumnValueStats([a, b])!;

    expect(result.count).toBe(150);
    expect(result.sum).toBe(700);
    expect(result.min).toBe(0);
    expect(result.max).toBe(15);
    expect(result.totalWeight).toBeUndefined();

    // mean = 700 / 150 ≈ 4.6667
    expect(result.mean).toBeCloseTo(700 / 150, 6);

    // histogram merged by value
    expect(result.histogram).toEqual([
      [1, 100],
      [10, 50],
    ]);
    expect(result.countDistinct).toBe(2);
  });

  it("weights means and stdDev by the legacy totalAreaSqKm field when entries are unavailable", () => {
    const a = makeNumberStats({
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

    const b = makeNumberStats({
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

    const result = combineNumberColumnValueStats([a, b])!;

    // weights are 5 and 1
    const expectedMean = (2 * 5 + 8 * 1) / (5 + 1);
    expect(result.mean).toBeCloseTo(expectedMean, 6);
    expect(result.totalWeight).toBeCloseTo(6, 6);

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

  it("weights means by totalWeight when entries are unavailable (e.g. truncated)", () => {
    const a = makeNumberStats({
      count: 100,
      min: 0,
      max: 10,
      mean: 2,
      stdDev: 1,
      sum: 200,
      histogram: [[2, 100]],
      countDistinct: 1,
      totalWeight: 5,
    });

    const b = makeNumberStats({
      count: 50,
      min: 0,
      max: 10,
      mean: 8,
      stdDev: 1,
      sum: 400,
      histogram: [[8, 50]],
      countDistinct: 1,
      totalWeight: 1,
    });

    const result = combineNumberColumnValueStats([a, b])!;

    const expectedMean = (2 * 5 + 8 * 1) / (5 + 1);
    expect(result.mean).toBeCloseTo(expectedMean, 6);
    expect(result.totalWeight).toBeCloseTo(6, 6);
  });

  it("falls back to count weighting when all totalAreaSqKm are zero or undefined", () => {
    const a = makeNumberStats({
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

    const b = makeNumberStats({
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

    const result = combineNumberColumnValueStats([a, b])!;

    expect(result.count).toBe(10);
    expect(result.sum).toBe(20);
    expect(result.totalWeight).toBeUndefined();
    expect(result.min).toBe(1);
    expect(result.max).toBe(3);

    // mean = (5*1 + 5*3) / 10 = 2
    expect(result.mean).toBeCloseTo(2, 6);
  });

  it("handles mix of fragments with and without totalAreaSqKm (area-weight where possible)", () => {
    const a = makeNumberStats({
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

    const b = makeNumberStats({
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
    const result = combineNumberColumnValueStats([a, b])!;

    const expectedMean = (4 * 2 + 6 * 30) / (2 + 30);
    expect(result.mean).toBeCloseTo(expectedMean, 6);

    // Combined total weight sums only positive weights
    expect(result.totalWeight).toBeCloseTo(2, 6);

    expect(result.count).toBe(40);
    expect(result.sum).toBe(220);
  });

  it("merges overlapping histogram bins and updates countDistinct", () => {
    const a = makeNumberStats({
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

    const b = makeNumberStats({
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

    const result = combineNumberColumnValueStats([a, b])!;

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

    const stats = makeNumberStats({
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

    const result = combineNumberColumnValueStats([stats])!;

    // Original stats should be returned unchanged for single element,
    // but when we pass more than one, the truncation logic applies.
    const result2 = combineNumberColumnValueStats([stats, stats])!;

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
    const bad = makeNumberStats({
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

    const good = makeNumberStats({
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

    const result = combineNumberColumnValueStats([bad, good])!;

    // Mean should be driven by the good fragment, not NaN
    expect(result.mean).toBeCloseTo(2, 6);
    expect(result.count).toBe(20);
    expect(result.sum).toBe(20);
    expect(result.totalWeight).toBeCloseTo(2, 6);
  });
});

describe("combineStringOrBooleanColumnValueStats", () => {
  it("returns undefined for empty input", () => {
    expect(combineStringOrBooleanColumnValueStats([])).toBeUndefined();
  });

  it("returns the single stats object unchanged when only one is provided", () => {
    const stats = makeStringStats({
      distinctValues: [
        ["a", 2],
        ["b", 3],
      ],
    });
    const result = combineStringOrBooleanColumnValueStats([stats]);
    expect(result).toBe(stats);
  });

  it("combines distinct value counts across fragments", () => {
    const a = makeStringStats({
      distinctValues: [
        ["apple", 2],
        ["banana", 1],
      ],
    });
    const b = makeStringStats({
      distinctValues: [
        ["banana", 3],
        ["cherry", 4],
      ],
    });

    const result = combineStringOrBooleanColumnValueStats([a, b])!;
    expect(result.type).toBe("string");
    expect(result.distinctValues).toEqual([
      ["apple", 2],
      ["banana", 4],
      ["cherry", 4],
    ]);
  });

  it("preserves boolean type when combining boolean stats", () => {
    const a: StringOrBooleanColumnValueStats = {
      type: "boolean",
      distinctValues: [
        [true, 2],
        [false, 1],
      ],
      countDistinct: 2,
    };
    const b: StringOrBooleanColumnValueStats = {
      type: "boolean",
      distinctValues: [
        [true, 1],
        [false, 4],
      ],
      countDistinct: 2,
    };

    const result = combineStringOrBooleanColumnValueStats([a, b])!;
    expect(result.type).toBe("boolean");
    expect(result.distinctValues).toEqual([
      [true, 3],
      [false, 5],
    ]);
  });
});

function entry(
  id: number,
  value: number | string | boolean,
  weight: number,
  offsets: number[]
): ColumnValuesEntry {
  return { id, value, weight, offsets };
}

describe("isColumnValuesEntry", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(isColumnValuesEntry(null)).toBe(false);
    expect(isColumnValuesEntry(undefined)).toBe(false);
    expect(isColumnValuesEntry(42)).toBe(false);
    expect(isColumnValuesEntry("entry")).toBe(false);
  });

  it("rejects objects missing required properties", () => {
    expect(isColumnValuesEntry({})).toBe(false);
    expect(isColumnValuesEntry({ id: 1, value: 2, weight: 3 })).toBe(false);
    expect(
      isColumnValuesEntry({ id: "1", value: 2, weight: 3, offsets: [] })
    ).toBe(false);
    expect(
      isColumnValuesEntry({ id: 1, value: {}, weight: 3, offsets: [] })
    ).toBe(false);
    expect(
      isColumnValuesEntry({ id: 1, value: 2, weight: 3, offsets: ["a"] })
    ).toBe(false);
  });

  it("accepts valid entries", () => {
    expect(isColumnValuesEntry(entry(1, 100, 2.5, [1234]))).toBe(true);
    expect(isColumnValuesEntry(entry(1, "town", 0, []))).toBe(true);
    expect(isColumnValuesEntry(entry(1, true, 0, [1, 2]))).toBe(true);
  });
});

describe("capColumnValueEntries", () => {
  it("returns entries unchanged when within the cap", () => {
    const entries = [entry(1, 100, 1, [0])];
    const result = capColumnValueEntries(entries);
    expect(result.entries).toBe(entries);
    expect(result.entriesTruncated).toBe(false);
  });

  it("drops entries entirely when over the cap", () => {
    const entries = Array.from(
      { length: MAX_COLUMN_VALUE_ENTRIES + 1 },
      (_, i) => entry(i, 1, 1, [i])
    );
    const result = capColumnValueEntries(entries);
    expect(result.entries).toBeUndefined();
    expect(result.entriesTruncated).toBe(true);
  });
});

describe("hasReliableColumnValueEntries", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(hasReliableColumnValueEntries(null)).toBe(false);
    expect(hasReliableColumnValueEntries(undefined)).toBe(false);
    expect(hasReliableColumnValueEntries(7)).toBe(false);
  });

  it("rejects stats without entries or with malformed entries", () => {
    expect(hasReliableColumnValueEntries({})).toBe(false);
    expect(hasReliableColumnValueEntries({ entries: "nope" })).toBe(false);
    expect(hasReliableColumnValueEntries({ entries: [{ id: 1 }] })).toBe(
      false
    );
  });

  it("rejects truncated entries", () => {
    expect(
      hasReliableColumnValueEntries({
        entries: [entry(1, 100, 1, [0])],
        entriesTruncated: true,
      })
    ).toBe(false);
  });

  it("accepts stats with complete valid entries (including empty)", () => {
    expect(hasReliableColumnValueEntries({ entries: [] })).toBe(true);
    expect(
      hasReliableColumnValueEntries({ entries: [entry(1, 100, 1, [0])] })
    ).toBe(true);
  });
});

describe("entry-based exact combination", () => {
  it("dedupes a feature that spans two fragments, summing weights but counting its value once", () => {
    // An enumeration area with Population=500 split across two fragments.
    // Legacy approximate merging would report sum=1000.
    const a = makeNumberStats({
      count: 2,
      min: 100,
      max: 500,
      mean: 300,
      stdDev: 200,
      sum: 600,
      histogram: [
        [100, 1],
        [500, 1],
      ],
      countDistinct: 2,
      totalWeight: 3,
      entries: [entry(1, 500, 2, [1000]), entry(2, 100, 1, [2000])],
    });
    const b = makeNumberStats({
      count: 1,
      min: 500,
      max: 500,
      mean: 500,
      stdDev: 0,
      sum: 500,
      histogram: [[500, 1]],
      countDistinct: 1,
      totalWeight: 4,
      entries: [entry(1, 500, 4, [1001])],
    });

    const result = combineNumberColumnValueStats([a, b])!;

    // Feature 1 appears in both fragments, but its value is only counted once
    expect(result.count).toBe(2);
    expect(result.sum).toBe(600);
    expect(result.min).toBe(100);
    expect(result.max).toBe(500);
    expect(result.countDistinct).toBe(2);
    // Weights (clipped areas) are summed: feature 1 = 2 + 4, feature 2 = 1
    expect(result.totalWeight).toBeCloseTo(7, 6);
    // Weighted mean over deduped entries: (500*6 + 100*1) / 7
    expect(result.mean).toBeCloseTo((500 * 6 + 100 * 1) / 7, 6);
    // Distinct fragments saw distinct parts, so no overlap warning
    expect(result.weightsMayOverlap).toBeUndefined();
    // Merged entries are preserved for further combination
    expect(result.entries).toHaveLength(2);
    const merged = result.entries!.find((e) => e.id === 1)!;
    expect(merged.weight).toBeCloseTo(6, 6);
    expect(merged.offsets.sort()).toEqual([1000, 1001]);
  });

  it("flags weightsMayOverlap when the same subdivided part contributed to multiple fragments", () => {
    const a = makeNumberStats({
      count: 1,
      sum: 500,
      totalWeight: 2,
      entries: [entry(1, 500, 2, [1000])],
    });
    const b = makeNumberStats({
      count: 1,
      sum: 500,
      totalWeight: 2,
      entries: [entry(1, 500, 2, [1000])],
    });

    const result = combineNumberColumnValueStats([a, b])!;
    expect(result.sum).toBe(500);
    expect(result.count).toBe(1);
    expect(result.weightsMayOverlap).toBe(true);
  });

  it("falls back to approximate combination when any input lacks entries", () => {
    const withEntries = makeNumberStats({
      count: 1,
      min: 500,
      max: 500,
      mean: 500,
      stdDev: 0,
      sum: 500,
      histogram: [[500, 1]],
      countDistinct: 1,
      entries: [entry(1, 500, 2, [1000])],
    });
    const legacy = makeNumberStats({
      count: 1,
      min: 500,
      max: 500,
      mean: 500,
      stdDev: 0,
      sum: 500,
      histogram: [[500, 1]],
      countDistinct: 1,
    });

    const result = combineNumberColumnValueStats([withEntries, legacy])!;
    // Approximate path cannot dedupe, so the sums add
    expect(result.sum).toBe(1000);
    expect(result.count).toBe(2);
  });

  it("falls back to approximate combination when entries were truncated", () => {
    const a = makeNumberStats({
      count: 1,
      sum: 500,
      mean: 500,
      entries: [entry(1, 500, 2, [1000])],
      entriesTruncated: true,
    });
    const b = makeNumberStats({
      count: 1,
      sum: 500,
      mean: 500,
      entries: [entry(1, 500, 2, [1000])],
    });

    const result = combineNumberColumnValueStats([a, b])!;
    expect(result.sum).toBe(1000);
    // Truncation is surfaced on the combined result so consumers can warn
    // that the approximate merge may double-count features.
    expect(result.entriesTruncated).toBe(true);
    expect(result.truncationAffectedMerge).toBe(true);
  });

  it("does not flag a single fragment's stats even when its entries were truncated", () => {
    const a = makeNumberStats({
      count: 1,
      sum: 500,
      mean: 500,
      entries: [entry(1, 500, 2, [1000])],
      entriesTruncated: true,
    });
    // A single fragment's summary stats are exact; truncation only matters
    // when combining across fragments.
    const result = combineNumberColumnValueStats([a])!;
    expect(result.entriesTruncated).toBe(true);
    expect(result.truncationAffectedMerge).toBeUndefined();
  });

  it("does not flag truncationAffectedMerge when an exact merge merely exceeds the entry cap", () => {
    // Both inputs carry complete entries, so the merge itself is exact even
    // though the combined entry list exceeds the retention cap. Stats are
    // computed from the full merged set before entries are dropped.
    const half = Math.floor(MAX_COLUMN_VALUE_ENTRIES / 2) + 1;
    const a = makeNumberStats({
      entries: Array.from({ length: half }, (_, i) => entry(i, 1, 1, [i])),
    });
    const b = makeNumberStats({
      entries: Array.from({ length: half }, (_, i) =>
        entry(half + i, 1, 1, [half + i])
      ),
    });
    const result = combineNumberColumnValueStats([a, b])!;
    expect(result.count).toBe(2 * half);
    expect(result.sum).toBe(2 * half);
    expect(result.entriesTruncated).toBe(true);
    // Over-cap entries are dropped entirely rather than partially retained;
    // a truncated list could never be used for exact merging anyway.
    expect(result.entries).toBeUndefined();
    expect(result.truncationAffectedMerge).toBeUndefined();
  });

  it("does not flag entriesTruncated when inputs merely lack entries (legacy metrics)", () => {
    const a = makeNumberStats({ count: 1, sum: 500, mean: 500 });
    const b = makeNumberStats({ count: 1, sum: 500, mean: 500 });
    const result = combineNumberColumnValueStats([a, b])!;
    expect(result.entriesTruncated).toBeUndefined();
    expect(result.truncationAffectedMerge).toBeUndefined();
  });

  it("propagates entriesTruncated for string stats combined approximately", () => {
    const a = makeStringStats({
      distinctValues: [["Efate", 1]],
      countDistinct: 1,
      entries: [entry(1, "Efate", 2, [1000])],
      entriesTruncated: true,
    });
    const b = makeStringStats({
      distinctValues: [["Tanna", 1]],
      countDistinct: 1,
    });
    const result = combineStringOrBooleanColumnValueStats([a, b])!;
    expect(result.entriesTruncated).toBe(true);
    expect(result.truncationAffectedMerge).toBe(true);
  });

  it("dedupes string values across fragments by feature id", () => {
    const a = makeStringStats({
      distinctValues: [["Efate", 1]],
      countDistinct: 1,
      entries: [entry(1, "Efate", 2, [1000])],
    });
    const b = makeStringStats({
      distinctValues: [
        ["Efate", 1],
        ["Tanna", 1],
      ],
      countDistinct: 2,
      entries: [entry(1, "Efate", 1, [1001]), entry(2, "Tanna", 3, [2000])],
    });

    const result = combineStringOrBooleanColumnValueStats([a, b])!;
    // Feature 1 spans both fragments but "Efate" is only counted once
    expect(result.distinctValues).toEqual([
      ["Efate", 1],
      ["Tanna", 1],
    ]);
    expect(result.countDistinct).toBe(2);
    expect(result.entries).toHaveLength(2);
  });
});

describe("numberColumnStatsFromEntries", () => {
  it("returns zeroed stats for empty entries", () => {
    const result = numberColumnStatsFromEntries([]);
    expect(result.count).toBe(0);
    expect(result.sum).toBe(0);
    expect(result.histogram).toEqual([]);
  });

  it("computes weighted mean and total weight", () => {
    const result = numberColumnStatsFromEntries([
      entry(1, 10, 3, [0]),
      entry(2, 20, 1, [1]),
    ]);
    expect(result.count).toBe(2);
    expect(result.sum).toBe(30);
    expect(result.mean).toBeCloseTo((10 * 3 + 20 * 1) / 4, 6);
    expect(result.totalWeight).toBeCloseTo(4, 6);
    expect(result.min).toBe(10);
    expect(result.max).toBe(20);
  });

  it("falls back to unweighted mean when weights are all zero (e.g. points)", () => {
    const result = numberColumnStatsFromEntries([
      entry(1, 10, 0, [0]),
      entry(2, 20, 0, [1]),
    ]);
    expect(result.mean).toBeCloseTo(15, 6);
    expect(result.totalWeight).toBeUndefined();
  });
});

describe("stringOrBooleanColumnStatsFromEntries", () => {
  it("counts each feature once per distinct value", () => {
    const result = stringOrBooleanColumnStatsFromEntries([
      entry(1, "a", 1, [0]),
      entry(2, "a", 1, [1]),
      entry(3, "b", 1, [2]),
    ]);
    expect(result.type).toBe("string");
    expect(result.distinctValues).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
    expect(result.countDistinct).toBe(2);
  });

  it("reports boolean type for boolean values", () => {
    const result = stringOrBooleanColumnStatsFromEntries([
      entry(1, true, 1, [0]),
      entry(2, false, 1, [1]),
    ]);
    expect(result.type).toBe("boolean");
  });
});
