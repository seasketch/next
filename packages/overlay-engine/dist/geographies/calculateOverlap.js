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
    batchedDifferenceFeatures: {
        name: "batched-difference-features",
        geometryType: "MultiPolygon",
        fields: {
            id: "number",
        },
    },
    batchedOriginalFeatures: {
        name: "batched-original-features",
        geometryType: "MultiPolygon",
        fields: {
            id: "number",
            category: "string",
        },
    },
    batchedJoinedFeatures: {
        name: "batched-joined-features",
        geometryType: "Polygon",
        fields: {
            id: "number",
            category: "string",
        },
    },
    batchedDiffProducts: {
        name: "batched-diff-products",
        geometryType: "MultiPolygon",
        fields: {
            id: "number",
            category: "string",
        },
    },
    unbatchedFeatures: {
        name: "unbatched-features",
        geometryType: "MultiPolygon",
        fields: {
            id: "number",
            category: "string",
        },
    },
};
let batchedFeaturesId = 0;
/**
 * The maximum number of features to process in a single batch.
 * Rather than performing a clipping operation for each individual feature,
 * we perform a clipping operation for a batch of features. Performing this
 * against entire layers could be slow or even run out available memory, and
 * also skips the opportunity to use the container index to achieve even greater
 * speed. This batch size is a compromise between these two factors.
 */
const CLIPPING_BATCH_SIZE = 1024 * 1024 * 5; // 2MB
async function calculateGeographyOverlap(geography, sourceCache, sourceUrl, sourceType, groupBy, helpersOption) {
    var _a, _b;
    let differenceReferences = 0;
    const loggedDifferenceFeatures = new Set();
    const helpers = (0, helpers_1.guaranteeHelpers)(helpersOption);
    if (sourceType !== "FlatGeobuf") {
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
    // // Start source prefetching and capture the result without creating
    // // unhandled rejections. We'll check this later and propagate if needed.
    // const prefetchResultPromise: Promise<
    //   { ok: true } | { ok: false; error: unknown }
    // > = sourceCache
    //   .get<Feature<Polygon | MultiPolygon>>(sourceUrl, {
    //     pageSize: "5MB",
    //   })
    //   .then(() => ({ ok: true as const }))
    //   .catch((error) => ({ ok: false as const, error }));
    const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } = await (0, geographies_1.initializeGeographySources)(geography, sourceCache, helpers, {
        pageSize: "5MB",
    });
    const simplified = (0, simplify_1.default)(intersectionFeatureGeojson, {
        tolerance: 0.002,
    });
    const outerPolygonContainerIndex = new containerIndex_1.ContainerIndex(simplified);
    // If prefetch failed, surface the error through the awaited path so the
    // caller's try/catch or .catch() reliably observes it.
    // {
    //   const prefetchResult = await prefetchResultPromise;
    //   if (!prefetchResult.ok) {
    //     throw prefetchResult.error;
    //   }
    // }
    const differenceSources = await Promise.all(differenceLayers.map(async (layer) => {
        const diffSource = await sourceCache.get(layer.source, {
            pageSize: "5MB",
        });
        return {
            cql2Query: layer.cql2Query,
            source: diffSource,
            layerId: layer.source,
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
    const estimate = await source.search(envelope);
    helpers.log(`Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}`);
    helpers.progress(progress, `Processing ${estimate.features} features`);
    const areaByClassId = { "*": 0 };
    function addFeatureToTotals(feature, hasChanged) {
        var _a;
        let area = ((_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__area) || 0;
        if (hasChanged) {
            area = (0, area_1.default)(feature) * 1e-6;
        }
        areaByClassId["*"] += area;
        if (groupBy && feature.properties) {
            const classKey = feature.properties[groupBy];
            if (classKey !== undefined) {
                areaByClassId[classKey] = areaByClassId[classKey] || 0;
                areaByClassId[classKey] += area;
            }
        }
    }
    const intersectionGeom = intersectionFeatureGeojson.geometry
        .coordinates;
    const batch = new DifferenceClippingBatch(differenceLayers.map((d) => d.source));
    async function processBatch() {
        var _a, _b;
        const refscount = Object.values(batch.offsets).reduce((acc, curr) => acc + curr.length, 0);
        console.log(`processing batch #${batch.id}`, batch.features.length, batch.bytes + " bytes", `${refscount} offsets`);
        const diffGeoms = [];
        for (const diffSource of differenceSources) {
            const refs = batch.offsets[diffSource.layerId];
            const queryPlan = diffSource.source.getQueryPlan(refs);
            if (refs.length > 0) {
                for await (const diffFeature of diffSource.source.getFeaturesAsync((0, bboxUtils_1.bboxToEnvelope)(batch.bbox), {
                    queryPlan,
                })) {
                    if (diffSource.cql2Query &&
                        !(0, cql2_1.evaluateCql2JSONQuery)(diffSource.cql2Query, diffFeature.properties)) {
                        continue;
                    }
                    diffGeoms.push(diffFeature.geometry.coordinates);
                }
            }
        }
        if (helpers.logFeature) {
            for (const geom of diffGeoms) {
                helpers.logFeature(layers.batchedDifferenceFeatures, {
                    type: "Feature",
                    properties: { id: batch.id, category: "difference-layer" },
                    geometry: {
                        type: "Polygon",
                        // @ts-ignore
                        coordinates: geom,
                    },
                });
            }
        }
        if (helpers.logFeature) {
            for (const feature of batch.features) {
                helpers.logFeature(layers.batchedOriginalFeatures, {
                    ...feature,
                    properties: {
                        id: (_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__offset,
                        category: ((_b = feature.properties) === null || _b === void 0 ? void 0 : _b[groupBy || ""]) || "original-feature",
                    },
                });
            }
        }
        const groupedGeoms = groupGeomsByClassKey(batch.features, groupBy);
        if (helpers.logFeature) {
            for (const classKey in groupedGeoms) {
                if (groupedGeoms[classKey].length === 0) {
                    continue;
                }
                for (const geom of groupedGeoms[classKey]) {
                    const f = {
                        type: "Feature",
                        properties: { id: batch.id, category: classKey + `-joined` },
                        geometry: {
                            type: "Polygon",
                            // @ts-ignore
                            coordinates: geom,
                        },
                    };
                    helpers.logFeature(layers.batchedJoinedFeatures, f);
                }
            }
        }
        if (groupBy) {
            for (const classKey in groupedGeoms) {
                if (classKey === "*") {
                    continue;
                }
                const product = {
                    type: "Feature",
                    properties: {
                        id: batch.id,
                        [groupBy]: classKey,
                    },
                    geometry: {
                        type: "MultiPolygon",
                        // coordinates: groupedGeoms[classKey],
                        coordinates: clipping.difference(groupedGeoms[classKey], ...diffGeoms),
                    },
                };
                // if (!isValid(product)) {
                //   throw new Error("Invalid product");
                // }
                if (helpers.logFeature) {
                    helpers.logFeature(layers.batchedDiffProducts, {
                        ...product,
                        properties: {
                            id: batch.id,
                            category: classKey + `-diffed`,
                        },
                    });
                }
                addFeatureToTotals(product, true);
            }
        }
        else {
            const product = {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "MultiPolygon",
                    coordinates: clipping.difference(groupedGeoms["*"], ...diffGeoms),
                },
            };
            addFeatureToTotals(product, true);
        }
        batch.reset();
    }
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
        if (classification === "outside") {
            // This feature is completely outside the geography, so we can skip it.
            continue;
        }
        else if (classification === "mixed") {
            // This feature is partially within the geography, so we need to perform
            // a clipping operation.
            hasChanged = true;
            // clipping always results in a MultiPolygon
            feature.geometry.type = "MultiPolygon";
            feature.geometry.coordinates = clipping.intersection(intersectionGeom, feature.geometry.coordinates);
        }
        else {
            // This feature is entirely within the geography, so we can skip clipping
            // but still need to check the difference layer(s), then count it's
            // remaining area.
        }
        const bboxes = (0, bboxUtils_1.splitBBoxAntimeridian)((0, bbox_1.bbox)(feature.geometry));
        const splitEnvelopes = bboxes.map(bboxUtils_1.bboxToEnvelope);
        let hasHits = false;
        for (const diffLayer of differenceSources) {
            const matches = diffLayer.source.search(splitEnvelopes);
            if (matches.features > 0) {
                batch.addDifferenceFeatureReferences(diffLayer.layerId, matches.refs);
                hasHits = true;
            }
        }
        if (hasHits) {
            batch.addFeature(feature);
            if (batch.bytes >= CLIPPING_BATCH_SIZE) {
                await processBatch();
            }
        }
        else {
            if (helpers.logFeature) {
                helpers.logFeature(layers.unbatchedFeatures, {
                    ...feature,
                    properties: {
                        id: (_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__offset,
                        category: ((_b = feature.properties) === null || _b === void 0 ? void 0 : _b[groupBy || ""]) || "unbatched-feature",
                    },
                });
            }
            addFeatureToTotals(feature, hasChanged);
        }
    }
    await processBatch();
    return areaByClassId;
}
function combineBBoxes(bboxA, bboxB) {
    return [
        Math.min(bboxA[0], bboxB[0]),
        Math.min(bboxA[1], bboxB[1]),
        Math.max(bboxA[2], bboxB[2]),
        Math.max(bboxA[3], bboxB[3]),
    ];
}
class DifferenceClippingBatch {
    constructor(layerIds) {
        this.id = batchedFeaturesId++;
        this.features = [];
        this.offsets = layerIds.reduce((l, id) => ({ ...l, [id]: [] }), {});
        this.offsetIds = layerIds.reduce((l, id) => ({ ...l, [id]: new Set() }), {});
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity];
        this.layerIds = layerIds;
        this.bytes = 0;
    }
    reset() {
        this.features = [];
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity];
        this.bytes = 0;
        this.id = batchedFeaturesId++;
        this.offsets = this.layerIds.reduce((l, id) => ({ ...l, [id]: [] }), {});
    }
    addFeature(feature) {
        var _a;
        this.features.push(feature);
        this.bytes += ((_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__byteLength) || 0;
        this.bbox = combineBBoxes(this.bbox, feature.bbox);
    }
    addDifferenceFeatureReferences(layerId, refs) {
        for (const ref of refs) {
            if (!this.offsetIds[layerId].has(ref[0])) {
                this.offsets[layerId].push(ref);
                this.offsetIds[layerId].add(ref[0]);
                this.bytes += ref[1] || 0;
            }
        }
    }
}
function groupGeomsByClassKey(features, groupBy) {
    var _a;
    const geoms = {
        "*": [],
    };
    for (const feature of features) {
        const area = (0, area_1.default)(feature) * 1e-6;
        if (groupBy) {
            const classKey = (_a = feature.properties) === null || _a === void 0 ? void 0 : _a[groupBy];
            if (classKey) {
                if (!(classKey in geoms)) {
                    geoms[classKey] = [];
                }
                if (feature.geometry.type === "Polygon") {
                    geoms[classKey].push(feature.geometry.coordinates);
                }
                else {
                    for (const poly of feature.geometry.coordinates) {
                        geoms[classKey].push(poly);
                    }
                }
            }
        }
        else {
            if (feature.geometry.type === "Polygon") {
                geoms["*"].push(feature.geometry.coordinates);
            }
            else {
                for (const poly of feature.geometry.coordinates) {
                    geoms["*"].push(poly);
                }
            }
        }
    }
    return geoms;
}
//# sourceMappingURL=calculateOverlap.js.map