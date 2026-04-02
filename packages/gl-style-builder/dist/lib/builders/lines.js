"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSimpleLineLayer = buildSimpleLineLayer;
exports.buildCategoricalLineLayer = buildCategoricalLineLayer;
exports.buildContinuousLineLayer = buildContinuousLineLayer;
const geostats_types_1 = require("@seasketch/geostats-types");
const colorScales_1 = require("../colorScales");
const labels_1 = require("./labels");
const columnPickers_1 = require("../columnPickers");
function buildSimpleLineLayer(geostats, aiDataAnalystNotes) {
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "LineString" &&
        geostats.geometry !== "MultiLineString") {
        throw new Error("Geostats must be a LineString or MultiLineString");
    }
    const lineColor = (0, colorScales_1.getSingleColorFromCustomPalette)(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.custom_palette) ||
        (0, colorScales_1.getDefaultFillColor)();
    layers.push({
        type: "line",
        layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: "visible",
        },
        paint: {
            "line-color": lineColor,
            "line-width": 2,
            "line-opacity": 1,
        },
        metadata: {
            "s:type": "Simple Line",
        },
    });
    (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    return layers;
}
function buildCategoricalLineLayer(geostats, aiDataAnalystNotes) {
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "LineString" &&
        geostats.geometry !== "MultiLineString") {
        throw new Error("Geostats must be a LineString or MultiLineString");
    }
    const presentationColumn = (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column)
        ? geostats.attributes.find((a) => a.attribute === (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column))
        : (0, columnPickers_1.findBestCategoricalAttribute)(geostats);
    if (!presentationColumn) {
        throw new Error("No categorical attribute found");
    }
    const colorScale = (0, colorScales_1.getColorScale)("categorical", (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.palette) || "schemeTableau10", aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.custom_palette);
    const lineLayer = {
        type: "line",
        layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: "visible",
        },
        paint: {
            "line-color": (0, colorScales_1.buildMatchExpressionForAttribute)(presentationColumn, colorScale, Boolean(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.reverse_palette)),
            "line-width": 2,
            "line-opacity": 1,
        },
        metadata: {
            "s:type": "Categorized Lines",
        },
    };
    (0, colorScales_1.setPaletteMetadata)(lineLayer, colorScale);
    layers.push(lineLayer);
    if (aiDataAnalystNotes) {
        (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    }
    return layers;
}
function buildContinuousLineLayer(geostats, aiDataAnalystNotes) {
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "LineString" &&
        geostats.geometry !== "MultiLineString") {
        throw new Error("Geostats must be a LineString or MultiLineString");
    }
    let presentationColumn;
    if (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column) {
        presentationColumn = geostats.attributes.find((a) => a.attribute === (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column));
    }
    if (!presentationColumn) {
        const attr = (0, columnPickers_1.findBestContinuousAttribute)(geostats);
        if (attr) {
            presentationColumn = geostats.attributes.find((a) => a.attribute === attr);
        }
    }
    if (!presentationColumn) {
        throw new Error("No continuous attribute found");
    }
    const colorScale = (0, colorScales_1.getColorScale)("continuous", (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.palette) || "interpolatePlasma");
    const lineLayer = {
        type: "line",
        paint: {
            "line-color": (0, colorScales_1.buildContinuousColorExpression)(colorScale, Boolean(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.reverse_palette), [presentationColumn.min || 0, presentationColumn.max], ["get", presentationColumn.attribute]),
            "line-width": 2,
            "line-opacity": 1,
        },
        layout: {
            visibility: "visible",
        },
    };
    (0, colorScales_1.setPaletteMetadata)(lineLayer, colorScale);
    layers.push(lineLayer);
    if (aiDataAnalystNotes) {
        (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    }
    return layers;
}
//# sourceMappingURL=lines.js.map