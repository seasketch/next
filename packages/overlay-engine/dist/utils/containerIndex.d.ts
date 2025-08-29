import type { Feature, Polygon, MultiPolygon, FeatureCollection } from "geojson";
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
    bboxPolygons: FeatureCollection<Polygon, {}>;
    constructor(container: ContainerFeature);
    /**
     * Classify a candidate polygon:
     *  - 'outside': bbox disjoint OR all sampled vertices outside and no boundary crossings
     *  - 'inside':  no boundary crossings & all sampled vertices inside
     *  - 'mixed':   any edge crosses/touches container boundary OR vertex on boundary OR mixed inside/outside vertices
     */
    classify(candidate: CandidateFeature): Classification;
    getBBoxPolygons(): FeatureCollection<Polygon, {}>;
}
//# sourceMappingURL=containerIndex.d.ts.map