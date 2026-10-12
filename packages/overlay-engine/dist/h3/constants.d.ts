/**
 * Fixed Earth radius used for rough degree <-> meter conversions.
 * Final distances are always computed geodesically by Turf.
 */
export declare const EARTH_RADIUS_METERS = 6371008.8;
/** Coarse H3 resolution for long-range search (~22 km edge). */
export declare const COARSE_H3_RESOLUTION = 4;
/** Fine H3 resolution for fetching land features (~1.2 km edge). */
export declare const FINE_H3_RESOLUTION = 7;
/** Give up once the next cell's lower bound exceeds this (3,000 km). */
export declare const MAX_SEARCH_METERS = 3000000;
/**
 * Minimum initial point buffer used for the small bbox search
 * (before falling back to H3). Combined with `minimumDistanceMeters`.
 */
export declare const MIN_POINT_BUFFER_METERS = 50;
export declare function metersToDegrees(distanceMeters: number): number;
//# sourceMappingURL=constants.d.ts.map