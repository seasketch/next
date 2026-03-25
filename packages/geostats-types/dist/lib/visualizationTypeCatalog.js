"use strict";
/**
 * Canonical visualization type ids (Postgres enum / LLM) and human labels for the style editor.
 * Imported by the API column-intelligence prompts and re-exported from the client style editor.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualizationTypeDescriptions = exports.VisualizationType = void 0;
exports.visualizationTypeIds = visualizationTypeIds;
exports.isRasterPresentationTypeId = isRasterPresentationTypeId;
var VisualizationType;
(function (VisualizationType) {
    // Raster
    VisualizationType["RGB_RASTER"] = "Raster Image";
    VisualizationType["CATEGORICAL_RASTER"] = "Categorical Raster";
    VisualizationType["CONTINUOUS_RASTER"] = "Continuous Raster";
    // Vector
    // Polygon or MultiPolygon
    VisualizationType["SIMPLE_POLYGON"] = "Simple Polygon";
    VisualizationType["CATEGORICAL_POLYGON"] = "Categories";
    VisualizationType["CONTINUOUS_POLYGON"] = "Color Range";
    // Point or MultiPoint
    VisualizationType["SIMPLE_POINT"] = "Simple Points";
    VisualizationType["MARKER_IMAGE"] = "Marker Image";
    VisualizationType["CATEGORICAL_POINT"] = "Categorized Points";
    VisualizationType["PROPORTIONAL_SYMBOL"] = "Proportional Symbol";
    VisualizationType["CONTINUOUS_POINT"] = "Point Color Range";
    VisualizationType["HEATMAP"] = "Heatmap";
})(VisualizationType || (exports.VisualizationType = VisualizationType = {}));
exports.VisualizationTypeDescriptions = {
    [VisualizationType.CATEGORICAL_RASTER]: "Discrete pixel values rendered as unique colors",
    [VisualizationType.CONTINUOUS_RASTER]: "Range of colors based on numeric values",
    [VisualizationType.RGB_RASTER]: "RGB pixels are displayed as uploaded",
    [VisualizationType.SIMPLE_POLYGON]: "Style features with a single color",
    [VisualizationType.CONTINUOUS_POLYGON]: "Choropleth maps based on continuous values",
    [VisualizationType.CATEGORICAL_POLYGON]: "Group polygons by discrete string values",
    [VisualizationType.SIMPLE_POINT]: "Circle markers indicating point locations",
    [VisualizationType.MARKER_IMAGE]: "Locations indicated by symbols",
    [VisualizationType.CATEGORICAL_POINT]: "Circles with unique colors",
    [VisualizationType.PROPORTIONAL_SYMBOL]: "Circle size determined by values",
    [VisualizationType.HEATMAP]: "Visualize densely packed locations",
    [VisualizationType.CONTINUOUS_POINT]: "Color range based on numeric values",
};
/** Enum member names matching Postgres `visualization_type` (e.g. RGB_RASTER). */
function visualizationTypeIds() {
    return Object.keys(VisualizationType).filter((k) => typeof VisualizationType[k] === "string");
}
/** True if the presentation id is a raster type (name contains `RASTER`). */
function isRasterPresentationTypeId(id) {
    return /RASTER/i.test(id);
}
//# sourceMappingURL=visualizationTypeCatalog.js.map