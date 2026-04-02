"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGlStyle = buildGlStyle;
const geostats_types_1 = require("@seasketch/geostats-types");
const visualizationTypes_1 = require("./visualizationTypes");
const rasters_1 = require("./builders/rasters");
const polygons_1 = require("./builders/polygons");
/**
 * Given layer geostats and optionally ai cartographer notes, produce a set of
 * Mapbox GL style layers for this data source. These layers include
 * SeaSketch-specific metadata where appropriate to drive GUIStyleEditor and
 * legend functionality.
 */
function buildGlStyle({ geostats, aiDataAnalystNotes, }) {
    let targetVisualizationType = (aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_type) &&
        isValidVisualizationType(geostats, aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.chosen_presentation_type).isValid
        ? visualizationTypes_1.VisualizationType[aiDataAnalystNotes.chosen_presentation_type]
        : defaultVisualizationTypeForGeostats(geostats);
    if (!targetVisualizationType) {
        throw new Error("Invalid visualization type");
    }
    switch (targetVisualizationType) {
        case visualizationTypes_1.VisualizationType.RGB_RASTER:
            return (0, rasters_1.buildRGBRasterLayer)(geostats, aiDataAnalystNotes);
        case visualizationTypes_1.VisualizationType.CONTINUOUS_RASTER:
            return (0, rasters_1.buildContinuousRasterLayer)(geostats, aiDataAnalystNotes);
        case visualizationTypes_1.VisualizationType.CATEGORICAL_RASTER:
            return (0, rasters_1.buildCategoricalRasterLayer)(geostats, aiDataAnalystNotes);
        case visualizationTypes_1.VisualizationType.SIMPLE_POLYGON:
            return (0, polygons_1.buildSimplePolygonLayer)(geostats, aiDataAnalystNotes);
        case visualizationTypes_1.VisualizationType.CATEGORICAL_POLYGON:
            return (0, polygons_1.buildCategoricalPolygonLayer)(geostats, aiDataAnalystNotes);
        default:
            throw new Error(`Unsupported visualization type: ${targetVisualizationType}`);
    }
    return [];
}
function defaultVisualizationTypeForGeostats(geostats) {
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        if (geostats.presentation === geostats_types_1.SuggestedRasterPresentation.rgb) {
            return visualizationTypes_1.VisualizationType.RGB_RASTER;
        }
        else if (geostats.presentation === geostats_types_1.SuggestedRasterPresentation.categorical) {
            return visualizationTypes_1.VisualizationType.CATEGORICAL_RASTER;
        }
        else if (geostats.presentation === geostats_types_1.SuggestedRasterPresentation.continuous) {
            return visualizationTypes_1.VisualizationType.CONTINUOUS_RASTER;
        }
    }
    else if ((0, geostats_types_1.isGeostatsLayer)(geostats)) {
        if (geostats.geometry === "Polygon") {
            return visualizationTypes_1.VisualizationType.SIMPLE_POLYGON;
        }
        else if (geostats.geometry === "MultiPolygon") {
            return visualizationTypes_1.VisualizationType.SIMPLE_POLYGON;
        }
        else if (geostats.geometry === "Point") {
            return visualizationTypes_1.VisualizationType.SIMPLE_POINT;
        }
        else if (geostats.geometry === "MultiPoint") {
            return visualizationTypes_1.VisualizationType.SIMPLE_POINT;
        }
    }
    return visualizationTypes_1.VisualizationType.SIMPLE_POLYGON;
}
function isValidVisualizationType(geostats, visualizationType) {
    console.log("isValidVisualizationType", geostats, visualizationType);
    if (!visualizationType) {
        return { isValid: false, errorMessage: "No visualization type specified" };
    }
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        console.log("isRasterInfo", geostats);
        const band1 = geostats.bands[0];
        if (visualizationType === visualizationTypes_1.VisualizationType.RGB_RASTER) {
            if (geostats.bands.length < 3) {
                return { isValid: false, errorMessage: "RGB raster must have 3 bands" };
            }
            if (geostats.presentation !== geostats_types_1.SuggestedRasterPresentation.rgb) {
                return { isValid: false, errorMessage: "Raster must be RGB" };
            }
        }
        else if (visualizationType === visualizationTypes_1.VisualizationType.CATEGORICAL_RASTER) {
            if (!band1) {
                return {
                    isValid: false,
                    errorMessage: "Categorical raster must have at least one band",
                };
            }
            if (geostats.byteEncoding ||
                geostats.presentation === geostats_types_1.SuggestedRasterPresentation.categorical) {
                return { isValid: true };
            }
            return {
                isValid: false,
                errorMessage: "Raster does not support categorical visualization",
            };
        }
        else if (visualizationType === visualizationTypes_1.VisualizationType.CONTINUOUS_RASTER) {
            if (geostats.bands.length < 1) {
                return {
                    isValid: false,
                    errorMessage: "Continuous raster must have at least one band",
                };
            }
            if (geostats.presentation !== geostats_types_1.SuggestedRasterPresentation.continuous) {
                return {
                    isValid: false,
                    errorMessage: "Raster does not support continuous presentation",
                };
            }
        }
        else {
            return {
                isValid: false,
                errorMessage: "Invalid visualization type for raster",
            };
        }
    }
    else {
        console.log("isGeostatsLayer", geostats);
        const hasCategoricalAttribute = geostats.attributes.some((attribute) => Object.keys(attribute.values).length > 0);
        const hasContinuousAttribute = geostats.attributes.some((attribute) => attribute.type === "number");
        console.log("hasCategoricalAttribute", hasCategoricalAttribute);
        console.log("hasContinuousAttribute", hasContinuousAttribute);
        console.log("visualizationType", visualizationType, visualizationTypes_1.VisualizationType.CATEGORICAL_POLYGON);
        switch (visualizationType) {
            // make sure rasters aren't styled as vectors
            case visualizationTypes_1.VisualizationType.CATEGORICAL_RASTER:
            case visualizationTypes_1.VisualizationType.CONTINUOUS_RASTER:
            case visualizationTypes_1.VisualizationType.RGB_RASTER:
                return {
                    isValid: false,
                    errorMessage: "Invalid visualization type for vector source",
                };
            // Simple vector types
            case visualizationTypes_1.VisualizationType.SIMPLE_POLYGON:
                if (geostats.geometry !== "Polygon" &&
                    geostats.geometry !== "MultiPolygon") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for polygon source",
                    };
                }
                return { isValid: true };
            case visualizationTypes_1.VisualizationType.SIMPLE_LINE:
                if (geostats.geometry !== "LineString" &&
                    geostats.geometry !== "MultiLineString") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for line source",
                    };
                }
                return { isValid: true };
            case visualizationTypes_1.VisualizationType.SIMPLE_POINT:
            case visualizationTypes_1.VisualizationType.MARKER_IMAGE:
            case visualizationTypes_1.VisualizationType.HEATMAP:
                if (geostats.geometry !== "Point" &&
                    geostats.geometry !== "MultiPoint") {
                    return {
                        isValid: false,
                        errorMessage: `${visualizationType} must be a point source`,
                    };
                }
                return { isValid: true };
            // now, check categorical vector types
            case visualizationTypes_1.VisualizationType.CATEGORICAL_POLYGON:
                console.log("checking categorical polygon", geostats.geometry, hasCategoricalAttribute, geostats.attributes);
                if (geostats.geometry !== "Polygon" &&
                    geostats.geometry !== "MultiPolygon") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for categorical polygon source",
                    };
                }
                if (!hasCategoricalAttribute) {
                    console.log("source has no categorical attributes", geostats.attributes);
                    return {
                        isValid: false,
                        errorMessage: "Source has no categorical attributes",
                    };
                }
                return { isValid: true };
            case visualizationTypes_1.VisualizationType.CATEGORICAL_LINE:
                if (geostats.geometry !== "LineString" &&
                    geostats.geometry !== "MultiLineString") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for categorical line source",
                    };
                }
                if (!hasCategoricalAttribute) {
                    return {
                        isValid: false,
                        errorMessage: "Source has no categorical attributes",
                    };
                }
                return { isValid: true };
            case visualizationTypes_1.VisualizationType.CATEGORICAL_POINT:
                if (geostats.geometry !== "Point" &&
                    geostats.geometry !== "MultiPoint") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for categorical point source",
                    };
                }
                if (!hasCategoricalAttribute) {
                    return {
                        isValid: false,
                        errorMessage: "Source has no categorical attributes",
                    };
                }
                return { isValid: true };
            // now, check continuous vector types
            case visualizationTypes_1.VisualizationType.CONTINUOUS_POLYGON:
                if (geostats.geometry !== "Polygon" &&
                    geostats.geometry !== "MultiPolygon") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for continuous polygon source",
                    };
                }
                if (!hasContinuousAttribute) {
                    return {
                        isValid: false,
                        errorMessage: "Source has no continuous attributes",
                    };
                }
                return { isValid: true };
            case visualizationTypes_1.VisualizationType.CONTINUOUS_LINE:
                if (geostats.geometry !== "LineString" &&
                    geostats.geometry !== "MultiLineString") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for continuous line source",
                    };
                }
                if (!hasContinuousAttribute) {
                    return {
                        isValid: false,
                        errorMessage: "Source has no continuous attributes",
                    };
                }
                return { isValid: true };
            case visualizationTypes_1.VisualizationType.CONTINUOUS_POINT:
                if (geostats.geometry !== "Point" &&
                    geostats.geometry !== "MultiPoint") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for continuous point source",
                    };
                }
                if (!hasContinuousAttribute) {
                    return {
                        isValid: false,
                        errorMessage: "Source has no continuous attributes",
                    };
                }
                return { isValid: true };
            case visualizationTypes_1.VisualizationType.PROPORTIONAL_SYMBOL:
                if (geostats.geometry !== "Point" &&
                    geostats.geometry !== "MultiPoint") {
                    return {
                        isValid: false,
                        errorMessage: "Invalid visualization type for proportional symbol source",
                    };
                }
                if (!hasContinuousAttribute) {
                    return {
                        isValid: false,
                        errorMessage: "Source has no continuous attributes",
                    };
                }
                return { isValid: true };
            default:
                return { isValid: false, errorMessage: "Invalid visualization type" };
        }
    }
    return { isValid: false, errorMessage: "Invalid visualization type" };
}
//# sourceMappingURL=buildGlStyle.js.map