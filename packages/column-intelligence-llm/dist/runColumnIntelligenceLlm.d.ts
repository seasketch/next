import { type ColumnIntelligenceProvider } from "./config";
import { type WorkersAiUsage } from "./cloudflareAi";
import { type VisualizationTypeId } from "./validation";
export interface ColumnIntelligenceAppliedRow {
    best_label_column: string | null;
    best_category_column: string | null;
    best_numeric_column: string | null;
    best_date_column: string | null;
    best_popup_description_column: string | null;
    best_id_column: string | null;
    junk_columns: string[] | null;
    chosen_presentation_type: VisualizationTypeId | null;
    chosen_presentation_column: string | null;
    ai_cartographer_rationale: string | null;
    best_layer_title: string | null;
}
export type PrefetchedColumnIntelligence = {
    status: "applied";
    row: ColumnIntelligenceAppliedRow;
    provider: ColumnIntelligenceProvider;
    /** Set when {@link provider} is `"cloudflare"` — Workers AI model id used for the call. */
    workersAiModel?: string;
    usage?: WorkersAiUsage;
    /** Convenience for TOC title (same as row.best_layer_title when applied). */
    bestLayerTitle: string | null;
} | {
    status: "skipped";
    reason: string;
    provider: ColumnIntelligenceProvider;
    workersAiModel?: string;
} | {
    status: "failed";
    error: string;
    provider: ColumnIntelligenceProvider;
    workersAiModel?: string;
};
/**
 * Run column intelligence LLM from geostats (no database). Used from the upload
 * Lambda to overlap network time with tiling, and from the API worker when loading from DB.
 */
export declare function runColumnIntelligenceLlm(options: {
    geostats: unknown;
    uploadedSourceFilename: string | null;
}): Promise<PrefetchedColumnIntelligence>;
//# sourceMappingURL=runColumnIntelligenceLlm.d.ts.map