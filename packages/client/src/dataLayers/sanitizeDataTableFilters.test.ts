import { describe, expect, it } from "@jest/globals";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import { sanitizeDataTableFilters } from "./DataTableFilterControls";

const fishClasscode: GeostatsAttribute = {
  attribute: "classcode",
  type: "string",
  count: 16,
  values: { AARG: 12, SMYS: 4 },
};

const upcClasscode: GeostatsAttribute = {
  attribute: "classcode",
  type: "string",
  count: 11,
  values: { APOPAR: 8, HALCOR: 3 },
};

describe("sanitizeDataTableFilters", () => {
  it("drops string values that are not in this table's column stats", () => {
    expect(
      sanitizeDataTableFilters(
        [{ column: "classcode", op: "eq", value: "AARG" }],
        [upcClasscode]
      )
    ).toEqual([]);
  });

  it("keeps a value that exists on this table", () => {
    expect(
      sanitizeDataTableFilters(
        [{ column: "classcode", op: "eq", value: "AARG" }],
        [fishClasscode]
      )
    ).toEqual([{ column: "classcode", op: "eq", value: "AARG" }]);
  });

  it("filters in-lists down to values present on this table", () => {
    expect(
      sanitizeDataTableFilters(
        [{ column: "classcode", op: "in", values: ["AARG", "APOPAR"] }],
        [upcClasscode]
      )
    ).toEqual([{ column: "classcode", op: "in", values: ["APOPAR"] }]);
  });

  it("keeps organism values that are missing from the histogram", () => {
    expect(
      sanitizeDataTableFilters(
        [{ column: "classcode", op: "eq", value: "SPUL" }],
        [upcClasscode],
        { unrestrictedColumns: ["classcode"] }
      )
    ).toEqual([{ column: "classcode", op: "eq", value: "SPUL" }]);
  });

  it("drops filters for columns this table does not have", () => {
    expect(
      sanitizeDataTableFilters(
        [{ column: "species", op: "eq", value: "kelp" }],
        [upcClasscode]
      )
    ).toEqual([]);
  });
});
