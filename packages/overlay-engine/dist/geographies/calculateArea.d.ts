import { Feature, MultiPolygon, Polygon } from "geojson";
import { SourceCache } from "fgb-source";
import { ClippingLayerOption } from "./geographies";
export type DebuggingCallback = (type: "edge-box" | "classified-difference-feature" | "intersection-layer", feature: Feature<Polygon | MultiPolygon>) => void;
export interface CalculateAreaOptions {
    debuggingCallback?: DebuggingCallback;
    progressCallback?: (progress: number) => void;
}
export declare function calculateArea(geography: ClippingLayerOption[], sourceCache: SourceCache, options?: CalculateAreaOptions): Promise<number>;
//# sourceMappingURL=calculateArea.d.ts.map