import { TemporalInfo } from "@seasketch/geostats-types";
import { dataTableEventDescription } from "./dataTableSummary";
import {
  DATA_TABLE_TEMPORAL_FIELD_GROUP,
  isTemporalReprocess,
  mappingLabel,
  temporalSettingsChange,
  temporalSettingsSnapshot,
} from "./dataTableTemporalChange";

const yearRow = (start: string, end: string, column: string): TemporalInfo => ({
  version: 1,
  granularity: "row",
  coverage: {
    kind: "interval",
    start,
    end,
    precision: "year",
  },
  nativeResolution: "year",
  defaultViewResolution: "year",
  supportedViewResolutions: ["year"],
  mapping: {
    type: "row",
    startColumn: "_when_start",
    endColumn: "_when_end",
    sourceColumns: {
      kind: "instant",
      column,
      format: "year",
    },
  },
  authoredBy: "admin",
});

describe("dataTableTemporalChange", () => {
  it("labels an instant year mapping", () => {
    expect(mappingLabel(yearRow("2018", "2019", "survey_year"), "None")).toBe(
      "survey_year (year)"
    );
  });

  it("labels a component mapping", () => {
    const temporal: TemporalInfo = {
      ...yearRow("2018", "2020", "yr"),
      mapping: {
        type: "row",
        startColumn: "_when_start",
        endColumn: "_when_end",
        sourceColumns: {
          kind: "components",
          year: "yr",
          month: "mo",
        },
      },
    };
    expect(mappingLabel(temporal, "None")).toBe("yr + mo");
  });

  it("returns None when temporal is missing", () => {
    expect(mappingLabel(null, "None")).toBe("None");
    expect(mappingLabel(undefined, "None")).toBe("None");
    expect(mappingLabel({}, "None")).toBe("None");
  });

  it("spaces ISO date ranges and converts exclusive end to inclusive", () => {
    const temporal: TemporalInfo = {
      ...yearRow("1999-09-07", "2024-12-22", "survey_year"),
      coverage: {
        kind: "interval",
        start: "1999-09-07",
        end: "2024-12-22",
        precision: "day",
      },
      nativeResolution: "day",
      defaultViewResolution: "year",
    };
    expect(
      temporalSettingsSnapshot(temporal, "None", "present").coverageLabel
    ).toBe("1999-09-07 \u2013 2024-12-21");
  });

  it("snapshots coverage and view settings", () => {
    const snap = temporalSettingsSnapshot(
      yearRow("2018", "2026", "survey_year"),
      "None",
      "present"
    );
    expect(snap.coverageLabel).toBe("2018–2025");
    expect(snap.mappingLabel).toBe("survey_year (year)");
    expect(snap.defaultViewResolution).toBe("year");
    expect(snap.supportedViewResolutions).toBe("year");
  });

  it("detects coverage vs mapping vs view changes", () => {
    const from = yearRow("2018", "2019", "survey_year");
    const coverage = yearRow("1999", "2026", "survey_year");
    const mapping = yearRow("2018", "2019", "DATE");
    const view: TemporalInfo = {
      ...from,
      defaultViewResolution: "month",
      supportedViewResolutions: ["year", "month"],
    };
    expect(temporalSettingsChange(from, coverage, "None", "present")).toEqual({
      coverage: true,
      mapping: false,
      defaultView: false,
      supportedViews: false,
    });
    expect(temporalSettingsChange(from, mapping, "None", "present")).toEqual({
      coverage: false,
      mapping: true,
      defaultView: false,
      supportedViews: false,
    });
    expect(temporalSettingsChange(from, view, "None", "present")).toEqual({
      coverage: false,
      mapping: false,
      defaultView: true,
      supportedViews: true,
    });
  });

  it("treats meta.reprocessed or a version bump as a reprocess", () => {
    expect(
      isTemporalReprocess(
        { version: 1 },
        { version: 1 },
        { reprocessed: true }
      )
    ).toBe(true);
    expect(
      isTemporalReprocess({ version: 1 }, { version: 2 }, { reprocessed: false })
    ).toBe(true);
    expect(
      isTemporalReprocess({ version: 1 }, { version: 1 }, { reprocessed: false })
    ).toBe(false);
  });

  it("describes reprocess vs in-place coverage updates", () => {
    const t = (key: string, opts?: Record<string, unknown>) => {
      if (!opts) return key;
      return Object.entries(opts).reduce(
        (acc, [name, value]) => acc.replace(`{{${name}}}`, String(value)),
        key
      );
    };
    const from = {
      name: "UPC",
      version: 1,
      temporal: yearRow("2018", "2019", "survey_year"),
    };
    const to = {
      name: "UPC",
      version: 2,
      temporal: yearRow("1999", "2026", "survey_year"),
    };
    expect(
      dataTableEventDescription(
        DATA_TABLE_TEMPORAL_FIELD_GROUP,
        from,
        to,
        t,
        { reprocessed: true }
      )
    ).toBe(
      "Reprocessed UPC temporal settings (2018 → 1999–2025)"
    );
    expect(
      dataTableEventDescription(
        DATA_TABLE_TEMPORAL_FIELD_GROUP,
        { name: "UPC", version: 1, temporal: from.temporal },
        { name: "UPC", version: 1, temporal: null },
        t
      )
    ).toBe("Cleared UPC temporal coverage");
  });
});
