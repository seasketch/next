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
const flatten_1 = __importDefault(require("@turf/flatten"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const bboxUtils_1 = require("../utils/bboxUtils");
// Determines whether to apply a difference operation against an entire diff
// layer vs the intersection layer union, or to apply an intersection against
// each feature in the difference layer and sum up the overlapping area
// piecemeal.
// I noticed problems > 40MB, but it probably makes sense to set it lower just
// in case. TODO: check for pathological performance differences
const MAX_SAFE_CLIPPING_OPERATION_BYTES = 10000000;
const MAX_SAFE_CLIPPING_OPERATION_FEATURE_COUNT = 2000;
async function calculateArea(geography, sourceCache, options = {}) {
    var _a, _b, _c;
    const { debuggingCallback, progressCallback } = options;
    // first, start initialization of all sources. Later code can still await
    // sourceCache.get, but the requests will already be resolved or in-flight
    geography.map((layer) => {
        sourceCache.get(layer.source, {
            initialHeaderRequestLength: layer.headerSizeHint,
        });
    });
    let progress = 0;
    // first, fetch all intersection layers and union the features into a single
    // multipolygon
    console.time("create intersection feature");
    if (progressCallback) {
        progressCallback(progress++); // Starting intersection layer processing
    }
    const intersectionLayers = geography.filter((l) => l.op === "INTERSECT");
    const differenceLayers = geography.filter((l) => l.op === "DIFFERENCE");
    const intersectionFeatures = [];
    let intersectionFeatureBytes = 0;
    await Promise.all(intersectionLayers.map(async (l) => {
        const source = await sourceCache.get(l.source);
        progress++;
        if (progressCallback) {
            progressCallback(progress);
        }
        for await (const { properties, getFeature, } of source.getFeatureProperties()) {
            if ((0, cql2_1.evaluateCql2JSONQuery)(l.cql2Query, properties)) {
                intersectionFeatures.push(getFeature());
                intersectionFeatureBytes += (properties === null || properties === void 0 ? void 0 : properties.__byteLength) || 0;
            }
        }
        console.log("got intersection features", intersectionFeatures.length);
    }));
    console.timeEnd("create intersection feature");
    console.log("got intersection features", intersectionFeatures.length, intersectionFeatureBytes + " bytes");
    // create a single multipolygon from the intersection features
    const intersectionFeatureGeojson = {
        type: "Feature",
        geometry: {
            type: "MultiPolygon",
            coordinates: (0, polygonClipping_1.union)(intersectionFeatures.map((f) => f.geometry.coordinates)),
        },
        properties: {},
    };
    if (differenceLayers.length === 0) {
        console.log("no difference layers, calculate area");
        if (progressCallback) {
            progressCallback(100); // No difference layers, calculation complete
        }
        return (0, area_1.default)(intersectionFeatureGeojson) / 1000000;
    }
    else {
        const envelopes = (0, flatten_1.default)(intersectionFeatureGeojson).features.map((f) => (0, bboxUtils_1.bboxToEnvelope)((0, bbox_1.default)(f)));
        const simplified = (0, simplify_1.simplify)(intersectionFeatureGeojson, {
            tolerance: 0.002,
        });
        if (debuggingCallback) {
            debuggingCallback("intersection-layer", {
                ...intersectionFeatureGeojson,
                properties: { name: "union" },
            });
            debuggingCallback("intersection-layer", {
                ...simplified,
                properties: { name: "simplified" },
            });
        }
        let mixedGeoms = [];
        let mixedGeomsBytes = 0;
        const differenceGeoms = [];
        let bytesFetched = 0;
        let overlappingDifferenceFeaturesSqKm = 0;
        for (const layer of differenceLayers) {
            console.time("get source");
            const source = await sourceCache.get(layer.source, {
                initialHeaderRequestLength: layer.headerSizeHint,
            });
            console.timeEnd("get source");
            console.time("countAndBytesForQuery");
            const { bytes, features } = await source.countAndBytesForQuery(envelopes);
            console.log("bytes", bytes, "features", features, envelopes);
            console.timeEnd("countAndBytesForQuery");
            if (true ||
                bytes > MAX_SAFE_CLIPPING_OPERATION_BYTES ||
                features > MAX_SAFE_CLIPPING_OPERATION_FEATURE_COUNT) {
                console.log("Large difference layer. Performing piecemeal intersection to calculate area");
                let i = 0;
                let fullyContainedFeatures = 0;
                let intersectingFeatures = 0;
                let lastLoggedPercent = 0;
                let outsideFeatures = 0;
                const containerIndex = new containerIndex_1.ContainerIndex(simplified);
                const bboxPolygons = containerIndex.getBBoxPolygons();
                if (debuggingCallback) {
                    for (const f of bboxPolygons.features) {
                        debuggingCallback("edge-box", f);
                    }
                }
                // get features from difference layer
                for await (const f of source.getFeaturesAsync(envelopes)) {
                    if (!layer.cql2Query ||
                        (0, cql2_1.evaluateCql2JSONQuery)(layer.cql2Query, f.properties)) {
                        i++;
                        // console.log(i);
                        const percent = (i / features) * 100;
                        if (percent - lastLoggedPercent > 1) {
                            lastLoggedPercent = percent;
                            if (progressCallback) {
                                progressCallback(Math.round(percent));
                            }
                        }
                        const classification = containerIndex.classify(f);
                        // Handle debugging callback for all classified features
                        if (debuggingCallback) {
                            debuggingCallback("classified-difference-feature", {
                                type: "Feature",
                                geometry: f.geometry,
                                properties: {
                                    class: classification,
                                    __offset: (_a = f.properties) === null || _a === void 0 ? void 0 : _a.__offset,
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
            else {
                console.log("Small difference layer. Performing union to calculate area");
                for (const b of envelopes) {
                    for await (const f of source.getFeaturesAsync(b)) {
                        bytesFetched += ((_c = f.properties) === null || _c === void 0 ? void 0 : _c.__byteLength) || 0;
                        if (bytesFetched > 40000000) {
                            throw new Error("bytes fetched too high, aborting. " + bytesFetched);
                        }
                        if (!layer.cql2Query ||
                            (0, cql2_1.evaluateCql2JSONQuery)(layer.cql2Query, f.properties)) {
                            differenceGeoms.push(f.geometry.coordinates);
                        }
                    }
                }
            }
        }
        if (differenceGeoms.length > 0) {
            const differenceFeature = (0, polygonClipping_1.difference)([
                simplified.geometry.coordinates,
                ...differenceGeoms,
            ]);
        }
        const productGeojson = {
            type: "Feature",
            geometry: {
                type: "MultiPolygon",
                coordinates: intersectionFeatureGeojson.geometry.coordinates,
            },
            properties: {},
        };
        if (progressCallback) {
            progressCallback(95); // Final calculation
        }
        console.log("product made, calculate area");
        const sqKm = (0, area_1.default)(productGeojson) / 1000000;
        console.log({
            sqKm,
            overlappingDifferenceFeaturesSqKm,
            total: sqKm - overlappingDifferenceFeaturesSqKm,
        });
        if (progressCallback) {
            progressCallback(100); // Complete
        }
        return sqKm - overlappingDifferenceFeaturesSqKm;
    }
}
function ringArea(coords) {
    let sum = 0;
    for (let i = 0, len = coords.length, j = len - 1; i < len; j = i++) {
        sum += (coords[j][0] - coords[i][0]) * (coords[j][1] + coords[i][1]);
    }
    return Math.abs(sum / 2);
}
function polygonArea(polygon) {
    let area = ringArea(polygon[0]); // exterior
    for (let i = 1; i < polygon.length; i++) {
        area -= ringArea(polygon[i]); // subtract holes
    }
    return area;
}
function handleMixedGeoms(mixedGeoms, intersectionFeature) {
    let areaKm = 0;
    let multipart = [];
    for (const geom of mixedGeoms) {
        // @ts-ignore
        multipart.push(geom);
    }
    const overlap = (0, polygonClipping_1.intersection)([intersectionFeature, multipart]);
    // for (const geom of mixedGeoms) {
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
        console.log("overlapping sq km", overlappingSqKm);
        // }
    }
    return areaKm;
}
//# sourceMappingURL=calculateArea.js.map