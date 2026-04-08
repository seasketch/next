"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.columnIntelligenceValidator = exports.columnIntelligenceSchema = exports.columnIntelligenceParameters = exports.columnIntelligencePrompt = void 0;
const ajv_1 = __importDefault(require("ajv"));
const ajv = new ajv_1.default({ allowUnionTypes: true });
exports.columnIntelligencePrompt = `
SeaSketch is an online decision support tool for ocean conservation planning. It has a map portal that allows users to visualize and analyze data layers.
You are a GIS analyst for SeaSketch, skilled in both data analysis and cartography. Your job is to inspect hosted data layers and prepare them for publication on SeaSketch. 
This work requires you to:

  1. Identifying which columns are suitable for different purposes (categorizing, measuring, labeling, etc).
  2. Determining the best cartographic presentation to use for a given layer, based on what the data contains and represents. This includes the style presentation type, labeling (if any), and color scheme.
  3. Make recommendations for interactivity settings (e.g. popups, tooltips, banners, etc).
  4. Choose a best group_by column, if appropriate, for overlap analysis.

To make these recommendations, you will be given the 'filename' of the data layer and the 'geostats', which is a JSON object containing the column names, types, and sample data values.

Rules:
  - Your choice of presentation type and column should be consistent with the best_*_column properties. For example, categorical presentation types should use the best_category_column, and continuous presentation types should use the best_numeric_column.
  - Use categorical presentation types when it is clear the data represents different habitat classes, bioregions, shoretypes, etc.
  - Prefer simple polygon, point, or line presentations when it is clear the intent of the data is to show the footprint of a single class of features. 
  - It is just as important to be able to distinguish between different layers as it is between different features within a layer, so don't automatically categorize by named areas.
  - Avoid using continuous presentation types for generated columns like Shape_Area, Shape_Length, area_km2, etc.
  - Interactivity and labeling are not supported for raster layers. No need to mention them in your notes.
  - RGB_RASTER should only be chosen for 3-band rasters (e.g. satellite imagery).
  - Never set a chosen_presentation_column for raster presentations.
  - CATEGORICAL_RASTER should only be chosen for 1-band rasters with a presentation type of categorical.
  - Usually pick CONTINUOUS_POINT over PROPORTIONAL_SYMBOL for point layers with good numeric columns. Use PROPORTIONAL_SYMBOL when you identify monitoring data (e.g. fish density at monitoring sites).
  - For categorical vectors or rasters, use 'custom_palette' when particular natural or man-made features are best associated with specific colors (e.g. mangroves are a shade of green, rock is typically grey, etc). When representing categories without natural colors (e.g. administrative boundaries), set 'palette' to a d3 categorical color scale.
  - 'custom_palette' must be an object keyed by category value, with each value set to a hex color string. Use key "default" when styling a simple polygon, point, or line.
  - Set reverse_palette to true only when recommending a named d3 scale in palette (not when using custom_palette). Use false when palette is null, when using custom_palette, or when reversal would not help interpretation.
  - When styling a continuous polygon or raster layer that appear to be results of a prioritization model (e.g. Marxan, Gap Analysis, etc), use a palette like interpolatePlasma or interpolateViridis. When a continuous layer looks like a map of human usage or pressure, use a warm palette like interpolateYlOrRd or interpolateOrRd.
  - If there are recognizable colors specified in column values, try to identify the related categories and set a matching custom_palette. *Don't* categorize by color codes alone though.
  - Some columns will be redacted to avoid transmitting PII to 3rd party LLMs. Don't put them in junk_columns. You can use them for your recommendations if you want, but they will not include sample values.
  - In your notes, don't call columns "junk". Be professional.
  - If you see bathymetry data (raster or polygons), use a blue color scheme to represent water at different depths.
`;
exports.columnIntelligenceParameters = {
    // Cloudflare AI Gateway compat expects `{provider}/{model}` (e.g. openai/gpt-5-mini).
    model: "openai/gpt-5.4-mini",
    effort: "low",
    verbosity: "low",
};
exports.columnIntelligenceSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        best_label_column: {
            type: ["string", "null"],
            description: "Column that is most suitable for labeling features on the map. (Optional)",
        },
        best_category_column: {
            type: ["string", "null"],
            description: "Column that appears to represent a category or class of data layer features. (Optional)",
        },
        best_numeric_column: {
            type: ["string", "null"],
            description: "Column that appears to represent an important measurement or value related to data layer features. (Optional)",
        },
        best_date_column: {
            type: ["string", "null"],
            description: "Column that appears to represent a temporal attribute. (Optional)",
        },
        best_popup_description_column: {
            type: ["string", "null"],
            description: "A longer text column suitable for popups. Choose a column that describes this particular location or feature specifically. (Optional)",
        },
        best_id_column: {
            type: ["string", "null"],
            description: "Column that appears to represent a unique identifier for each feature. (Optional)",
        },
        best_group_by_column: {
            type: ["string", "null"],
            description: "For analytical reports. Select a group_by column if appropriate. For example, if reporting on overlap with habitats, choosing a `habClass` column would split overlapping area results into a row for each habitat class in the output table. Should usually match the chosen_presentation_column, but in some cases it should be left null if the column is only useful for presentation purposes and not analysis. Very rarely should it be a different column, in which case you should explain why.",
        },
        junk_columns: {
            type: "array",
            items: { type: "string" },
            description: "Attributes that are useless for mapping (IDs, FID, OBJECTID, globalid, computed shape length/area e.g. Shape_Area, Shape_Length, area_km2, etc).",
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
                "SIMPLE_LINE",
                "CONTINUOUS_LINE",
                "CATEGORICAL_LINE",
                // disable for now. not sure the ai can figure out how to use heatmaps.
                "HEATMAP",
            ],
            description: "The cartographic presentation type to use for this layer. (Required)",
        },
        chosen_presentation_column: {
            type: ["string", "null"],
            description: "If the chosen_presentation_type uses a data-driven style, this is the column to reference. Leave null for raster layers.",
        },
        palette: {
            type: ["string", "null"],
            description: "A d3 color scale to use for this layer and presentation type. Be sure to select one appropriate for the presentation type (categorical, continuous, etc). Only specify one of palette or custom_palette. (Optional)",
        },
        custom_palette: {
            type: ["object", "null", "string"],
            additionalProperties: {
                type: "string",
                pattern: "^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$",
            },
            description: "For simple polygon, point, or line presentations, a single hex color string will do. For categorical presentations, a custom color palette keyed by category value, where each value is a hex color string. Only specify one of palette or custom_palette. Can be used when particular natural or man-made features are best associated with specific colors (e.g. mangroves are a shade of green, rock is typically grey, etc). Not suitable for continuous presentation types. (Optional)",
        },
        reverse_palette: {
            type: "boolean",
            description: "If true, reverse the named d3 palette so high values map to the low end of the scale. Only set true when palette is a non-null named d3 scale; must be false when using custom_palette or when palette is null.",
        },
        show_labels: {
            type: "boolean",
            description: "Whether to show labels on the layer. If true, labels will be based on the best_label_column.",
        },
        labels_min_zoom: {
            type: ["number", "null"],
            minimum: 5,
            maximum: 14,
            description: "The minimum zoom level at which to show labels. Labels are not shown at zoom levels less than this value. Relatively small areas should not show labels until zoomed in quite a bit (>= 12). (Optional)",
        },
        interactivity_type: {
            type: "string",
            enum: ["BANNER", "TOOLTIP", "POPUP", "ALL_PROPERTIES_POPUP", "NONE"],
            description: "The type of interactivity to use for the layer. Most layers should use ALL_PROPERTIES_POPUP (when there are significant columns users may want to inspect), BANNER (for habitat or other classifications that users may want to see at a glance), or NONE (for layers that need not be interactive). If BANNER is chosen the best_label_column will be used to generate the banner text. If in doubt, choose NONE. Don't choose POPUP or TOOLTIP, since those require a mustache template to be generated.",
        },
        notes: {
            type: "string",
            description: "A concise description of the data analysis and cartographic recommendations. Why did you choose the presentation type you did? When referring to column names, use backtick quotes (e.g. `habclass`), but don't use them for anything else. For example, never use backtick quotes for values or referring to presentation types.",
        },
    },
    required: [
        "best_label_column",
        "best_category_column",
        "best_numeric_column",
        "best_date_column",
        "best_popup_description_column",
        "best_id_column",
        "best_group_by_column",
        "junk_columns",
        "chosen_presentation_type",
        "chosen_presentation_column",
        "palette",
        "custom_palette",
        "reverse_palette",
        "show_labels",
        "labels_min_zoom",
        "interactivity_type",
        "notes",
    ],
};
const validator = ajv.compile(exports.columnIntelligenceSchema);
const columnIntelligenceValidator = (data) => {
    const d = {
        ...data,
    };
    delete d.value_steps;
    delete d.value_steps_n;
    delete d.raster_steps;
    delete d.raster_steps_n;
    delete d.pii_redacted_columns;
    return validator(d);
};
exports.columnIntelligenceValidator = columnIntelligenceValidator;
//# sourceMappingURL=columnIntelligence.js.map