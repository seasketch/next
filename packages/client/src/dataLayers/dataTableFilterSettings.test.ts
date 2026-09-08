import { describe, expect, it } from "@jest/globals";
import {
  dataTableFilterLabel,
  hiddenDataTableFilterColumns,
  isFilterColumnLabels,
  parseFilterColumnLabels,
  requiredDataTableFilterColumns,
} from "./dataTableQueryApi";

describe("isFilterColumnLabels", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(isFilterColumnLabels(null)).toBe(false);
    expect(isFilterColumnLabels(undefined)).toBe(false);
    expect(isFilterColumnLabels("year")).toBe(false);
    expect(isFilterColumnLabels(["year"])).toBe(false);
    expect(isFilterColumnLabels(1)).toBe(false);
  });

  it("rejects objects with non-string values", () => {
    expect(isFilterColumnLabels({ year: 2024 })).toBe(false);
    expect(isFilterColumnLabels({ year: { label: "Year" } })).toBe(false);
  });

  it("accepts a string map", () => {
    expect(isFilterColumnLabels({ year: "Year", species: "Species" })).toBe(
      true
    );
    expect(isFilterColumnLabels({})).toBe(true);
  });
});

describe("parseFilterColumnLabels", () => {
  it("returns an empty object for invalid input", () => {
    expect(parseFilterColumnLabels(null)).toEqual({});
    expect(parseFilterColumnLabels(undefined)).toEqual({});
    expect(parseFilterColumnLabels(["year"])).toEqual({});
  });

  it("drops empty keys and whitespace-only labels", () => {
    expect(
      parseFilterColumnLabels({
        year: " Year ",
        species: "   ",
        "": "Nope",
      })
    ).toEqual({ year: "Year" });
  });
});

describe("dataTableFilterLabel", () => {
  it("falls back to the column name", () => {
    expect(dataTableFilterLabel("year")).toBe("year");
    expect(dataTableFilterLabel("year", { species: "Species" })).toBe("year");
    expect(dataTableFilterLabel("year", { year: "  Year  " })).toBe("Year");
  });
});

describe("hiddenDataTableFilterColumns", () => {
  it("drops empties and required columns", () => {
    expect(
      hiddenDataTableFilterColumns({
        requiredFilterColumns: ["year"],
        hiddenFilterColumns: ["year", "region", "", null],
      })
    ).toEqual(["region"]);
    expect(requiredDataTableFilterColumns({})).toEqual([]);
  });
});
