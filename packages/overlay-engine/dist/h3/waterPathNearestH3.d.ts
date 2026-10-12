import { Feature, LineString, Position } from "geojson";
import { FlatGeobufSource } from "fgb-source";
/**
 * Largest radius the engine will search. A miss expands the whole disk, so
 * this stays well under the overlay worker's practical time budget.
 * Retune with the bench when the grid changes.
 */
export declare const MAX_DISTANCE_TO_FEATURES_KM = 400;
/** Default number of nearest features when the caller does not set one. */
export declare const DEFAULT_WATER_PATH_MAX_RESULTS = 3;
/** Default search radius, in kilometres. */
export declare const DEFAULT_WATER_PATH_DISTANCE_KM = 300;
export declare const MAX_WATER_PATH_RESULTS = 25;
export type WaterPathFeatureHit = {
    __id: number;
    meters: number;
    properties: Record<string, unknown>;
    geojsonLine: Feature<LineString>;
};
/** A port inside the search disk, whether or not it received a water route. */
export type WaterPathCandidate = {
    __id: number;
    position: Position;
    properties: Record<string, unknown>;
    /** Straight-line distance from the sketch boundary, in meters. */
    geodesicMeters: number;
    /** Water-route length when this port was routed. */
    meters?: number;
};
export type WaterPathNearestResult = {
    features: WaterPathFeatureHit[];
    exceededLimit: boolean;
    /** Every port in the search disk, nearest geodesic first. */
    candidates: WaterPathCandidate[];
};
/**
 * Hex-grid water path. Open ocean steps up to coarse cells; the shore stays
 * on fine cells, then the chain is pulled taut. Kept so it can be compared
 * with the tangent router.
 */
export declare function searchWaterPathNearestH3(feature: Feature, points: FlatGeobufSource<Feature>, land: FlatGeobufSource<Feature>, options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
}): Promise<WaterPathNearestResult>;
//# sourceMappingURL=waterPathNearestH3.d.ts.map