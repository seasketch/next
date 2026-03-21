import { Feature, MultiPolygon, Polygon } from "geojson";
import { RasterBandStats } from "./metrics/metrics";
export type HistogramEntry = [number, number];
interface GeorasterLike {
    pixelWidth: number;
    pixelHeight: number;
    projection?: number;
}
/**
 * Geodesic length in meters of one raster pixel in X and Y at `centerLonLat`, using
 * COG/georaster metadata (pixelWidth/Height in CRS units + EPSG from GeoKeys).
 */
export declare function groundPixelDimensionsMeters(raster: GeorasterLike, centerLonLat: [number, number]): {
    mX: number;
    mY: number;
};
/**
 * True when native pixels are **coarser** than {@link TARGET_GROUND_SAMPLE_METERS} on the ground
 * on either axis (so virtual resampling is needed).
 */
export declare function needsVirtualResamplingForGroundResolution(dims: {
    mX: number;
    mY: number;
}): boolean;
/**
 * VRM so that virtually subdivided cells are about {@link TARGET_GROUND_SAMPLE_METERS}
 * on a side. See [geoblaze stats / vrm](https://docs.geoblaze.io/#stats).
 */
export declare function vrmFromGroundPixelDimensions(dims: {
    mX: number;
    mY: number;
}): [number, number];
/** Convenience: ground size → VRM (use when you always pass `vrm` to geoblaze). */
export declare function vrmForTargetGroundResolution(raster: GeorasterLike, centerLonLat: [number, number]): [number, number];
export declare function downsampleHistogram(histogram: HistogramEntry[], maxEntries: number): HistogramEntry[];
export declare function calculateRasterStats(sourceUrl: string, feature: Feature<Polygon | MultiPolygon>): Promise<{
    bands: RasterBandStats[];
}>;
export {};
//# sourceMappingURL=rasterStats.d.ts.map