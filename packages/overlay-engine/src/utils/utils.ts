import { Feature, MultiPolygon, Polygon } from "geojson";
import { isPolygon } from "./unionAtAntimeridian";

/**
 * Converts a GeoJSON Feature with Polygon geometry to a Feature with
 * MultiPolygon geometry. If the input is already a MultiPolygon, returns it
 * unchanged.
 *
 * This is useful for normalizing polygon features to a consistent MultiPolygon
 * type before performing operations like clipping or union that expect
 * MultiPolygon inputs.
 *
 * @param feature - A GeoJSON Feature with either Polygon or MultiPolygon
 *                  geometry
 * @returns A GeoJSON Feature with MultiPolygon geometry. For Polygon inputs,
 *          wraps the coordinates in an extra array level. For MultiPolygon
 *          inputs, returns as-is.
 * @preserves The input feature's properties
 */
export function makeMultipolygon(
  feature: Feature<Polygon | MultiPolygon>
): Feature<MultiPolygon> {
  if (isPolygon(feature)) {
    return {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: [feature.geometry.coordinates],
      },
      properties: feature.properties,
    };
  }
  return feature as Feature<MultiPolygon>;
}
