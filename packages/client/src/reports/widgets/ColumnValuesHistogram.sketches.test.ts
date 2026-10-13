import { describe, expect, it } from "@jest/globals";
import { columnValueStatsBySketch } from "./ColumnValuesHistogram";

function numericStats(overrides: { mean: number; min: number; max: number; sum: number; count: number }) {
  return {
    type: "number" as const,
    count: overrides.count,
    min: overrides.min,
    max: overrides.max,
    mean: overrides.mean,
    stdDev: 0,
    histogram: [] as [number, number][],
    countDistinct: overrides.count,
    sum: overrides.sum,
  };
}

describe("columnValueStatsBySketch", () => {
  it("returns each collection sketch's column stats and skips sketches with no overlap", () => {
    const rows = columnValueStatsBySketch({
      metrics: [
        {
          type: "column_values",
          subject: { hash: "a", sketches: [1], geographies: [56] },
          value: { "*": { score: numericStats({ mean: 1.2, min: 0, max: 4, sum: 12, count: 10 }) } },
        },
        {
          type: "column_values",
          subject: { hash: "b", sketches: [2], geographies: [56] },
          value: { "*": { score: numericStats({ mean: 4.5, min: 2, max: 8, sum: 18, count: 4 }) } },
        },
      ],
      column: "score",
      childSketchIds: [1, 2, 3],
      sketchNameById: new Map([
        [1, "Inshore"],
        [2, "Offshore"],
        [3, "Empty"],
      ]),
      sketchLabel: (id) => `Sketch #${id}`,
    });

    expect(rows.map((row) => row.sketchName)).toEqual(["Inshore", "Offshore"]);
    expect(rows[0]?.stats.mean).toBe(1.2);
    expect(rows[0]?.stats.min).toBe(0);
    expect(rows[0]?.stats.max).toBe(4);
    expect(rows[1]?.stats.mean).toBe(4.5);
    expect(rows[1]?.stats.sum).toBe(18);
  });
});
