"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateArea = calculateArea;
const cql2_1 = require("../cql2");
const area_1 = __importDefault(require("@turf/area"));
const polygonClipping_1 = require("../utils/polygonClipping");
const simplify_1 = require("@turf/simplify");
const containerIndex_1 = require("../utils/containerIndex");
const geographies_1 = require("./geographies");
const flatten_1 = __importDefault(require("@turf/flatten"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const bboxUtils_1 = require("../utils/bboxUtils");
const helpers_1 = require("../utils/helpers");
// Layer configurations for logging features
const layers = {
    bboxes: {
        name: "edge-box",
        geometryType: "Polygon",
        fields: { category: "string" },
    },
    intersection: {
        name: "intersection-layer",
        geometryType: "MultiPolygon",
        fields: { name: "string" },
    },
    classified: {
        name: "classified-difference-feature",
        geometryType: "Polygon",
        fields: { category: "string", id: "number" },
    },
};
async function calculateArea(geography, sourceCache, helpersOption) {
    var _a, _b;
    // Transform optional helpers into guaranteed interface with no-op functions for log and progress
    const helpers = (0, helpers_1.guaranteeHelpers)(helpersOption);
    const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } = await (0, geographies_1.initializeGeographySources)(geography, sourceCache, helpers);
    let progress = 0;
    if (differenceLayers.length === 0) {
        helpers.progress(50, "No difference layers, calculating final area");
        return (0, area_1.default)(intersectionFeatureGeojson) / 1000000;
    }
    else {
        helpers.progress(progress++, "Processing difference layers");
        const envelopes = (0, flatten_1.default)(intersectionFeatureGeojson).features.map((f) => (0, bboxUtils_1.bboxToEnvelope)((0, bbox_1.default)(f)));
        const simplified = (0, simplify_1.simplify)(intersectionFeatureGeojson, {
            tolerance: 0.002,
        });
        helpers.progress(progress++, "Simplified intersection geometry");
        if (helpers.logFeature) {
            helpers.logFeature(layers.intersection, {
                ...intersectionFeatureGeojson,
                properties: { name: "union" },
            });
            helpers.logFeature(layers.intersection, {
                ...simplified,
                properties: { name: "simplified" },
            });
        }
        let mixedGeoms = [];
        let mixedGeomsBytes = 0;
        let overlappingDifferenceFeaturesSqKm = 0;
        for (const layer of differenceLayers) {
            helpers.log("Getting source for difference layer");
            const source = await sourceCache.get(layer.source, {
                initialHeaderRequestLength: layer.headerSizeHint,
            });
            helpers.progress(progress++, "Fetched difference layer source");
            helpers.log("Counting bytes and features for query");
            const { bytes, features } = await source.countAndBytesForQuery(envelopes);
            helpers.log(`Bytes: ${bytes}, Features: ${features}, Envelopes: ${envelopes.length}`);
            helpers.progress(progress++, "Counted features and bytes");
            let i = 0;
            let fullyContainedFeatures = 0;
            let intersectingFeatures = 0;
            let outsideFeatures = 0;
            const containerIndex = new containerIndex_1.ContainerIndex(simplified);
            if (helpers.logFeature) {
                const bboxPolygons = containerIndex.getBBoxPolygons();
                for (const f of bboxPolygons.features) {
                    helpers.logFeature(layers.bboxes, {
                        ...f,
                        properties: { category: "edge-box" },
                    });
                }
            }
            // get features from difference layer
            for await (const f of source.getFeaturesAsync(envelopes)) {
                if (!layer.cql2Query ||
                    (0, cql2_1.evaluateCql2JSONQuery)(layer.cql2Query, f.properties)) {
                    i++;
                    const percent = (i / features) * 100;
                    await helpers.progress(percent < 95 ? percent : 95, `Processing difference features: ${percent}%`);
                    const classification = containerIndex.classify(f);
                    if (helpers.logFeature) {
                        // Handle debugging callback for all classified features
                        helpers.logFeature(layers.classified, {
                            type: "Feature",
                            geometry: f.geometry,
                            properties: {
                                category: classification,
                                id: (_a = f.properties) === null || _a === void 0 ? void 0 : _a.__offset,
                            },
                        });
                    }
                    if (classification === "inside") {
                        overlappingDifferenceFeaturesSqKm += (0, area_1.default)(f) / 1000000;
                        fullyContainedFeatures++;
                    }
                    else if (classification === "mixed") {
                        intersectingFeatures++;
                        if (f.geometry.type === "Polygon") {
                            mixedGeoms.push(f.geometry.coordinates);
                        }
                        else {
                            for (const poly of f.geometry.coordinates) {
                                mixedGeoms.push(poly);
                            }
                        }
                        mixedGeomsBytes += ((_b = f.properties) === null || _b === void 0 ? void 0 : _b.__byteLength) || 0;
                        if (mixedGeomsBytes > 200000) {
                            overlappingDifferenceFeaturesSqKm += handleMixedGeoms(mixedGeoms, simplified.geometry.coordinates);
                            mixedGeoms = [];
                            mixedGeomsBytes = 0;
                        }
                    }
                    else {
                        // outside
                        outsideFeatures++;
                    }
                }
            }
            if (mixedGeoms.length > 0) {
                overlappingDifferenceFeaturesSqKm += handleMixedGeoms(mixedGeoms, simplified.geometry.coordinates);
                mixedGeoms = [];
                mixedGeomsBytes = 0;
            }
        }
        helpers.progress(98, "Final calculation");
        const sqKm = (0, area_1.default)(intersectionFeatureGeojson) / 1000000;
        helpers.log(`Area calculation complete: ${sqKm} sq km - ${overlappingDifferenceFeaturesSqKm} sq km = ${sqKm - overlappingDifferenceFeaturesSqKm} sq km`);
        return sqKm - overlappingDifferenceFeaturesSqKm;
    }
}
/**
 * Handles mixed geometries by intersecting them with the intersection feature
 * and calculating the area of the resulting multipolygon.
 *
 * "Mixed geometries" are geometries that are part of the difference layer that
 * are not fully contained by the intersection feature, and are not fully
 * outside of it. They are likely to be polygons that are intersected by the
 * intersection feature.
 *
 * @param mixedGeoms - The mixed geometries to handle.
 * @param intersectionFeature - The intersection feature to intersect with.
 * @returns The area of the resulting multipolygon.
 */
function handleMixedGeoms(mixedGeoms, intersectionFeature) {
    let areaKm = 0;
    let multipart = [];
    for (const geom of mixedGeoms) {
        multipart.push(geom);
    }
    const overlap = (0, polygonClipping_1.intersection)([intersectionFeature, (0, polygonClipping_1.union)(multipart)]);
    if (overlap) {
        const overlappingSqKm = (0, area_1.default)({
            type: "Feature",
            geometry: {
                type: "MultiPolygon",
                coordinates: overlap,
            },
            properties: {},
        }) / 1000000;
        areaKm += overlappingSqKm;
    }
    return areaKm;
}
//# sourceMappingURL=calculateArea.js.map