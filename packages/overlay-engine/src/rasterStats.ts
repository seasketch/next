import { Feature, MultiPolygon, Polygon } from "geojson";
import { RasterBandStats } from "./metrics/metrics";
const geoblaze = require("geoblaze");

export async function calculateRasterStats(
  sourceUrl: string,
  feature: Feature<Polygon | MultiPolygon>
): Promise<{ bands: RasterBandStats[] }> {
  const raster = await geoblaze.parse(sourceUrl);
  const stats = await geoblaze.stats(raster, feature);

  return {
    bands: stats.map((stat: any) => ({
      count: stat.count,
      min: stat.min,
      max: stat.max,
      mean: stat.mean,
      median: stat.median,
      mode: stat.mode,
      modes: stat.modes,
      range: stat.range,
      histogram: [],
      invalid: stat.invalid,
      std: stat.std,
      sum: stat.sum,
    })),
  };
}
