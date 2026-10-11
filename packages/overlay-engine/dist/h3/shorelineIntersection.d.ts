import { Feature, LineString, MultiLineString } from "geojson";
/**
 * Shoreline of `landFeatures` that lies inside or on `subject`.
 * The result is simplified so a coastal overlap is a short line, not the
 * full land ring.
 */
export declare function shorelineInsideSubject(subject: Feature, landFeatures: Feature[]): Feature<LineString | MultiLineString> | null;
//# sourceMappingURL=shorelineIntersection.d.ts.map