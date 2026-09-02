import { describe, expect, it } from "@jest/globals";
import { GeostatsAttribute, TemporalInfo } from "@seasketch/geostats-types";
import {
  allowedViewResolutionsForForm,
  applyNativeDefaults,
  columnLooksLikeDateString,
  configFromForm,
  existingSourceColumns,
  formStateFromTemporal,
  inferredInstantFormat,
  isResolutionOnlyChange,
  parsedIsoPattern,
  sourceColumnsFromForm,
  temporalColumnAvailability,
  temporalSourceColumnSet,
  withComponentMonth,
  withComponentYear,
  withInstantColumn,
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

function testAttr(
  partial: Pick<GeostatsAttribute, "attribute" | "type"> &
    Partial<GeostatsAttribute>
): GeostatsAttribute {
  return {
    count: 10,
    values: {},
    ...partial,
  };
}

describe("temporalColumnAvailability", () => {
  const isoDate = testAttr({
    attribute: "samplecollectiondate",
    type: "string",
    values: { "2021-05-27": 12, "2021-06-03": 8, "2023-12-08": 1 },
  });
  const year = testAttr({
    attribute: "year",
    type: "number",
    min: 2021,
    max: 2023,
  });
  const depth = testAttr({
    attribute: "depth_m",
    type: "number",
    min: 0.5,
    max: 45,
  });
  const station = testAttr({
    attribute: "stationno",
    type: "string",
    values: { A1: 4, B2: 4 },
  });
  const flag = testAttr({
    attribute: "active",
    type: "boolean",
    values: { true: 8, false: 2 },
  });

  it("keeps numeric columns available on the year/month/day tab", () => {
    expect(temporalColumnAvailability(year, "components")).toEqual({
      available: true,
    });
    expect(temporalColumnAvailability(depth, "components")).toEqual({
      available: true,
    });
  });

  it("disables ISO date strings on the year/month/day tab", () => {
    expect(temporalColumnAvailability(isoDate, "components")).toEqual({
      available: false,
      reason: "date_string",
      suggestedMode: "instant",
    });
    expect(columnLooksLikeDateString(isoDate)).toBe(true);
    expect(inferredInstantFormat(isoDate)).toBe("iso");
  });

  it("disables other strings on the year/month/day tab with a tab hint", () => {
    expect(temporalColumnAvailability(station, "components")).toEqual({
      available: false,
      reason: "not_numeric",
      suggestedMode: "instant",
    });
  });

  it("allows date strings and numbers on a single date column tab", () => {
    expect(temporalColumnAvailability(isoDate, "instant")).toEqual({
      available: true,
    });
    expect(temporalColumnAvailability(year, "instant")).toEqual({
      available: true,
    });
    expect(temporalColumnAvailability(flag, "instant")).toEqual({
      available: false,
      reason: "unsupported_type",
    });
  });

  it("infers slash dates as month/day/year", () => {
    const slash = testAttr({
      attribute: "collected",
      type: "string",
      values: { "5/27/2021": 3, "6/3/2021": 2 },
    });
    expect(columnLooksLikeDateString(slash)).toBe(true);
    expect(inferredInstantFormat(slash)).toBe("mdy");
  });

  it("infers day-first slash dates when the first number is > 12", () => {
    const slash = testAttr({
      attribute: "collected",
      type: "string",
      values: { "27/5/2021": 3, "31/12/2021": 2 },
    });
    expect(inferredInstantFormat(slash)).toBe("dmy");
  });

  it("infers ISO from hyphenated samples, including times", () => {
    expect(
      inferredInstantFormat(
        testAttr({
          attribute: "samplecollectiondate",
          type: "string",
          values: { "2021-10-21": 4, "2021-10-22": 1 },
        })
      )
    ).toBe("iso");
    expect(
      inferredInstantFormat(
        testAttr({
          attribute: "observed_at",
          type: "string",
          values: { "2021-10-21T14:30:00Z": 2 },
        })
      )
    ).toBe("iso");
  });

  it("infers year for numeric columns and 4-digit year strings", () => {
    expect(inferredInstantFormat(year)).toBe("year");
    expect(
      inferredInstantFormat(
        testAttr({
          attribute: "yr",
          type: "string",
          values: { "2018": 4, "2019": 6 },
        })
      )
    ).toBe("year");
  });

  it("selects a guessed format when a date column is chosen", () => {
    const form = withInstantColumn(
      formStateFromTemporal(null),
      isoDate.attribute,
      isoDate
    );
    expect(form.instantColumn).toBe("samplecollectiondate");
    expect(form.instantFormat).toBe("iso");
  });
});
