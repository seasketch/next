import { H3Index } from "h3-js";
import { Position } from "geojson";
import { COARSE_H3_RESOLUTION, FINE_H3_RESOLUTION } from "./constants";
export { COARSE_H3_RESOLUTION, FINE_H3_RESOLUTION };
/**
 * Admissible lower bound (meters) from origin sample points to any location
 * inside `cell`: geodesic to the cell center minus the hex circumradius
 * (edge length).
 */
export declare function cellLowerBoundMeters(originSamples: Position[], cell: H3Index): number;
export declare function sameResNeighbors(cell: H3Index): H3Index[];
export declare function refineToFine(cell: H3Index): H3Index[];
//# sourceMappingURL=adaptiveGrid.d.ts.map