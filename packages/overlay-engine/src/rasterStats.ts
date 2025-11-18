import { Feature, MultiPolygon, Polygon } from "geojson";
const geoblaze = require("geoblaze");

export async function calculateRasterStats(
  sourceUrl: string,
  feature: Feature<Polygon | MultiPolygon>
) {
  console.time("load raster");
  const raster = await geoblaze.parse(sourceUrl);
  console.timeEnd("load raster");
  console.time("calculate stats");
  const stats = await geoblaze.stats(raster, feature);
  console.timeEnd("calculate stats");
  return stats;
}
