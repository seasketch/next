import { Feature, LineString, MultiLineString } from "geojson";
/**
 * Shoreline of `landFeatures` that lies inside or on `subject`.
 * A short overlap keeps fine detail. A long one is thousands of separate
 * land edges; those are rounded to about a kilometer so the highlight
 * stays drawable and under the queue size limit.
 */
export declare function shorelineInsideSubject(subject: Feature, landFeatures: Feature[]): Feature<LineString | MultiLineString> | null;
//# sourceMappingURL=shorelineIntersection.d.ts.map