"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildUserPrompt = buildUserPrompt;
const geostats_types_1 = require("@seasketch/geostats-types");
function formatVisualizationTypesForPrompt() {
    const ids = (0, geostats_types_1.visualizationTypeIds)();
    const rasterIds = ids.filter((id) => (0, geostats_types_1.isRasterPresentationTypeId)(id));
    const vectorIds = ids.filter((id) => !(0, geostats_types_1.isRasterPresentationTypeId)(id));
    const line = (id) => {
        var _a;
        const label = geostats_types_1.VisualizationType[id];
        const desc = (_a = geostats_types_1.VisualizationTypeDescriptions[label]) !== null && _a !== void 0 ? _a : "";
        return desc ? `  - ${id}: ${label} — ${desc}` : `  - ${id}: ${label}`;
    };
    return [
        "# Raster visualization types:",
        ...rasterIds.map(line),
        "",
        "# Vector presentation types:",
        ...vectorIds.map(line),
    ].join("\n");
}
function buildSystemPrompt() {
    return `
You are a GIS analyst for SeaSketch, evaluating data layers for mapping and spatial analysis.

Given the original spatial file upload name and geostatistics which summarize data types and column values, you will interpret how to best represent this data layer in SeaSketch.

First, I'd like you to create the following property:

- best_layer_title: Cleanup the uploadedSourceFilename for display in a map UI. Remove underscores, hyphens, file extensions, and any other "junk". Title-case words if appropriate. Be careful not to change it so much that it becomes unrecognizable from the original filename.

Next, you will populate the following properties, evaluating data layer columns from the geostats. If there is no good fit, leave the property null.

Properties:

- best_label_column: best short text for labeling features on the map.
- best_category_column: which column would most likely be used for discrete/categorical styling (classes).
- best_numeric_column: which is most useful for proportional symbol or choropleth styling.
- best_date_column: temporal attribute if clearly present.
- best_popup_description_column: longer text suitable for popups. Only if obvious.
- best_id_column: stable identifier if present (not geometry).
- junk_columns: attributes that are useless for mapping (IDs, FID, OBJECTID, globalid, computed shape length/area e.g. Shape_Area, Shape_Length, area_km2, etc).

Finally, use your expertise in cartography to pick the best visualization type 
to represent the data layer on the SeaSketch map. You can choose from the following presentation types, after reviewing the rules below.

${formatVisualizationTypesForPrompt()}

From that, set the following properties:

- chosen_presentation_type: Choose from the visualization type id's above (raster or vector as appropriate for the layer). Use your judgement based on the information in geostats. Don't base cartography on "junk columns". Sometimes it will be appropriate to pick a particular column of interest that looks important to visualize using categorical or continuous visualization styles, other times a simple presentation will do. Don't categorize or show data-driven styling unless there is a clear column of interest for ocean planning.
- chosen_presentation_column: If the chosen_presentation_type uses a data-driven attribute, set this to the attribute name. Otherwise, set it to null.
- ai_cartographer_rationale: one or two short sentences (under ~400 characters) explaining your reasoning for the chosen presentation type and column. Tell the SeaSketch admin why you made the choices you did (but not necessarily getting into the choices you did not make).

Rules:
- Remember, SeaSketch is an ocean conservation planning tool. Pick the best visualization type to facilitate decision-making.
- best_layer_title is NOT an attribute name; it is free-form display text only.
- If unsure, set properties to null.
- For raster data, set all best_*_column fields to null and junk_columns to [].
- Output should be a single JSON object with the mentioned properties, matching the JSON schema exactly.
- In general, don't visualize by junk columns. 
- Don't ever visualize by geometry size columns like shape area or shape length.
- Gray color interpretation rasters should be visualized as continuous, unless there is a small number of unique values in which case it should be visualized as categorical.
- Don't use RGB presentation for raster unless it has 3 bands.
- Don't choose a categorical presentation type if there is only one unique value (or 1 + null or a blank value).
`.trim();
}
function buildUserPrompt(payload) {
    return JSON.stringify({
        allowedAttributes: payload.allowedAttributes,
        isRaster: payload.isRaster,
        trimmedGeostats: payload.trimmedGeostats,
        uploadedSourceFilename: payload.uploadedSourceFilename,
    }, null, 0);
}
//# sourceMappingURL=prompts.js.map