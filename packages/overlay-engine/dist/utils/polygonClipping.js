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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.union = union;
exports.intersection = intersection;
const polygonClipping = __importStar(require("polygon-clipping"));
/**
 * Union a list of polygons into a single polygon.
 *
 * I made this wrapper because polygonClipping has a weird type signature where
 * it expects to be passed a single Geom as the first argment, and then a list
 * of Geoms as the rest of the arguments.
 *
 * This wrapper just takes a list of Geoms and calls polygonClipping.union with
 * the first geom and the rest of the geoms as the rest of the arguments.
 *
 * @param geometries - The list of polygons to union.
 * @returns The union of the polygons.
 */
function union(geometries) {
    return polygonClipping.union(geometries[0], ...geometries.slice(1));
}
/**
 * Intersect a list of polygons into a single polygon.
 *
 * @param geometries - The list of polygons to intersect.
 * @returns The intersection of the polygons.
 */
function intersection(geometries) {
    if (geometries.length < 2) {
        throw new Error("At least two geometries are required for intersection");
    }
    else {
        return polygonClipping.intersection(geometries[0], ...geometries.slice(1));
    }
}
//# sourceMappingURL=polygonClipping.js.map