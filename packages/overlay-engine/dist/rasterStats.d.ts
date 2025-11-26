import { Feature, MultiPolygon, Polygon } from "geojson";
import { RasterBandStats } from "./metrics/metrics";
export type HistogramEntry = [number, number];
export declare function downsampleHistogram(histogram: HistogramEntry[], maxEntries: number): HistogramEntry[];
export declare function calculateRasterStats(sourceUrl: string, feature: Feature<Polygon | MultiPolygon>): Promise<{
    bands: RasterBandStats[];
}>;
//# sourceMappingURL=rasterStats.d.ts.map