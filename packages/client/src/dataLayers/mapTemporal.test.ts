import { describe, expect, it } from "@jest/globals";
import { createLayerYearTemporalInfo } from "@seasketch/geostats-types";
import {
  collectVisibleTemporalSources,
  coverageKey,
  enumerateSteps,
  formatIsoFromMs,
  hasInternalTimeSeries,
  instantClockForStep,
  latestClock,
  layoutTimeSliderCoverageMarks,
  layoutTimeSliderSteps,
  nearestTimeSliderStepIndex,
  reconcileClock,
  shouldShowTimeSlider,
  sourceParticipatesInMapClock,
  tocIdsHiddenByClock,
  VisibleTemporalSource,
} from "./mapTemporal";

function yearSource(
  tocStableId: string,
  year: number,
  dataSourceId = year
): VisibleTemporalSource {
  return {
    tocStableId,
    dataSourceId,
    temporal: createLayerYearTemporalInfo(year),
  };
}

describe("shouldShowTimeSlider", () => {
  it("hides when nothing temporal is visible", () => {
    expect(shouldShowTimeSlider([])).toBe(false);
  });

  it("hides a single layer-level year", () => {
    expect(shouldShowTimeSlider([yearSource("a", 2018)])).toBe(false);
  });

  it("hides two layers that share one span", () => {
    expect(
      shouldShowTimeSlider([yearSource("a", 2018, 1), yearSource("b", 2018, 2)])
    ).toBe(false);
  });

  it("shows two layers with different years", () => {
    expect(
      shouldShowTimeSlider([yearSource("a", 2018), yearSource("b", 2020)])
    ).toBe(true);
  });

  it("shows a single band-mapped source", () => {
    const temporal = createLayerYearTemporalInfo(1985);
    temporal.granularity = "band";
    temporal.coverage.end = "2026";
    expect(
      shouldShowTimeSlider([{ tocStableId: "gmw", dataSourceId: 1, temporal }])
    ).toBe(true);
  });

  it("shows a single feature-timed source", () => {
    const temporal = createLayerYearTemporalInfo(2019);
    temporal.granularity = "feature";
    expect(
      shouldShowTimeSlider([{ tocStableId: "shark", dataSourceId: 2, temporal }])
    ).toBe(true);
  });
});

describe("hasInternalTimeSeries / coverageKey", () => {
  it("treats layer as not internal", () => {
    expect(hasInternalTimeSeries(createLayerYearTemporalInfo(2018))).toBe(
      false
    );
  });

  it("keys coverage by start, exclusive end, and precision", () => {
    const a = createLayerYearTemporalInfo(2018).coverage;
    const b = createLayerYearTemporalInfo(2018).coverage;
    expect(coverageKey(a)).toBe(coverageKey(b));
    expect(coverageKey(a)).not.toBe(
      coverageKey(createLayerYearTemporalInfo(2019).coverage)
    );
  });
});

describe("steps and clocks", () => {
  it("formats a year and a month", () => {
    expect(formatIsoFromMs(Date.UTC(2018, 0, 1), "year")).toBe("2018");
    expect(formatIsoFromMs(Date.UTC(2018, 5, 15), "month")).toBe("2018-06");
  });

  it("enumerates inclusive years up to an exclusive end", () => {
    expect(
      enumerateSteps(
        {
          kind: "interval",
          start: "1996",
          end: "1999",
          precision: "year",
        },
        "year"
      )
    ).toEqual(["1996", "1997", "1998"]);
  });

  it("builds an instant clock for one year step", () => {
    expect(instantClockForStep("2018", "year")).toEqual({
      mode: "instant",
      start: "2018",
      end: "2019",
      viewResolution: "year",
    });
  });

  it("picks the latest step in the domain", () => {
    const domain = {
      kind: "interval" as const,
      start: "2015",
      end: "2018",
      precision: "year" as const,
    };
    expect(latestClock(domain, "year")).toEqual({
      mode: "instant",
      start: "2017",
      end: "2018",
      viewResolution: "year",
    });
  });

  it("anchors ten annual steps at the midpoint of each year span", () => {
    const layouts = layoutTimeSliderSteps(
      {
        kind: "interval",
        start: "2011",
        end: "2021",
        precision: "year",
      },
      "year"
    );
    expect(layouts.map((layout) => layout.step)).toEqual([
      "2011",
      "2012",
      "2013",
      "2014",
      "2015",
      "2016",
      "2017",
      "2018",
      "2019",
      "2020",
    ]);
    expect(layouts.map((layout) => layout.midPct)).toEqual([
      5, 15, 25, 35, 45, 55, 65, 75, 85, 95,
    ]);
  });

  it("maps a pointer to the year span it sits in, not the nearest native tick", () => {
    const layouts = layoutTimeSliderSteps(
      {
        kind: "interval",
        start: "2011",
        end: "2021",
        precision: "year",
      },
      "year"
    );
    expect(nearestTimeSliderStepIndex(layouts, 0)).toBe(0);
    expect(nearestTimeSliderStepIndex(layouts, 7)).toBe(0);
    expect(nearestTimeSliderStepIndex(layouts, 10)).toBe(1);
    expect(nearestTimeSliderStepIndex(layouts, 95)).toBe(9);
    expect(nearestTimeSliderStepIndex(layouts, 100)).toBe(9);
  });

  it("paints a single-year coverage mark on that year's slot", () => {
    const layouts = layoutTimeSliderSteps(
      {
        kind: "interval",
        start: "2011",
        end: "2021",
        precision: "year",
      },
      "year"
    );
    expect(
      layoutTimeSliderCoverageMarks(layouts, [yearSource("gmw-2011", 2011)], "year")
    ).toEqual([{ id: "gmw-2011", left: 0, width: 10 }]);
    expect(
      layoutTimeSliderCoverageMarks(layouts, [yearSource("gmw-2020", 2020)], "year")
    ).toEqual([{ id: "gmw-2020", left: 90, width: 10 }]);
  });
});

describe("reconcileClock", () => {
  const domain = {
    kind: "interval" as const,
    start: "2015",
    end: "2021",
    precision: "year" as const,
  };

  it("defaults to the latest year when there is no clock", () => {
    const clock = reconcileClock(null, domain, "year", [], [
      yearSource("a", 2015),
      yearSource("b", 2020),
    ]);
    expect(clock?.start).toBe("2020");
  });

  it("keeps a valid clock when the new layer still intersects", () => {
    const previous = instantClockForStep("2018", "year");
    const clock = reconcileClock(
      previous,
      domain,
      "year",
      ["a"],
      [yearSource("a", 2018), yearSource("b", 2018)]
    );
    expect(clock?.start).toBe("2018");
  });

  it("snaps to a newly toggled year so it is not filtered out", () => {
    const previous = instantClockForStep("2015", "year");
    const clock = reconcileClock(
      previous,
      domain,
      "year",
      ["a"],
      [yearSource("a", 2015), yearSource("b", 2020)]
    );
    expect(clock?.start).toBe("2020");
  });
});

describe("sourceParticipatesInMapClock", () => {
  it("ignores ArcGIS services", () => {
    expect(sourceParticipatesInMapClock("ARCGIS_DYNAMIC_MAPSERVER")).toBe(
      false
    );
    expect(
      sourceParticipatesInMapClock(
        "ARCGIS_DYNAMIC_MAPSERVER_RASTER_SUBLAYER"
      )
    ).toBe(false);
    expect(
      sourceParticipatesInMapClock(
        "ARCGIS_DYNAMIC_MAPSERVER_VECTOR_SUBLAYER"
      )
    ).toBe(false);
    expect(sourceParticipatesInMapClock("ARCGIS_RASTER_TILES")).toBe(false);
    expect(sourceParticipatesInMapClock("ARCGIS_VECTOR")).toBe(false);
  });

  it("includes hosted tilesets", () => {
    expect(sourceParticipatesInMapClock("SEASKETCH_RASTER")).toBe(true);
    expect(sourceParticipatesInMapClock("SEASKETCH_MVT")).toBe(true);
  });
});

describe("collectVisibleTemporalSources", () => {
  const layerStates = { a: { visible: true, hidden: false } };

  it("skips ArcGIS dynamic services even when temporal metadata is set", () => {
    expect(
      collectVisibleTemporalSources(
        layerStates as any,
        [{ isFolder: false, dataLayerId: 1, stableId: "a" }] as any,
        [{ id: 1, dataSourceId: 9 }] as any,
        [
          {
            id: 9,
            type: "ARCGIS_DYNAMIC_MAPSERVER",
            temporal: createLayerYearTemporalInfo(2018),
          },
        ] as any
      )
    ).toEqual([]);
  });

  it("includes hosted rasters with temporal metadata", () => {
    expect(
      collectVisibleTemporalSources(
        layerStates as any,
        [{ isFolder: false, dataLayerId: 1, stableId: "a" }] as any,
        [{ id: 1, dataSourceId: 9 }] as any,
        [
          {
            id: 9,
            type: "SEASKETCH_RASTER",
            temporal: createLayerYearTemporalInfo(2018),
          },
        ] as any
      )
    ).toEqual([
      {
        tocStableId: "a",
        dataSourceId: 9,
        temporal: createLayerYearTemporalInfo(2018),
      },
    ]);
  });
});

describe("tocIdsHiddenByClock", () => {
  it("hides layer-granularity sources that miss the clock", () => {
    const clock = instantClockForStep("2018", "year")!;
    expect(
      tocIdsHiddenByClock(
        [yearSource("a", 2018), yearSource("b", 2020)],
        clock
      )
    ).toEqual(["b"]);
  });

  it("does not hide a band source for missing the clock", () => {
    const temporal = createLayerYearTemporalInfo(1985);
    temporal.granularity = "band";
    temporal.coverage.end = "2026";
    const clock = instantClockForStep("2018", "year")!;
    expect(
      tocIdsHiddenByClock(
        [{ tocStableId: "gmw", dataSourceId: 1, temporal }],
        clock
      )
    ).toEqual([]);
  });
});
