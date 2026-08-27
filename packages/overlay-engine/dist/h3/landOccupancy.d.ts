import { Feature, Polygon } from "geojson";
import { H3Index } from "h3-js";
import { FlatGeobufSource } from "fgb-source";
export type LandOccupancyCache = Map<string, boolean>;
/**
 * True if the FlatGeobuf R-tree reports any land features in this cell.
 * Index-only (no feature fetch). Results are cached per cell.
 */
export declare function cellHasLand(cell: H3Index, land: FlatGeobufSource<Feature<Polygon>>, cache: LandOccupancyCache): boolean;
//# sourceMappingURL=landOccupancy.d.ts.map