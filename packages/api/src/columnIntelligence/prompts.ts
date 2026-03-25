import {
  VisualizationType,
  VisualizationTypeDescriptions,
  isRasterPresentationTypeId,
  visualizationTypeIds,
} from "@seasketch/geostats-types";

function formatVisualizationTypesForPrompt(): string {
  const ids = visualizationTypeIds();
  const rasterIds = ids.filter((id) =>
    isRasterPresentationTypeId(id as string),
  );
  const vectorIds = ids.filter(
    (id) => !isRasterPresentationTypeId(id as string),
  );
  const line = (id: (typeof ids)[number]): string => {
    const label = VisualizationType[id];
    const desc = VisualizationTypeDescriptions[label] ?? "";
    return desc ? `  - ${id}: ${label} — ${desc}` : `  - ${id}: ${label}`;
  };
  return [
    "Raster chosen_presentation_type (only when isRaster is true):",
    ...rasterIds.map(line),
    "",
    "Vector chosen_presentation_type (only when isRaster is false):",
    ...vectorIds.map(line),
  ].join("\n");
}

export function buildSystemPrompt(): string {
  return `You are a GIS data assistant for SeaSketch maps and reports. An expert in both cartography and GIS data analysis.
Given summarized geostatistics (and optional original upload filename), choose the best attribute columns and a default map visualization type.
Reply with a single JSON object only (no markdown).

Field meanings:
- best_label_column: best short text for labeling features on the map.
- best_category_column: discrete/categorical styling (classes).
- best_numeric_column: continuous values, choropleth, or proportional symbol size.
- best_date_column: temporal attribute if clearly present.
- best_popup_description_column: longer text suitable for popups. Only if obvious.
- best_id_column: stable identifier if present (not geometry).
- junk_columns: attributes that are useless for mapping (IDs, FID, OBJECTID, globalid, shape length/area).
- chosen_presentation_type: one of the allowed enum ids below (use the UPPER_SNAKE_CASE id, not the human label). Prefer types that visualize categories or numeric values where columns support it, otherwise use simple presentations. Use your judgement based on sample values to determine when numeric vs categorical visualization is most appropriate.
- chosen_presentation_column: the attribute from allowedAttributes that should drive the map style for chosen_presentation_type. Required when the visualization uses field-based styling: e.g. for CONTINUOUS_POLYGON, CONTINUOUS_POINT, PROPORTIONAL_SYMBOL, or HEATMAP set this to the numeric field to use; for CATEGORICAL_* types set it to the categorical field. Use null for types that do not use a data-driven attribute (e.g. SIMPLE_POLYGON, SIMPLE_POINT, RGB_RASTER) or when no suitable column exists.
- ai_cartographer_rationale: one or two short sentences (under ~400 characters) explaining your reasoning for chosen_presentation_type (and column, if applicable).
- best_layer_title: Cleanup the uploadedSourceFilename for display in a map UI. Remove underscores, hyphens, file extensions, and any other "junk". Title-case words if appropriate. Be careful not to change 

Rules:
- For vector data, every non-null column field MUST be exactly one of the attribute names listed in allowedAttributes.
- best_layer_title is NOT an attribute name; it is free-form display text only.
- If unsure, use null for that field.
- For raster data, set all best_*_column fields to null and junk_columns to [].
- Raster vs vector for chosen_presentation_type: use a type from the "Raster" list only when isRaster is true; use a type from the "Vector" list only when isRaster is false.

${formatVisualizationTypesForPrompt()}

Geometry (vector only): for points vs polygon/line choices, prefer types that match the layer geometry when obvious from trimmedGeostats. Consider best_*_column values, and a review of the actual column values before making a choice, using your expertise in cartography and GIS data analysis.

The user message JSON may include uploadedSourceFilename (original file name from the uploader). Use it as weak prior context only—e.g. thematic clues in the basename—without overriding evidence from trimmedGeostats or allowedAttributes.
`;
}

export function buildUserPrompt(payload: {
  allowedAttributes: string[];
  trimmedGeostats: Record<string, unknown>;
  isRaster: boolean;
  uploadedSourceFilename: string | null;
}): string {
  return JSON.stringify(
    {
      allowedAttributes: payload.allowedAttributes,
      isRaster: payload.isRaster,
      trimmedGeostats: payload.trimmedGeostats,
      uploadedSourceFilename: payload.uploadedSourceFilename,
    },
    null,
    0,
  );
}
