import { Feature, LineString, Polygon } from "geojson";
import { OverlayWorkerHelpers } from "./utils/helpers";
import { FlatGeobufSource } from "fgb-source";
export type DistanceToShoreResult = {
    meters: number;
    geojsonLine: Feature<LineString> | null;
};
/**
 * Distance from a sketch in the ocean to the nearest shoreline.
 *
 * Cases:
 *   1. On land or touching land → 0
 *   2. Within `minimumDistanceMeters` of shore → 0
 *   3. Otherwise geodesic distance from the closest point on the subject
 *      to the closest shoreline point
 *
 * Land features should be subdivided; H3 search uses variable resolution
 * (coarse open-ocean cells, fine cells when fetching shoreline).
 */
export declare function calculateDistanceToShore(feature: GeoJSON.Feature, land: FlatGeobufSource<Feature<Polygon>>, options?: {
    helpers?: OverlayWorkerHelpers;
    minimumDistanceMeters?: number;
    /** @deprecated typo alias of {@link minimumDistanceMeters} */
    miminumDistanceMeters?: number;
}): Promise<DistanceToShoreResult>;
//# sourceMappingURL=calculateDistanceToShore.d.ts.map