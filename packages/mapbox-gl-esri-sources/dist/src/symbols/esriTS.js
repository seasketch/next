"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
/** @hidden */
exports.default = (labelingInfo, geometryType, fieldNames) => {
    // TODO: Support scale-dependant rendering. Right now just taking first label
    // TODO: labelExpressions (full Arcade!?)
    // TODO: where expressions
    // TODO: xoffset, yoffset, kerning, angle, rightToLeft, horizontalAlignment, etc
    // See https://developers.arcgis.com/documentation/common-data-types/labeling-objects.htm
    return {
        id: (0, utils_1.generateId)(),
        type: "symbol",
        layout: {
            // TODO: properly support labeling functions like UCASE(), CONCAT(), etc
            // https://developers.arcgis.com/documentation/common-data-types/labeling-objects.htm
            "text-field": toExpression(labelingInfo.labelExpression, fieldNames),
            // Only supports points right now
            "text-anchor": (0, utils_1.toTextAnchor)(labelingInfo.labelPlacement),
            "text-size": (0, utils_1.ptToPx)(labelingInfo.symbol.font.size || 13),
            "symbol-placement": geometryType === "line" ? "line" : "point",
            "text-max-angle": 20,
        },
        paint: {
            "text-color": (0, utils_1.rgba)(labelingInfo.symbol.color),
            "text-halo-width": (0, utils_1.ptToPx)(labelingInfo.symbol.haloSize || 0),
            "text-halo-color": (0, utils_1.rgba)(labelingInfo.symbol.haloColor || [255, 255, 255, 255]),
            "text-halo-blur": (0, utils_1.ptToPx)(labelingInfo.symbol.haloSize || 0) * 0.5,
        },
    };
};
/** @hidden */
function toExpression(labelExpression, fieldNames) {
    const fields = (labelExpression.match(/\[\w+\]/g) || [])
        .map((val) => val.replace(/[\[\]]/g, ""))
        .map((val) => fieldNames.find((name) => name.toLowerCase() === val.toLowerCase()));
    const strings = labelExpression.split(/\[\w+\]/g);
    const expression = ["format"];
    while (strings.length) {
        expression.push(strings.shift());
        const field = fields.shift();
        if (field) {
            expression.push(["get", field]);
        }
    }
    return expression;
}
