import Ajv from "ajv";
import { visualizationTypeIds } from "@seasketch/geostats-types";

/**
 * JSON Schema sent to Workers AI `response_format` (must stay aligned with
 * {@link parseColumnIntelligenceResponse} and DB columns).
 */
export function buildColumnIntelligenceResponseJsonSchema(): Record<string, unknown> {
  const presentationEnum = visualizationTypeIds() as string[];
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      best_label_column: { type: ["string", "null"] },
      best_category_column: { type: ["string", "null"] },
      best_numeric_column: { type: ["string", "null"] },
      best_date_column: { type: ["string", "null"] },
      best_popup_description_column: { type: ["string", "null"] },
      best_id_column: { type: ["string", "null"] },
      junk_columns: {
        type: "array",
        items: { type: "string" },
      },
      chosen_presentation_type: {
        oneOf: [
          { type: "null" },
          { type: "string", enum: presentationEnum },
        ],
      },
      chosen_presentation_column: { type: ["string", "null"] },
      ai_cartographer_rationale: { type: ["string", "null"] },
      best_layer_title: { type: ["string", "null"] },
    },
    required: [
      "best_label_column",
      "best_category_column",
      "best_numeric_column",
      "best_date_column",
      "best_popup_description_column",
      "best_id_column",
      "junk_columns",
      "chosen_presentation_type",
      "chosen_presentation_column",
      "ai_cartographer_rationale",
      "best_layer_title",
    ],
  };
}

/** Single schema instance shared with Workers AI `response_format` and Ajv. */
export const COLUMN_INTELLIGENCE_RESPONSE_JSON_SCHEMA =
  buildColumnIntelligenceResponseJsonSchema();

const ajvForColumnIntelligence = new Ajv({ allErrors: true });
const validateColumnIntelligenceResponse = ajvForColumnIntelligence.compile(
  COLUMN_INTELLIGENCE_RESPONSE_JSON_SCHEMA as object,
);

export function validateColumnIntelligenceResponseAgainstJsonSchema(
  data: unknown,
): { ok: true } | { ok: false; message: string } {
  if (validateColumnIntelligenceResponse(data)) {
    return { ok: true };
  }
  return {
    ok: false,
    message: ajvForColumnIntelligence.errorsText(
      validateColumnIntelligenceResponse.errors,
      { separator: "; " },
    ),
  };
}
