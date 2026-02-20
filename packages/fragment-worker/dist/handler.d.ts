import { GeographySettings, SketchFragment, FragmentResult } from "overlay-engine";
import { Feature, MultiPolygon } from "geojson";
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
export declare function handleCreateFragments(payload: CreateFragmentsPayload): Promise<CreateFragmentsResult>;
//# sourceMappingURL=handler.d.ts.map