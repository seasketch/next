import { Feature } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { WaterPathNearestResult } from "./h3/waterPathNearest";
import { WaterPathResolution } from "./h3/bitmapSearch";
/**
 * Water-path distance from a sketch to the nearest point features.
 * Land blocks the route. A point on the shoreline is reached from the
 * adjacent water cell plus a short hop.
 */
export declare function calculateDistanceToFeaturesOverWater(feature: Feature, points: FlatGeobufSource<Feature>, land: FlatGeobufSource<Feature>, options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
    /** Grid cell size. Omitted means the fine grid. */
    resolution?: WaterPathResolution;
}): Promise<WaterPathNearestResult>;
//# sourceMappingURL=calculateDistanceToFeaturesOverWater.d.ts.map