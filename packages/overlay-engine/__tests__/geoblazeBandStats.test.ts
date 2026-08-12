import { describe, it, expect } from "vitest";
import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
import {
  computeGeoblazeBandStats,
  intersectingWindowPixelCounts,
  medianFromHistogram,
  shouldStreamGeoblazeStats,
  MAX_COLLECTED_PIXELS,
  type GeoblazeStatsExtra,
} from "../src/geoblazeBandStats";
import { expectBandStatsMatch } from "./helpers/rasterStatsMatch";

function makeRaster(values: number[][], noDataValue = 0) {
  const height = values.length;
  const width = values[0].length;
  return {
    xmin: 0,
    ymin: 0,
    xmax: width,
    ymax: height,
    width,
    height,
    pixelWidth: 1,
    pixelHeight: 1,
    projection: 4326,
    noDataValue,
    values: [values],
  };
}

const RASTER_STATS = {
  stats: [
    "count",
    "min",
    "max",
    "mean",
    "median",
    "range",
    "histogram",
    "invalid",
    "sum",
    "valid",
  ],
};

function polygon(rings: number[][][]): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: rings },
  };
}

function multiPolygon(polys: number[][][][]): Feature<MultiPolygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: polys },
  };
}

async function expectStreamMatchesGeoblaze(
  raster: ReturnType<typeof makeRaster>,
  feature: Feature<Polygon | MultiPolygon>,
  extra?: GeoblazeStatsExtra,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const geoblaze = require("geoblaze");
  const window: [number, number] = [raster.width, raster.height];
  const collected = await computeGeoblazeBandStats(
    geoblaze,
    raster,
    feature,
    RASTER_STATS,
    extra,
    window,
  );
  const streamed = await computeGeoblazeBandStats(
    geoblaze,
    raster,
    feature,
    RASTER_STATS,
    extra,
    window,
    { forceStream: true },
  );
  expect(streamed).toHaveLength(collected.length);
  for (let i = 0; i < collected.length; i++) {
    expectBandStatsMatch(streamed[i], collected[i]);
  }
}

const sequential4x4 = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
];

const withNodata = [
  [0, 2, 3, 0],
  [5, 0, 7, 8],
  [9, 10, 0, 12],
  [0, 14, 15, 0],
];

describe("intersectingWindowPixelCounts", () => {
  const raster = {
    xmin: 0,
    ymin: 0,
    xmax: 100,
    ymax: 50,
    width: 100,
    height: 50,
    pixelWidth: 1,
    pixelHeight: 1,
  };

  it("uses (max-min)/pixelSize, not subtraction-then-divide precedence", () => {
    const bbox: BBox = [0, 0, 10, 10];
    const rasterPw2 = {
      ...raster,
      pixelWidth: 2,
      pixelHeight: 2,
      width: 50,
      height: 25,
    };
    expect(intersectingWindowPixelCounts(bbox, rasterPw2)).toEqual([5, 5]);
  });

  it("clamps a geography larger than the raster to the raster size", () => {
    const bbox: BBox = [-1e6, -1e6, 1e6, 1e6];
    const [cols, rows] = intersectingWindowPixelCounts(bbox, raster);
    expect(cols).toBe(100);
    expect(rows).toBe(50);
  });
});

describe("shouldStreamGeoblazeStats", () => {
  it("keeps typical sketch/geography windows on the geoblaze.stats path", () => {
    expect(shouldStreamGeoblazeStats([4000, 2000], null)).toBe(false);
    expect(shouldStreamGeoblazeStats([4000, 2000], [1, 1])).toBe(false);
  });

  it("streams windows that would overflow geoblaze's value array", () => {
    expect(shouldStreamGeoblazeStats([9346, 28823], null)).toBe(true);
    const side = Math.ceil(Math.sqrt(MAX_COLLECTED_PIXELS)) + 1;
    expect(shouldStreamGeoblazeStats([side, side], null)).toBe(true);
  });
});

describe("medianFromHistogram", () => {
  it("returns the middle value for an odd count", () => {
    expect(
      medianFromHistogram(
        { "1": { n: 1, ct: 1 }, "2": { n: 2, ct: 1 }, "3": { n: 3, ct: 1 } },
        3,
      ),
    ).toBe(2);
  });

  it("averages the two central values for an even count", () => {
    expect(
      medianFromHistogram({ "1": { n: 1, ct: 2 }, "3": { n: 3, ct: 2 } }, 4),
    ).toBe(2);
  });
});

describe("streaming vs geoblaze.stats (in-memory rasters)", () => {
  const full = polygon([
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
  ]);

  it("matches on a fully covered raster", async () => {
    await expectStreamMatchesGeoblaze(makeRaster(sequential4x4), full);
  });

  it("matches with VRM rescale", async () => {
    await expectStreamMatchesGeoblaze(makeRaster(sequential4x4), full, {
      vrm: [2, 2],
      rescale: true,
    });
  });

  it("matches when nodata pixels are present", async () => {
    await expectStreamMatchesGeoblaze(makeRaster(withNodata), full);
  });

  it("matches a polygon covering only part of the raster", async () => {
    await expectStreamMatchesGeoblaze(
      makeRaster(sequential4x4),
      polygon([
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ]),
    );
  });

  it("matches a polygon with a hole", async () => {
    await expectStreamMatchesGeoblaze(
      makeRaster(sequential4x4),
      polygon([
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [1, 3],
          [3, 3],
          [3, 1],
          [1, 1],
        ],
      ]),
    );
  });

  it("matches a MultiPolygon of two disjoint parts", async () => {
    await expectStreamMatchesGeoblaze(
      makeRaster(sequential4x4),
      multiPolygon([
        [
          [
            [0, 0],
            [1.5, 0],
            [1.5, 1.5],
            [0, 1.5],
            [0, 0],
          ],
        ],
        [
          [
            [2.5, 2.5],
            [4, 2.5],
            [4, 4],
            [2.5, 4],
            [2.5, 2.5],
          ],
        ],
      ]),
    );
  });
});
