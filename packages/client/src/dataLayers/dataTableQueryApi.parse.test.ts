import { describe, expect, it } from "@jest/globals";
import {
  buildDataTableQuerySearchParams,
  dataTableQueryClockParams,
  dataTableQueryFailureFromBody,
  isDataTableQuerySeriesMeta,
  isWhenStepLimitError,
  omitFiltersForColumns,
  parseDataTableQueryGroups,
  combineSeriesSteps,
  parseDataTableQuerySeries,
  temporalSourceFilterColumns,
} from "./dataTableQueryApi";

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

describe("buildDataTableQuerySearchParams", () => {
  it("appends when.start and when.end epoch seconds", () => {
    const params = buildDataTableQuerySearchParams({
      column: "count",
      op: "sum",
      groupBy: "site",
      when: { start: 1514764800, end: 1546300800 },
    });
    expect(params.get("when.start")).toBe("1514764800");
    expect(params.get("when.end")).toBe("1546300800");
  });

  it("appends when.step for a series query", () => {
    const params = buildDataTableQuerySearchParams({
      column: "count",
      op: "mean",
      groupBy: "site",
      when: { start: 1514764800, end: 1577836800 },
      whenStep: "year",
    });
    expect(params.get("when.step")).toBe("year");
  });

  it("drops temporal source-column filters so they do not fight when.*", () => {
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
    expect(temporalSourceFilterColumns(temporal)).toEqual([
      "year",
      "month",
      "day",
    ]);
    const filters = omitFiltersForColumns(
      [
        { column: "classcode", op: "eq", value: "BOULD" },
        { column: "year", op: "eq", value: "2022" },
      ],
      temporalSourceFilterColumns(temporal)
    );
    expect(filters).toEqual([
      { column: "classcode", op: "eq", value: "BOULD" },
    ]);
  });
});

describe("dataTableQueryClockParams", () => {
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

  it("uses a full-coverage when.step series for instant clocks", () => {
    const params = dataTableQueryClockParams(
      {
        mode: "instant",
        start: "2018",
        end: "2019",
        viewResolution: "year",
      },
      temporal
    );
    expect(params.when).toEqual({
      start: Date.UTC(1999, 0, 1) / 1000,
      end: Date.UTC(2025, 0, 1) / 1000,
    });
    expect(params.whenStep).toBe("year");
  });

  it("queries the selected window without when.step so the engine recalculates", () => {
    const params = dataTableQueryClockParams(
      {
        mode: "window",
        start: "2018",
        end: "2021",
        viewResolution: "year",
      },
      temporal
    );
    expect(params.when).toEqual({
      start: Date.UTC(2018, 0, 1) / 1000,
      end: Date.UTC(2021, 0, 1) / 1000,
    });
    expect(params.whenStep).toBeUndefined();
  });
});

describe("parseDataTableQuerySeries", () => {
  const series = {
    step: "year",
    steps: ["2018", "2019"],
    min: 0,
    max: 10,
    scaleMin: 4,
    scaleMax: 10,
    hasZero: true,
    stepStats: [
      { step: "2018", rows: 2, groups: 2 },
      { step: "2019", rows: 1, groups: 1 },
    ],
  };

  it("rejects null, undefined, and non-objects", () => {
    expect(isDataTableQuerySeriesMeta(null)).toBe(false);
    expect(isDataTableQuerySeriesMeta(undefined)).toBe(false);
    expect(isDataTableQuerySeriesMeta("year")).toBe(false);
    expect(parseDataTableQuerySeries([], null, "site", "mean")).toBeNull();
  });

  it("indexes groups by step and keeps the global scale", () => {
    const parsed = parseDataTableQuerySeries(
      [
        { step: "2018", site: "A", mean: 10, count: 2 },
        { step: "2018", site: "B", mean: 0, count: 1 },
        { step: "2019", site: "A", mean: 4, count: 2 },
      ],
      series,
      "site",
      "mean"
    );
    expect(parsed?.scaleMin).toBe(4);
    expect(parsed?.scaleMax).toBe(10);
    expect(parsed?.byStep["2018"].values).toEqual({ A: 10, B: 0 });
    expect(parsed?.byStep["2019"].values).toEqual({ A: 4 });
    expect(parsed?.featureCountsByStep["2018"]).toEqual({ A: 2, B: 1 });
  });

  it("combines a window of steps with a count-weighted mean", () => {
    const parsed = parseDataTableQuerySeries(
      [
        { step: "2018", site: "A", mean: 10, count: 2 },
        { step: "2018", site: "B", mean: 0, count: 1 },
        { step: "2019", site: "A", mean: 4, count: 2 },
      ],
      series,
      "site",
      "mean"
    );
    expect(parsed).not.toBeNull();
    const combined = combineSeriesSteps(parsed!, ["2018", "2019"], "mean");
    expect(combined.values.A).toBe(7);
    expect(combined.values.B).toBe(0);
  });
});

describe("dataTableQueryFailureFromBody", () => {
  it("reads the JSON error body and when.step limit code", () => {
    const failure = dataTableQueryFailureFromBody(
      {
        error:
          'when.step="day" produces more than 2000 bins in this range. Use a coarser step.',
        code: "when_step_limit",
        step: "day",
        maxSteps: 2000,
      },
      "Failed to fetch data table query: Bad Request"
    );
    expect(failure.message).toMatch(/more than 2000 bins/);
    expect(failure.code).toBe("when_step_limit");
    expect(isWhenStepLimitError(failure)).toBe(true);
  });

  it("falls back when the body is not an error object", () => {
    expect(dataTableQueryFailureFromBody("nope", "Bad Gateway")).toEqual({
      message: "Bad Gateway",
    });
    expect(isWhenStepLimitError({ message: "Bad Gateway" })).toBe(false);
  });
});
