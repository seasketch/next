import { Feature, Geometry, MultiPolygon, Polygon, Position } from "geojson";
export type ClosestPath = {
    meters: number;
    origin: Position | null;
    shoreline: Position | null;
};
/**
 * Closest points between the subject geometry and a land polygon, in meters.
 */
export declare function nearestPointsBetweenGeometryAndPolygon(subjectGeom: Geometry, landFeature: Feature<Polygon | MultiPolygon>): ClosestPath;
//# sourceMappingURL=nearestShorelinePath.d.ts.map