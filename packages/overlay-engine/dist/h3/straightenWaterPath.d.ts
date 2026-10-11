import { Geometry, Position } from "geojson";
import { H3Index } from "h3-js";
export type WaterPortal = {
    left: Position;
    right: Position;
};
/**
 * The hex edge crossed when moving from `from` to `to`, oriented so `left`
 * is on the left of the direction of travel. Parent/child steps are not
 * crossings.
 */
export declare function portalBetween(from: H3Index, to: H3Index): WaterPortal | null;
/**
 * Taut string through a channel of portals. In open water this collapses to
 * a straight line. Around land it bends only at portal corners.
 */
export declare function pullString(origin: Position, portals: WaterPortal[], end: Position): Position[];
/**
 * Point on the subject boundary where the water route leaves. Shore distance
 * uses the same idea: the line starts on an edge, not inside the polygon.
 */
export declare function departurePoint(geometry: Geometry, startCell: H3Index, aim: Position): Position;
/**
 * Feasible route through the hex corridor, then pulled toward the straight
 * chord until land stops it. The reported distance is the length of this line.
 */
export declare function straightenWaterPath(geometry: Geometry, chain: H3Index[], port: Position, segmentHitsLand: (start: Position, end: Position) => Promise<boolean>): Promise<Position[]>;
//# sourceMappingURL=straightenWaterPath.d.ts.map