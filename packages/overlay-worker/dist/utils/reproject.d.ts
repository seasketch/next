import { Feature, MultiPolygon, Polygon } from "geojson";
/**
 * Reproject a WGS84 (EPSG:4326) GeoJSON Feature to any target EPSG code.
 *
 * Uses `transform-coordinates` (proj4 + epsg-index glue) so this function
 * lives in overlay-worker rather than overlay-engine, keeping the 6 MB
 * epsg-index JSON out of the client bundle.
 *
 * @param feature     Input feature in WGS84 (EPSG:4326).
 * @param targetEpsg  Numeric EPSG code of the target CRS.
 * @throws {Error}    If the EPSG code is not found in epsg-index.
 */
export declare function reproject(feature: Feature<Polygon | MultiPolygon>, targetEpsg: number): Feature<Polygon | MultiPolygon>;
//# sourceMappingURL=reproject.d.ts.map