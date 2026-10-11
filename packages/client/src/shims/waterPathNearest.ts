/** Browser stand-in for the worker's ocean-bitmap search. */

export const MAX_DISTANCE_TO_FEATURES_KM = 400;
export const DEFAULT_WATER_PATH_MAX_RESULTS = 3;
/** Default search radius: 200 statute miles, stored in kilometres. */
export const DEFAULT_WATER_PATH_DISTANCE_KM = 200 * 1.609344;
export const MAX_WATER_PATH_RESULTS = 25;

export function searchWaterPathNearest(): never {
  throw new Error("Water-path search runs in the overlay worker");
}
