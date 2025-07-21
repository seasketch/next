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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.unionAtAntimeridian = unionAtAntimeridian;
exports.isPolygon = isPolygon;
const polygonClipping = __importStar(require("polygon-clipping"));
/**
 * Accepts a Polygon or MultiPolygon geojson feature and returns a unioned
 * feature where components meet at the antimeridian. Not a general-purpose
 * union, as it only works for polygons that meet at the antimeridian. In
 * order to render properly on a webmap, coordinates crossing the
 * antimeridian may end up greater or less than 180 or -180.
 *
 * If provided a Polygon, this will be a no-op.
 *
 * @param feature Polygon or MultiPolygon geojson feature
 * @returns Unioned feature
 */
function unionAtAntimeridian(feature) {
    if (isPolygon(feature)) {
        return feature;
    }
    const multiPolygon = feature.geometry;
    // Normalize coordinates to 0-360 space
    const normalizedCoordinates = multiPolygon.coordinates.map((polygon) => polygon.map((ring) => 
    // @ts-ignore
    ring.map(([x, y]) => [x < 0 ? x + 360 : x, y])));
    // Perform union using polygon-clipping
    const unioned = polygonClipping.union(normalizedCoordinates[0], ...normalizedCoordinates.slice(1));
    // Convert the result back to GeoJSON MultiPolygon format
    const unionedFeature = {
        type: "Feature",
        geometry: {
            type: "MultiPolygon",
            coordinates: unioned,
        },
        properties: feature.properties || {},
    };
    return unionedFeature;
}
function isPolygon(feature) {
    return feature.geometry.type === "Polygon";
}
//# sourceMappingURL=unionAtAntimeridian.js.map