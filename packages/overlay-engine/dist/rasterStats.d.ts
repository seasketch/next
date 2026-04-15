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
 * Resolve the VRM value to apply given user options and fragment area.
 *
 * - `false`   → VRM disabled; returns null.
 * - `number`  → explicit value; expands to [n, n] (min 1).
 * - `'auto'`  → targets ~100 m virtual grid cells. Returns [1, 1] when
 *               native pixels are already finer than 100 m.
 *               Hard per-axis cap: MAX_VRM_PER_AXIS.
 */
export declare function resolveVrm(vrmOpt: false | "auto" | number | undefined, fragmentAreaSqM: number, groundDims: {
    mX: number;
    mY: number;
}): [number, number] | null;
export declare function downsampleHistogram(histogram: HistogramEntry[], maxEntries: number): HistogramEntry[];
/**
 * Calculate raster statistics for a feature that has already been reprojected
 * into the raster's native CRS.
 *
 * Reprojection is the caller's responsibility so that this function — and by
 * extension overlay-engine — does not need to bundle epsg-index (6 MB).
 *
 * @param sourceUrl  URL of the COG.
 * @param feature    Feature already projected into the raster's native CRS.
 * @param options.vrm
 *   - `false`  → disable VRM (recommended for large geography subjects).
 *   - `'auto'` (default) → fragment-size-aware dynamic VRM.
 *   - `number` → explicit VRM value, applied as [n, n].
 * @param options.centerLonLat
 *   WGS84 [lon, lat] of the sketch fragment centre.  Used for accurate
 *   ground-pixel-size measurement in the auto-VRM calculation.  When omitted
 *   the VRM defaults to [1, 1] (no upsampling).
 * @param options.fragmentAreaSqM
 *   Area of the original WGS84 feature in square metres.  Used by auto-VRM
 *   to size virtual pixels relative to the fragment.  When omitted alongside
 *   centerLonLat the VRM defaults to [1, 1].
 */
export declare function calculateRasterStats(sourceUrl: string, feature: Feature<Polygon | MultiPolygon>, options?: {
    vrm?: false | "auto" | number;
    centerLonLat?: [number, number];
    fragmentAreaSqM?: number;
}): Promise<{
    bands: RasterBandStats[];
}>;
export {};
//# sourceMappingURL=rasterStats.d.ts.map