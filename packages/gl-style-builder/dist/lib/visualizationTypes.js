"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualizationTypeDescriptions = exports.VisualizationType = void 0;
var VisualizationType;
(function (VisualizationType) {
    // Raster
    VisualizationType["RGB_RASTER"] = "RGB_RASTER";
    VisualizationType["CATEGORICAL_RASTER"] = "CATEGORICAL_RASTER";
    VisualizationType["CONTINUOUS_RASTER"] = "CONTINUOUS_RASTER";
    // Vector
    // Polygon or MultiPolygon
    VisualizationType["SIMPLE_POLYGON"] = "SIMPLE_POLYGON";
    VisualizationType["CATEGORICAL_POLYGON"] = "CATEGORICAL_POLYGON";
    VisualizationType["CONTINUOUS_POLYGON"] = "CONTINUOUS_POLYGON";
    // Point or MultiPoint
    VisualizationType["SIMPLE_POINT"] = "SIMPLE_POINT";
    VisualizationType["MARKER_IMAGE"] = "MARKER_IMAGE";
    VisualizationType["CATEGORICAL_POINT"] = "CATEGORICAL_POINT";
    VisualizationType["PROPORTIONAL_SYMBOL"] = "PROPORTIONAL_SYMBOL";
    VisualizationType["CONTINUOUS_POINT"] = "CONTINUOUS_POINT";
    VisualizationType["HEATMAP"] = "HEATMAP";
    // Line
    VisualizationType["SIMPLE_LINE"] = "SIMPLE_LINE";
    VisualizationType["CONTINUOUS_LINE"] = "CONTINUOUS_LINE";
    VisualizationType["CATEGORICAL_LINE"] = "CATEGORICAL_LINE";
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
    [VisualizationType.SIMPLE_LINE]: "Style lines with a single color",
    [VisualizationType.CONTINUOUS_LINE]: "Line color based on numeric values",
    [VisualizationType.CATEGORICAL_LINE]: "Line color based on categorical values",
};
// export function validVisualizationTypes(
//   sourceProperties: {
//     type: "raster" | "vector";
//     isSingleBandRaster?: boolean;
//     vectorGeometryType?: GeostatsLayer["geometry"];
//     categoricalColumns?: string[];
//     continuousColumns?: string[];
//     rasterByteEncoding?: boolean;
//   }
// ) {
//   const types: VisualizationType[] = [];
//   if (isRasterInfo(geostats)) {
//     if (geostats.presentation === SuggestedRasterPresentation.rgb) {
//       types.push(VisualizationType.RGB_RASTER);
//     } else if (
//       geostats.presentation === SuggestedRasterPresentation.categorical &&
//       geostats.bands[0].stats.categories &&
//       geostats.bands[0].stats.categories.length > 0
//     ) {
//       types.push(VisualizationType.CATEGORICAL_RASTER);
//       if (geostats.bands[0].stats.categories.length > 4) {
//         types.push(VisualizationType.CONTINUOUS_RASTER);
//       }
//     } else if (
//       geostats.presentation === SuggestedRasterPresentation.continuous
//     ) {
//       types.push(VisualizationType.CONTINUOUS_RASTER);
//       if (geostats.byteEncoding) {
//         types.push(VisualizationType.CATEGORICAL_RASTER);
//       }
//     }
//   } else {
//     if (
//       geostats.geometry === "Polygon" ||
//       geostats.geometry === "MultiPolygon"
//     ) {
//       types.push(VisualizationType.SIMPLE_POLYGON);
//       if (findBestCategoricalAttribute(geostats) !== null) {
//         types.push(VisualizationType.CATEGORICAL_POLYGON);
//       }
//       if (findBestContinuousAttribute(geostats) !== null) {
//         types.push(VisualizationType.CONTINUOUS_POLYGON);
//       }
//     } else if (
//       geostats.geometry === "Point" ||
//       geostats.geometry === "MultiPoint"
//     ) {
//       types.push(
//         VisualizationType.SIMPLE_POINT,
//         // TODO: implement VisualizationType.MARKER_IMAGE
//       );
//       // check for categorical attributes and add CATEGORICAL_POINT if so
//       const categorical = findBestCategoricalAttribute(geostats);
//       if (categorical) {
//         types.push(VisualizationType.CATEGORICAL_POINT);
//       }
//       // check for continuous data values
//       if (findBestContinuousAttribute(geostats) !== null) {
//         types.push(
//           VisualizationType.PROPORTIONAL_SYMBOL,
//           VisualizationType.CONTINUOUS_POINT,
//         );
//       }
//       types.push(VisualizationType.HEATMAP);
//     }
//   }
//   return types;
// }
//# sourceMappingURL=visualizationTypes.js.map