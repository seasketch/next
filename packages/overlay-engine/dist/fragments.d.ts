import { BBox, Feature, GeoJsonProperties, Polygon } from "geojson";
import { ClippingFn, ClippingLayerOption } from "./geographies";
import { PreparedSketch } from "./utils/prepareSketch";
export type GeographySettings = {
    id: number;
    clippingLayers: ClippingLayerOption[];
};
export type FragmentResult = Feature<Polygon, {
    __geographyIds: number[];
} & GeoJsonProperties>;
export type PendingFragmentResult = FragmentResult & {
    properties: {
        __id: number;
    };
    bbox: BBox;
};
export declare function createFragments(preparedSketch: PreparedSketch, geographies: GeographySettings[], clippingFn: ClippingFn): Promise<FragmentResult[]>;
export type SketchFragment = FragmentResult & {
    properties: {
        __sketchIds: number[];
    } & GeoJsonProperties;
};
/**
 * Sketch Collections may not have overlapping fragments. It is assumed that any
 * overlap between sketches produces additional fragments, similar to how new
 * fragments are created when a sketch overlaps multiple geographies.
 *
 * This function accepts new fragments for a sketch, and merges them with
 * existing fragments in a collection, returning a new collection of fragments
 * that do not overlap.
 *
 * This function can be called with all the existing fragments in a collection,
 * or just the subset of fragments that overlap the bounding box of the new
 * sketch. It will operate correctly in either case, but with better performance
 * on large collections if the spatial index of postgres is used to limit the
 * number of fragments that need to be processed.
 *
 * @param newFragments - The new fragments to add to the collection.
 * @param existingFragments - The existing fragments in the collection.
 * @returns A new collection of fragments that do not overlap.
 */
export declare function eliminateOverlap(newFragments: SketchFragment[], existingFragments: SketchFragment[]): SketchFragment[];
/**
 * Finds fragments that have matching key properties and are touching, and
 * attempts to merge them into a single fragment if their intersection results
 * in a single polygon.
 *
 * Uses a connected components algorithm to find all fragments that can be
 * merged through chains of touching fragments, not just direct neighbors.
 * Makes multiple passes until no more merges are possible.
 */
export declare function mergeTouchingFragments(fragments: PendingFragmentResult[], keyNumericProperties: string[]): PendingFragmentResult[];
/**
 * Attempts to merge a group of touching fragments into a single fragment
 */
export declare function mergeTouchingFragmentGroup(fragments: PendingFragmentResult[], keyNumericProperties: string[]): PendingFragmentResult | null;
//# sourceMappingURL=fragments.d.ts.map