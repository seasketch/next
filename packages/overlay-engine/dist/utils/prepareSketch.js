"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareSketch = prepareSketch;
const bboxUtils_1 = require("./bboxUtils");
const cleanCoords_1 = require("./cleanCoords");
const utils_1 = require("./utils");
const bbox_1 = __importDefault(require("@turf/bbox"));
const splitGeoJSON = require("geojson-antimeridian-cut");
/**
 * Prepares a sketch for processing by:
 * 1. Validating geometry type
 * 2. Converting to MultiPolygon if needed
 * 3. Cleaning coordinates
 * 4. Handling antimeridian crossing (splitting into multiple polygon parts if needed)
 * 5. Calculating envelopes for feature fetching
 *
 * @throws {Error} If feature has no geometry or geometry is not a polygon/multipolygon
 */
function prepareSketch(feature) {
    if (!feature.geometry) {
        throw new Error("feature has no geometry");
    }
    if (feature.geometry.type !== "Polygon" &&
        feature.geometry.type !== "MultiPolygon") {
        throw new Error("feature geometry is not a polygon or multipolygon");
    }
    let sketch = (0, utils_1.makeMultipolygon)(feature);
    const bbox = (0, bboxUtils_1.cleanBBox)((0, bbox_1.default)(sketch));
    const split = (0, bboxUtils_1.splitBBoxAntimeridian)(bbox);
    const envelopes = split.map((box) => (0, bboxUtils_1.bboxToEnvelope)(box));
    sketch = splitGeoJSON((0, cleanCoords_1.cleanCoords)(sketch));
    if (sketch.geometry.coordinates.length > 1) {
        sketch = (0, cleanCoords_1.cleanCoords)(sketch);
    }
    if (sketch.type === "FeatureCollection") {
        throw new Error("sketch is a FeatureCollection");
    }
    return { feature: sketch, envelopes };
}
//# sourceMappingURL=prepareSketch.js.map