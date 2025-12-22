import { describe, it, expect } from "vitest";
import {
  combineMetricsForFragments,
  RasterBandStats,
  ColumnValueStats,
  UniqueIdIndex,
  Metric,
} from "../src/metrics/metrics";
import { Feature, LineString } from "geojson";

function makeRasterBandStats(
  partial: Partial<RasterBandStats>
): RasterBandStats {
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

function makeColumnValueStats(
  partial: Partial<ColumnValueStats>
): ColumnValueStats {
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

describe("combineMetricsForFragments", () => {
  describe("error handling", () => {
    it("throws error when metrics have different types", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        { type: "total_area", value: 100 },
        {
          type: "count",
          value: {
            class1: {
              count: 5,
              uniqueIdIndex: { ranges: [], individuals: [] },
            },
          },
        },
      ];

      expect(() => combineMetricsForFragments(metrics)).toThrow(
        "All metrics must have the same type"
      );
    });

    it("throws error for unsupported metric type", () => {
      const metrics = [{ type: "invalid_type" as any, value: 100 }];

      expect(() => combineMetricsForFragments(metrics)).toThrow(
        "Unsupported metric type"
      );
    });

    it("throws error for raster_stats with multiple bands", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "raster_stats",
          value: {
            bands: [
              makeRasterBandStats({ count: 10 }),
              makeRasterBandStats({ count: 20 }),
            ],
          },
        },
      ];

      expect(() => combineMetricsForFragments(metrics)).toThrow(
        "Multiple bands are not supported for raster_stats"
      );
    });
  });

  describe("raster_stats", () => {
    it("combines single raster_stats metric", () => {
      const band = makeRasterBandStats({
        count: 100,
        min: 0,
        max: 10,
        mean: 5,
        sum: 500,
      });

      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "raster_stats",
          value: { bands: [band] },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("raster_stats");
      expect(result.value.bands).toHaveLength(1);
      expect(result.value.bands[0]).toBe(band);
    });

    it("combines multiple raster_stats metrics", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "raster_stats",
          value: {
            bands: [
              makeRasterBandStats({
                count: 100,
                min: 0,
                max: 10,
                mean: 2,
                sum: 200,
                histogram: [[1, 100]],
              }),
            ],
          },
        },
        {
          type: "raster_stats",
          value: {
            bands: [
              makeRasterBandStats({
                count: 50,
                min: 5,
                max: 15,
                mean: 10,
                sum: 500,
                histogram: [[10, 50]],
              }),
            ],
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("raster_stats");
      expect(result.value.bands).toHaveLength(1);
      const combined = result.value.bands[0];
      expect(combined.count).toBe(150);
      expect(combined.sum).toBe(700);
      expect(combined.min).toBe(0);
      expect(combined.max).toBe(15);
      expect(combined.mean).toBeCloseTo(700 / 150, 6);
      expect(combined.histogram).toEqual([
        [1, 100],
        [10, 50],
      ]);
    });
  });

  describe("column_values", () => {
    it("combines single column_values metric", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "column_values",
          value: {
            class1: makeColumnValueStats({
              count: 10,
              mean: 5,
              sum: 50,
            }),
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("column_values");
      expect(result.value.class1).toBe(metrics[0].value.class1);
    });

    it("combines multiple column_values metrics with same groupBy keys", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "column_values",
          value: {
            class1: makeColumnValueStats({
              count: 100,
              min: 0,
              max: 10,
              mean: 2,
              sum: 200,
              histogram: [[1, 100]],
            }),
          },
        },
        {
          type: "column_values",
          value: {
            class1: makeColumnValueStats({
              count: 50,
              min: 5,
              max: 15,
              mean: 10,
              sum: 500,
              histogram: [[10, 50]],
            }),
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("column_values");
      expect(result.value.class1.count).toBe(150);
      expect(result.value.class1.sum).toBe(700);
      expect(result.value.class1.min).toBe(0);
      expect(result.value.class1.max).toBe(15);
      expect(result.value.class1.mean).toBeCloseTo(700 / 150, 6);
    });

    it("combines column_values metrics with different groupBy keys", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "column_values",
          value: {
            class1: makeColumnValueStats({
              count: 10,
              mean: 5,
              sum: 50,
            }),
            class2: makeColumnValueStats({
              count: 20,
              mean: 10,
              sum: 200,
            }),
          },
        },
        {
          type: "column_values",
          value: {
            class1: makeColumnValueStats({
              count: 15,
              mean: 3,
              sum: 45,
            }),
            class3: makeColumnValueStats({
              count: 5,
              mean: 2,
              sum: 10,
            }),
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("column_values");
      expect(result.value.class1.count).toBe(25);
      expect(result.value.class1.sum).toBe(95);
      expect(result.value.class2.count).toBe(20);
      expect(result.value.class3.count).toBe(5);
    });
  });

  describe("total_area", () => {
    it("combines single total_area metric", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        { type: "total_area", value: 100.5 },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("total_area");
      expect(result.value).toBe(100.5);
    });

    it("combines multiple total_area metrics by summing", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        { type: "total_area", value: 100.5 },
        { type: "total_area", value: 200.25 },
        { type: "total_area", value: 50.75 },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("total_area");
      expect(result.value).toBeCloseTo(351.5, 6);
    });

    it("handles zero values", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        { type: "total_area", value: 0 },
        { type: "total_area", value: 100 },
        { type: "total_area", value: 0 },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.value).toBe(100);
    });
  });

  describe("count", () => {
    it("combines single count metric", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "count",
          value: {
            class1: {
              count: 5,
              uniqueIdIndex: {
                ranges: [[1, 5]],
                individuals: [],
              },
            },
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("count");
      expect(result.value.class1.count).toBe(5);
      expect(result.value.class1.uniqueIdIndex.ranges).toEqual([[1, 5]]);
    });

    it("combines multiple count metrics with same groupBy keys", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "count",
          value: {
            class1: {
              count: 5,
              uniqueIdIndex: {
                ranges: [[1, 5]],
                individuals: [],
              },
            },
          },
        },
        {
          type: "count",
          value: {
            class1: {
              count: 3,
              uniqueIdIndex: {
                ranges: [[6, 8]],
                individuals: [],
              },
            },
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("count");
      expect(result.value.class1.count).toBe(8); // 5 + 3
      expect(result.value.class1.uniqueIdIndex.ranges).toEqual([
        [1, 8], // Merged ranges
      ]);
    });

    it("combines count metrics with overlapping unique IDs (deduplicates)", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "count",
          value: {
            class1: {
              count: 5,
              uniqueIdIndex: {
                ranges: [[1, 5]],
                individuals: [],
              },
            },
          },
        },
        {
          type: "count",
          value: {
            class1: {
              count: 5,
              uniqueIdIndex: {
                ranges: [[3, 7]], // Overlaps with [1,5]
                individuals: [],
              },
            },
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("count");
      // Should deduplicate: [1,5] merged with [3,7] = [1,7] = 7 unique IDs
      expect(result.value.class1.count).toBe(7);
      expect(result.value.class1.uniqueIdIndex.ranges).toEqual([[1, 7]]);
    });

    it("combines count metrics with different groupBy keys", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "count",
          value: {
            class1: {
              count: 5,
              uniqueIdIndex: {
                ranges: [[1, 5]],
                individuals: [],
              },
            },
            class2: {
              count: 3,
              uniqueIdIndex: {
                ranges: [[10, 12]],
                individuals: [],
              },
            },
          },
        },
        {
          type: "count",
          value: {
            class1: {
              count: 2,
              uniqueIdIndex: {
                ranges: [[6, 7]],
                individuals: [],
              },
            },
            class3: {
              count: 1,
              uniqueIdIndex: {
                ranges: [],
                individuals: [20],
              },
            },
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("count");
      expect(result.value.class1.count).toBe(7); // [1,5] + [6,7] = [1,7]
      expect(result.value.class2.count).toBe(3);
      expect(result.value.class3.count).toBe(1);
    });

    it("combines count metrics with individuals", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "count",
          value: {
            class1: {
              count: 3,
              uniqueIdIndex: {
                ranges: [],
                individuals: [1, 5, 10],
              },
            },
          },
        },
        {
          type: "count",
          value: {
            class1: {
              count: 2,
              uniqueIdIndex: {
                ranges: [],
                individuals: [2, 3],
              },
            },
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("count");
      // [1,5,10] + [2,3] merged = [1,3] range + [5,10] individuals? Actually, let's check:
      // 1, 2, 3, 5, 10 - 1,2,3 are consecutive so become [1,3], 5 and 10 remain individuals
      expect(result.value.class1.count).toBe(5);
      expect(result.value.class1.uniqueIdIndex.ranges).toEqual([[1, 3]]);
      expect(result.value.class1.uniqueIdIndex.individuals).toEqual([5, 10]);
    });
  });

  describe("distance_to_shore", () => {
    const makeLineString = (): Feature<LineString> => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    });

    it("combines single distance_to_shore metric", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "distance_to_shore",
          value: {
            meters: 1000,
            geojsonLine: makeLineString(),
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("distance_to_shore");
      expect(result.value.meters).toBe(1000);
    });

    it("returns closest distance when combining multiple metrics", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "distance_to_shore",
          value: {
            meters: 5000,
            geojsonLine: makeLineString(),
          },
        },
        {
          type: "distance_to_shore",
          value: {
            meters: 1000,
            geojsonLine: makeLineString(),
          },
        },
        {
          type: "distance_to_shore",
          value: {
            meters: 3000,
            geojsonLine: makeLineString(),
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("distance_to_shore");
      expect(result.value.meters).toBe(1000); // Closest
    });

    it("returns first metric when all distances are equal", () => {
      const line1 = makeLineString();
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "distance_to_shore",
          value: {
            meters: 1000,
            geojsonLine: line1,
          },
        },
        {
          type: "distance_to_shore",
          value: {
            meters: 1000,
            geojsonLine: makeLineString(),
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.value.meters).toBe(1000);
      expect(result.value.geojsonLine).toBe(line1); // Returns first
    });
  });

  describe("presence", () => {
    it("combines single presence metric", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        { type: "presence", value: true },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("presence");
      expect(result.value).toBe(true);
    });

    it("returns true if any fragment has presence", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        { type: "presence", value: false },
        { type: "presence", value: false },
        { type: "presence", value: true },
        { type: "presence", value: false },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("presence");
      expect(result.value).toBe(true);
    });

    it("returns false if no fragments have presence", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        { type: "presence", value: false },
        { type: "presence", value: false },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.value).toBe(false);
    });
  });

  describe("presence_table", () => {
    it("combines single presence_table metric", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "presence_table",
          value: {
            values: [
              { __id: 1, name: "Feature 1" },
              { __id: 2, name: "Feature 2" },
            ],
            exceededLimit: false,
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("presence_table");
      expect(result.value.values).toHaveLength(2);
      expect(result.value.exceededLimit).toBe(false);
    });

    it("combines multiple presence_table metrics and deduplicates by __id", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "presence_table",
          value: {
            values: [
              { __id: 1, name: "Feature 1" },
              { __id: 2, name: "Feature 2" },
            ],
            exceededLimit: false,
          },
        },
        {
          type: "presence_table",
          value: {
            values: [
              { __id: 2, name: "Feature 2" }, // Duplicate
              { __id: 3, name: "Feature 3" },
            ],
            exceededLimit: false,
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("presence_table");
      expect(result.value.values).toHaveLength(3);
      expect(result.value.values.map((v) => v.__id)).toEqual([1, 2, 3]);
      expect(result.value.exceededLimit).toBe(false);
    });

    it("sets exceededLimit to true if any fragment exceeded limit", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "presence_table",
          value: {
            values: [{ __id: 1, name: "Feature 1" }],
            exceededLimit: false,
          },
        },
        {
          type: "presence_table",
          value: {
            values: [{ __id: 2, name: "Feature 2" }],
            exceededLimit: true,
          },
        },
        {
          type: "presence_table",
          value: {
            values: [{ __id: 3, name: "Feature 3" }],
            exceededLimit: false,
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.value.exceededLimit).toBe(true);
    });

    it("handles empty values arrays", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "presence_table",
          value: {
            values: [],
            exceededLimit: false,
          },
        },
        {
          type: "presence_table",
          value: {
            values: [{ __id: 1, name: "Feature 1" }],
            exceededLimit: false,
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.value.values).toHaveLength(1);
      expect(result.value.values[0].__id).toBe(1);
    });
  });

  describe("overlay_area", () => {
    it("combines single overlay_area metric", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "overlay_area",
          value: {
            class1: 100.5,
            class2: 200.25,
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("overlay_area");
      expect(result.value.class1).toBe(100.5);
      expect(result.value.class2).toBe(200.25);
    });

    it("combines multiple overlay_area metrics by summing same groupBy keys", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "overlay_area",
          value: {
            class1: 100.5,
            class2: 200.25,
          },
        },
        {
          type: "overlay_area",
          value: {
            class1: 50.75,
            class3: 300.0,
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.type).toBe("overlay_area");
      expect(result.value.class1).toBeCloseTo(151.25, 6); // 100.5 + 50.75
      expect(result.value.class2).toBe(200.25);
      expect(result.value.class3).toBe(300.0);
    });

    it("handles zero values", () => {
      const metrics: Pick<Metric, "type" | "value">[] = [
        {
          type: "overlay_area",
          value: {
            class1: 0,
            class2: 100,
          },
        },
        {
          type: "overlay_area",
          value: {
            class1: 50,
            class2: 0,
          },
        },
      ];

      const result = combineMetricsForFragments(metrics);
      expect(result.value.class1).toBe(50);
      expect(result.value.class2).toBe(100);
    });
  });
});
