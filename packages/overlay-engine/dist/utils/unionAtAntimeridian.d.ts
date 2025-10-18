import { Feature } from "geojson";
import { MultiPolygon, Polygon } from "geojson";
/**
 * Accepts a Polygon or MultiPolygon geojson feature and returns a unioned
 * feature where components meet at the antimeridian. Not a general-purpose
 * union, as it only works for polygons that meet at the antimeridian. In
 * order to render properly on a webmap, coordinates crossing the
 * antimeridian may end up greater or less than 180 or -180.
 *
 * If provided a Polygon, this will be a no-op.
 *
 * @param feature Polygon or MultiPolygon geojson feature
 * @returns Unioned feature
 */
export declare function unionAtAntimeridian(feature: Feature<MultiPolygon | Polygon>): Feature<Polygon, import("geojson").GeoJsonProperties> | Feature<MultiPolygon, import("geojson").GeoJsonProperties>;
export declare function isPolygon(feature: Feature<Polygon | MultiPolygon>): feature is Feature<Polygon>;
//# sourceMappingURL=unionAtAntimeridian.d.ts.map