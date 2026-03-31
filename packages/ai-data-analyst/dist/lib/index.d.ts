import { ColumnIntelligence } from "./client";
export { attributionFormattingSchema, attributionFormattingValidator, } from "./prompts/layers/attribution";
export { columnIntelligenceSchema, columnIntelligenceValidator, } from "./prompts/layers/columnIntelligence";
export { titleFormattingSchema, titleFormattingValidator, } from "./prompts/layers/title";
export { attributionPrompt, attributionParameters, } from "./prompts/layers/attribution";
export { columnIntelligencePrompt, columnIntelligenceParameters, } from "./prompts/layers/columnIntelligence";
export { titlePrompt, titleParameters } from "./prompts/layers/title";
export { generateAttribution, generateColumnIntelligence, generateTitle, ColumnIntelligence, } from "./client";
export type { GenerateTitleResult, GenerateAttributionResult, GenerateColumnIntelligenceResult, } from "./client";
export { pruneGeostats } from "./geostats/shrinkGeostats";
export type OpenAIParameters = {
    model: string;
    effort: "low" | "medium" | "high";
    verbosity: "low" | "medium" | "high";
};
export type AiDataAnalystNotes = ColumnIntelligence & {
    /** Present when the title LLM call succeeded (may be empty string). */
    best_layer_title?: string;
    /** Present when the attribution LLM call succeeded; null means the model returned no attribution. */
    attribution?: string | null;
    /** Combined LLM / timeout / client error messages for debugging (last compose pass wins on upsert). */
    errors?: string;
};
//# sourceMappingURL=index.d.ts.map