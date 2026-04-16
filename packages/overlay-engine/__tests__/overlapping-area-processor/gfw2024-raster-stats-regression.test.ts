/**
 * Regression coverage for raster_stats sums on EPSG:4326 GFW-style rasters with
 * antimeridian-spanning sketches and Fiji EEZ geography assembly.
 *
 * @see https://github.com/seasketch/next/issues/918 — compares SeaSketch output
 * to QGIS / Google Earth Engine figures in WGS84 (EPSG:4326).
 */
import { vi } from "vitest";
import calcArea from "@turf/area";
import calcBBox from "@turf/bbox";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { SourceCache } from "fgb-source";
import { makeFetchRangeFn } from "../../scripts/optimizedFetchRangeFn";
import {
  ClippingFn,
  ClippingLayerOption,
  clipSketchToPolygons,
  initializeGeographySources,
} from "../../src/geographies/geographies";
import { createFragments, GeographySettings } from "../../src/fragments";
import {
  combineMetricsForFragments,
  type Metric,
  type RasterStats,
} from "../../src/metrics/metrics";
import { prepareSketch } from "../../src/utils/prepareSketch";
import { calculateRasterStats } from "../../src/rasterStats";

const GFW_RASTER_URL = "https://uploads.seasketch.org/testing-gfw-2024.tif";

/**
 * Reference sums from issue #918 (QGIS EPSG:4326 where noted; MPA from GP 4326).
 * Bounding-box cases from the ticket are intentionally not asserted here.
 */
const REFERENCE = {
  /** QGIS (4326) within AOI polygon */
  aoiSum: 7677.96021201089,
  /** GP (4326) within MPA polygon */
  mpaSum: 607.62,
  /** QGIS (4326) sum within EEZ */
  eezSum: 85538.02015047893,
} as const;

const FIJI_EEZ_LAYERS: ClippingLayerOption[] = [
  {
    cql2Query: {
      op: "=",
      args: [
        {
          property: "MRGID_EEZ",
        },
        8325,
      ],
    },
    source: "https://uploads.seasketch.org/testing-eez.fgb",
    op: "INTERSECT",
  },
  {
    cql2Query: null,
    source: "https://uploads.seasketch.org/testing-land.fgb",
    op: "DIFFERENCE",
    headerSizeHint: 38500000,
  },
];

const FIJI_GEOGRAPHY: GeographySettings = {
  id: 1,
  clippingLayers: FIJI_EEZ_LAYERS,
};

const aoiSketch = require("./sketches/aoi.geojson.json") as Feature<Polygon>;
const mpaSketch = require("./sketches/mpa.geojson.json") as Feature<Polygon>;

async function sumGfwRasterAcrossFragments(
  fragments: Feature<Polygon>[],
  vrm: false | "auto" | number = false,
): Promise<number> {
  const metrics: Pick<Metric, "type" | "value">[] = [];
  for (const fragment of fragments) {
    const fragmentAreaSqM = calcArea(fragment);
    const bbox = calcBBox(fragment, { recompute: true });
    const centerLonLat: [number, number] = [
      (bbox[0] + bbox[2]) / 2,
      (bbox[1] + bbox[3]) / 2,
    ];
    const { bands } = await calculateRasterStats(GFW_RASTER_URL, fragment, {
      vrm,
      centerLonLat,
      fragmentAreaSqM,
    });
    metrics.push({
      type: "raster_stats",
      value: { bands: [bands[0]] },
    });
  }
  const combined = combineMetricsForFragments(metrics);
  if (combined.type !== "raster_stats") {
    throw new Error(`expected raster_stats, got ${combined.type}`);
  }
  const rasterValue = combined.value as RasterStats["value"];
  return rasterValue.bands[0].sum;
}

describe("GFW 2024 raster_stats regression (#918)", () => {
  vi.setConfig({ testTimeout: 1000 * 120 });

  const { fetchRangeFn } = makeFetchRangeFn(
    "https://uploads.seasketch.org",
    1000 * 1024 * 128,
  );

  let sourceCache: SourceCache;

  beforeAll(() => {
    sourceCache = new SourceCache("512mb", { fetchRangeFn });
  });

  const clippingFn: ClippingFn = async (sketch, source, op, query) => {
    const fgbSource = await sourceCache.get(source, {
      fetchRangeFn,
      pageSize: "5MB",
    });
    const overlappingFeatures = fgbSource.getFeaturesAsync(sketch.envelopes);
    return clipSketchToPolygons(
      sketch,
      op,
      query,
      overlappingFeatures as AsyncIterable<Feature<Polygon | MultiPolygon>>,
    );
  };

  it("AOI sketch: raster sum matches QGIS 4326 (~7678)", async () => {
    const prepared = prepareSketch(aoiSketch);
    const fragments = await createFragments(
      prepared,
      [FIJI_GEOGRAPHY],
      clippingFn,
    );
    expect(fragments.length).toBeGreaterThanOrEqual(1);
    const sum = await sumGfwRasterAcrossFragments(fragments);
    expect(Math.abs(sum - REFERENCE.aoiSum)).toBeLessThan(0.05);
  });

  it("AOI sketch: with vrm=auto raster sum is ~6986", async () => {
    const prepared = prepareSketch(aoiSketch);
    const fragments = await createFragments(
      prepared,
      [FIJI_GEOGRAPHY],
      clippingFn,
    );
    expect(fragments.length).toBeGreaterThanOrEqual(1);
    const sum = await sumGfwRasterAcrossFragments(fragments, "auto");
    expect(Math.abs(sum - 6986)).toBeLessThan(0.05);
  });

  it("MPA sketch (antimeridian): fragments combine to ~607 (GP 4326)", async () => {
    const prepared = prepareSketch(mpaSketch);
    const fragments = await createFragments(
      prepared,
      [FIJI_GEOGRAPHY],
      clippingFn,
    );
    expect(fragments.length).toBeGreaterThan(1);
    const sum = await sumGfwRasterAcrossFragments(fragments);
    expect(Math.abs(sum - REFERENCE.mpaSum)).toBeLessThan(0.05);
  });

  it("Fiji EEZ geography: combined fragment sums align with QGIS 4326 EEZ (~85538)", async () => {
    const { intersectionFeature } = await initializeGeographySources(
      FIJI_EEZ_LAYERS,
      sourceCache,
      undefined,
      { pageSize: "5MB" },
    );
    const prepared = prepareSketch(intersectionFeature);
    const fragments = await createFragments(
      prepared,
      [FIJI_GEOGRAPHY],
      clippingFn,
    );
    expect(fragments.length).toBeGreaterThan(1);
    const sum = await sumGfwRasterAcrossFragments(fragments);
    // EEZ spans the dateline; one narrow fragment can return no samples while
    // the combined total still tracks QGIS closely (#918).
    expect(Math.abs(sum - REFERENCE.eezSum)).toBeLessThan(30);
  });
});
