import { Feature, MultiPolygon, Polygon } from "geojson";
import { RasterBandStats } from "./metrics/metrics";
export declare function calculateRasterStats(sourceUrl: string, feature: Feature<Polygon | MultiPolygon>): Promise<{
    bands: RasterBandStats[];
}>;
//# sourceMappingURL=rasterStats.d.ts.map