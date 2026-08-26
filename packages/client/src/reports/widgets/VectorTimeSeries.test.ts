import {
  defaultNumericColumn,
  defaultVectorTimeSeriesMode,
  getVectorTimeSeriesMode,
  getVectorTimeSeriesUnit,
  intersectNumericColumns,
  numericColumnsFromGeostats,
  pickerGeometryTypesForFamily,
  unionColumnValueDomain,
} from "./vectorTimeSeriesSettings";
import {
  buildVectorTimeSeriesDependencies,
  countAtStar,
  extractVectorTimeSeriesSample,
  numberColumnStatsAt,
  samplesToChartData,
  totalOverlayMeasure,
} from "./vectorTimeSeriesData";

describe("vector time series settings", () => {
  test("defaults polygons and lines to geometry, points to count", () => {
    expect(defaultVectorTimeSeriesMode("Polygon")).toBe("geometry");
    expect(defaultVectorTimeSeriesMode("LineString")).toBe("geometry");
    expect(defaultVectorTimeSeriesMode("Point")).toBe("count");
  });

  test("refuses geometry mode for point layers", () => {
    expect(getVectorTimeSeriesMode({ mode: "geometry" }, "point")).toBe(
      "count"
    );
    expect(getVectorTimeSeriesMode({ mode: "geometry" }, "polygon")).toBe(
      "geometry"
    );
  });

  test("parses area and length units", () => {
    expect(getVectorTimeSeriesUnit({}, "polygon")).toBe("kilometer");
    expect(getVectorTimeSeriesUnit({ unit: "mi" }, "polygon")).toBe("mile");
    expect(getVectorTimeSeriesUnit({ unit: "foot" }, "line")).toBe("foot");
    expect(getVectorTimeSeriesUnit({ unit: "acre" }, "line")).toBe("kilometer");
  });

  test("numericColumnsFromGeostats rejects junk and reads numbers", () => {
    expect(numericColumnsFromGeostats(null)).toEqual([]);
    expect(numericColumnsFromGeostats(undefined)).toEqual([]);
    expect(numericColumnsFromGeostats("nope")).toEqual([]);
    expect(
      numericColumnsFromGeostats({
        layers: [
          {
            layer: "reefs",
            count: 2,
            geometry: "Polygon",
            hasZ: false,
            attributeCount: 2,
            attributes: [
              { attribute: "pop", type: "number", count: 2, values: {} },
              { attribute: "name", type: "string", count: 2, values: {} },
            ],
          },
        ],
      })
    ).toEqual(["pop"]);
  });

  test("intersectNumericColumns drops renamed or missing columns", () => {
    const a = {
      geostats: {
        layers: [
          {
            layer: "a",
            count: 1,
            geometry: "Polygon",
            hasZ: false,
            attributeCount: 2,
            attributes: [
              { attribute: "pop", type: "number", count: 1, values: {} },
              { attribute: "area", type: "number", count: 1, values: {} },
            ],
          },
        ],
      },
    };
    const b = {
      geostats: {
        layers: [
          {
            layer: "b",
            count: 1,
            geometry: "Polygon",
            hasZ: false,
            attributeCount: 1,
            attributes: [
              { attribute: "pop", type: "number", count: 1, values: {} },
            ],
          },
        ],
      },
    };
    expect(intersectNumericColumns([a, b])).toEqual(["pop"]);
    expect(defaultNumericColumn(["area", "pop"], "pop")).toBe("pop");
    expect(defaultNumericColumn(["area", "pop"], "missing")).toBe("area");
  });

  test("unionColumnValueDomain reads attribute min/max", () => {
    expect(
      unionColumnValueDomain(
        [
          {
            geostats: {
              layers: [
                {
                  layer: "a",
                  count: 1,
                  geometry: "Polygon",
                  hasZ: false,
                  attributeCount: 1,
                  attributes: [
                    {
                      attribute: "pop",
                      type: "number",
                      count: 1,
                      values: {},
                      min: 1,
                      max: 4,
                    },
                  ],
                },
              ],
            },
          },
          {
            geostats: {
              layers: [
                {
                  layer: "b",
                  count: 1,
                  geometry: "Polygon",
                  hasZ: false,
                  attributeCount: 1,
                  attributes: [
                    {
                      attribute: "pop",
                      type: "number",
                      count: 1,
                      values: {},
                      min: 0,
                      max: 10,
                    },
                  ],
                },
              ],
            },
          },
        ],
        "pop"
      )
    ).toEqual([0, 10]);
  });

  test("pickerGeometryTypesForFamily locks to one family", () => {
    expect(pickerGeometryTypesForFamily("polygon")).toEqual([
      "Polygon",
      "MultiPolygon",
    ]);
    expect(pickerGeometryTypesForFamily("point")).toEqual([
      "Point",
      "MultiPoint",
    ]);
  });
});

describe("buildVectorTimeSeriesDependencies", () => {
  test("fans out count, overlay_area, and column_values correctly", () => {
    expect(
      buildVectorTimeSeriesDependencies({
        stableIds: ["a"],
        mode: "count",
      })
    ).toEqual([
      { type: "count", subjectType: "fragments", stableId: "a" },
      { type: "count", subjectType: "geographies", stableId: "a" },
    ]);
    expect(
      buildVectorTimeSeriesDependencies({
        stableIds: ["a"],
        mode: "geometry",
        overlappingByStableId: { a: true },
      })
    ).toEqual([
      {
        type: "overlay_area",
        subjectType: "fragments",
        stableId: "a",
        parameters: { sourceHasOverlappingFeatures: true },
      },
      {
        type: "overlay_area",
        subjectType: "geographies",
        stableId: "a",
        parameters: { sourceHasOverlappingFeatures: true },
      },
    ]);
    expect(
      buildVectorTimeSeriesDependencies({
        stableIds: ["a"],
        mode: "stats",
        column: "pop",
      })
    ).toEqual([
      {
        type: "column_values",
        subjectType: "fragments",
        stableId: "a",
        parameters: { includedColumns: ["pop"] },
      },
    ]);
    expect(
      buildVectorTimeSeriesDependencies({
        stableIds: ["a"],
        mode: "sum_proportion",
        column: "pop",
      })
    ).toHaveLength(2);
  });

  test("does not emit column_values without a column", () => {
    expect(
      buildVectorTimeSeriesDependencies({
        stableIds: ["a"],
        mode: "stats",
      })
    ).toEqual([]);
  });
});

describe("vector time series extractors", () => {
  test("countAtStar reads * and rejects junk", () => {
    expect(countAtStar(null)).toBeNull();
    expect(
      countAtStar({
        "*": { count: 4, uniqueIdIndex: { ranges: [], individuals: [] } },
      })
    ).toBe(4);
    expect(
      countAtStar({
        "*": {
          count: Number.NaN,
          uniqueIdIndex: { ranges: [], individuals: [] },
        },
      })
    ).toBeNull();
  });

  test("totalOverlayMeasure uses * and skips reserved keys", () => {
    expect(totalOverlayMeasure(null)).toBeNull();
    expect(
      totalOverlayMeasure({
        "*": 12,
        __overlap: { flagged: true, perClass: {} },
      })
    ).toBe(12);
    expect(totalOverlayMeasure({ forest: 4, wetland: 6 })).toBe(10);
  });

  test("numberColumnStatsAt requires a numeric * column", () => {
    expect(numberColumnStatsAt(undefined, "pop")).toBeNull();
    expect(
      numberColumnStatsAt(
        {
          "*": {
            pop: {
              type: "number",
              count: 2,
              min: 1,
              max: 5,
              mean: 3,
              stdDev: 1,
              histogram: [],
              countDistinct: 2,
              sum: 6,
            },
          },
        },
        "pop"
      )?.sum
    ).toBe(6);
    expect(
      numberColumnStatsAt(
        {
          "*": {
            name: { type: "string", distinctValues: [], countDistinct: 0 },
          },
        },
        "name"
      )
    ).toBeNull();
  });

  test("extractVectorTimeSeriesSample computes geography fractions", () => {
    const count = extractVectorTimeSeriesSample({
      stableId: "a",
      title: "Reefs 2015",
      coverage: {
        start: 1,
        end: 2,
        span: false,
        label: "2015",
        nativeResolution: "year",
      },
      mode: "count",
      fragments: {
        value: {
          "*": { count: 5, uniqueIdIndex: { ranges: [], individuals: [] } },
        },
      },
      geographies: {
        value: {
          "*": { count: 20, uniqueIdIndex: { ranges: [], individuals: [] } },
        },
      },
    });
    expect(count.count).toBe(5);
    expect(count.fraction).toBe(0.25);

    const zeroGeo = extractVectorTimeSeriesSample({
      stableId: "a",
      title: "Reefs 2015",
      coverage: count.coverage,
      mode: "count",
      fragments: {
        value: {
          "*": { count: 5, uniqueIdIndex: { ranges: [], individuals: [] } },
        },
      },
      geographies: {
        value: {
          "*": { count: 0, uniqueIdIndex: { ranges: [], individuals: [] } },
        },
      },
    });
    expect(zeroGeo.fraction).toBeNull();
  });

  test("samplesToChartData plots zeros and flags missing temporal or column", () => {
    const { absoluteData, percentData, missingTemporal, percentUnavailable } =
      samplesToChartData({
        samples: [
          {
            stableId: "a",
            title: "Reefs 2015",
            coverage: {
              start: Date.UTC(2015, 0, 1),
              end: Date.UTC(2016, 0, 1),
              span: false,
              label: "2015",
              nativeResolution: "year",
            },
            count: 0,
            geographyCount: 10,
            geometry: null,
            geographyGeometry: null,
            min: null,
            max: null,
            mean: null,
            sum: null,
            geographySum: null,
            fraction: 0,
            columnStats: null,
          },
          {
            stableId: "b",
            title: "Reefs undated",
            coverage: null,
            count: 3,
            geographyCount: 10,
            geometry: null,
            geographyGeometry: null,
            min: null,
            max: null,
            mean: null,
            sum: null,
            geographySum: null,
            fraction: 0.3,
            columnStats: null,
          },
        ],
        mode: "count",
        formatAbsolute: (v) => String(v),
        formatEnvelope: (v) => String(v),
        formatPercent: (v) => String(v),
      });
    expect(absoluteData).toHaveLength(1);
    expect(absoluteData[0].value).toBe(0);
    expect(percentData[0].value).toBe(0);
    expect(missingTemporal).toEqual(["Reefs undated"]);
    expect(percentUnavailable).toBe(false);
  });
});
