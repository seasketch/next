import { VisualizationTypeId } from "@seasketch/geostats-types";
/** Re-export for callers that need the id list (same source as prompts). */
export declare const VISUALIZATION_TYPES: ("RGB_RASTER" | "CATEGORICAL_RASTER" | "CONTINUOUS_RASTER" | "SIMPLE_POLYGON" | "CATEGORICAL_POLYGON" | "CONTINUOUS_POLYGON" | "SIMPLE_POINT" | "MARKER_IMAGE" | "CATEGORICAL_POINT" | "PROPORTIONAL_SYMBOL" | "CONTINUOUS_POINT" | "HEATMAP")[];
export type { VisualizationTypeId };
/** Max stored length for LLM rationale (Postgres `text` is unbounded; cap for safety). */
export declare const AI_CARTOGRAPHER_RATIONALE_MAX_LEN = 8000;
/** Max length for human-friendly layer title from column intelligence. */
export declare const BEST_LAYER_TITLE_MAX_LEN = 200;
export declare function clampBestLayerTitle(s: string | null | undefined): string | null;
export interface ColumnIntelligenceResponse {
    best_label_column: string | null;
    best_category_column: string | null;
    best_numeric_column: string | null;
    best_date_column: string | null;
    best_popup_description_column: string | null;
    best_id_column: string | null;
    junk_columns: string[];
    chosen_presentation_type: VisualizationTypeId | null;
    chosen_presentation_column: string | null;
    ai_cartographer_rationale: string | null;
    best_layer_title: string | null;
}
/**
 * Parse and validate LLM JSON (no zod — keeps api install working where private packages block npm i).
 */
export declare function parseColumnIntelligenceResponse(parsed: unknown): ColumnIntelligenceResponse | null;
/**
 * After sanitization and geometry/raster filtering, choose the attribute column
 * that drives the presentation style (LLM may omit; use sensible fallbacks).
 */
export declare function derivePresentationColumnForStorage(presentation: VisualizationTypeId | null, parsed: ColumnIntelligenceResponse, isRaster: boolean): string | null;
/**
 * Keep presentation only if it matches dataset kind (raster vs vector geometry).
 */
export declare function filterPresentationType(presentation: VisualizationTypeId | null | undefined, opts: {
    isRaster: boolean;
    primaryGeometry?: string;
}): VisualizationTypeId | null;
/**
 * Restrict column names to known attributes; drop unknowns with no fuzzy match.
 */
export declare function sanitizeColumnFields(parsed: ColumnIntelligenceResponse, allowedColumns: string[] | null): ColumnIntelligenceResponse;
//# sourceMappingURL=validation.d.ts.map