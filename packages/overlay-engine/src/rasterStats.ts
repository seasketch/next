import { Feature, MultiPolygon, Polygon } from "geojson";
import { RasterBandStats } from "./metrics/metrics";
export type HistogramEntry = [number, number];

export function downsampleHistogram(
  histogram: HistogramEntry[],
  maxEntries: number
): HistogramEntry[] {
  if (histogram.length === 0 || histogram.length <= maxEntries) {
    return histogram;
  }

  // Ensure sorted by value (x)
  const sorted = [...histogram].sort((a, b) => a[0] - b[0]);
  const minValue = sorted[0][0];
  const maxValue = sorted[sorted.length - 1][0];

  if (!isFinite(minValue) || !isFinite(maxValue) || minValue === maxValue) {
    const totalCount = sorted.reduce((acc, [, count]) => acc + count, 0);
    return [[minValue, totalCount]];
  }

  const numBins = maxEntries;
  const binCounts = new Array<number>(numBins).fill(0);

  const span = maxValue - minValue;

  for (const [value, count] of sorted) {
    const normalized = (value - minValue) / span;
    let binIndex = Math.round(normalized * (numBins - 1));
    if (binIndex < 0) binIndex = 0;
    if (binIndex >= numBins) binIndex = numBins - 1;
    binCounts[binIndex] += count;
  }

  const result: HistogramEntry[] = [];
  for (let i = 0; i < numBins; i++) {
    const count = binCounts[i];
    if (count === 0) continue;
    const value = minValue + (span * i) / (numBins - 1);
    result.push([value, count]);
  }

  return result;
}

let _geoblaze: any;

function getGeoblaze() {
  if (!_geoblaze) {
    _geoblaze = require("geoblaze");
  }
  return _geoblaze;
}

export async function calculateRasterStats(
  sourceUrl: string,
  feature: Feature<Polygon | MultiPolygon>
): Promise<{ bands: RasterBandStats[] }> {
  const geoblaze = getGeoblaze();
  try {
    const raster = await geoblaze.parse(sourceUrl);
    const stats = await geoblaze.stats(
      raster,
      feature,
      {
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
        ],
      },
      undefined,
      {
        vrm: "minimal",
      }
    );
    return {
      bands: stats.map((stat: any) => {
        const rawHistogram: HistogramEntry[] = Array.isArray(stat.histogram)
          ? (stat.histogram as HistogramEntry[])
          : Object.values(
              stat.histogram as Record<string, { n: number; ct: number }>
            ).map((r) => [r.n, r.ct] as HistogramEntry);

        const histogram = downsampleHistogram(rawHistogram, 200);

        return {
          count: stat.count,
          min: stat.min,
          max: stat.max,
          mean: stat.mean,
          median: stat.median,
          range: stat.range,
          histogram,
          invalid: stat.invalid,
          sum: stat.sum,
        };
      }),
    };
  } catch (e) {
    console.error("Error calculating raster stats", e);
    console.log(sourceUrl);
    console.log(feature);
    console.log(feature.geometry.coordinates);
    if (typeof e === "string" && e.includes("No Values")) {
      return {
        bands: [
          {
            count: 0,
            min: NaN,
            max: NaN,
            mean: NaN,
            median: NaN,
            range: NaN,
            histogram: [],
            invalid: 0,
            sum: 0,
          } as RasterBandStats,
        ],
      };
    } else {
      throw e;
    }
  }
}
