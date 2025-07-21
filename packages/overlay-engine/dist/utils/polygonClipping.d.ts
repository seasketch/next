import * as polygonClipping from "polygon-clipping";
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
export declare function union(geometries: polygonClipping.Geom[]): polygonClipping.MultiPolygon;
/**
 * Intersect a list of polygons into a single polygon.
 *
 * @param geometries - The list of polygons to intersect.
 * @returns The intersection of the polygons.
 */
export declare function intersection(geometries: polygonClipping.Geom[]): polygonClipping.MultiPolygon;
//# sourceMappingURL=polygonClipping.d.ts.map