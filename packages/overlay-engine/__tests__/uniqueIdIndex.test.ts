import {
  createUniqueIdIndex,
  countUniqueIds,
  mergeUniqueIdIndexes,
} from "../src/utils/uniqueIdIndex";
import { UniqueIdIndex } from "../src/metrics/metrics";

describe("createUniqueIdIndex", () => {
  it("should handle empty input", () => {
    const result = createUniqueIdIndex([]);
    expect(result).toEqual({ ranges: [], individuals: [] });
  });

  it("should handle empty Set", () => {
    const result = createUniqueIdIndex(new Set());
    expect(result).toEqual({ ranges: [], individuals: [] });
  });

  it("should handle single ID", () => {
    const result = createUniqueIdIndex([5]);
    expect(result).toEqual({ ranges: [], individuals: [5] });
  });

  it("should create a range for consecutive IDs", () => {
    const result = createUniqueIdIndex([1, 2, 3, 4, 5]);
    expect(result).toEqual({
      ranges: [[1, 5]],
      individuals: [],
    });
  });

  it("should create individuals for non-consecutive IDs", () => {
    const result = createUniqueIdIndex([1, 5, 10, 20]);
    expect(result).toEqual({
      ranges: [],
      individuals: [1, 5, 10, 20],
    });
  });

  it("should handle mixed ranges and individuals", () => {
    const result = createUniqueIdIndex([1, 2, 3, 7, 10, 11, 12, 15]);
    expect(result).toEqual({
      ranges: [
        [1, 3],
        [10, 12],
      ],
      individuals: [7, 15],
    });
  });

  it("should remove duplicates", () => {
    const result = createUniqueIdIndex([1, 2, 2, 3, 3, 3, 4]);
    expect(result).toEqual({
      ranges: [[1, 4]],
      individuals: [],
    });
  });

  it("should handle unsorted input", () => {
    const result = createUniqueIdIndex([5, 1, 3, 2, 4]);
    expect(result).toEqual({
      ranges: [[1, 5]],
      individuals: [],
    });
  });

  it("should handle Set input", () => {
    const result = createUniqueIdIndex(new Set([1, 2, 3, 5, 7]));
    expect(result).toEqual({
      ranges: [[1, 3]],
      individuals: [5, 7],
    });
  });

  it("should handle large consecutive range", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => i + 1);
    const result = createUniqueIdIndex(ids);
    expect(result).toEqual({
      ranges: [[1, 1000]],
      individuals: [],
    });
  });


  it("should handle single-element ranges correctly", () => {
    // Single IDs should be stored as individuals, not ranges
    const result = createUniqueIdIndex([1, 3, 5]);
    expect(result.ranges).toEqual([]);
    expect(result.individuals).toEqual([1, 3, 5]);
  });

  it("should handle gaps in ranges", () => {
    const result = createUniqueIdIndex([1, 2, 3, 10, 11, 12, 20, 21, 22]);
    expect(result).toEqual({
      ranges: [
        [1, 3],
        [10, 12],
        [20, 22],
      ],
      individuals: [],
    });
  });

  it("should handle very large numbers", () => {
    const result = createUniqueIdIndex([
      1000000, 1000001, 1000002, 2000000,
    ]);
    expect(result).toEqual({
      ranges: [[1000000, 1000002]],
      individuals: [2000000],
    });
  });

  it("should handle negative numbers", () => {
    const result = createUniqueIdIndex([-5, -4, -3, -1]);
    expect(result).toEqual({
      ranges: [[-5, -3]],
      individuals: [-1],
    });
  });

  it("should handle zero", () => {
    const result = createUniqueIdIndex([0, 1, 2, 4]);
    expect(result).toEqual({
      ranges: [[0, 2]],
      individuals: [4],
    });
  });
});

describe("countUniqueIds", () => {
  it("should return 0 for empty index", () => {
    const index: UniqueIdIndex = { ranges: [], individuals: [] };
    expect(countUniqueIds(index)).toBe(0);
  });

  it("should count ranges correctly", () => {
    const index: UniqueIdIndex = {
      ranges: [
        [1, 5],
        [10, 12],
      ],
      individuals: [],
    };
    // (5-1+1) + (12-10+1) = 5 + 3 = 8
    expect(countUniqueIds(index)).toBe(8);
  });

  it("should count individuals correctly", () => {
    const index: UniqueIdIndex = {
      ranges: [],
      individuals: [1, 5, 10, 20],
    };
    expect(countUniqueIds(index)).toBe(4);
  });

  it("should count mixed ranges and individuals", () => {
    const index: UniqueIdIndex = {
      ranges: [
        [1, 3],
        [10, 12],
      ],
      individuals: [7, 15],
    };
    // (3-1+1) + (12-10+1) + 2 = 3 + 3 + 2 = 8
    expect(countUniqueIds(index)).toBe(8);
  });

  it("should handle single-element ranges", () => {
    const index: UniqueIdIndex = {
      ranges: [[5, 5]],
      individuals: [],
    };
    expect(countUniqueIds(index)).toBe(1);
  });

  it("should handle large ranges", () => {
    const index: UniqueIdIndex = {
      ranges: [[1, 100000]],
      individuals: [],
    };
    expect(countUniqueIds(index)).toBe(100000);
  });

  it("should handle many ranges", () => {
    const index: UniqueIdIndex = {
      ranges: [
        [1, 10],
        [20, 30],
        [40, 50],
      ],
      individuals: [],
    };
    // 10 + 11 + 11 = 32
    expect(countUniqueIds(index)).toBe(32);
  });
});

describe("mergeUniqueIdIndexes", () => {
  it("should handle empty input", () => {
    const result = mergeUniqueIdIndexes();
    expect(result).toEqual({ ranges: [], individuals: [] });
  });

  it("should return single index unchanged", () => {
    const index: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [10],
    };
    const result = mergeUniqueIdIndexes(index);
    expect(result).toEqual(index);
  });

  it("should merge non-overlapping indexes", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [],
    };
    const index2: UniqueIdIndex = {
      ranges: [[10, 15]],
      individuals: [],
    };
    const result = mergeUniqueIdIndexes(index1, index2);
    expect(result).toEqual({
      ranges: [
        [1, 5],
        [10, 15],
      ],
      individuals: [],
    });
  });

  it("should merge overlapping ranges", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [],
    };
    const index2: UniqueIdIndex = {
      ranges: [[3, 8]],
      individuals: [],
    };
    const result = mergeUniqueIdIndexes(index1, index2);
    expect(result).toEqual({
      ranges: [[1, 8]],
      individuals: [],
    });
  });

  it("should merge adjacent ranges", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [],
    };
    const index2: UniqueIdIndex = {
      ranges: [[6, 10]],
      individuals: [],
    };
    const result = mergeUniqueIdIndexes(index1, index2);
    expect(result).toEqual({
      ranges: [[1, 10]],
      individuals: [],
    });
  });

  it("should merge individuals that become ranges", () => {
    const index1: UniqueIdIndex = {
      ranges: [],
      individuals: [1, 3],
    };
    const index2: UniqueIdIndex = {
      ranges: [],
      individuals: [2],
    };
    const result = mergeUniqueIdIndexes(index1, index2);
    expect(result).toEqual({
      ranges: [[1, 3]],
      individuals: [],
    });
  });

  it("should remove duplicate IDs", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [10],
    };
    const index2: UniqueIdIndex = {
      ranges: [[3, 7]],
      individuals: [10, 15],
    };
    const result = mergeUniqueIdIndexes(index1, index2);
    // Ranges [1,5] and [3,7] merge to [1,7]
    // Individuals [10] and [10,15] deduplicate to [10,15]
    // 10 is not adjacent to 7, so it remains as individual
    expect(result).toEqual({
      ranges: [[1, 7]],
      individuals: [10, 15],
    });
  });

  it("should merge multiple indexes", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [10],
    };
    const index2: UniqueIdIndex = {
      ranges: [[7, 9]],
      individuals: [12],
    };
    const index3: UniqueIdIndex = {
      ranges: [[4, 8]],
      individuals: [11],
    };
    const result = mergeUniqueIdIndexes(index1, index2, index3);
    // Should merge [1,5], [4,8], [7,9] into [1,9]
    // And merge individuals 10, 11, 12 - but 10 and 11 are adjacent to range, so they become part of range
    // Actually, let me think: [1,5] and [4,8] merge to [1,8], then [7,9] merges to [1,9]
    // Individual 10 is adjacent to 9, so becomes [1,10]
    // Individual 11 is adjacent to 10, so becomes [1,11]
    // Individual 12 is adjacent to 11, so becomes [1,12]
    expect(result).toEqual({
      ranges: [[1, 12]],
      individuals: [],
    });
  });

  it("should handle individuals that bridge gaps", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [],
    };
    const index2: UniqueIdIndex = {
      ranges: [],
      individuals: [6, 7],
    };
    const index3: UniqueIdIndex = {
      ranges: [[8, 10]],
      individuals: [],
    };
    const result = mergeUniqueIdIndexes(index1, index2, index3);
    // [1,5] + [6,7] + [8,10] should merge to [1,10]
    expect(result).toEqual({
      ranges: [[1, 10]],
      individuals: [],
    });
  });

  it("should handle complex merging scenario", () => {
    const index1: UniqueIdIndex = {
      ranges: [
        [1, 3],
        [10, 12],
      ],
      individuals: [20],
    };
    const index2: UniqueIdIndex = {
      ranges: [[2, 4]],
      individuals: [11, 21],
    };
    const index3: UniqueIdIndex = {
      ranges: [],
      individuals: [5, 6, 7],
    };
    const result = mergeUniqueIdIndexes(index1, index2, index3);
    // [1,3] + [2,4] = [1,4]
    // [5,6,7] = [5,7] (becomes a range)
    // [1,4] and [5,7] are adjacent (4 and 5), so merge to [1,7]
    // [10,12] + [11] = [10,12] (11 is already in range)
    // [20] + [21] = [20,21] (becomes a range)
    expect(result).toEqual({
      ranges: [
        [1, 7],
        [10, 12],
        [20, 21],
      ],
      individuals: [],
    });
  });

  it("should handle many indexes", () => {
    const indexes: UniqueIdIndex[] = [];
    for (let i = 0; i < 10; i++) {
      indexes.push({
        ranges: [[i * 10, i * 10 + 2]],
        individuals: [i * 10 + 5],
      });
    }
    const result = mergeUniqueIdIndexes(...indexes);
    // Each index has: range [i*10, i*10+2] (3 IDs) and individual [i*10+5] (1 ID)
    // For i=0: [0,2] and [5] - these merge to [0,5] (adjacent: 2 and 5 are not adjacent, but 2,3,4,5... wait, 5 is not in range [0,2])
    // Actually: [0,2] = IDs 0,1,2. Individual 5. These don't merge (2 and 5 are not adjacent)
    // So we have 10 ranges of 3 IDs each = 30, plus 10 individuals = 10, total = 40
    expect(result.ranges.length).toBeGreaterThan(0);
    expect(countUniqueIds(result)).toBe(40); // 10 ranges of 3 each (30) + 10 individuals (10) = 40
  });

  it("should handle empty indexes in merge", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [],
    };
    const index2: UniqueIdIndex = {
      ranges: [],
      individuals: [],
    };
    const index3: UniqueIdIndex = {
      ranges: [[10, 15]],
      individuals: [],
    };
    const result = mergeUniqueIdIndexes(index1, index2, index3);
    expect(result).toEqual({
      ranges: [
        [1, 5],
        [10, 15],
      ],
      individuals: [],
    });
  });

  it("should merge individuals into existing ranges when adjacent", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [],
    };
    const index2: UniqueIdIndex = {
      ranges: [],
      individuals: [6, 7, 8],
    };
    const result = mergeUniqueIdIndexes(index1, index2);
    expect(result).toEqual({
      ranges: [[1, 8]],
      individuals: [],
    });
  });

  it("should handle completely overlapping ranges", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 10]],
      individuals: [],
    };
    const index2: UniqueIdIndex = {
      ranges: [[3, 7]],
      individuals: [],
    };
    const result = mergeUniqueIdIndexes(index1, index2);
    expect(result).toEqual({
      ranges: [[1, 10]],
      individuals: [],
    });
  });

  it("should handle ranges that are subsets", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 100]],
      individuals: [],
    };
    const index2: UniqueIdIndex = {
      ranges: [[50, 60]],
      individuals: [],
    };
    const result = mergeUniqueIdIndexes(index1, index2);
    expect(result).toEqual({
      ranges: [[1, 100]],
      individuals: [],
    });
  });

  it("should preserve count after merging", () => {
    const index1: UniqueIdIndex = {
      ranges: [[1, 5]],
      individuals: [10, 11],
    };
    const index2: UniqueIdIndex = {
      ranges: [[3, 7]],
      individuals: [10, 12],
    };
    const count1 = countUniqueIds(index1);
    const count2 = countUniqueIds(index2);
    const merged = mergeUniqueIdIndexes(index1, index2);
    const mergedCount = countUniqueIds(merged);
    
    // Merged count should be less than or equal to sum (due to deduplication)
    expect(mergedCount).toBeLessThanOrEqual(count1 + count2);
    // In this case: index1 has 5+2=7, index2 has 5+2=7, merged should have 7+1=8 (deduplicated)
    // Actually: [1,5] + [3,7] = [1,7] = 7, individuals [10,11] + [10,12] = [10,11,12] = 3
    // Total = 10
    expect(mergedCount).toBe(10);
  });
});

