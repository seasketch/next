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
    "Raster best_presentation_type (only when isRaster is true):",
    ...rasterIds.map(line),
    "",
    "Vector best_presentation_type (only when isRaster is false):",
    ...vectorIds.map(line),
  ].join("\n");
}

export function buildSystemPrompt(): string {
  return `You are a GIS data assistant for SeaSketch maps and reports. An expert in both cartography and GIS data analysis.
Given summarized geostatistics, choose the best attribute columns and a default map visualization type.
Reply with a single JSON object only (no markdown).

Field meanings:
- best_label_column: best short text for labeling features on the map.
- best_category_column: discrete/categorical styling (classes).
- best_numeric_column: continuous values, choropleth, or proportional symbol size.
- best_date_column: temporal attribute if clearly present.
- best_popup_description_column: longer text suitable for popups. Only if obvious.
- best_id_column: stable identifier if present (not geometry).
- junk_columns: attributes that are useless for mapping (IDs, FID, OBJECTID, globalid, shape length/area).
- best_presentation_type: one of the allowed enum ids below (use the UPPER_SNAKE_CASE id, not the human label). Prefer types that visualize categories or numeric values where columns support it, otherwise use simple presentations. Use your judgement based on sample values to determine when numeric vs categorical visualization is most appropriate.
- ai_cartographer_rationale: one or two short sentences (under ~400 characters) explaining your reasoning for best_presentation_type only—why that visualization type is most appropriate.

Rules:
- For vector data, every non-null column field MUST be exactly one of the attribute names listed in allowedAttributes.
- If unsure, use null for that field.
- For raster data, set all best_*_column fields to null and junk_columns to [].
- Raster vs vector for best_presentation_type: use a type from the "Raster" list only when isRaster is true; use a type from the "Vector" list only when isRaster is false.

${formatVisualizationTypesForPrompt()}

Geometry (vector only): for points vs polygon/line choices, prefer types that match the layer geometry when obvious from trimmedGeostats. Consider best_*_column values, and a review of the actual column values before making a choice, using your expertise in cartography and GIS data analysis.
`;
}

export function buildUserPrompt(payload: {
  allowedAttributes: string[];
  trimmedGeostats: Record<string, unknown>;
  isRaster: boolean;
}): string {
  return JSON.stringify(
    {
      allowedAttributes: payload.allowedAttributes,
      isRaster: payload.isRaster,
      trimmedGeostats: payload.trimmedGeostats,
    },
    null,
    0,
  );
}
