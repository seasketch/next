import { visualizationTypeIds } from "@seasketch/geostats-types";
import Ajv from "ajv";
/**
 * JSON Schema sent to Workers AI `response_format` (must stay aligned with
 * {@link parseColumnIntelligenceResponse} and DB columns).
 */
export function buildColumnIntelligenceResponseJsonSchema(): Record<
  string,
  unknown
> {
  const presentationEnum = visualizationTypeIds() as string[];
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      best_label_column: {
        type: ["string", "null"],
        description:
          "A short text for labeling features on the map. Choose a column that is most likely to be used for labeling features on the map. If none are suitable, set to null.",
      },
      best_category_column: {
        type: ["string", "null"],
        description:
          "A categorical column, if there is one that appears to represent a category or class of data layer features.",
      },
      best_numeric_column: {
        type: ["string", "null"],
        description:
          "A numeric column, if there is one that appears to represent an important measurement or value related to data layer features.",
      },
      best_date_column: {
        type: ["string", "null"],
        description: "A temporal attribute, only if clearly present.",
      },
      best_popup_description_column: {
        type: ["string", "null"],
        description:
          "A longer text suitable for popups. Choose a column that describes this particular location or feature specifically. If none is obvious, set to null.",
      },
      best_id_column: { type: ["string", "null"] },
      junk_columns: {
        type: "array",
        items: { type: "string" },
        description:
          "Attributes that are useless for mapping (IDs, FID, OBJECTID, globalid, computed shape length/area e.g. Shape_Area, Shape_Length, area_km2, etc).",
      },
      chosen_presentation_type: {
        type: ["string", "null"],
        enum: presentationEnum,
        description:
          "The cartographic presentation type to use for this layer.",
      },
      chosen_presentation_column: {
        type: ["string", "null"],
        description:
          "If the chosen_presentation_type uses a data-driven attribute, set this to the attribute name. Otherwise, set it to null.",
      },
      ai_cartographer_rationale: { type: ["string", "null"] },
      best_layer_title: { type: "string" },
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
