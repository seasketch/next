import { Feature, MultiPolygon, Polygon } from "geojson";
/**
 * Reproject a GeoJSON Feature with Polygon geometry to EPSG:6933.
 */
export declare function reprojectFeatureTo6933(feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon, import("geojson").GeoJsonProperties>;
//# sourceMappingURL=reproject.d.ts.map