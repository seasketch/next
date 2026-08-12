import { expect } from "vitest";
import { Feature, MultiPolygon, Polygon } from "geojson";
import type { RasterBandStats } from "../../src/metrics/metrics";
import type { RasterOverlayAreaMetricValue } from "../../src/metrics/metrics";
import type { GeoblazeBandStat } from "../../src/geoblazeBandStats";
import { calculateRasterStats } from "../../src/rasterStats";

function expectSameNumber(actual: number, expected: number, label: string) {
  if (Number.isNaN(expected)) {
    expect(actual, label).toBeNaN();
    return;
  }
  expect(actual, label).toBeCloseTo(expected, 8);
}

function histogramEntries(
  histogram: GeoblazeBandStat["histogram"] | RasterBandStats["histogram"],
): [number, number][] {
  if (Array.isArray(histogram)) {
    return [...histogram].sort((a, b) => a[0] - b[0]);
  }
  return Object.values(histogram)
    .map((r) => [r.n, r.ct] as [number, number])
    .sort((a, b) => a[0] - b[0]);
}

/** Compare streaming vs geoblaze.stats band output. */
export function expectBandStatsMatch(
  streamed: GeoblazeBandStat | RasterBandStats,
  collected: GeoblazeBandStat | RasterBandStats,
) {
  expectSameNumber(streamed.count, collected.count, "count");
  expectSameNumber(streamed.invalid, collected.invalid, "invalid");
  expectSameNumber(streamed.min, collected.min, "min");
  expectSameNumber(streamed.max, collected.max, "max");
  expectSameNumber(streamed.sum, collected.sum, "sum");
  expectSameNumber(streamed.mean, collected.mean, "mean");
  expectSameNumber(streamed.median, collected.median, "median");
  expectSameNumber(streamed.range, collected.range, "range");
  if ("valid" in streamed && "valid" in collected) {
    expectSameNumber(streamed.valid, collected.valid, "valid");
  }

  const a = histogramEntries(streamed.histogram);
  const b = histogramEntries(collected.histogram);
  expect(a.length, "histogram unique values").toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expectSameNumber(a[i][0], b[i][0], `histogram[${i}].value`);
    expectSameNumber(a[i][1], b[i][1], `histogram[${i}].count`);
  }
}

/**
 * Run the public raster_stats API twice: geoblaze.stats (forceCollect) and
 * the streaming walk (forceStream). Asserts band-level equality so COG
 * getValues coverage does not depend on windows larger than 32M pixels.
 */
export async function rasterStatsCollectedAndStreamed(
  sourceUrl: string,
  feature: Feature<Polygon | MultiPolygon>,
  options?: Parameters<typeof calculateRasterStats>[2],
) {
  const collected = await calculateRasterStats(sourceUrl, feature, {
    ...options,
    forceCollect: true,
  });
  const streamed = await calculateRasterStats(sourceUrl, feature, {
    ...options,
    forceStream: true,
  });
  expect(streamed.bands, "band count").toHaveLength(collected.bands.length);
  for (let i = 0; i < collected.bands.length; i++) {
    expectBandStatsMatch(streamed.bands[i], collected.bands[i]);
  }
  return collected;
}

export function expectOverlayAreaMatch(
  streamed: RasterOverlayAreaMetricValue,
  collected: RasterOverlayAreaMetricValue,
) {
  const keys = new Set([
    ...Object.keys(streamed.areas),
    ...Object.keys(collected.areas),
  ]);
  for (const key of keys) {
    expectSameNumber(
      streamed.areas[key] ?? 0,
      collected.areas[key] ?? 0,
      `areas[${key}]`,
    );
  }
  if (collected.overlap && "collarAreas" in collected.overlap) {
    expect(streamed.overlap).toBeDefined();
    if (!streamed.overlap || !("collarAreas" in streamed.overlap)) {
      throw new Error("expected streamed overlap info");
    }
    const s = streamed.overlap;
    const c = collected.overlap;
    const collarKeys = new Set([
      ...Object.keys(s.collarAreas),
      ...Object.keys(c.collarAreas),
    ]);
    for (const key of collarKeys) {
      expectSameNumber(
        s.collarAreas[key] ?? 0,
        c.collarAreas[key] ?? 0,
        `collarAreas[${key}]`,
      );
      expectSameNumber(
        s.innerAreas[key] ?? 0,
        c.innerAreas[key] ?? 0,
        `innerAreas[${key}]`,
      );
    }
  }
}
