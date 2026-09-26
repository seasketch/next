import { describe, expect, it } from "@jest/globals";
import { emptyReplicateWithin } from "./emptyReplicateWithin";

describe("emptyReplicateWithin", () => {
  it("reports the chosen operation for a single value column", () => {
    expect(
      emptyReplicateWithin({
        valueColumns: ["max_n"],
        withinByColumn: { max_n: "max" },
      })
    ).toBe("max");
  });

  it("defaults to sum when a value column has no operation set", () => {
    expect(
      emptyReplicateWithin({ valueColumns: ["count"], withinByColumn: {} })
    ).toBe("sum");
  });

  it("reports mixed when value columns disagree", () => {
    expect(
      emptyReplicateWithin({
        valueColumns: ["count", "size"],
        withinByColumn: { count: "sum", size: "mean" },
      })
    ).toBe("mixed");
  });

  it("uses explicit operations when any numeric column may be mapped", () => {
    expect(
      emptyReplicateWithin({
        valueColumns: [],
        withinByColumn: { biomass_g: "mean" },
      })
    ).toBe("mean");
    expect(emptyReplicateWithin({ valueColumns: [], withinByColumn: {} })).toBe(
      "sum"
    );
  });
});
