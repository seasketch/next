import type { Feature, Polygon, MultiPolygon } from "geojson";
export type ContainerFeature = Feature<Polygon | MultiPolygon>;
export type CandidateFeature = Feature<Polygon | MultiPolygon>;
export type Classification = "inside" | "outside" | "mixed";
/**
 * ContainerIndex
 *  - Preprocesses the container polygon (or multipolygon)
 *  - Builds a Flatbush index of its boundary segments
 *  - Classifies candidate polygons in streaming fashion
 */
export declare class ContainerIndex {
    private container;
    private containerBBox;
    private rings;
    private segsA;
    private segsB;
    private index;
    constructor(container: ContainerFeature);
    /**
     * Classify a candidate polygon:
     *  - 'outside': bbox disjoint OR vertex outside and no boundary crossings
     *  - 'inside':  no boundary crossings & vertex inside
     *  - 'mixed':   any edge crosses/touches container boundary OR vertex on boundary
     */
    classify(candidate: CandidateFeature): Classification;
}
//# sourceMappingURL=containerIndex.d.ts.map