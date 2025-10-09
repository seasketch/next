import { SourceCache } from "fgb-source";
import { ClippingLayerOption } from "./geographies";
import { SourceType } from "../metrics/metrics";
import { OverlayWorkerHelpers } from "../utils/helpers";
import { Feature, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
export declare function calculateGeographyOverlap(geography: ClippingLayerOption[], sourceCache: SourceCache, sourceUrl: string, sourceType: SourceType, groupBy?: string, helpersOption?: OverlayWorkerHelpers): Promise<{
    [classId: string]: number;
}>;
export declare function groupGeomsByClassKey(features: Feature<Polygon | MultiPolygon>[], groupBy?: string): {
    [key: string]: clipping.Geom[];
};
//# sourceMappingURL=calculateOverlap.d.ts.map