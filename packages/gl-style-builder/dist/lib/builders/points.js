"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSimplePointLayer = buildSimplePointLayer;
exports.buildMarkerImageLayer = buildMarkerImageLayer;
exports.buildCategoricalPointLayer = buildCategoricalPointLayer;
exports.buildContinuousPointLayer = buildContinuousPointLayer;
exports.buildProportionalSymbolLayer = buildProportionalSymbolLayer;
exports.buildHeatmapLayer = buildHeatmapLayer;
const geostats_types_1 = require("@seasketch/geostats-types");
const colord_1 = require("colord");
const colorScales_1 = require("../colorScales");
const labels_1 = require("./labels");
const columnPickers_1 = require("../columnPickers");
function buildSimplePointLayer(geostats, aiDataAnalystNotes) {
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
        throw new Error("Geostats must be a Point or MultiPoint");
    }
    const circleColor = (0, colorScales_1.getSingleColorFromCustomPalette)(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.custom_palette) ||
        (0, colorScales_1.getDefaultFillColor)();
    layers.push({
        type: "circle",
        paint: {
            "circle-radius": 4,
            "circle-color": circleColor,
            "circle-stroke-color": (0, colorScales_1.autoStrokeColorForFillColor)(circleColor),
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.8,
        },
        metadata: {
            "s:type": "Simple Point",
            "s:color-auto": true,
        },
    });
    (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    return layers;
}
/**
 * @deprecated AiDataAnalystNotes don't have a means of specifying
 * (or generating) standard mapbox marker images yet, so this isn't very useful.
 * Falls back to simple point layer. Maybe something for the future.
 */
function buildMarkerImageLayer(geostats, aiDataAnalystNotes) {
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
        throw new Error("Geostats must be a Point or MultiPoint");
    }
    console.warn("Marker image layer building is not supported yet. Falling back to simple point layer.");
    return buildSimplePointLayer(geostats, aiDataAnalystNotes);
}
function buildCategoricalPointLayer(geostats, aiDataAnalystNotes) {
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
        throw new Error("Geostats must be a Point or MultiPoint");
    }
    const presentationColumn = (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column)
        ? geostats.attributes.find((a) => a.attribute === (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column))
        : (0, columnPickers_1.findBestCategoricalAttribute)(geostats);
    if (!presentationColumn) {
        throw new Error("No categorical attribute found");
    }
    const colorScale = (0, colorScales_1.getColorScale)("categorical", (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.palette) || "schemeTableau10", aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.custom_palette);
    const categoryColor = (0, colorScales_1.buildMatchExpressionForAttribute)(presentationColumn, colorScale, Boolean(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.reverse_palette));
    const circleLayer = {
        type: "circle",
        paint: {
            "circle-radius": 4,
            "circle-color": categoryColor,
            "circle-stroke-color": categoryColor,
            "circle-opacity": 0.5,
            "circle-stroke-width": 1,
            "circle-stroke-opacity": 1,
        },
        metadata: {
            "s:type": "Categorized Points",
        },
    };
    (0, colorScales_1.setPaletteMetadata)(circleLayer, colorScale);
    layers.push(circleLayer);
    if (aiDataAnalystNotes) {
        (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    }
    return layers;
}
function buildContinuousPointLayer(geostats, aiDataAnalystNotes) {
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
        throw new Error("Geostats must be a Point or MultiPoint");
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
    const rampColor = (0, colorScales_1.buildContinuousColorExpression)(colorScale, Boolean(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.reverse_palette), [presentationColumn.min || 0, presentationColumn.max], ["get", presentationColumn.attribute]);
    const circleLayer = {
        type: "circle",
        paint: {
            "circle-radius": 4,
            "circle-color": rampColor,
            "circle-opacity": 0.8,
            "circle-stroke-color": rampColor,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.8,
        },
        layout: {
            visibility: "visible",
            "circle-sort-key": ["get", presentationColumn.attribute],
        },
    };
    (0, colorScales_1.setPaletteMetadata)(circleLayer, colorScale);
    layers.push(circleLayer);
    if (aiDataAnalystNotes) {
        (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    }
    return layers;
}
/** Min / max circle radius (px) for proportional symbols — matches style editor defaults. */
const PROPORTIONAL_RADIUS_MIN_PX = 5;
const PROPORTIONAL_RADIUS_MAX_PX = 50;
function buildProportionalSymbolLayer(geostats, aiDataAnalystNotes) {
    var _a;
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
        throw new Error("Geostats must be a Point or MultiPoint");
    }
    let sizeColumn;
    if (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_column) {
        const attr = geostats.attributes.find((a) => a.attribute === aiDataAnalystNotes.chosen_presentation_column);
        if (attr && (0, geostats_types_1.isNumericGeostatsAttribute)(attr)) {
            sizeColumn = attr;
        }
    }
    if (!sizeColumn) {
        const name = (0, columnPickers_1.findBestContinuousAttribute)(geostats);
        if (name) {
            sizeColumn = geostats.attributes.find((a) => a.attribute === name);
        }
    }
    if (!sizeColumn) {
        throw new Error("No continuous attribute found");
    }
    const circleColor = (0, colorScales_1.getSingleColorFromCustomPalette)(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.custom_palette) ||
        (0, colorScales_1.getDefaultFillColor)();
    const rawMin = (_a = sizeColumn.min) !== null && _a !== void 0 ? _a : 0;
    const rawMax = sizeColumn.max !== undefined && sizeColumn.max !== null
        ? sizeColumn.max
        : rawMin;
    const domainLow = Math.min(rawMin, rawMax);
    const domainHigh = Math.max(rawMin, rawMax);
    const circleRadius = domainLow === domainHigh
        ? PROPORTIONAL_RADIUS_MIN_PX
        : [
            "interpolate",
            ["linear"],
            ["get", sizeColumn.attribute],
            domainLow,
            PROPORTIONAL_RADIUS_MIN_PX,
            domainHigh,
            PROPORTIONAL_RADIUS_MAX_PX,
        ];
    const circleLayer = {
        type: "circle",
        paint: {
            "circle-color": circleColor,
            "circle-radius": circleRadius,
            "circle-stroke-width": 1,
            "circle-stroke-color": (0, colorScales_1.autoStrokeColorForFillColor)(circleColor),
            "circle-stroke-opacity": 1,
            "circle-opacity": 0.8,
        },
        layout: {
            visibility: "visible",
            "circle-sort-key": ["get", sizeColumn.attribute],
        },
        metadata: {
            "s:type": "Proportional Symbol",
            "s:color-auto": true,
        },
    };
    layers.push(circleLayer);
    if (aiDataAnalystNotes) {
        (0, labels_1.addLabelsLayer)(layers, geostats, aiDataAnalystNotes);
    }
    return layers;
}
function buildHeatmapLayer(geostats, aiDataAnalystNotes) {
    const layers = [];
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Geostats must be a GeostatsLayer");
    }
    if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
        throw new Error("Geostats must be a Point or MultiPoint");
    }
    const colorScale = (0, colorScales_1.getColorScale)("continuous", (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.palette) || "interpolateTurbo");
    const heatmapColor = [
        ...(0, colorScales_1.buildContinuousColorExpression)(colorScale, Boolean(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.reverse_palette), [0, 1], ["heatmap-density"]),
    ];
    const lowEndColor = heatmapColor[4];
    if (typeof lowEndColor === "string") {
        heatmapColor[4] = (0, colord_1.colord)(lowEndColor).alpha(0).toRgbString();
    }
    const heatmapLayer = {
        type: "heatmap",
        paint: {
            "heatmap-radius": 10,
            "heatmap-weight": 1,
            "heatmap-intensity": 0.5,
            "heatmap-opacity": 0.9,
            "heatmap-color": heatmapColor,
        },
        metadata: {
            "s:type": "Heatmap",
        },
    };
    (0, colorScales_1.setPaletteMetadata)(heatmapLayer, colorScale);
    layers.push(heatmapLayer);
    return layers;
}
//# sourceMappingURL=points.js.map