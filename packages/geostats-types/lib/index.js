"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuggestedRasterPresentation = void 0;
exports.isNumericGeostatsAttribute = isNumericGeostatsAttribute;
exports.isLegacyGeostatsLayer = isLegacyGeostatsLayer;
exports.isLegacyGeostatsAttribute = isLegacyGeostatsAttribute;
exports.isRasterInfo = isRasterInfo;
exports.isGeostatsLayer = isGeostatsLayer;
function isNumericGeostatsAttribute(attr) {
    return attr.type === "number";
}
function isLegacyGeostatsLayer(layer) {
    if ("attributesCount" in layer && layer.attributesCount) {
        return layer.attributes[0].countDistinct === undefined;
    }
    else {
        return !("bounds" in layer);
    }
}
function isLegacyGeostatsAttribute(attr) {
    return Array.isArray(attr.values);
}
/**
 * SuggestedRasterPresentation is a hint to the client on how to present the
 * raster data. This can be used to determine the default visualization type for
 * the raster data.
 *
 * - "categorical" is used for rasters with a color interpretation of "Palette",
 *   or which have a small number of unique values
 * - "continuous" is used for rasters with a color interpretation of "Gray"
 * - "rgb" is used for rasters which can be simply presented as an RGB image
 */
var SuggestedRasterPresentation;
(function (SuggestedRasterPresentation) {
    SuggestedRasterPresentation[SuggestedRasterPresentation["categorical"] = 0] = "categorical";
    SuggestedRasterPresentation[SuggestedRasterPresentation["continuous"] = 1] = "continuous";
    SuggestedRasterPresentation[SuggestedRasterPresentation["rgb"] = 2] = "rgb";
})(SuggestedRasterPresentation || (exports.SuggestedRasterPresentation = SuggestedRasterPresentation = {}));
function isRasterInfo(info) {
    return info.bands !== undefined;
}
function isGeostatsLayer(data) {
    return (!Array.isArray(data) && data.attributes !== undefined);
}
