import { Feature } from "geojson";
import { MultiPolygon, Polygon } from "geojson";
import * as polygonClipping from "polygon-clipping";
import truncate from "@turf/truncate";

/**
 * Accepts a Polygon or MultiPolygon geojson feature and returns a unioned
 * feature where components meet at the antimeridian. Not a general-purpose
 * union, as it only works for polygons that meet at the antimeridian. In
 * order to render properly on a webmap, coordinates crossing the
 * antimeridian may end up greater or less than 180 or -180. Truncates
 * coordinates to 6 decimal places so that antimeridian seams can be accurately
 * detected.
 *
 * If provided a Polygon, this will be a no-op.
 *
 * @param feature Polygon or MultiPolygon geojson feature
 * @returns Unioned feature
 */
export function unionAtAntimeridian(feature: Feature<MultiPolygon | Polygon>) {
  if (isPolygon(feature)) {
    return feature;
  }

  feature = truncate(feature, {
    precision: 6,
    coordinates: 2,
    mutate: true,
  });

  const multiPolygon = feature.geometry;

  // Normalize coordinates to 0-360 space
  const normalizedCoordinates = multiPolygon.coordinates.map((polygon) =>
    polygon.map((ring) =>
      // @ts-ignore
      ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]),
    ),
  ) as polygonClipping.Geom[];

  // Perform union using polygon-clipping
  const unioned = polygonClipping.union(
    normalizedCoordinates[0],
    ...normalizedCoordinates.slice(1),
  );

  // Convert the result back to GeoJSON MultiPolygon format
  const unionedFeature: Feature<MultiPolygon> = {
    type: "Feature",
    geometry: {
      type: "MultiPolygon",
      coordinates: unioned as MultiPolygon["coordinates"],
    },
    properties: feature.properties || {},
  };

  return unionedFeature;
}

export function isPolygon(
  feature: Feature<Polygon | MultiPolygon>,
): feature is Feature<Polygon> {
  return feature.geometry.type === "Polygon";
}
