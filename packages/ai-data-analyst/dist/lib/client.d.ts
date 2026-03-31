import OpenAI from "openai";
export type ColumnIntelligence = {
    best_label_column?: string;
    best_category_column?: string;
    best_numeric_column?: string;
    best_date_column?: string;
    best_popup_description_column?: string;
    best_id_column?: string;
    junk_columns: string[];
    chosen_presentation_type: "RGB_RASTER" | "CATEGORICAL_RASTER" | "CONTINUOUS_RASTER" | "SIMPLE_POLYGON" | "CATEGORICAL_POLYGON" | "CONTINUOUS_POLYGON" | "SIMPLE_POINT" | "MARKER_IMAGE" | "CATEGORICAL_POINT" | "PROPORTIONAL_SYMBOL" | "CONTINUOUS_POINT" | "HEATMAP";
    chosen_presentation_column?: string;
    palette?: string;
    custom_palette?: string[];
    show_labels: boolean;
    labels_min_zoom?: number;
    interactivity_type: "BANNER" | "TOOLTIP" | "POPUP" | "ALL_PROPERTIES_POPUP" | "NONE";
    notes: string;
};
export type GenerateTitleResult = {
    title: string;
    usage: OpenAI.Completions.CompletionUsage;
} | {
    error: string;
    usage?: OpenAI.Completions.CompletionUsage;
};
export declare function generateTitle(filename: string): Promise<GenerateTitleResult>;
export type GenerateAttributionResult = {
    attribution: string | null;
    usage: OpenAI.Completions.CompletionUsage;
} | {
    error: string;
    usage?: OpenAI.Completions.CompletionUsage;
};
export declare function generateAttribution(metadata: string[]): Promise<GenerateAttributionResult>;
export type GenerateColumnIntelligenceResult = {
    result: ColumnIntelligence;
    usage: OpenAI.Completions.CompletionUsage;
} | {
    error: string;
    usage?: OpenAI.Completions.CompletionUsage;
};
export declare function generateColumnIntelligence(filename: string, geostats: unknown): Promise<GenerateColumnIntelligenceResult>;
//# sourceMappingURL=client.d.ts.map