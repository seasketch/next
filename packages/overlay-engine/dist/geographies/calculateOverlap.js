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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateGeographyOverlap = calculateGeographyOverlap;
const geographies_1 = require("./geographies");
const helpers_1 = require("../utils/helpers");
const cql2_1 = require("../cql2");
const bbox_1 = require("@turf/bbox");
const bboxUtils_1 = require("../utils/bboxUtils");
const clipping = __importStar(require("polyclip-ts"));
const area_1 = __importDefault(require("@turf/area"));
const simplify_1 = __importDefault(require("@turf/simplify"));
const containerIndex_1 = require("../utils/containerIndex");
const layers = {
    bboxes: {
        name: "outer-polygon-edge-box",
        geometryType: "Polygon",
        fields: { category: "string" },
    },
    classifiedSourceFeatures: {
        name: "classified-source-features",
        geometryType: "Polygon",
        fields: { category: "string" },
    },
    outerPolygonIntersectionResults: {
        name: "outer-polygon-intersection-results",
        geometryType: "MultiPolygon",
        fields: { category: "string" },
    },
    allDifferenceFeatures: {
        name: "all-difference-features",
        geometryType: "Polygon",
        fields: { offset: "number" },
    },
    finalProductFeatures: {
        name: "final-product-features",
        geometryType: "MultiPolygon",
        fields: {},
    },
    differenceLayerIntesectionState: {
        name: "difference-layer-intersection-state",
        geometryType: "Polygon",
        fields: { category: "string" },
    },
};
async function calculateGeographyOverlap(geography, sourceCache, sourceUrl, sourceType, groupBy, helpersOption) {
    var _a, _b, _c;
    let differenceReferences = 0;
    const loggedDifferenceFeatures = new Set();
    const helpers = (0, helpers_1.guaranteeHelpers)(helpersOption);
    if (sourceType !== "FlatGeobuf") {
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
    console.log("prefetch source layer of interest");
    // Start source prefetching and capture the result without creating
    // unhandled rejections. We'll check this later and propagate if needed.
    const prefetchResultPromise = sourceCache
        .get(sourceUrl, {
        pageSize: "5MB",
    })
        .then(() => ({ ok: true }))
        .catch((error) => ({ ok: false, error }));
    const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } = await (0, geographies_1.initializeGeographySources)(geography, sourceCache, helpers, {
        pageSize: "5MB",
    });
    const simplified = (0, simplify_1.default)(intersectionFeatureGeojson, {
        tolerance: 0.002,
    });
    const outerPolygonContainerIndex = new containerIndex_1.ContainerIndex(simplified);
    if (helpers.logFeature) {
        const bboxPolygons = outerPolygonContainerIndex.getBBoxPolygons();
        for (const f of bboxPolygons.features) {
            helpers.logFeature(layers.bboxes, {
                ...f,
                properties: { category: "outer-polygon-edge-box" },
            });
        }
    }
    // If prefetch failed, surface the error through the awaited path so the
    // caller's try/catch or .catch() reliably observes it.
    {
        const prefetchResult = await prefetchResultPromise;
        if (!prefetchResult.ok) {
            throw prefetchResult.error;
        }
    }
    const differenceSources = await Promise.all(differenceLayers.map(async (layer) => {
        const diffSource = await sourceCache.get(layer.source);
        return {
            cql2Query: layer.cql2Query,
            source: diffSource,
        };
    }));
    // throw new Error("stop");
    // difference layers often include the osm land layer, which is very large.
    // to optimize performance, start fetching pages from the difference layers
    // for every page that intersects the geography. Afterwards,
    // feature-by-feature calculations can be performed.
    const env = (0, bboxUtils_1.bboxToEnvelope)((0, bbox_1.bbox)(intersectionFeatureGeojson));
    // helpers.log("prefetching difference sources");
    // TODO: Work towards enabling this, or at least understanding why it happens.
    // Uncommenting this won't always cause issues, but if it does cause
    // connection terminations on lambda (and it will eventually), then somehow
    // those terminated range requests will get jammed up in a cache somewhere
    // (likely in AWS's network stack) and just repeatedly fail. If you wait, the
    // same code will work again eventually. I just don't think the network stack
    // likes repeated identical range requests.
    //
    // for (const differenceSource of differenceSources) {
    //   differenceSource.source
    //     .prefetch(env)
    //     .then(() => {
    //       console.log("prefetched difference source for", env);
    //     })
    //     .catch((error) => {
    //       console.log("error prefetching difference source for", env);
    //       console.error(error);
    //     });
    // }
    helpers.log("initialized geography sources");
    let progress = 0;
    let featuresProcessed = 0;
    const source = await sourceCache.get(sourceUrl);
    const envelope = (0, bboxUtils_1.bboxToEnvelope)((0, bbox_1.bbox)(intersectionFeatureGeojson));
    const estimate = await source.countAndBytesForQuery(envelope);
    helpers.log(`Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}, requests: ${estimate.requests}`);
    helpers.progress(progress, `Processing ${estimate.features} features`);
    const areaByClassId = { "*": 0 };
    const intersectionGeom = intersectionFeatureGeojson.geometry
        .coordinates;
    const geomsForClipping = {
        totalGeometryBytes: 0,
        sourceFeatures: [],
        differenceFeatures: [],
    };
    for await (const feature of source.getFeaturesAsync(envelope)) {
        if (featuresProcessed === 0) {
            helpers.log("starting processing of first source feature");
        }
        featuresProcessed++;
        const percent = (featuresProcessed / estimate.features) * 100;
        await helpers.progress(percent, `Processing features: (${featuresProcessed}/${estimate.features})`);
        let hasChanged = false;
        let intersection;
        const classification = outerPolygonContainerIndex.classify(feature);
        if (helpers.logFeature) {
            helpers.logFeature(layers.classifiedSourceFeatures, {
                ...feature,
                properties: {
                    category: classification,
                },
            });
        }
        if (classification === "outside") {
            continue;
        }
        else if (classification === "mixed") {
            hasChanged = true;
            intersection = clipping.intersection(intersectionGeom, feature.geometry.coordinates);
            if (helpers.logFeature) {
                helpers.logFeature(layers.outerPolygonIntersectionResults, {
                    ...feature,
                    properties: { category: "outer-polygon-intersection-results" },
                    geometry: {
                        type: "MultiPolygon",
                        coordinates: intersection,
                    },
                });
            }
        }
        else {
            intersection = feature.geometry.coordinates;
        }
        let differenceGeoms = [];
        const featureEnvelope = (0, bboxUtils_1.bboxToEnvelope)((0, bbox_1.bbox)(feature.geometry));
        if (differenceSources.length > 0) {
            for (const diffLayer of differenceSources) {
                for await (const differenceFeature of diffLayer.source.getFeaturesAsync(featureEnvelope)) {
                    differenceReferences++;
                    if (!diffLayer.cql2Query ||
                        (0, cql2_1.evaluateCql2JSONQuery)(diffLayer.cql2Query, differenceFeature.properties)) {
                        if (helpers.logFeature &&
                            !loggedDifferenceFeatures.has(`${differenceSources.indexOf(diffLayer)}-${(_a = differenceFeature.properties) === null || _a === void 0 ? void 0 : _a.__offset}`)) {
                            helpers.logFeature(layers.allDifferenceFeatures, {
                                ...differenceFeature,
                                properties: {
                                    offset: ((_b = differenceFeature.properties) === null || _b === void 0 ? void 0 : _b.__offset) || 0,
                                },
                            });
                        }
                        differenceGeoms.push(differenceFeature.geometry.coordinates);
                    }
                }
            }
        }
        if (differenceGeoms.length > 0) {
            // console.log("difference geoms", differenceGeoms.length);
            hasChanged = true;
            intersection = clipping.difference(intersection, ...differenceGeoms);
            // continue;
        }
        else {
            // console.log("no difference geoms");
        }
        if (helpers.logFeature) {
            helpers.logFeature(layers.differenceLayerIntesectionState, {
                type: "Feature",
                properties: {
                    category: hasChanged ? "would-clip" : "no-intersection-w-diff",
                },
                geometry: feature.geometry,
            });
        }
        if (helpers.logFeature) {
            if (hasChanged) {
                helpers.logFeature(layers.finalProductFeatures, {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "MultiPolygon",
                        // @ts-ignore
                        coordinates: intersection,
                    },
                });
            }
            else {
                helpers.logFeature(layers.finalProductFeatures, {
                    ...feature,
                });
            }
        }
        let area = 0;
        if (hasChanged) {
            area =
                (0, area_1.default)({
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "MultiPolygon",
                        coordinates: intersection,
                    },
                }) / 1000000;
        }
        else {
            area = ((_c = feature.properties) === null || _c === void 0 ? void 0 : _c.__area) || (0, area_1.default)(feature) / 1000000;
        }
        areaByClassId["*"] += area;
        if (groupBy) {
            const classKey = feature.properties[groupBy];
            if (classKey !== undefined) {
                if (!areaByClassId[classKey]) {
                    areaByClassId[classKey] = 0;
                }
                areaByClassId[classKey] += area;
            }
        }
    }
    return areaByClassId;
}
//# sourceMappingURL=calculateOverlap.js.map