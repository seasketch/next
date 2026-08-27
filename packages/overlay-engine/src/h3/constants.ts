/**
 * Fixed Earth radius used for rough degree <-> meter conversions.
 * Final distances are always computed geodesically by Turf.
 */
export const EARTH_RADIUS_METERS = 6_371_008.8;

/** Coarse H3 resolution for long-range search (~22 km edge). */
export const COARSE_H3_RESOLUTION = 4;

/** Fine H3 resolution for fetching land features (~1.2 km edge). */
export const FINE_H3_RESOLUTION = 7;

/** Give up once the next cell's lower bound exceeds this (3,000 km). */
export const MAX_SEARCH_METERS = 3_000_000;

/**
 * Minimum initial point buffer used for the small bbox search
 * (before falling back to H3). Combined with `minimumDistanceMeters`.
 */
export const MIN_POINT_BUFFER_METERS = 50;

export function metersToDegrees(distanceMeters: number) {
  const radians = distanceMeters / EARTH_RADIUS_METERS;
  return (radians * 180) / Math.PI;
}
