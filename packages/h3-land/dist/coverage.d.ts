export type Pt = [number, number];
export declare function ringArea(ring: readonly Pt[]): number;
/**
 * Sutherland–Hodgman clip of `subject` to a convex window.
 * The window is oriented counterclockwise. Area is in the same units as the points.
 */
export declare function clipToConvex(subject: readonly Pt[], window: readonly Pt[]): Pt[];
/**
 * H3 children are not inside their parent's outline. Two levels down, the six
 * corner children sit half outside it. Scaling the parent hexagon about its
 * center by this factor covers every descendant two levels down, with margin.
 */
export declare const DESCENDANT_REACH = 1.3;
/**
 * Polygon pieces of `rings` that lie inside the cell. The result is small even
 * when the source polygon is a continent, so finer cells can be measured
 * against it instead of against the original rings. `expand` scales the
 * clipping hexagon about the cell center; pass `DESCENDANT_REACH` when the
 * clipped polygon will be measured against descendants.
 */
export declare function clipRingsToCell(rings: readonly (readonly number[][])[], h3: bigint, expand?: number): number[][][] | null;
/**
 * Longitude/latitude box around the cell scaled by `expand`, for a cheap
 * rejection before projecting a large ring.
 */
export declare function cellReachBbox(h3: bigint, expand: number): [number, number, number, number];
export declare function ringsBbox(rings: readonly (readonly number[][])[]): [number, number, number, number];
export declare function bboxesOverlap(a: readonly [number, number, number, number], b: readonly [number, number, number, number]): boolean;
/** Planar area of the cell in the same frame used for intersection. */
export declare function hexAreaM2(h3: bigint): number;
/**
 * Area of `rings` (GeoJSON polygon coordinates, outer ring first) that lies
 * inside the cell. Holes are subtracted. The fraction of `hexAreaM2` is the
 * coverage used to tell partial from entire.
 */
export declare function intersectionAreaM2(h3: bigint, rings: readonly (readonly number[][])[]): number;
