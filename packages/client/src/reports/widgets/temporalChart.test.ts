import { createLayerYearTemporalInfo } from "@seasketch/geostats-types";
import {
  coverageForSource,
  findTimeSeriesSiblingStableIds,
  findTimeSeriesSiblings,
  isLayerGranularityTemporal,
  rasterBandValueDomain,
  splitObservedRuns,
  titleKeyWithoutDates,
  unionRasterValueDomain,
  vectorGeometryFamily,
} from "./temporalChart";

describe("titleKeyWithoutDates", () => {
  test("strips years so yearly siblings share a key", () => {
    expect(titleKeyWithoutDates("DHW 2015")).toBe("dhw");
    expect(titleKeyWithoutDates("DHW 2016")).toBe("dhw");
    expect(titleKeyWithoutDates("Global Mangrove Watch 2020")).toBe(
      "global mangrove watch"
    );
  });

  test("strips ISO dates and month names", () => {
    expect(titleKeyWithoutDates("SST 2018-06")).toBe("sst");
    expect(titleKeyWithoutDates("SST June 2018")).toBe("sst");
  });

  test("returns empty when the title is only a date", () => {
    expect(titleKeyWithoutDates("2015")).toBe("");
  });
});

describe("coverageForSource", () => {
  test("single year is a point, not a span", () => {
    const coverage = coverageForSource({
      temporal: createLayerYearTemporalInfo(2018),
    });
    expect(coverage).not.toBeNull();
    expect(coverage!.span).toBe(false);
    expect(coverage!.label).toBe("2018");
    expect(coverage!.start).toBe(Date.UTC(2018, 0, 1));
    expect(coverage!.end).toBe(Date.UTC(2019, 0, 1));
  });

  test("multi-year exclusive-end interval is a span", () => {
    const temporal = createLayerYearTemporalInfo(2015);
    temporal.coverage = {
      kind: "interval",
      start: "2015",
      end: "2021",
      precision: "year",
    };
    const coverage = coverageForSource({ temporal });
    expect(coverage!.span).toBe(true);
    expect(coverage!.label).toBe("2015–2020");
    expect(coverage!.start).toBe(Date.UTC(2015, 0, 1));
    expect(coverage!.end).toBe(Date.UTC(2021, 0, 1));
  });

  test("rejects missing or invalid temporal", () => {
    expect(coverageForSource({ temporal: null })).toBeNull();
    expect(coverageForSource({ temporal: undefined })).toBeNull();
    expect(coverageForSource({ temporal: { version: 1 } })).toBeNull();
  });
});

describe("splitObservedRuns", () => {
  test("touching year intervals are one run; a skipped year is a gap", () => {
    const samples = [
      { start: Date.UTC(2015, 0, 1), end: Date.UTC(2016, 0, 1) },
      { start: Date.UTC(2016, 0, 1), end: Date.UTC(2017, 0, 1) },
      { start: Date.UTC(2017, 0, 1), end: Date.UTC(2018, 0, 1) },
      { start: Date.UTC(2023, 0, 1), end: Date.UTC(2024, 0, 1) },
    ];
    const runs = splitObservedRuns(samples);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toHaveLength(3);
    expect(runs[1]).toHaveLength(1);
    expect(runs[1][0].start).toBe(Date.UTC(2023, 0, 1));
  });

  test("overlapping span and point stay in the same run", () => {
    const runs = splitObservedRuns([
      { start: Date.UTC(2015, 0, 1), end: Date.UTC(2021, 0, 1) },
      { start: Date.UTC(2018, 0, 1), end: Date.UTC(2019, 0, 1) },
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(2);
  });
});

describe("findTimeSeriesSiblingStableIds", () => {
  const toc = [
    {
      id: 1,
      title: "DHW 2015",
      stableId: "dhw-2015",
      parentStableId: "folder-a",
    },
    {
      id: 2,
      title: "DHW 2016",
      stableId: "dhw-2016",
      parentStableId: "folder-a",
    },
    {
      id: 3,
      title: "DHW 2017",
      stableId: "dhw-2017",
      parentStableId: "folder-b",
    },
    {
      id: 4,
      title: "Mangroves 2016",
      stableId: "gmw-2016",
      parentStableId: "folder-a",
    },
    {
      id: 5,
      title: "Nested DHW 2018",
      stableId: "nested",
      parentStableId: "subfolder",
    },
  ];
  const sources = [
    {
      stableId: "s-2015",
      tableOfContentsItemId: 1,
      rasterBandCount: 1,
      styleGroupByColumn: null,
      temporal: createLayerYearTemporalInfo(2015),
    },
    {
      stableId: "s-2016",
      tableOfContentsItemId: 2,
      rasterBandCount: 1,
      styleGroupByColumn: null,
      temporal: createLayerYearTemporalInfo(2016),
    },
    {
      stableId: "s-2017",
      tableOfContentsItemId: 3,
      rasterBandCount: 1,
      styleGroupByColumn: null,
      temporal: createLayerYearTemporalInfo(2017),
    },
    {
      stableId: "s-gmw",
      tableOfContentsItemId: 4,
      rasterBandCount: 1,
      styleGroupByColumn: "value",
      temporal: createLayerYearTemporalInfo(2016),
    },
    {
      stableId: "s-nested",
      tableOfContentsItemId: 5,
      rasterBandCount: 1,
      styleGroupByColumn: null,
      temporal: createLayerYearTemporalInfo(2018),
    },
  ];

  test("matches same-folder, same-title-key, same raster shape", () => {
    expect(
      findTimeSeriesSiblingStableIds({
        subject: sources[0],
        sources,
        tocItems: toc,
      })
    ).toEqual(["s-2016"]);
  });

  test("does not treat title-matched rasters without temporal coverage as siblings", () => {
    const timeless = sources.map((source) => ({
      ...source,
      temporal: null,
    }));
    expect(
      findTimeSeriesSiblingStableIds({
        subject: timeless[0],
        sources: timeless,
        tocItems: toc,
      })
    ).toEqual([]);
  });

  test("does not cross folders or pick a different raster type", () => {
    const ids = findTimeSeriesSiblingStableIds({
      subject: sources[0],
      sources,
      tocItems: toc,
    });
    expect(ids).not.toContain("s-2017");
    expect(ids).not.toContain("s-gmw");
    expect(ids).not.toContain("s-nested");
  });

  test("root siblings stay at the root", () => {
    const rootToc = [
      { id: 10, title: "Effort 2018", stableId: "e18", parentStableId: null },
      { id: 11, title: "Effort 2019", stableId: "e19", parentStableId: null },
      {
        id: 12,
        title: "Effort 2020",
        stableId: "e20",
        parentStableId: "folder",
      },
    ];
    const rootSources = [
      {
        stableId: "se18",
        tableOfContentsItemId: 10,
        rasterBandCount: 1,
        temporal: createLayerYearTemporalInfo(2018),
      },
      {
        stableId: "se19",
        tableOfContentsItemId: 11,
        rasterBandCount: 1,
        temporal: createLayerYearTemporalInfo(2019),
      },
      {
        stableId: "se20",
        tableOfContentsItemId: 12,
        rasterBandCount: 1,
        temporal: createLayerYearTemporalInfo(2020),
      },
    ];
    expect(
      findTimeSeriesSiblingStableIds({
        subject: rootSources[0],
        sources: rootSources,
        tocItems: rootToc,
      })
    ).toEqual(["se19"]);
  });

  test("includes unprocessed same-folder single-band rasters", () => {
    const tocWithUnprocessed = [
      ...toc,
      {
        id: 20,
        title: "DHW 2018",
        stableId: "dhw-2018",
        parentStableId: "folder-a",
        dataLayer: {
          dataSource: {
            id: 99,
            isSingleBandRaster: true,
            temporal: createLayerYearTemporalInfo(2018),
          },
        },
      },
      {
        id: 21,
        title: "DHW 2019",
        stableId: "dhw-2019",
        parentStableId: "folder-a",
        dataLayer: {
          dataSource: { id: 100, isSingleBandRaster: false },
        },
      },
      {
        id: 22,
        title: "DHW 2020",
        stableId: "dhw-2020",
        parentStableId: "folder-a",
        dataLayer: {
          dataSource: { id: 101, isSingleBandRaster: true },
        },
      },
    ];
    expect(
      findTimeSeriesSiblings({
        subject: sources[0],
        sources,
        tocItems: tocWithUnprocessed,
      })
    ).toEqual([
      {
        stableId: "s-2016",
        title: "DHW 2016",
        processed: true,
        sourceId: undefined,
      },
      {
        stableId: "dhw-2018",
        title: "DHW 2018",
        processed: false,
        sourceId: 99,
      },
    ]);
  });
});

describe("vectorGeometryFamily", () => {
  test("collapses Multi* types and rejects junk", () => {
    expect(vectorGeometryFamily("Polygon")).toBe("polygon");
    expect(vectorGeometryFamily("MultiPolygon")).toBe("polygon");
    expect(vectorGeometryFamily("LineString")).toBe("line");
    expect(vectorGeometryFamily("Point")).toBe("point");
    expect(vectorGeometryFamily(null)).toBeNull();
    expect(vectorGeometryFamily("SingleBandRaster")).toBeNull();
  });
});

describe("findTimeSeriesSiblings vector layers", () => {
  const toc = [
    {
      id: 1,
      title: "Reefs 2015",
      stableId: "reefs-2015",
      parentStableId: "folder-a",
    },
    {
      id: 2,
      title: "Reefs 2016",
      stableId: "reefs-2016",
      parentStableId: "folder-a",
    },
    {
      id: 3,
      title: "Reefs 2017",
      stableId: "reefs-2017",
      parentStableId: "folder-b",
    },
    {
      id: 4,
      title: "Reefs 2016",
      stableId: "reefs-points",
      parentStableId: "folder-a",
    },
  ];
  const sources = [
    {
      stableId: "v-2015",
      tableOfContentsItemId: 1,
      vectorGeometryType: "Polygon",
      temporal: createLayerYearTemporalInfo(2015),
    },
    {
      stableId: "v-2016",
      tableOfContentsItemId: 2,
      vectorGeometryType: "MultiPolygon",
      temporal: createLayerYearTemporalInfo(2016),
    },
    {
      stableId: "v-2017",
      tableOfContentsItemId: 3,
      vectorGeometryType: "Polygon",
      temporal: createLayerYearTemporalInfo(2017),
    },
    {
      stableId: "v-points",
      tableOfContentsItemId: 4,
      vectorGeometryType: "Point",
      temporal: createLayerYearTemporalInfo(2016),
    },
  ];

  test("matches same-folder yearly polygons including MultiPolygon", () => {
    expect(
      findTimeSeriesSiblingStableIds({
        subject: sources[0],
        sources,
        tocItems: toc,
      })
    ).toEqual(["v-2016"]);
  });

  test("does not cross folders or match a different geometry family", () => {
    const ids = findTimeSeriesSiblingStableIds({
      subject: sources[0],
      sources,
      tocItems: toc,
    });
    expect(ids).not.toContain("v-2017");
    expect(ids).not.toContain("v-points");
  });

  test("rejects feature-granularity subjects and siblings", () => {
    const featureTemporal = {
      version: 1 as const,
      granularity: "feature" as const,
      coverage: {
        kind: "interval" as const,
        start: "2015",
        end: "2016",
        precision: "year" as const,
      },
      nativeResolution: "year" as const,
      defaultViewResolution: "year" as const,
      mapping: {
        type: "feature" as const,
        startColumn: "_when_start" as const,
        endColumn: "_when_end" as const,
      },
    };
    expect(isLayerGranularityTemporal({ temporal: featureTemporal })).toBe(
      false
    );
    expect(
      findTimeSeriesSiblingStableIds({
        subject: { ...sources[0], temporal: featureTemporal },
        sources,
        tocItems: toc,
      })
    ).toEqual([]);
    expect(
      findTimeSeriesSiblingStableIds({
        subject: sources[0],
        sources: sources.map((source, index) =>
          index === 1 ? { ...source, temporal: featureTemporal } : source
        ),
        tocItems: toc,
      })
    ).toEqual([]);
  });

  test("does not match a raster with the same title", () => {
    expect(
      findTimeSeriesSiblingStableIds({
        subject: sources[0],
        sources: [
          ...sources,
          {
            stableId: "r-2016",
            tableOfContentsItemId: 2,
            rasterBandCount: 1,
            temporal: createLayerYearTemporalInfo(2016),
          },
        ],
        tocItems: toc,
      })
    ).toEqual(["v-2016"]);
  });

  test("includes unprocessed same-folder vector siblings", () => {
    const tocWithUnprocessed = [
      ...toc,
      {
        id: 20,
        title: "Reefs 2018",
        stableId: "reefs-2018",
        parentStableId: "folder-a",
        dataLayer: {
          dataSource: {
            id: 77,
            vectorGeometryType: "Polygon",
            temporal: createLayerYearTemporalInfo(2018),
          },
        },
      },
      {
        id: 21,
        title: "Reefs 2019",
        stableId: "reefs-2019",
        parentStableId: "folder-a",
        dataLayer: {
          dataSource: {
            id: 78,
            vectorGeometryType: "Point",
            temporal: createLayerYearTemporalInfo(2019),
          },
        },
      },
    ];
    expect(
      findTimeSeriesSiblings({
        subject: sources[0],
        sources,
        tocItems: tocWithUnprocessed,
      })
    ).toEqual([
      {
        stableId: "v-2016",
        title: "Reefs 2016",
        processed: true,
        sourceId: undefined,
      },
      {
        stableId: "reefs-2018",
        title: "Reefs 2018",
        processed: false,
        sourceId: 77,
      },
    ]);
  });
});

describe("rasterBandValueDomain", () => {
  test("reads the first band and rejects junk", () => {
    expect(rasterBandValueDomain(null)).toBeNull();
    expect(rasterBandValueDomain(undefined)).toBeNull();
    expect(rasterBandValueDomain({ bands: [] })).toBeNull();
    expect(
      rasterBandValueDomain({
        bands: [{ minimum: 0, maximum: 10 }],
      })
    ).toEqual([0, 10]);
  });

  test("unions domains across sources", () => {
    expect(
      unionRasterValueDomain([
        { geostats: { bands: [{ minimum: 1, maximum: 4 }] } },
        { geostats: { bands: [{ minimum: 0, maximum: 10 }] } },
      ])
    ).toEqual([0, 10]);
  });
});
