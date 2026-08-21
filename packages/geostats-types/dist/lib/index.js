"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuggestedRasterPresentation = exports.isTemporalInfo = exports.expandTemporalValue = exports.createLayerYearTemporalInfo = void 0;
exports.isNumericGeostatsAttribute = isNumericGeostatsAttribute;
exports.isLegacyGeostatsLayer = isLegacyGeostatsLayer;
exports.isLegacyGeostatsAttribute = isLegacyGeostatsAttribute;
exports.isRasterInfo = isRasterInfo;
exports.isGeostatsLayer = isGeostatsLayer;
__exportStar(require("./temporal"), exports);
var temporal_1 = require("./temporal");
Object.defineProperty(exports, "createLayerYearTemporalInfo", { enumerable: true, get: function () { return temporal_1.createLayerYearTemporalInfo; } });
Object.defineProperty(exports, "expandTemporalValue", { enumerable: true, get: function () { return temporal_1.expandTemporalValue; } });
Object.defineProperty(exports, "isTemporalInfo", { enumerable: true, get: function () { return temporal_1.isTemporalInfo; } });
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
    if (!info || typeof info !== "object") {
        return false;
    }
    return info.bands !== undefined;
}
function isGeostatsLayer(data) {
    if (!data) {
        return false;
    }
    if (Array.isArray(data)) {
        return false;
    }
    if (typeof data !== "object") {
        return false;
    }
    if (!("attributes" in data)) {
        return false;
    }
    return true;
}
//# sourceMappingURL=index.js.map