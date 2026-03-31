import type { AiDataAnalystNotes, GenerateAttributionResult, GenerateColumnIntelligenceResult, GenerateTitleResult } from "ai-data-analyst";
export declare function isAiDataAnalystEnabled(): boolean;
type TitleOutcome = GenerateTitleResult | {
    error: string;
};
type AttributionOutcome = GenerateAttributionResult | {
    error: string;
};
type ColumnOutcome = GenerateColumnIntelligenceResult | {
    error: string;
};
export declare function asNeverReject<T>(p: Promise<T>, label: string): Promise<T | {
    error: string;
}>;
/**
 * Await in-flight AI tasks and merge into {@link AiDataAnalystNotes} when column
 * intelligence succeeds. Title and attribution are best-effort overlays.
 */
export declare function composeAiDataAnalystNotesFromPromises(options: {
    uploadFilename: string;
    titleP: Promise<TitleOutcome | {
        error: string;
    }> | null;
    attributionP: Promise<AttributionOutcome | {
        error: string;
    }> | null;
    columnP: Promise<ColumnOutcome | {
        error: string;
    }> | null;
}): Promise<AiDataAnalystNotes | undefined>;
export {};
//# sourceMappingURL=aiUploadNotes.d.ts.map