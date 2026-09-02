import { describe, expect, it } from "@jest/globals";
import {
  clockAwarePaintKey,
  tableHasRowTemporal,
} from "./DataTableQueryManager";

const rowTemporal = {
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

const layerTemporal = {
  version: 1,
  granularity: "layer",
  coverage: {
    kind: "interval",
    start: "2018",
    end: "2019",
    precision: "year",
  },
  nativeResolution: "year",
  defaultViewResolution: "year",
};

const clock = {
  mode: "instant" as const,
  start: "2018",
  end: "2019",
  viewResolution: "year" as const,
};

describe("tableHasRowTemporal", () => {
  it("accepts row-mapped TemporalInfo", () => {
    expect(tableHasRowTemporal(rowTemporal)).toBe(true);
  });

  it("rejects layer-granularity and invalid values", () => {
    expect(tableHasRowTemporal(layerTemporal)).toBe(false);
    expect(tableHasRowTemporal(null)).toBe(false);
    expect(tableHasRowTemporal(undefined)).toBe(false);
    expect(tableHasRowTemporal({})).toBe(false);
  });
});

describe("clockAwarePaintKey", () => {
  it("suffixes the clock only for row-temporal tables", () => {
    expect(clockAwarePaintKey("q1", clock, rowTemporal)).toBe(
      "q1#instant:2018:2019"
    );
  });

  it("leaves the query key alone when the table is not row-temporal", () => {
    expect(clockAwarePaintKey("q1", clock, layerTemporal)).toBe("q1");
    expect(clockAwarePaintKey("q1", clock, null)).toBe("q1");
    expect(clockAwarePaintKey("q1", clock, undefined)).toBe("q1");
  });

  it("leaves the query key alone when there is no clock", () => {
    expect(clockAwarePaintKey("q1", null, rowTemporal)).toBe("q1");
  });
});
