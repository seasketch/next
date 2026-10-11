import { Feature } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { LandState } from "@seasketch/h3-land/client";
import { WaterPathNearestResult } from "./waterPathNearestH3";
/**
 * Water route from a sketch to the nearest point features. The search walks
 * the H3 land archive, then straightens the chain and checks the last mile
 * against shoreline polygons.
 */
export type OccupancyTrace = {
    fine: number;
    expansions: number;
    requests: number;
    bytes: number;
    /** Every cell whose state was read, including parents that were lifted or split. */
    cells: {
        cell: string;
        state: LandState;
    }[];
};
export declare function searchWaterPathByOccupancy(feature: Feature, points: FlatGeobufSource<Feature>, land: FlatGeobufSource<Feature>, options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
    deadline?: number;
    /** Occupancy archive. Defaults to the res-9 file, or H3_LAND_URL. */
    archiveUrl?: string;
    /** Attach the cells this search read. The route itself does not change. */
    trace?: boolean;
}): Promise<WaterPathNearestResult & {
    trace?: OccupancyTrace;
}>;
//# sourceMappingURL=waterPathOccupancy.d.ts.map