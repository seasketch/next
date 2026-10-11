import { Feature, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { WaterPathNearestResult } from "./waterPathNearestH3";
/** Offshore hulls, tangent edges, and the graph walk. Viewer-only; routing ignores it. */
export type TangentRouteTrace = {
    nodes: Position[];
    steps: number[];
    prev: number[];
    depart: Array<Position | null>;
    hulls: Position[][];
    edges: Array<[number, number]>;
    edgesTruncated: boolean;
};
/**
 * Water route from `origin` to `port` around `landRings`, standing offshore.
 * `subjectRings` are obstacles the line may leave but not cross.
 * Returns null when every detour is longer than `maxDistanceMeters`.
 */
export declare function routeWaterPath(origin: Position, port: Position, landRings: Position[][], subjectRings: Position[][], maxDistanceMeters: number): Position[] | null;
/**
 * Tangent water path. Ports in the search disk are cheap. Land is not: a
 * rough path is drawn from the FlatGeobuf index (an index miss is water),
 * and polygons are fetched only inside that corridor.
 */
export declare function searchWaterPathByTangent(feature: Feature, points: FlatGeobufSource<Feature>, land: FlatGeobufSource<Feature>, options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
    deadline?: number;
    /** Record hulls, tangents, and the graph walk for the viewer. Routing is unchanged. */
    trace?: boolean;
}): Promise<WaterPathNearestResult & {
    traces?: Array<TangentRouteTrace | null>;
}>;
//# sourceMappingURL=waterPathTangent.d.ts.map