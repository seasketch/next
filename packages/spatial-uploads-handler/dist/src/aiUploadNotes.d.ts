import type { AiDataAnalystNotes, GenerateAttributionResult, GenerateColumnIntelligenceResult, GenerateTitleResult } from "ai-data-analyst";
import type { GeostatsLayer } from "@seasketch/geostats-types";
/**
 * @deprecated Prefer gating on the upload request's `enableAiDataAnalyst` flag plus
 * {@link assertAiDataAnalystEnvVarsPresent}. Kept for callers that only need to know whether
 * Cloudflare AI Gateway env is present.
 */
export declare function isAiDataAnalystEnabled(): boolean;
/** Throws if AI Data Analyst LLM features were requested but Cloudflare AI Gateway env is incomplete. */
export declare function assertAiDataAnalystEnvVarsPresent(): void;
/**
 * Invoke the geostats-pii-risk-classifier Lambda synchronously.
 *
 * On success, returns the full annotated {@link GeostatsLayer} from the
 * Lambda payload (`{ geostats: ... }`). That object is the input layer spread
 * with updated `attributes` (each analysed string column has `piiRisk` and
 * optionally `piiRiskCategories`; high-cardinality columns may have shuffled
 * `values` key order) and `piiRiskWasAssessed: true`.
 *
 * Throws on any failure (missing env, Lambda error, invalid payload).
 *
 * GEOSTATS_PII_CLASSIFIER_ARN must be set.
 */
export declare function classifyGeostatsPii(geostats: GeostatsLayer): Promise<GeostatsLayer>;
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