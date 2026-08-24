import { describe, expect, it } from "@jest/globals";
import { createLayerYearTemporalInfo } from "@seasketch/geostats-types";
import { DataSourceTypes } from "../../../generated/graphql";
import {
  allowedTemporalModes,
  coerceSpanValue,
  exclusiveEndFromInclusive,
  formStateFromTemporal,
  inclusiveThroughFromExclusive,
  inferTemporalMode,
  isOneUnitInterval,
  sourceSupportsTemporalEditor,
  sourceTemporalCapabilities,
  spanPickerType,
  summarizeTemporalInfo,
  temporalFromFormState,
} from "./temporalCoverageForm";

describe("exclusive / inclusive ends", () => {
  it("advances a year", () => {
    expect(exclusiveEndFromInclusive("1996", "year")).toBe("1997");
  });

  it("rolls a month into the next year", () => {
    expect(exclusiveEndFromInclusive("2020-11", "month")).toBe("2020-12");
    expect(exclusiveEndFromInclusive("2020-12", "month")).toBe("2021-01");
  });

  it("converts exclusive end back to inclusive through", () => {
    expect(inclusiveThroughFromExclusive("1997", "year")).toBe("1996");
    expect(inclusiveThroughFromExclusive("2020-12", "month")).toBe("2020-11");
    expect(inclusiveThroughFromExclusive("2021-01", "month")).toBe("2020-12");
  });

  it("detects a one-unit interval", () => {
    expect(isOneUnitInterval("1996", "1997", "year")).toBe(true);
    expect(isOneUnitInterval("1996", "2011", "year")).toBe(false);
    expect(isOneUnitInterval("1996", null, "year")).toBe(false);
  });
});

describe("temporalFromFormState", () => {
  it("clears coverage for none", () => {
    expect(
      temporalFromFormState({
        mode: "none",
        year: "1996",
        month: "",
        from: "",
        through: "",
        spanPrecision: "year",
        ongoing: false,
      })
    ).toEqual({ ok: true, temporal: null });
  });

  it("writes a single-year layer document", () => {
    const result = temporalFromFormState({
      mode: "year",
      year: "1996",
      month: "",
      from: "",
      through: "",
      spanPrecision: "year",
      ongoing: false,
    });
    expect(result).toEqual({
      ok: true,
      temporal: createLayerYearTemporalInfo(1996),
    });
  });

  it("writes an inclusive last year as an exclusive end", () => {
    const result = temporalFromFormState({
      mode: "span",
      year: "",
      month: "",
      from: "1996",
      through: "2010",
      spanPrecision: "year",
      ongoing: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.temporal) {
      expect(result.temporal.coverage).toEqual({
        kind: "interval",
        start: "1996",
        end: "2011",
        precision: "year",
      });
    }
  });

  it("writes an open-ended span", () => {
    const result = temporalFromFormState({
      mode: "span",
      year: "",
      month: "",
      from: "2012",
      through: "",
      spanPrecision: "year",
      ongoing: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.temporal) {
      expect(result.temporal.coverage.end).toBeNull();
    }
  });

  it("refuses column and band modes", () => {
    expect(
      temporalFromFormState({
        mode: "column",
        year: "",
        month: "",
        from: "",
        through: "",
        spanPrecision: "year",
        ongoing: false,
      }).ok
    ).toBe(false);
  });
});

describe("formStateFromTemporal / infer", () => {
  const layerCaps = { hasColumn: false, hasBands: false };

  it("opens null coverage on none", () => {
    expect(inferTemporalMode(null, layerCaps)).toBe("none");
    expect(formStateFromTemporal(null, layerCaps).mode).toBe("none");
  });

  it("opens a one-year document on year", () => {
    const info = createLayerYearTemporalInfo(1996);
    expect(inferTemporalMode(info, layerCaps)).toBe("year");
    expect(formStateFromTemporal(info, layerCaps).year).toBe("1996");
  });

  it("opens a multi-year document on span", () => {
    const info = createLayerYearTemporalInfo(1996);
    info.coverage.end = "2011";
    expect(inferTemporalMode(info, layerCaps)).toBe("span");
    const state = formStateFromTemporal(info, layerCaps);
    expect(state.from).toBe("1996");
    expect(state.through).toBe("2010");
    expect(state.ongoing).toBe(false);
  });
});

describe("sourceSupportsTemporalEditor", () => {
  it("allows SeaSketch-hosted vector and raster sources", () => {
    expect(sourceSupportsTemporalEditor(DataSourceTypes.SeasketchRaster)).toBe(
      true
    );
    expect(sourceSupportsTemporalEditor(DataSourceTypes.SeasketchMvt)).toBe(
      true
    );
    expect(sourceSupportsTemporalEditor(DataSourceTypes.SeasketchVector)).toBe(
      true
    );
  });

  it("allows remote tiles and GeoJSON", () => {
    expect(sourceSupportsTemporalEditor(DataSourceTypes.Vector)).toBe(true);
    expect(sourceSupportsTemporalEditor(DataSourceTypes.Raster)).toBe(true);
    expect(sourceSupportsTemporalEditor(DataSourceTypes.RasterDem)).toBe(true);
    expect(sourceSupportsTemporalEditor(DataSourceTypes.Geojson)).toBe(true);
  });

  it("hides the editor for ArcGIS and other remote services", () => {
    expect(
      sourceSupportsTemporalEditor(DataSourceTypes.ArcgisDynamicMapserver)
    ).toBe(false);
    expect(sourceSupportsTemporalEditor(DataSourceTypes.ArcgisVector)).toBe(
      false
    );
    expect(sourceSupportsTemporalEditor(DataSourceTypes.ArcgisRasterTiles)).toBe(
      false
    );
    expect(sourceSupportsTemporalEditor(DataSourceTypes.Inaturalist)).toBe(
      false
    );
    expect(sourceSupportsTemporalEditor(DataSourceTypes.Image)).toBe(false);
    expect(sourceSupportsTemporalEditor(null)).toBe(false);
  });
});

describe("sourceTemporalCapabilities", () => {
  it("omits column and bands on a single-band raster", () => {
    const caps = sourceTemporalCapabilities({
      type: DataSourceTypes.SeasketchRaster,
      geostats: { bands: [{ name: "b1" }], presentation: 0 },
    });
    expect(caps).toEqual({ hasColumn: false, hasBands: false });
    expect(allowedTemporalModes(caps)).toEqual([
      "none",
      "year",
      "month",
      "span",
    ]);
  });

  it("offers bands when the raster has more than one band", () => {
    const caps = sourceTemporalCapabilities({
      type: DataSourceTypes.SeasketchRaster,
      geostats: {
        bands: [{ name: "b1" }, { name: "b2" }],
        presentation: 0,
      },
    });
    expect(caps.hasBands).toBe(true);
    expect(allowedTemporalModes(caps)).toContain("bands");
    expect(allowedTemporalModes(caps)).not.toContain("column");
  });

  it("offers a column on vector sources", () => {
    const caps = sourceTemporalCapabilities({
      type: DataSourceTypes.SeasketchMvt,
      geostats: null,
    });
    expect(caps).toEqual({ hasColumn: true, hasBands: false });
  });

  it("offers a column on remote GeoJSON and vector tiles", () => {
    expect(
      sourceTemporalCapabilities({
        type: DataSourceTypes.Geojson,
        geostats: null,
      })
    ).toEqual({ hasColumn: true, hasBands: false });
    expect(
      sourceTemporalCapabilities({
        type: DataSourceTypes.Vector,
        geostats: null,
      })
    ).toEqual({ hasColumn: true, hasBands: false });
  });

  it("does not treat ArcGIS services as temporal-capable", () => {
    expect(
      sourceTemporalCapabilities({
        type: DataSourceTypes.ArcgisDynamicMapserver,
        geostats: null,
      })
    ).toEqual({ hasColumn: false, hasBands: false });
  });
});

describe("coerceSpanValue / picker type", () => {
  it("widens a year to month and day", () => {
    expect(coerceSpanValue("2018", "month")).toBe("2018-01");
    expect(coerceSpanValue("2018", "day")).toBe("2018-01-01");
  });

  it("narrows a day to month and year", () => {
    expect(coerceSpanValue("2018-03-15", "month")).toBe("2018-03");
    expect(coerceSpanValue("2018-03-15", "year")).toBe("2018");
  });

  it("picks a native control per unit", () => {
    expect(spanPickerType("year")).toBe("text");
    expect(spanPickerType("month")).toBe("month");
    expect(spanPickerType("day")).toBe("date");
  });
});

describe("summarizeTemporalInfo", () => {
  it("labels a single year", () => {
    expect(summarizeTemporalInfo(createLayerYearTemporalInfo(1996), "present")).toEqual({
      label: "1996",
      chip: null,
    });
  });

  it("returns empty for null", () => {
    expect(summarizeTemporalInfo(null, "present")).toEqual({
      label: "",
      chip: null,
    });
  });
});
