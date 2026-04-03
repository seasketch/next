import type { AiDataAnalystNotes, GenerateAttributionResult, GenerateColumnIntelligenceResult, GenerateTitleResult } from "ai-data-analyst";
import type { GeostatsLayer } from "@seasketch/geostats-types";
export declare function isAiDataAnalystEnabled(): boolean;
/**
 * Invoke the geostats-pii-risk-classifier Lambda synchronously.
 *
 * On success, returns the full annotated {@link GeostatsLayer} from the
 * Lambda payload (`{ geostats: ... }`). That object is the input layer spread
 * with updated `attributes` (each analysed string column has `piiRisk` and
 * optionally `piiRiskCategories`; high-cardinality columns may have shuffled
 * `values` key order) and `piiRiskWasAssessed: true`.
 *
 * Returns `null` on any failure (fail-open: caller proceeds without changes).
 *
 * GEOSTATS_PII_CLASSIFIER_ARN must be set before calling this function.
 */
export declare function classifyGeostatsPii(geostats: GeostatsLayer): Promise<GeostatsLayer | null>;
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