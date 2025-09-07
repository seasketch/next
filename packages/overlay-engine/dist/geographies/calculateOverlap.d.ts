import { SourceCache } from "fgb-source";
import { ClippingLayerOption } from "./geographies";
import { SourceType } from "../metrics/metrics";
import { OverlayWorkerHelpers } from "../utils/helpers";
export declare function calculateGeographyOverlap(geography: ClippingLayerOption[], sourceCache: SourceCache, sourceUrl: string, sourceType: SourceType, groupBy?: string, helpersOption?: OverlayWorkerHelpers): Promise<{
    [classId: string]: number;
}>;
//# sourceMappingURL=calculateOverlap.d.ts.map