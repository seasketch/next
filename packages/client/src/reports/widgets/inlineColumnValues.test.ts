import { describe, expect, it } from "@jest/globals";
import { numberColumnStatOrZero } from "./inlineColumnValues";

describe("numberColumnStatOrZero", () => {
  it("treats a missing column as zero, not NaN", () => {
    expect(numberColumnStatOrZero({}, "Population", "sum")).toBe(0);
    expect(numberColumnStatOrZero(undefined, "Population", "sum")).toBe(0);
  });

  it("returns the stored sum when the column is present", () => {
    expect(
      numberColumnStatOrZero(
        {
          Population: {
            type: "number",
            count: 2,
            min: 10,
            max: 30,
            mean: 20,
            stdDev: 10,
            histogram: [],
            countDistinct: 2,
            sum: 40,
          },
        },
        "Population",
        "sum"
      )
    ).toBe(40);
  });

  it("returns countDistinct for a string column, not zero", () => {
    expect(
      numberColumnStatOrZero(
        {
          Island: {
            type: "string",
            countDistinct: 1,
            distinctValues: [["Santo", 2]],
          },
        },
        "Island",
        "countDistinct"
      )
    ).toBe(1);
  });
});
