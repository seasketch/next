import { describe, expect, it } from "@jest/globals";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import {
  hiddenFilterValuesByColumn,
  omitHiddenFilterValues,
  omitHiddenFilterValuesFromFilters,
} from "./hiddenFilterValues";

const column = (
  attribute: string,
  values: { [value: string]: number }
): GeostatsAttribute =>
  ({
    attribute,
    type: "string",
    count: Object.values(values).reduce((a, b) => a + b, 0),
    countDistinct: Object.keys(values).length,
    values,
  } as unknown as GeostatsAttribute);

describe("hiddenFilterValuesByColumn", () => {
  it("keys nothing-seen values on the subject column and rows to ignore on theirs", () => {
    expect(
      hiddenFilterValuesByColumn({
        subjectColumn: "scientificname",
        effortMarkerValues: ["Not recorded", null],
        excludedValues: { method: ["PA"], scientificname: ["unknown"] },
      })
    ).toEqual({
      scientificname: ["Not recorded", "unknown"],
      method: ["PA"],
    });
  });

  it("returns nothing when neither setting is used", () => {
    expect(
      hiddenFilterValuesByColumn({ subjectColumn: "classcode" })
    ).toEqual({});
    expect(
      hiddenFilterValuesByColumn({
        subjectColumn: null,
        effortMarkerValues: ["NO_ORG"],
      })
    ).toEqual({});
  });
});

describe("omitHiddenFilterValues", () => {
  const columns = [
    column("scientificname", { "Not recorded": 5, "Ulva lactuca": 3 }),
    column("method", { PA: 2, count: 9 }),
    column("habitat", { marsh: 4 }),
  ];

  it("drops hidden values and keeps untouched columns by reference", () => {
    const next = omitHiddenFilterValues(columns, {
      scientificname: ["Not recorded"],
      method: ["PA"],
    });
    expect((next[0] as { values: object }).values).toEqual({
      "Ulva lactuca": 3,
    });
    expect((next[1] as { values: object }).values).toEqual({ count: 9 });
    expect(next[2]).toBe(columns[2]);
  });

  it("returns the same array when nothing is hidden", () => {
    expect(omitHiddenFilterValues(columns, {})).toBe(columns);
    expect(omitHiddenFilterValues(columns, { habitat: ["dune"] })).toBe(
      columns
    );
  });
});

describe("omitHiddenFilterValuesFromFilters", () => {
  const hidden = { scientificname: ["Not recorded"] };

  it("strips hidden values from in filters and drops eq filters on them", () => {
    expect(
      omitHiddenFilterValuesFromFilters(
        [
          {
            column: "scientificname",
            op: "in",
            values: ["Not recorded", "Ulva lactuca"],
          },
          { column: "scientificname", op: "eq", value: "Not recorded" },
          { column: "method", op: "eq", value: "PA" },
        ],
        hidden
      )
    ).toEqual([
      { column: "scientificname", op: "in", values: ["Ulva lactuca"] },
      { column: "method", op: "eq", value: "PA" },
    ]);
  });

  it("drops an in filter left with no values", () => {
    expect(
      omitHiddenFilterValuesFromFilters(
        [{ column: "scientificname", op: "in", values: ["Not recorded"] }],
        hidden
      )
    ).toEqual([]);
  });

  it("returns the same array when nothing changes", () => {
    const filters = [{ column: "habitat", op: "eq" as const, value: "marsh" }];
    expect(omitHiddenFilterValuesFromFilters(filters, hidden)).toBe(filters);
  });
});
