import { BBox, Feature, MultiPolygon, Polygon } from "geojson";

/**
 * Creates a bounding box for the given feature, taking into account features
 * that may span the antimeridian, and adjusting the coordinates into space
 * outside of -180, 180, such that a webmap can be panned to an appropriate
 * bounds.
 *
 * @param feature - A GeoJSON Feature containing a Polygon or MultiPolygon geometry
 * @returns A bounding box as [minX, minY, maxX, maxY]
 */
export function bboxForFeature(
  feature: Feature<Polygon | MultiPolygon>
): number[] {
  // Extract coordinates based on geometry type
  const coords =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

  // Find min/max values
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Track if coordinates span the antimeridian
  let minLng = Infinity;
  let maxLng = -Infinity;

  // First pass: collect all raw coordinates to detect antimeridian crossing
  for (const polygon of coords) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        minLng = Math.min(minLng, x);
        maxLng = Math.max(maxLng, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Detect if we're crossing the antimeridian
  const crossesAntimeridian = minLng < -160 && maxLng > 160;

  // Second pass: normalize coordinates if crossing antimeridian
  for (const polygon of coords) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        if (crossesAntimeridian) {
          // If we cross the antimeridian, shift points to negative space
          // This makes coordinates like [170, -170] become [170, 190] for proper bbox calculation
          const adjustedX = x > 0 ? x - 360 : x;
          minX = Math.min(minX, adjustedX);
          maxX = Math.max(maxX, adjustedX);
        } else {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    }
  }

  // Only use -180/180 fallback if the feature truly wraps most of the globe
  // and we're not just dealing with antimeridian crossing
  if (!crossesAntimeridian && maxX - minX > 359) {
    minX = -180;
    maxX = 180;
  }

  return [minX, minY, maxX, maxY];
}

/**
 * If bounding box crosses antimeridian (and extends outside the range of -180 to 180),
 * split it into two bounding boxes at the antimeridian.
 * @param bbox the bounding box to split
 * @returns array of one or two bounding boxes
 */
export function splitBBoxAntimeridian(bbox: BBox) {
  const [minX, minY, maxX, maxY] = cleanBBox(bbox);

  // If the normalized bbox crosses the antimeridian, splitting is needed
  if (minX > maxX) {
    return [
      [minX, minY, 180, maxY],
      [-180, minY, maxX, maxY],
    ];
  } else {
    return [bbox];
  }
}

/**
 * Normalizes bounding box longitude values to the [-180, 180] range if they cross the antimeridian
 * @param bbox the bounding box to clean
 * @returns the cleaned bounding box
 */
export function cleanBBox(bbox: BBox | number[]) {
  const [minX, minY, maxX, maxY] = bbox;

  // Normalize longitudes to the [-180, 180] range if needed
  const normMinX = ((((minX + 180) % 360) + 360) % 360) - 180;
  const normMaxX = ((((maxX + 180) % 360) + 360) % 360) - 180;

  return [normMinX, minY, normMaxX, maxY];
}

/**
 * Converts a bounding box array to an envelope object with minX, minY, maxX, maxY properties
 * @param bbox the bounding box as [minX, minY, maxX, maxY]
 * @returns an envelope object
 */
export function bboxToEnvelope(bbox: BBox | number[]) {
  const [minX, minY, maxX, maxY] = bbox;
  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}

/**
 * Checks if two bounding boxes intersect
 * @param bbox1 the first bounding box
 * @param bbox2 the second bounding box
 * @returns true if the bounding boxes intersect, false otherwise
 */
export function bboxIntersects(bbox1: BBox, bbox2: BBox) {
  return (
    bbox1[0] <= bbox2[2] &&
    bbox1[2] >= bbox2[0] &&
    bbox1[1] <= bbox2[3] &&
    bbox1[3] >= bbox2[1]
  );
}
