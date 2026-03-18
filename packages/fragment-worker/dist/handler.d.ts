import { GeographySettings, SketchFragment, FragmentResult } from "overlay-engine";
import { Feature, MultiPolygon } from "geojson";
export interface WarmCachePayload {
    operation: "warm-cache";
    feature: Feature<any>;
    geographies: GeographySettings[];
}
export interface CreateFragmentsPayload {
    feature: Feature<any>;
    geographies: GeographySettings[];
    geographiesForClipping: number[];
    existingOverlappingFragments: SketchFragment[];
    existingSketchId: number | null;
}
export interface CreateFragmentsResult {
    success: boolean;
    clipped?: Feature<MultiPolygon> | null;
    fragments?: FragmentResult[];
    error?: string;
}
export interface CreateCollectionFragmentsPayload {
    operation: "create-collection-fragments";
    sketches: Array<{
        id: number;
        feature: Feature<any>;
    }>;
    geographies: GeographySettings[];
    geographiesForClipping: number[];
}
export interface CreateCollectionFragmentsResult {
    success: boolean;
    fragmentsBySketchId?: Record<number, FragmentResult[]>;
    error?: string;
}
export declare function handleWarmCache(payload: WarmCachePayload): Promise<{
    success: boolean;
}>;
export declare function handleCreateFragments(payload: CreateFragmentsPayload): Promise<CreateFragmentsResult>;
export declare function handleCreateCollectionFragments(payload: CreateCollectionFragmentsPayload): Promise<CreateCollectionFragmentsResult>;
//# sourceMappingURL=handler.d.ts.map