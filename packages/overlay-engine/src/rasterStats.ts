import { Feature, MultiPolygon, Polygon } from "geojson";
const geoblaze = require("geoblaze");

export async function calculateRasterStats(
  sourceUrl: string,
  feature: Feature<Polygon | MultiPolygon>
) {
  const raster = await geoblaze.parse(sourceUrl);
  const stats = await geoblaze.stats(raster, feature);
  return stats;
}
