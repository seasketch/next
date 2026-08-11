import { Feature, MultiPolygon, Polygon } from "geojson";
import { RasterOverlayAreaAreas, RasterOverlayAreaMetricValue } from "./metrics/metrics";
/**
 * Convert per-value (or total) pixel counts to km² using geodesic ground
 * pixel size.
 *
 * Counts must already be in native-pixel units. With geoblaze
 * `{ vrm, rescale: true }`, `valid` / histogram totals are fractional native
 * pixels — do **not** divide by VRM again (that would shrink area as VRM grows).
 *
 * areaKm2 = count × mX × mY / 1e6
 */
export declare function pixelCountsToAreaKm2(counts: RasterOverlayAreaAreas, groundDims: {
    mX: number;
    mY: number;
}): RasterOverlayAreaAreas;
/**
 * Parse geoblaze histogram (array or object form) into rounded class-key counts.
 * Does **not** downsample — class keys must stay exact.
 */
export declare function histogramToClassCounts(histogram: unknown, groupByValue: boolean, validCount: number): RasterOverlayAreaAreas;
export type CalculateRasterOverlayAreaOptions = {
    vrm?: false | "auto" | number;
    centerLonLat?: [number, number];
    fragmentAreaSqM?: number;
    /** When true, produce per-value class keys (groupBy: "value"). */
    groupByValue?: boolean;
    /**
     * Optional collar geometry (already in raster CRS) + WGS84 bbox metadata.
     * When provided, a second stats pass fills overlap collar/inner areas.
     * Caller must resolve a single VRM from the buffered subject for both passes.
     */
    collar?: {
        feature: Feature<Polygon | MultiPolygon>;
        /** WGS84 bbox of the buffered subject. */
        bbox: [number, number, number, number];
        bufferKm: number;
    };
};
/**
 * Calculate raster overlay area (km²) for a feature already reprojected into
 * the raster's native CRS.
 *
 * Per-value pixel counts come from geoblaze's histogram stat (exact, not the
 * condensed 200-entry display histogram used by raster_stats). Counts are
 * converted to km² and discarded — the metric stores only `areas`.
 *
 * When `collar` is provided, both the subject and collar passes share one
 * resolved VRM (from the buffered subject options).
 */
export declare function calculateRasterOverlayArea(sourceUrl: string, feature: Feature<Polygon | MultiPolygon>, options?: CalculateRasterOverlayAreaOptions): Promise<RasterOverlayAreaMetricValue>;
//# sourceMappingURL=rasterOverlayArea.d.ts.map