import {
  getColumnTotalFromGeostats,
  getFeatureCountFromGeostats,
  listColumnsWithGeostatsTotals,
  pickBestColumnForPercentOfColumnTotal,
} from "./columnTotalFromGeostats";

function makeGeostats(
  attributes: Array<{
    attribute: string;
    type: string;
    count: number;
    avg?: number;
  }>
) {
  return {
    layerCount: 1,
    layers: [
      {
        layer: "test",
        count: 10,
        geometry: "Polygon",
        attributeCount: attributes.length,
        attributes: attributes.map((a) => ({
          attribute: a.attribute,
          type: a.type,
          count: a.count,
          values: {},
          ...(a.type === "number"
            ? {
                min: 0,
                max: 100,
                stats: {
                  avg: a.avg,
                  stdev: 1,
                  equalInterval: {},
                  naturalBreaks: {},
                  quantiles: [],
                  geometricInterval: {},
                  standardDeviations: {},
                  histogram: [],
                },
              }
            : {}),
        })),
      },
    ],
  };
}

describe("getFeatureCountFromGeostats", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(getFeatureCountFromGeostats(null)).toBeNull();
    expect(getFeatureCountFromGeostats(undefined)).toBeNull();
    expect(getFeatureCountFromGeostats(42)).toBeNull();
  });

  it("returns the layer feature count", () => {
    const geostats = makeGeostats([
      { attribute: "Population", type: "number", count: 100, avg: 250 },
    ]);
    expect(getFeatureCountFromGeostats(geostats)).toBe(10);
  });
});

describe("getColumnTotalFromGeostats", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(getColumnTotalFromGeostats(null, "Population")).toBeNull();
    expect(getColumnTotalFromGeostats(undefined, "Population")).toBeNull();
    expect(getColumnTotalFromGeostats(42, "Population")).toBeNull();
  });

  it("returns avg × count for a numeric attribute", () => {
    const geostats = makeGeostats([
      { attribute: "Population", type: "number", count: 100, avg: 250 },
    ]);
    expect(getColumnTotalFromGeostats(geostats, "Population")).toBe(25000);
  });

  it("rejects missing avg or non-positive count", () => {
    expect(
      getColumnTotalFromGeostats(
        makeGeostats([{ attribute: "Population", type: "number", count: 0, avg: 10 }]),
        "Population"
      )
    ).toBeNull();
    expect(
      getColumnTotalFromGeostats(
        makeGeostats([
          { attribute: "Population", type: "number", count: 10, avg: undefined },
        ]),
        "Population"
      )
    ).toBeNull();
  });
});

describe("listColumnsWithGeostatsTotals", () => {
  it("returns only numeric columns with recoverable totals", () => {
    const geostats = makeGeostats([
      { attribute: "Province", type: "string", count: 6 },
      { attribute: "Population", type: "number", count: 100, avg: 250 },
      { attribute: "Empty", type: "number", count: 0, avg: 1 },
    ]);
    expect(listColumnsWithGeostatsTotals(geostats)).toEqual(["Population"]);
  });
});

describe("pickBestColumnForPercentOfColumnTotal", () => {
  it("prefers population-like column names when geostats are available", () => {
    const geostats = makeGeostats([
      { attribute: "SSOLN", type: "number", count: 50, avg: 0.4 },
      { attribute: "Population", type: "number", count: 100, avg: 250 },
    ]);
    expect(
      pickBestColumnForPercentOfColumnTotal({
        geostats,
        preferred: "SSOLN",
      })
    ).toBe("Population");
  });

  it("falls back to preferred when geostats are omitted", () => {
    expect(
      pickBestColumnForPercentOfColumnTotal({ preferred: "Population" })
    ).toBe("Population");
  });
});
