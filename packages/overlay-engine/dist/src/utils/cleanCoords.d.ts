/**
 * Cleans and normalizes GeoJSON coordinates to ensure they are within valid world bounds. This can be helpful for ensuring reliable output from clipping operations.
 *
 * This function processes GeoJSON geometries to ensure all coordinates are within:
 * - Latitude bounds: [-90, 90]
 * - Longitude bounds: [-180, 180]
 *
 * It handles various geometry types:
 * - Point (returns as-is)
 * - MultiPoint (removes duplicates)
 * - LineString
 * - MultiLineString
 * - Polygon
 * - MultiPolygon
 * - FeatureCollection (processes each feature)
 *
 * @param geojson - The GeoJSON object to clean. Can be a geometry, feature, or feature collection.
 * @returns A new GeoJSON object with cleaned coordinates. The structure matches the input type.
 * @throws Error if:
 *   - geojson is null or undefined
 *   - geometry type is not supported
 *
 * @example
 * // Clean a polygon that crosses the antimeridian
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[190, 0], [200, 0], [200, 10], [190, 10], [190, 0]]]
 * };
 * const cleaned = cleanCoords(polygon);
 * // Result: coordinates will be normalized to [-180, 180] range
 */
export declare function cleanCoords(geojson: any): any;
