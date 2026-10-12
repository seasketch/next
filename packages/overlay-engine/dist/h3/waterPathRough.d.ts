import { Feature, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { H3Index } from "h3-js";
/**
 * Thrown when a search passes its deadline. Hot loops check the clock and
 * throw so a synchronous stretch cannot run on after the budget.
 */
export declare class RouteDeadline extends Error {
    constructor();
}
export declare function pastDeadline(deadline?: number): boolean;
/** True when the straight line meets the land index, so it is not open water. */
export declare function geodesicHitsIndex(land: FlatGeobufSource<Feature>, origin: Position, goal: Position, cache: Map<H3Index, boolean>, deadline?: number): boolean;
/**
 * Interior samples whose cell meets the land index. A hit means the point
 * might be on land; the caller confirms with the polygon. Shoreline bboxes
 * make this true for a route that is still in the water.
 */
export declare function indexedRouteSamples(land: FlatGeobufSource<Feature>, coords: Position[], cache: Map<H3Index, boolean>, deadline?: number, stepMeters?: number): Position[];
export type RoughSpan = {
    /** Length of the index path, or the geodesic when that path was not found. */
    meters: number;
    /**
     * True when the fetch window is the geodesic band. A long detour is not
     * local: the caller can try nearby ports before paying for it.
     */
    local: boolean;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    /** Index path, or the geodesic when that path was not found. */
    path: Position[];
};
export declare function cellBlocked(land: FlatGeobufSource<Feature>, cell: H3Index, cache: Map<H3Index, boolean>, deadline?: number): boolean;
/**
 * Index-only path from `origin` to `goal`. Land polygons are not downloaded.
 * The returned window is what the tangent router should fetch to hone the line.
 */
export declare function roughCorridor(land: FlatGeobufSource<Feature>, origin: Position, goal: Position, maxMeters: number, cache: Map<H3Index, boolean>, deadline?: number): RoughSpan;
//# sourceMappingURL=waterPathRough.d.ts.map