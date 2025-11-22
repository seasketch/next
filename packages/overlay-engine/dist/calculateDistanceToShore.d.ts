import { Feature, Polygon, Position } from "geojson";
import { OverlayWorkerHelpers } from "./utils/helpers";
import { FlatGeobufSource } from "fgb-source";
/**
 * Calculates the distance from a given feature in the ocean to the nearest
 * point on land. Only supports Points, Polygons, and Lines (Multi* variants
 * are handled by flattening to their constituent geometries).
 *
 * There are 3 main cases to consider:
 *
 *   1. The feature is on land. If that is the case, the distance is 0.
 *   2. The feature is in the ocean but touches land, or is within
 *      options.miminumDistanceMeters. In this case the distance will again be
 *      0.
 *   3. The feature is in the ocean and is not touching land. In this case, the
 *      returned distance will be from the closest point along the polygon or
 *      line (or just the input point) to the closest point along the shoreline
 *      of nearby land features.
 *
 *
 * @param feature GeoJSON feature to calculate distance to shore for. Supports
 * Points, Polygons, and Lines (including Multi* variants)
 * @param land FlatGeobuf source containing the land geometry. Features should
 * be subdivided to reasonable sizes, otherwise performance will be poor.
 * @param helpers Optional helpers object for logging and progress reporting.
 * @returns Object containing:
 *   - meters: Distance to shore in meters
 *   - geojsonLine: LineString from closest point on the subject feature to the
 *     closest point along the shoreline (or null when distance is 0 or
 *     unbounded).
 */
export declare function calculateDistanceToShore(feature: GeoJSON.Feature, land: FlatGeobufSource<Feature<Polygon>>, options?: {
    helpers?: OverlayWorkerHelpers;
    miminumDistanceMeters?: number;
}): Promise<{
    meters: number;
    geojsonLine: {
        type: string;
        geometry: {
            type: string;
            coordinates: Position[];
        };
        properties: {};
    } | null;
}>;
//# sourceMappingURL=calculateDistanceToShore.d.ts.map