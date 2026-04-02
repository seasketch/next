"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSimplePolygonLayer = buildSimplePolygonLayer;
exports.buildCategoricalPolygonLayer = buildCategoricalPolygonLayer;
const geostats_types_1 = require("@seasketch/geostats-types");
const colorScales_1 = require("../colorScales");
const labels_1 = require("./labels");
function buildSimplePolygonLayer(geostats, aiDataAnalystNotes) {
    console.log("building simple polygon layer", aiDataAnalystNotes);
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "Polygon" && geostats.geometry !== "MultiPolygon") {
        throw new Error("Geostats must be a Polygon or MultiPolygon");
    }
    const fillColor = (0, colorScales_1.getSingleColorFromCustomPalette)(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.custom_palette) ||
        (0, colorScales_1.getDefaultFillColor)();
    layers.push({
        type: "fill",
        paint: {
            "fill-color": fillColor,
            "fill-opacity": 0.8,
        },
        metadata: {
            "s:type": "Simple Polygon",
        },
    });
    layers.push({
        type: "line",
        layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: "visible",
        },
        paint: {
            "line-color": (0, colorScales_1.autoStrokeColorForFillColor)(fillColor),
            "line-width": 1,
            "line-opacity": 1,
        },
        metadata: {
            "s:color-auto": true,
        },
    });
    (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    return layers;
}
function buildCategoricalPolygonLayer(geostats, aiDataAnalystNotes) {
    console.log("building categorical polygon layer", aiDataAnalystNotes);
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "Polygon" && geostats.geometry !== "MultiPolygon") {
        throw new Error("Geostats must be a Polygon or MultiPolygon");
    }
    if (!aiDataAnalystNotes) {
        throw new Error("AiDataAnalystNotes is required");
    }
    if (!(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column)) {
        throw new Error("chosen_presentation_column is required");
    }
    const presentationColumn = geostats.attributes.find((a) => a.attribute === (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column));
    if (!presentationColumn) {
        throw new Error("chosen_presentation_column not found in geostats attributes");
    }
    const colorScale = (0, colorScales_1.getColorScale)("categorical", (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.palette) || "schemeTableau10", aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.custom_palette);
    layers.push({
        type: "fill",
        paint: {
            "fill-color": (0, colorScales_1.buildMatchExpressionForAttribute)(presentationColumn, colorScale, Boolean(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.reverse_palette)),
            "fill-opacity": 0.7,
        },
        metadata: {
            "s:type": "Categories",
            "s:palette": colorScale.name,
        },
    });
    layers.push({
        type: "line",
        layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: "visible",
        },
        paint: {
            "line-color": (0, colorScales_1.buildMatchExpressionForAttribute)(presentationColumn, colorScale, Boolean(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.reverse_palette)),
            "line-width": 1,
            "line-opacity": 1,
        },
        metadata: {
            "s:color-auto": true,
        },
    });
    (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    return layers;
}
//# sourceMappingURL=polygons.js.map