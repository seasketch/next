"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBestCategoricalAttribute = findBestCategoricalAttribute;
exports.categoricalAttributes = categoricalAttributes;
exports.findBestContinuousAttribute = findBestContinuousAttribute;
const geostats_types_1 = require("@seasketch/geostats-types");
function findBestCategoricalAttribute(geostats) {
    const attributes = geostats.attributes;
    const filtered = categoricalAttributes(attributes);
    // sort the attributes by suitability, with the most suitable coming first.
    // Criteria:
    //   1. Strings are prefered over booleans, booleans over numbers
    //   2. attribute.values contains a count of how many times each value appears in the dataset. Prefer attributes where the sum of these counts is a large proprotion of the total number of features
    //   3. Fewer unique values (countDistinct) are prefered
    const sorted = [...filtered].sort((a, b) => {
        if (a.type === "string" && b.type !== "string") {
            return -1;
        }
        else if (b.type === "string" && a.type !== "string") {
            return 1;
        }
        if (a.type === "boolean" && b.type !== "boolean") {
            return -1;
        }
        else if (b.type === "boolean" && a.type !== "boolean") {
            return 1;
        }
        const totalFeaturesWithValuesA = Object.values(a.values).reduce((sum, count) => sum + count, 0);
        const totalFeaturesWithValuesB = Object.values(b.values).reduce((sum, count) => sum + count, 0);
        if (totalFeaturesWithValuesA > totalFeaturesWithValuesB) {
            return -1;
        }
        else if (totalFeaturesWithValuesB > totalFeaturesWithValuesA) {
            return 1;
        }
        const aCountDistinct = a.countDistinct && a.countDistinct > 1 ? a.countDistinct : Infinity;
        const bCountDistinct = b.countDistinct && b.countDistinct > 1 ? b.countDistinct : Infinity;
        return aCountDistinct - bCountDistinct;
    });
    if (sorted.length) {
        return sorted[0];
    }
    else {
        return null;
    }
}
function categoricalAttributes(attributes) {
    return attributes.filter((a) => a.countDistinct && a.countDistinct > 1 && a.type === "string");
}
function findBestContinuousAttribute(geostats) {
    var _a;
    const attributes = geostats.attributes;
    const filtered = [...attributes].filter((a) => (0, geostats_types_1.isNumericGeostatsAttribute)(a) &&
        a.min !== undefined &&
        a.max !== undefined &&
        a.min < a.max);
    // first, sort attributes by number of stddev values
    const sorted = filtered
        .sort((a, b) => {
        var _a, _b, _c, _d;
        let aValue = ((_a = a.stats) === null || _a === void 0 ? void 0 : _a.standardDeviations)
            ? Object.keys(((_b = a.stats) === null || _b === void 0 ? void 0 : _b.standardDeviations) || {}).length
            : 0;
        let bValue = ((_c = b.stats) === null || _c === void 0 ? void 0 : _c.standardDeviations)
            ? Object.keys(((_d = b.stats) === null || _d === void 0 ? void 0 : _d.standardDeviations) || {}).length
            : 0;
        return bValue - aValue;
    })
        .reverse();
    for (const attr of sorted) {
        if (!/area/i.test(attr.attribute) &&
            !/length/i.test(attr.attribute) &&
            !/code/i.test(attr.attribute) &&
            Object.keys(((_a = attr.stats) === null || _a === void 0 ? void 0 : _a.standardDeviations) || {}).length > 3) {
            return attr.attribute;
        }
    }
    const best = sorted.find((a) => { var _a; return Object.keys(((_a = a.stats) === null || _a === void 0 ? void 0 : _a.standardDeviations) || {}).length > 3; });
    if (best) {
        return best.attribute;
    }
    if (sorted.length) {
        return sorted[0].attribute;
    }
    return null;
}
//# sourceMappingURL=columnPickers.js.map