// import * as polygonClipping from "polygon-clipping";
import * as clipper from "polyclip-ts";

/**
 * Union a list of polygons into a single polygon.
 *
 * I made this wrapper because polygonClipping has a weird type signature where
 * it expects to be passed a single Geom as the first argment, and then a list
 * of Geoms as the rest of the arguments.
 *
 * This wrapper just takes a list of Geoms and calls polygonClipping.union with
 * the first geom and the rest of the geoms as the rest of the arguments.
 *
 * @param geometries - The list of polygons to union.
 * @returns The union of the polygons.
 */
export function union(geometries: clipper.Geom[]) {
  return clipper.union(geometries[0], ...geometries.slice(1));
}

/**
 * Intersect a list of polygons into a single polygon.
 *
 * @param geometries - The list of polygons to intersect.
 * @returns The intersection of the polygons.
 */
export function intersection(geometries: clipper.Geom[]) {
  if (geometries.length < 2) {
    throw new Error("At least two geometries are required for intersection");
  } else {
    return clipper.intersection(geometries[0], ...geometries.slice(1));
  }
}

/**
 * Difference a list of polygons into a single polygon.
 *
 * @param geometries - The list of polygons to difference.
 * @returns The difference of the polygons.
 */
export function difference(geometries: clipper.Geom[]) {
  if (geometries.length < 2) {
    throw new Error("At least two geometries are required for difference");
  } else {
    return clipper.difference(geometries[0], ...geometries.slice(1));
  }
}
