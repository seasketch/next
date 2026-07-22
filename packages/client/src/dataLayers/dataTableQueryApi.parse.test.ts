import { describe, expect, it } from "@jest/globals";
import { parseDataTableQueryGroups } from "./dataTableQueryApi";

describe("parseDataTableQueryGroups", () => {
  it("maps join keys to aggregation values and computes extents", () => {
    const parsed = parseDataTableQueryGroups(
      [
        { site: "A", sum: 10 },
        { site: "B", sum: 0 },
        { site: "C", sum: 4 },
        { site: "D", sum: null },
        { site: "E", sum: "skip" },
      ],
      "site",
      "sum"
    );
    expect(parsed.values).toEqual({ A: 10, B: 0, C: 4 });
    expect(parsed.min).toBe(0);
    expect(parsed.max).toBe(10);
    expect(parsed.scaleMin).toBe(4);
    expect(parsed.scaleMax).toBe(10);
    expect(parsed.hasZero).toBe(true);
  });

  it("handles empty groups and array ops", () => {
    expect(parseDataTableQueryGroups([], "site", "mean")).toEqual({
      values: {},
      min: 0,
      max: 0,
      scaleMin: 0,
      scaleMax: 0,
      hasZero: false,
    });
    const parsed = parseDataTableQueryGroups(
      [{ site: 12, mean: 3.5 }],
      "site",
      ["mean", "sum"]
    );
    expect(parsed.values).toEqual({ "12": 3.5 });
  });
});
