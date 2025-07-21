"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeMultipolygon = makeMultipolygon;
exports.multiPartToSinglePart = multiPartToSinglePart;
const unionAtAntimeridian_1 = require("./unionAtAntimeridian");
/**
 * Converts a GeoJSON Feature with Polygon geometry to a Feature with
 * MultiPolygon geometry. If the input is already a MultiPolygon, returns it
 * unchanged.
 *
 * This is useful for normalizing polygon features to a consistent MultiPolygon
 * type before performing operations like clipping or union that expect
 * MultiPolygon inputs.
 *
 * @param feature - A GeoJSON Feature with either Polygon or MultiPolygon
 *                  geometry
 * @returns A GeoJSON Feature with MultiPolygon geometry. For Polygon inputs,
 *          wraps the coordinates in an extra array level. For MultiPolygon
 *          inputs, returns as-is.
 * @preserves The input feature's properties
 */
function makeMultipolygon(feature) {
    if ((0, unionAtAntimeridian_1.isPolygon)(feature)) {
        return {
            type: "Feature",
            geometry: {
                type: "MultiPolygon",
                coordinates: [feature.geometry.coordinates],
            },
            properties: feature.properties
                ? { ...feature.properties }
                : feature.properties,
        };
    }
    return feature;
}
function multiPartToSinglePart(feature) {
    return feature.geometry.coordinates.map((polygon) => ({
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: polygon,
        },
        properties: feature.properties,
    }));
}
//# sourceMappingURL=utils.js.map