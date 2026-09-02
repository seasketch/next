import { describe, expect, it } from "@jest/globals";
import { TemporalInfo } from "@seasketch/geostats-types";
import {
  allowedViewResolutionsForForm,
  applyNativeDefaults,
  configFromForm,
  existingSourceColumns,
  formStateFromTemporal,
  isResolutionOnlyChange,
  parsedIsoPattern,
  sourceColumnsFromForm,
  temporalSourceColumnSet,
  withComponentMonth,
  withComponentYear,
} from "./dataTableTemporalForm";

const rowTemporal: TemporalInfo = {
  version: 1,
  granularity: "row",
  coverage: {
    kind: "interval",
    start: "2018",
    end: "2021",
    precision: "year",
  },
  nativeResolution: "day",
  defaultViewResolution: "year",
  supportedViewResolutions: ["year", "month", "day"],
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

describe("dataTableTemporalForm", () => {
  it("round-trips a component mapping from stored TemporalInfo", () => {
    const form = formStateFromTemporal(rowTemporal);
    expect(form.mode).toBe("components");
    expect(sourceColumnsFromForm(form)).toEqual({
      kind: "components",
      year: "year",
      month: "month",
      day: "day",
    });
    expect(configFromForm(form)?.defaultViewResolution).toBe("year");
  });

  it("treats resolution-only edits as metadata updates", () => {
    const form = {
      ...formStateFromTemporal(rowTemporal),
      defaultViewResolution: "month" as const,
    };
    expect(isResolutionOnlyChange(form, rowTemporal)).toBe(true);
    form.yearColumn = "survey_year";
    expect(isResolutionOnlyChange(form, rowTemporal)).toBe(false);
  });

  it("defaults day-precision mappings to a year view", () => {
    const form = applyNativeDefaults({
      ...formStateFromTemporal(null),
      mode: "instant",
      instantColumn: "Date",
      instantFormat: "mdy",
    });
    expect(form.defaultViewResolution).toBe("year");
    expect(form.supportedViewResolutions).toEqual(["year", "month", "day"]);
  });

  it("lists mapped source columns for required-filter warnings", () => {
    expect(temporalSourceColumnSet(rowTemporal)).toEqual([
      "year",
      "month",
      "day",
    ]);
    expect(existingSourceColumns(null)).toBeNull();
  });

  it("limits supported views to the mapped native precision", () => {
    const yearOnly = {
      ...formStateFromTemporal(null),
      mode: "components" as const,
      yearColumn: "year",
    };
    expect(allowedViewResolutionsForForm(yearOnly)).toEqual(["year"]);
    expect(
      allowedViewResolutionsForForm({
        ...yearOnly,
        monthColumn: "month",
        dayColumn: "day",
      })
    ).toEqual(["year", "month", "day"]);
    expect(
      allowedViewResolutionsForForm({
        ...formStateFromTemporal(null),
        mode: "instant",
        instantColumn: "Date",
        instantFormat: "year",
      })
    ).toEqual(["year"]);
  });

  it("clears month and day when the year column is removed", () => {
    const form = withComponentYear(
      {
        ...formStateFromTemporal(rowTemporal),
      },
      ""
    );
    expect(form.yearColumn).toBe("");
    expect(form.monthColumn).toBe("");
    expect(form.dayColumn).toBe("");
    const withoutMonth = withComponentMonth(
      formStateFromTemporal(rowTemporal),
      ""
    );
    expect(withoutMonth.monthColumn).toBe("");
    expect(withoutMonth.dayColumn).toBe("");
  });

  it("describes parsed ISO width for the preview table", () => {
    expect(parsedIsoPattern("year")).toBe("YYYY");
    expect(parsedIsoPattern("month")).toBe("YYYY-MM");
    expect(parsedIsoPattern("day")).toBe("YYYY-MM-DD");
  });
});
