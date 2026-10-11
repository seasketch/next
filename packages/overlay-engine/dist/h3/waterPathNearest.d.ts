import { Feature } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { WaterPathResolution } from "./bitmapSearch";
export type { WaterPathCandidate, WaterPathFeatureHit, WaterPathNearestResult, } from "./waterPathNearestH3";
import type { WaterPathNearestResult } from "./waterPathNearestH3";
export declare const MAX_DISTANCE_TO_FEATURES_KM = 400;
export declare const DEFAULT_WATER_PATH_MAX_RESULTS = 3;
/** Default search radius: 200 statute miles, stored in kilometres. */
export declare const DEFAULT_WATER_PATH_DISTANCE_KM: number;
export declare const MAX_WATER_PATH_RESULTS = 25;
/**
 * Water-path distance from a sketch to the nearest point features.
 * The ocean bitmap is classified from the H3 land archive. The land
 * polygons are the caller's shoreline source, the same file distance-to-shore
 * uses, and they carry a port out of a harbor the archive has filled in.
 */
export declare function searchWaterPathNearest(feature: Feature, points: FlatGeobufSource<Feature>, land: FlatGeobufSource<Feature>, options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
    /** Grid cell size. Omitted means the fine grid. */
    resolution?: WaterPathResolution;
    /** Epoch ms. The search stops and returns the routes it has. */
    deadline?: number;
    /** Record the grid walk for the debug viewer. */
    trace?: boolean;
    archiveUrl?: string;
    onProgress?: (text: string) => void;
}): Promise<WaterPathNearestResult>;
//# sourceMappingURL=waterPathNearest.d.ts.map