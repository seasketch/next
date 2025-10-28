import { SourceCache } from "fgb-source";
import { SourceType } from "./metrics/metrics";
import { Feature, Polygon } from "geojson";
import { OverlayWorkerHelpers } from "./utils/helpers";
/**
 *
 * @deprecated Use the OverlappingAreaBatchedClippingProcessor instead.
 */
export declare function calculateFragmentOverlap(fragment: Feature<Polygon>, sourceCache: SourceCache, sourceUrl: string, sourceType: SourceType, groupBy?: string, helpersOption?: OverlayWorkerHelpers): Promise<number | {
    [classKey: string]: number;
}>;
//# sourceMappingURL=calculateFragmentOverlap.d.ts.map