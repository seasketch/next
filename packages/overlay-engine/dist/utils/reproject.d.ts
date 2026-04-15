import { Feature, MultiPolygon, Polygon } from "geojson";
/**
 * Reproject a GeoJSON Feature with Polygon geometry to EPSG:6933.
 * Used by overlay-engine tests and spatial-processing code that operates on
 * 6933-projected features.  For general reprojection in the overlay Lambda
 * worker, use `reprojectFeatureTo` from `overlay-worker/src/utils/reproject`.
 */
export declare function reprojectFeatureTo6933(feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon, import("geojson").GeoJsonProperties>;
//# sourceMappingURL=reproject.d.ts.map