import { Feature } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { WaterPathNearestResult } from "./waterPathNearestH3";
/**
 * Hierarchical water path. Open ocean is a coarse hex step. A cell whose
 * bbox meets the land index is split, and only the children that still
 * have water are entered. Land polygons are fetched only for the fine cells
 * the path actually touches. The cell chain is then string-pulled so an
 * ocean crossing stays a straight line.
 */
export declare function searchWaterPathByHierarchy(feature: Feature, points: FlatGeobufSource<Feature>, land: FlatGeobufSource<Feature>, options?: {
    maxResults?: number;
    maxDistanceKm?: number;
    includedColumns?: string[];
}): Promise<WaterPathNearestResult>;
//# sourceMappingURL=waterPathHierarchy.d.ts.map