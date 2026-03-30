import { JSONSchema4 } from "json-schema";
import AJV from "ajv";

const ajv = new AJV();

export const columnIntelligenceSchema: JSONSchema4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    best_label_column: {
      type: "string",
      description:
        "Column that is most suitable for labeling features on the map. (Optional)",
    },
    best_category_column: {
      type: "string",
      description:
        "Column that appears to represent a category or class of data layer features. (Optional)",
    },
    best_numeric_column: {
      type: "string",
      description:
        "Column that appears to represent an important measurement or value related to data layer features. (Optional)",
    },
    best_date_column: {
      type: "string",
      description:
        "Column that appears to represent a temporal attribute. (Optional)",
    },
    best_popup_description_column: {
      type: "string",
      description:
        "A longer text column suitable for popups. Choose a column that describes this particular location or feature specifically. (Optional)",
    },
    best_id_column: {
      type: "string",
      description:
        "Column that appears to represent a unique identifier for each feature. (Optional)",
    },
    junk_columns: {
      type: "array",
      items: { type: "string" },
      description:
        "Attributes that are useless for mapping (IDs, FID, OBJECTID, globalid, computed shape length/area e.g. Shape_Area, Shape_Length, area_km2, etc).",
    },
    chosen_presentation_type: {
      type: "string",
      enum: [
        "RGB_RASTER",
        "CATEGORICAL_RASTER",
        "CONTINUOUS_RASTER",
        "SIMPLE_POLYGON",
        "CATEGORICAL_POLYGON",
        "CONTINUOUS_POLYGON",
        "SIMPLE_POINT",
        "MARKER_IMAGE",
        "CATEGORICAL_POINT",
        "PROPORTIONAL_SYMBOL",
        "CONTINUOUS_POINT",
        "HEATMAP",
      ],
      description:
        "The cartographic presentation type to use for this layer. (Required)",
    },
    chosen_presentation_column: {
      type: "string",
      description:
        "If the chosen_presentation_type uses a data-driven attribute, this is the column to be used. Required for some presentation types.",
    },
    palette: {
      type: "string",
      description:
        "A d3 color scale to use for this layer and presentation type. Be sure to select one appropriate for the presentation type (categorical, continuous, etc). Only specify one of palette or custom_palette. (Optional)",
    },
    custom_palette: {
      type: "array",
      items: { type: "string" },
      description:
        "A custom color palette to use for the layer. Only specify one of palette or custom_palette. Can be used when particular natural or man-made features are best associated with specific colors (e.g. mangroves are a shade of green, rock is typically grey, etc). Not suitable for continuous presentation types. (Optional)",
    },
    show_labels: {
      type: "boolean",
      description:
        "Whether to show labels on the layer. If true, labels will be based on the best_label_column.",
    },
    labels_min_zoom: {
      type: "number",
      minimum: 3,
      maximum: 14,
      description:
        "The minimum zoom level at which to show labels. Labels are not shown at zoom levels less than this value. (Optional)",
    },
    interactivity_type: {
      type: "string",
      enum: ["BANNER", "TOOLTIP", "POPUP", "ALL_PROPERTIES_POPUP", "NONE"],
      description:
        "The type of interactivity to use for the layer. Most layers should use ALL_PROPERTIES_POPUP (when there are significant columns users may want to inspect), BANNER (for habitat or other classifications that users may want to see at a glance), or NONE (for layers that need not be interactive). If BANNER is chosen the best_label_column will be used to generate the banner text. If in doubt, choose NONE.",
    },
    notes: {
      type: "string",
      description:
        "A concise description of the data analysis and cartographic recommendations. Why did you choose the presentation type you did?",
    },
  },
  required: [
    "chosen_presentation_type",
    "notes",
    "junk_columns",
    "interactivity_type",
    "show_labels",
  ],
};

export const columnIntelligenceValidator = ajv.compile(
  columnIntelligenceSchema,
);

/** Root type must be an object for OpenAI structured outputs / gateway validation. */
export const titleFormattingSchema: JSONSchema4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 1,
      description:
        "Public-facing layer title derived from the source filename.",
    },
  },
  required: ["title"],
};

export const titleFormattingValidator = ajv.compile(titleFormattingSchema);

export const attributionFormattingSchema: JSONSchema4 = {
  type: "object",
  additionalProperties: false,
  properties: {
    attribution: {
      type: ["string", "null"],
      maxLength: 48,
      description:
        "Public-facing attribution string (< 48 chars for mapbox-gl). If unsure, return null.",
    },
  },
  required: ["attribution"],
};

export const attributionFormattingValidator = ajv.compile(
  attributionFormattingSchema,
);
