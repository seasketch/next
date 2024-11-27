"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGeostatsLayer = exports.isRasterInfo = exports.SuggestedRasterPresentation = exports.isLegacyGeostatsAttribute = exports.isLegacyGeostatsLayer = exports.isNumericGeostatsAttribute = void 0;
function isNumericGeostatsAttribute(attr) {
    return attr.type === "number";
}
exports.isNumericGeostatsAttribute = isNumericGeostatsAttribute;
function isLegacyGeostatsLayer(layer) {
    if ("attributesCount" in layer && layer.attributesCount) {
        return layer.attributes[0].countDistinct === undefined;
    }
    else {
        return !("bounds" in layer);
    }
}
exports.isLegacyGeostatsLayer = isLegacyGeostatsLayer;
function isLegacyGeostatsAttribute(attr) {
    return Array.isArray(attr.values);
}
exports.isLegacyGeostatsAttribute = isLegacyGeostatsAttribute;
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
})(SuggestedRasterPresentation = exports.SuggestedRasterPresentation || (exports.SuggestedRasterPresentation = {}));
function isRasterInfo(info) {
    return info.bands !== undefined;
}
exports.isRasterInfo = isRasterInfo;
function isGeostatsLayer(data) {
    return (!Array.isArray(data) && data.attributes !== undefined);
}
exports.isGeostatsLayer = isGeostatsLayer;
