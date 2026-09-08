import { describe, expect, it } from "@jest/globals";
import {
  allowedDataTableVisualizationColumns,
  configuredDataTableVisualizationColumns,
  dataTableFilterLabel,
  hiddenDataTableFilterColumns,
  isAlwaysHiddenFilterColumn,
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

describe("isAlwaysHiddenFilterColumn", () => {
  const temporal = {
    version: 1,
    granularity: "row",
    coverage: {
      kind: "interval",
      start: "1999",
      end: "2025",
      precision: "year",
    },
    nativeResolution: "day",
    defaultViewResolution: "year",
    mapping: {
      type: "row",
      startColumn: "_when_start",
      endColumn: "_when_end",
      sourceColumns: {
        kind: "components",
        year: "year",
        month: "month",
        day: "day",
      },
    },
    authoredBy: "admin",
  };

  it("hides join, temporal source, and derived when columns", () => {
    expect(isAlwaysHiddenFilterColumn("site", temporal, "site")).toBe(true);
    expect(isAlwaysHiddenFilterColumn("year", temporal, "site")).toBe(true);
    expect(isAlwaysHiddenFilterColumn("month", temporal, "site")).toBe(true);
    expect(isAlwaysHiddenFilterColumn("_when_start", temporal, "site")).toBe(
      true
    );
    expect(isAlwaysHiddenFilterColumn("classcode", temporal, "site")).toBe(
      false
    );
  });

  it("rejects nullish and non-object temporal without treating every column as hidden", () => {
    expect(isAlwaysHiddenFilterColumn("year", null, null)).toBe(false);
    expect(isAlwaysHiddenFilterColumn("_when_end", undefined, "site")).toBe(
      true
    );
    expect(isAlwaysHiddenFilterColumn("", undefined, null)).toBe(true);
  });
});

describe("allowedDataTableVisualizationColumns", () => {
  it("returns every configured data column, not only a current selection", () => {
    expect(
      allowedDataTableVisualizationColumns(
        { visualizationColumns: ["cpue", "biomass", null, ""] },
        ["cpue", "biomass", "depth"]
      )
    ).toEqual(["cpue", "biomass"]);
  });

  it("falls back to all numeric columns when none are configured", () => {
    expect(
      allowedDataTableVisualizationColumns({}, ["cpue", "biomass"])
    ).toEqual(["cpue", "biomass"]);
    expect(configuredDataTableVisualizationColumns(null)).toEqual([]);
    expect(configuredDataTableVisualizationColumns(undefined)).toEqual([]);
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
