import type { Feature, Polygon, MultiPolygon, Point, MultiPoint, FeatureCollection } from "geojson";
export type ContainerFeature = Feature<Polygon | MultiPolygon>;
export type CandidateFeature = Feature<Polygon | MultiPolygon | Point | MultiPoint>;
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
    private holeRings;
    private holeBBoxes;
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
    /**
     * Test whether a point (or multipoint) feature is within the container polygon.
     * Uses the container bbox and hole bboxes for efficient filtering.
     *
     * @param pointFeature - A Point or MultiPoint feature to test
     * @returns For Point: true if the point is inside the container (and not in any holes).
     *          For MultiPoint: true if ANY point is inside the container (and not in any holes).
     */
    pointInPolygon(pointFeature: Feature<Point | MultiPoint>): boolean;
    /**
     * Test whether a single point coordinate is within the container polygon.
     * Uses bbox filtering and hole bboxes for efficiency.
     */
    private pointInPolygonSingle;
    getBBoxPolygons(): FeatureCollection<Polygon, {}>;
}
//# sourceMappingURL=containerIndex.d.ts.map