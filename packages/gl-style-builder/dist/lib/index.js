"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectiveReverseNamedPalette = exports.buildGlStyle = void 0;
exports.groupByFromStyle = groupByFromStyle;
exports.isExpression = isExpression;
exports.findGetExpression = findGetExpression;
var buildGlStyle_1 = require("./buildGlStyle");
Object.defineProperty(exports, "buildGlStyle", { enumerable: true, get: function () { return buildGlStyle_1.buildGlStyle; } });
var ai_data_analyst_1 = require("ai-data-analyst");
Object.defineProperty(exports, "effectiveReverseNamedPalette", { enumerable: true, get: function () { return ai_data_analyst_1.effectiveReverseNamedPalette; } });
/**
 * Attempts to find a group by column name from a set of Mapbox GL style layers.
 * Useful for determining if the map layer presented to users is categorical,
 * indicating a feature class breakdown that may be useful for reporting.
 * @param mapboxGlStyles
 * @param geometryType
 * @param columnNames
 * @returns
 */
function groupByFromStyle(mapboxGlStyles, geometryType, columnNames) {
    if (!(mapboxGlStyles === null || mapboxGlStyles === void 0 ? void 0 : mapboxGlStyles.length)) {
        return undefined;
    }
    const paintProps = geometryType === "Polygon" || geometryType === "MultiPolygon"
        ? ["fill-color"]
        : geometryType === "LineString" || geometryType === "MultiLineString"
            ? ["line-color"]
            : ["circle-color", "icon-image"];
    for (const layer of mapboxGlStyles) {
        if (!("paint" in layer))
            continue;
        const paint = layer.paint;
        if (!paint)
            continue;
        for (const prop of paintProps) {
            const value = paint[prop];
            if (!value || !isExpression(value))
                continue;
            // skip interpolate expressions. we want categorical styles only
            if (/interpolate/.test(value[0]))
                continue;
            // same for step expressions
            if (/step/.test(value[0]))
                continue;
            const getExpr = findGetExpression(value);
            if ((getExpr === null || getExpr === void 0 ? void 0 : getExpr.property) &&
                (!columnNames.size || columnNames.has(getExpr.property))) {
                return getExpr.property;
            }
        }
    }
    return undefined;
}
function isExpression(e) {
    return Array.isArray(e) && typeof e[0] === "string";
}
function findGetExpression(expression, isFilter, parent) {
    if (!isExpression(expression)) {
        return null;
    }
    if (expression[0] === "get") {
        return { type: "get", property: expression[1] };
    }
    else {
        if (isFilter) {
            // check for legacy filter type
            if (typeof expression[1] === "string" &&
                !/\$/.test(expression[1]) &&
                expression[1] !== "zoom") {
                return {
                    type: "legacy",
                    property: expression[1],
                };
            }
        }
    }
    for (const arg of expression.slice(1)) {
        if (isExpression(arg)) {
            const found = findGetExpression(arg, isFilter, expression);
            if (found !== null) {
                return found;
            }
        }
    }
    return null;
}
//# sourceMappingURL=index.js.map