import { describe, expect, it } from "@jest/globals";
import {
  buildDataTableQuerySearchParams,
  DATA_TABLE_CALCULATION_ROWS_LIMIT,
  DataTableQuerySettings,
  defaultHiddenCalculationColumns,
  deriveDataTableCalculationRowsQuery,
  filterRowsOverlappingSteps,
  parseDataTableCalculationRowsBody,
  precisionForStep,
  resolveCalculationRowsSelection,
  rowWhenOverlapsStep,
  stepIntervalSeconds,
  WHEN_END_COLUMN,
  WHEN_START_COLUMN,
} from "./dataTableQueryApi";
import {
  calculationRowsExportFilename,
  calculationRowsToCsv,
} from "./dataTableCalculationRowsExport";

/**
 * Guards the coupling between map statistics queries and the QA/QC
 * "Show rows in calculation" modal. The raw-row query must carry the exact
 * same `q.*` filters and `when.*` window as the stats query so the engine's
 * raw/aggregate consistency guarantee (see
 * packages/pmtiles-server/test/dataTables/rawAggConsistency.test.ts) applies.
 */

const statsQuery: DataTableQuerySettings = {
  op: ["mean", "count"],
  column: "count",
  groupBy: "site",
  filters: [
    { column: "classcode", op: "in", values: ["SPUL", "PYCHEL", "a,b"] },
    { column: "observer", op: "eq", value: "CHAD BURT" },
    { column: "size", op: "gte", value: "10" },
    { column: "site_status", op: "isNull" },
  ],
  when: { start: 1514764800, end: 1672531200 },
  whenStep: "year",
};

describe("deriveDataTableCalculationRowsQuery", () => {
  it("carries every q.* and when.* parameter of the stats query, unchanged", () => {
    const rowsQuery = deriveDataTableCalculationRowsQuery(
      statsQuery,
      "site",
      "SRI_CHICKASAW_W"
    );
    const statsParams = buildDataTableQuerySearchParams(statsQuery);
    const rowsParams = buildDataTableQuerySearchParams(rowsQuery);

    // Every filter and temporal-window parameter sent for stats must be sent
    // verbatim for rows (rows additionally narrow to one join value).
    for (const [key, value] of statsParams.entries()) {
      if (key.startsWith("q.")) {
        expect(rowsParams.getAll(key)).toContain(value);
      }
    }
    expect(rowsParams.get("when.start")).toBe(statsParams.get("when.start"));
    expect(rowsParams.get("when.end")).toBe(statsParams.get("when.end"));

    // Raw mode: aggregation-only parameters must be absent.
    expect(rowsParams.get("op")).toBeNull();
    expect(rowsParams.get("column")).toBeNull();
    expect(rowsParams.get("groupBy")).toBeNull();
    expect(rowsParams.get("when.step")).toBeNull();

    // Narrowed to the requested site.
    expect(rowsParams.get("q.site")).toBe("SRI_CHICKASAW_W");
  });

  it("adds no filters beyond the join-column narrowing", () => {
    const rowsQuery = deriveDataTableCalculationRowsQuery(
      statsQuery,
      "site",
      "PINOS"
    );
    expect(rowsQuery.filters).toHaveLength(
      (statsQuery.filters?.length ?? 0) + 1
    );
    expect(rowsQuery.filters![rowsQuery.filters!.length - 1]).toEqual({
      column: "site",
      op: "eq",
      value: "PINOS",
    });
    // The stats query's own filters are passed by reference, not rewritten.
    for (let i = 0; i < statsQuery.filters!.length; i++) {
      expect(rowsQuery.filters![i]).toBe(statsQuery.filters![i]);
    }
  });

  it("orders temporal tables by the derived _when_start mapping and exposes _when_* columns", () => {
    const rowsQuery = deriveDataTableCalculationRowsQuery(
      statsQuery,
      "site",
      "PINOS"
    );
    expect(rowsQuery.orderBy).toEqual({
      key: WHEN_START_COLUMN,
      direction: "asc",
    });
    expect(rowsQuery.includeWhen).toBe(true);
    expect(rowsQuery.limit).toBe(DATA_TABLE_CALCULATION_ROWS_LIMIT);
  });

  it("omits temporal ordering for non-temporal queries", () => {
    const rowsQuery = deriveDataTableCalculationRowsQuery(
      { op: "mean", column: "count", filters: statsQuery.filters },
      "site",
      "PINOS"
    );
    expect(rowsQuery.orderBy).toBeUndefined();
    expect(rowsQuery.includeWhen).toBeUndefined();
    expect(rowsQuery.when).toBeUndefined();
  });

  it("stringifies numeric join values", () => {
    const rowsQuery = deriveDataTableCalculationRowsQuery(
      { op: "mean", column: "count" },
      "site_id",
      42 as unknown as string
    );
    expect(rowsQuery.filters).toEqual([
      { column: "site_id", op: "eq", value: "42" },
    ]);
  });
});

describe("parseDataTableCalculationRowsBody", () => {
  const query = deriveDataTableCalculationRowsQuery(statsQuery, "site", "A");

  it("returns rows plus match counts", () => {
    const result = parseDataTableCalculationRowsBody(
      {
        rows: [{ site: "A", count: 1 }],
        rowsMatched: 12,
        totalRows: 100,
      },
      query
    );
    expect(result.rows).toEqual([{ site: "A", count: 1 }]);
    expect(result.rowsMatched).toBe(12);
    expect(result.totalRows).toBe(100);
    expect(result.query).toBe(query);
  });

  it("rejects malformed bodies", () => {
    expect(() => parseDataTableCalculationRowsBody(null, query)).toThrow();
    expect(() =>
      parseDataTableCalculationRowsBody({ groups: [] }, query)
    ).toThrow();
    expect(() => parseDataTableCalculationRowsBody([], query)).toThrow();
  });

  it("drops non-object rows", () => {
    const result = parseDataTableCalculationRowsBody(
      { rows: [{ a: 1 }, null, "x", 4, ["y"]], rowsMatched: 1, totalRows: 1 },
      query
    );
    expect(result.rows).toEqual([{ a: 1 }]);
  });
});

/**
 * Step filtering in the rows modal mirrors the engine's row↔step assignment
 * (`stepsOverlappingInterval` in pmtiles-server). Both expand step keys with
 * the shared `expandTemporalIso` and use half-open interval overlap.
 */
describe("client-side step filtering (rowWhenOverlapsStep)", () => {
  const sec = (iso: string) => Date.parse(iso) / 1000;
  const row = (start: string, end: string) => ({
    [WHEN_START_COLUMN]: sec(start),
    [WHEN_END_COLUMN]: sec(end),
  });

  it("infers step precision from key length", () => {
    expect(precisionForStep("2018")).toBe("year");
    expect(precisionForStep("2018-06")).toBe("month");
    expect(precisionForStep("2018-06-15")).toBe("day");
  });

  it("expands step keys to calendar-aligned half-open intervals", () => {
    expect(stepIntervalSeconds("2018")).toEqual({
      startSec: sec("2018-01-01T00:00:00Z"),
      endSec: sec("2019-01-01T00:00:00Z"),
    });
    expect(stepIntervalSeconds("2018-06")).toEqual({
      startSec: sec("2018-06-01T00:00:00Z"),
      endSec: sec("2018-07-01T00:00:00Z"),
    });
    expect(stepIntervalSeconds("not-a-step")).toBeNull();
  });

  it("uses the engine's half-open overlap rule", () => {
    const june = "2018-06";
    // Fully inside
    expect(
      rowWhenOverlapsStep(row("2018-06-10", "2018-06-11"), june)
    ).toBe(true);
    // Spanning the whole step
    expect(
      rowWhenOverlapsStep(row("2018-01-01", "2019-01-01"), june)
    ).toBe(true);
    // Partial overlap at either edge
    expect(
      rowWhenOverlapsStep(row("2018-05-20", "2018-06-02"), june)
    ).toBe(true);
    expect(
      rowWhenOverlapsStep(row("2018-06-30", "2018-07-05"), june)
    ).toBe(true);
    // Half-open: a row ending exactly at the step start does not overlap,
    // nor does a row starting exactly at the step end.
    expect(
      rowWhenOverlapsStep(row("2018-05-01", "2018-06-01"), june)
    ).toBe(false);
    expect(
      rowWhenOverlapsStep(row("2018-07-01", "2018-07-10"), june)
    ).toBe(false);
  });

  it("excludes rows without numeric _when_* values", () => {
    expect(rowWhenOverlapsStep({}, "2018")).toBe(false);
    expect(
      rowWhenOverlapsStep(
        { [WHEN_START_COLUMN]: null, [WHEN_END_COLUMN]: null },
        "2018"
      )
    ).toBe(false);
  });
});

describe("filterRowsOverlappingSteps", () => {
  const sec = (iso: string) => Date.parse(iso) / 1000;
  const row = (start: string, end: string) => ({
    [WHEN_START_COLUMN]: sec(start),
    [WHEN_END_COLUMN]: sec(end),
  });

  it("keeps rows that overlap any step in a date range and skips gaps", () => {
    const rows = [
      row("2023-06-01", "2023-06-02"),
      row("2024-01-15", "2024-01-16"),
      row("2019-05-01", "2019-05-02"),
    ];
    expect(filterRowsOverlappingSteps(rows, ["2023", "2024"])).toEqual([
      rows[0],
      rows[1],
    ]);
    // 2019 sits between 2018 and 2020; the outer bounds must not swallow it.
    expect(
      filterRowsOverlappingSteps(
        [row("2019-03-01", "2019-03-02")],
        ["2018", "2020"]
      )
    ).toEqual([]);
  });

  it("returns nothing when no step expands", () => {
    expect(
      filterRowsOverlappingSteps([row("2018-01-01", "2018-02-01")], ["nope"])
    ).toEqual([]);
  });
});

describe("resolveCalculationRowsSelection", () => {
  const observed = ["2018", "2023", "2024"];

  it("keeps a date-range clock on the whole window", () => {
    expect(
      resolveCalculationRowsSelection(undefined, observed, ["2023", "2024"])
    ).toBe("window");
    // A range is the audit target even before per-step series points arrive,
    // so the modal cannot snap to the latest year once they do.
    expect(
      resolveCalculationRowsSelection(undefined, [], ["2023", "2024"])
    ).toBe("window");
  });

  it("keeps an explicit step, range, or all-steps choice", () => {
    expect(
      resolveCalculationRowsSelection("2018", observed, ["2023", "2024"])
    ).toBe("2018");
    expect(
      resolveCalculationRowsSelection("window", observed, ["2023", "2024"])
    ).toBe("window");
    expect(
      resolveCalculationRowsSelection("all", observed, ["2023", "2024"])
    ).toBe("all");
  });

  it("drops a step the site did not observe and returns to the clock", () => {
    expect(
      resolveCalculationRowsSelection("2010", observed, ["2023", "2024"])
    ).toBe("window");
    expect(
      resolveCalculationRowsSelection("2010", observed, ["2024"])
    ).toBe("2024");
  });

  it("selects the instant clock step, or the latest observed step", () => {
    expect(
      resolveCalculationRowsSelection(undefined, observed, ["2023"])
    ).toBe("2023");
    expect(
      resolveCalculationRowsSelection(undefined, observed, ["1999"])
    ).toBe("2024");
    expect(resolveCalculationRowsSelection(undefined, [], [])).toBeUndefined();
  });
});

describe("calculationRowsToCsv", () => {
  it("writes visible columns, blanks nulls, and keeps zeros", () => {
    const csv = calculationRowsToCsv(
      [
        { id: "survey_year", label: "survey year" },
        { id: "count", label: "count" },
        { id: "sex", label: "sex" },
      ],
      [
        { survey_year: 2024, count: 0, sex: null },
        { survey_year: 2023, count: 2, sex: "FEMALE" },
      ]
    );
    expect(csv).toBe(
      ["survey year,count,sex", "2024,0,", "2023,2,FEMALE"].join("\n")
    );
  });

  it("quotes commas and disambiguates duplicate labels", () => {
    const csv = calculationRowsToCsv(
      [
        { id: "a", label: "note" },
        { id: "b", label: "note" },
      ],
      [{ a: "north, west", b: "reef" }]
    );
    expect(csv).toBe(["note,note (b)", '"north, west",reef'].join("\n"));
  });

  it("builds a safe download filename", () => {
    expect(
      calculationRowsExportFilename([
        "Fish transects",
        "SOL_SCORPION_W",
        "2023 – 2024",
      ])
    ).toBe("Fish-transects-SOL_SCORPION_W-2023-–-2024.csv");
    expect(calculationRowsExportFilename(["", "  "])).toBe("rows.csv");
  });
});

describe("defaultHiddenCalculationColumns", () => {
  const columns = ["year", "count", "classcode", "site", "campus", "method"];
  const rows = [
    { year: 2024, count: 1, classcode: "PNEB", site: "A", campus: "VRG", method: "SBTL" },
    { year: 2023, count: 0, classcode: "PNEB", site: "A", campus: "VRG", method: "SBTL" },
    { year: 2024, count: null, classcode: "PNEB", site: "A", campus: "VRG", method: "SBTL" },
  ];

  it("hides constant columns, keeping filter/temporal/organism/measure columns", () => {
    const hidden = defaultHiddenCalculationColumns(columns, rows, {
      filterColumns: ["classcode"],
      temporalSourceColumns: ["year"],
      organismColumn: "classcode",
      measureColumn: "count",
    });
    // site, campus, and method are constant; classcode is constant but kept
    // as an active filter + organism identifier.
    expect(hidden).toEqual(new Set(["site", "campus", "method"]));
  });

  it("does not hide columns that vary, and treats missing values as null", () => {
    const hidden = defaultHiddenCalculationColumns(
      ["a", "b"],
      [{ a: 1, b: null }, { a: 1 }, { a: 2, b: null }],
      { filterColumns: [], temporalSourceColumns: [] }
    );
    // `a` varies; `b` is consistently null/undefined → hidden.
    expect(hidden).toEqual(new Set(["b"]));
  });

  it("hides nothing before rows load", () => {
    expect(
      defaultHiddenCalculationColumns(columns, [], {
        filterColumns: [],
        temporalSourceColumns: [],
      })
    ).toEqual(new Set());
  });
});
