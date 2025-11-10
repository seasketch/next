"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlappingAreaBatchedClippingProcessor = exports.createClippingWorkerPool = void 0;
const containerIndex_1 = require("./utils/containerIndex");
const helpers_1 = require("./utils/helpers");
const bboxUtils_1 = require("./utils/bboxUtils");
const bbox_1 = __importDefault(require("@turf/bbox"));
const area_1 = __importDefault(require("@turf/area"));
const cql2_1 = require("./cql2");
const clipBatch_1 = require("./workers/clipBatch");
const p_queue_1 = __importDefault(require("p-queue"));
const pool_1 = require("./workers/pool");
Object.defineProperty(exports, "createClippingWorkerPool", { enumerable: true, get: function () { return pool_1.createClippingWorkerPool; } });
const truncate_1 = __importDefault(require("@turf/truncate"));
const layers = {
    classifiedFeatures: {
        name: "classified-features",
        geometryType: "Polygon",
        fields: {
            classification: "string",
            groupBy: "string",
        },
    },
    containerIndexBoxes: {
        name: "container-index-boxes",
        geometryType: "Polygon",
        fields: {
            id: "number",
        },
    },
    subjectFeature: {
        name: "subject-feature",
        geometryType: "Polygon",
        fields: {},
    },
};
class OverlappingAreaBatchedClippingProcessor {
    constructor(operation, maxBatchSize, subjectFeature, intersectionSource, differenceSources, helpers, groupBy, pool) {
        var _a;
        /**
         * Current weight of the batch. Once the weight exceeds the batch size, the
         * batch is processed. These values should be based on the complexity of the
         * features in the batch. If the input is an fgb features with a __byteLength
         * property, that should be used. For features that area already deserialized
         * or processed into GeoJSON, a comparable value should be used such as the
         * byte length of the GeoJSON / 10, to account for the difference of the
         * buffer fgb features size vs GeoJSON text.
         */
        this.maxBatchSize = 0;
        this.results = { "*": 0 };
        this.batchPromises = [];
        this.progress = 0;
        this.progressTarget = 0;
        this.operation = operation;
        this.pool = pool;
        this.intersectionSource = intersectionSource;
        this.differenceSources = differenceSources;
        this.maxBatchSize = maxBatchSize;
        this.subjectFeature = subjectFeature;
        this.helpers = (0, helpers_1.guaranteeHelpers)(helpers);
        // Validate operation type and geometry type compatibility
        if (operation === "overlay_area") {
            // overlay_area only supports Polygon/MultiPolygon
            // Type checking will handle this at compile time, but we can add runtime validation if needed
        }
        else if (operation === "count") {
            // count supports Point/MultiPoint (and potentially others in the future)
        }
        console.time("build container index");
        this.containerIndex = new containerIndex_1.ContainerIndex(subjectFeature);
        console.timeEnd("build container index");
        const boxes = this.containerIndex.getBBoxPolygons();
        let id = 0;
        for (const box of boxes.features) {
            box.properties = { id: id++ };
            if (this.helpers.logFeature) {
                this.helpers.logFeature(layers.containerIndexBoxes, box);
            }
        }
        this.groupBy = groupBy;
        this.resetBatchData();
        this.queue = new p_queue_1.default({
            concurrency: ((_a = this.pool) === null || _a === void 0 ? void 0 : _a.size) || 1,
        });
        if (this.helpers.logFeature) {
            this.helpers.logFeature(layers.subjectFeature, subjectFeature);
        }
    }
    resetBatchData() {
        this.batchData = {
            weight: this.weightForFeature(this.subjectFeature),
            progressWorth: 0,
            differenceSourceReferences: this.differenceSources.reduce((acc, curr) => {
                return {
                    ...acc,
                    [curr.layerId]: {
                        offsets: new Set(),
                        references: [],
                    },
                };
            }, {}),
            features: [],
        };
    }
    async calculate() {
        return new Promise(async (resolve, reject) => {
            var _a, _b, _c;
            try {
                this.progress = 0;
                // Step 1. Create query plan for fetching features from the intersection
                // source which overlap the bounding box of the subject feature. Based on
                // how many bytes of features are estimated to be returned, determine the
                // batch size to use when clipping.
                const envelopes = (0, bboxUtils_1.splitBBoxAntimeridian)((0, bbox_1.default)(this.subjectFeature.geometry)).map(bboxUtils_1.bboxToEnvelope);
                const queryPlan = this.intersectionSource.createPlan(envelopes);
                const concurrency = ((_a = this.pool) === null || _a === void 0 ? void 0 : _a.size) || 1;
                // The default max batch size is helpful when working with very large
                // datasets. For example, if clipping to 100MB of features, we may want to
                // work in batches of 5MB, rather than 100MB / 6 threads. That could cause
                // very large pauses in the processing of the features.
                let BATCH_SIZE = this.maxBatchSize;
                if (queryPlan.estimatedBytes.features / concurrency <
                    this.maxBatchSize) {
                    // Ideally, batch size would be based on the number of threads used to
                    // perform the clipping operation.
                    BATCH_SIZE = Math.round(queryPlan.estimatedBytes.features / concurrency);
                }
                this.helpers.log(`Using batch size of ${BATCH_SIZE} for ${queryPlan.estimatedBytes.features} estimated bytes of features. Concurrency is ${concurrency}, and max batch size setting is ${this.maxBatchSize}`);
                this.progressTarget = queryPlan.estimatedBytes.features;
                // Step 2. Start working through the features, quickly discarding those that
                // are completely outside the subject feature, and collecting size data from
                // those entirely within. For those that are partially within, or need to be
                // clipping against a difference layer, put them into the current batch.
                for await (const feature of this.intersectionSource.getFeaturesAsync(envelopes, {
                    queryPlan,
                })) {
                    (0, truncate_1.default)(feature, { mutate: true });
                    this.helpers.progress((this.progress / this.progressTarget) * 100, `Processing features: (${this.progress}/${this.progressTarget} bytes)`);
                    let requiresIntersection = false;
                    // ContainerIndex.classify supports Polygon, MultiPolygon, Point, and MultiPoint
                    const classification = this.containerIndex.classify(feature);
                    if (this.helpers.logFeature) {
                        this.helpers.logFeature(layers.classifiedFeatures, {
                            type: "Feature",
                            geometry: feature.geometry,
                            properties: {
                                classification,
                                groupBy: ((_b = feature.properties) === null || _b === void 0 ? void 0 : _b[this.groupBy || ""]) || "",
                            },
                        });
                    }
                    if (classification === "outside") {
                        // We can safely skip this feature.
                        this.progress++;
                        // requiresIntersection = true;
                        continue;
                    }
                    else if (classification === "mixed") {
                        // This feature will need to be clipped against the subject feature
                        // to find the intersection, if we're doing an overlay area
                        // operation. If we're doing a count operation, we don't need to
                        // clip against the subject feature. We know it intersects in some
                        // way, so we'll count it.
                        requiresIntersection =
                            this.operation === "overlay_area" ? true : false;
                    }
                    else {
                        // Requires no clipping against the subject feature, but still may need
                        // to be clipped against a difference layer(s) to find the difference.
                    }
                    let requiresDifference = false;
                    for (const differenceSource of this.differenceSources) {
                        // Note that since we're searching without first clipping the feature
                        // to the subject feature, we may be matching on a bigger bounding box
                        // than optimal. But since sources are subdivided into smaller chunks
                        // this shouldn't have a significant impact.
                        const matches = differenceSource.source.search((0, bboxUtils_1.bboxToEnvelope)((0, bbox_1.default)(feature.geometry)));
                        if (matches.features > 0) {
                            requiresDifference = true;
                            this.addDifferenceFeatureReferencesToBatch(differenceSource.layerId, matches.refs);
                        }
                    }
                    if (!requiresIntersection && !requiresDifference) {
                        // feature is entirely within the subject feature, so we can skip
                        // clipping. Just need to add it to the appropriate total(s).
                        this.addFeatureToTotals(feature);
                        this.progress += ((_c = feature.properties) === null || _c === void 0 ? void 0 : _c.__byteLength) || 0;
                    }
                    else {
                        // add feature to batch for clipping
                        this.addFeatureToBatch(feature, requiresIntersection, requiresDifference);
                    }
                    // Only process batch if it has features AND weight threshold is reached
                    // (weight can exceed threshold due to difference references even without features)
                    if (this.batchData.features.length > 0 &&
                        this.batchData.weight >= BATCH_SIZE) {
                        const differenceMultiPolygon = await this.getDifferenceMultiPolygon();
                        if (this.queue && this.queue.isSaturated) {
                            this.helpers.log("Waiting for worker pool to drain");
                            await this.queue.onSizeLessThan(this.queue.concurrency);
                        }
                        let batchData = this.batchData;
                        this.batchPromises.push(this.queue.add(() => this.processBatch(batchData, differenceMultiPolygon).catch((e) => {
                            console.error(`Error processing batch: ${e.message}`);
                            reject(e);
                        })));
                        this.resetBatchData();
                    }
                }
                if (this.batchData.features.length > 0) {
                    const differenceMultiPolygon = await this.getDifferenceMultiPolygon();
                    this.batchPromises.push(this.processBatch(this.batchData, differenceMultiPolygon));
                    this.resetBatchData();
                }
                const resolvedBatchData = await Promise.all(this.batchPromises);
                this.helpers.log(`Resolved ${resolvedBatchData.length} batches`);
                for (const batchData of resolvedBatchData) {
                    console.log("resolving batch data", batchData);
                    for (const classKey in batchData) {
                        if (!(classKey in this.results)) {
                            this.results[classKey] = 0;
                        }
                        this.results[classKey] += batchData[classKey];
                    }
                }
                resolve(this.results);
            }
            catch (e) {
                reject(e);
            }
        });
    }
    async processBatch(batch, differenceMultiPolygon) {
        if (batch.features.length === 0) {
            throw new Error("Batch has no features");
        }
        this.progress += batch.progressWorth;
        this.helpers.progress((this.progress / this.progressTarget) * 100);
        const batchPayload = {
            operation: this.operation,
            features: batch.features,
            differenceMultiPolygon: differenceMultiPolygon,
            subjectFeature: this.subjectFeature,
            groupBy: this.groupBy,
        };
        this.helpers.log(`submitting batchPayload: ${JSON.stringify({
            operation: this.operation,
            features: batch.features.length,
            differenceMultiPolygon: differenceMultiPolygon.length,
            subjectFeature: this.subjectFeature.geometry.type,
            groupBy: this.groupBy,
        })}`);
        if (this.pool) {
            return this.pool.run(batchPayload).catch((error) => {
                console.error(`Error processing batch in worker: ${error && (error.stack || error.message || error)}`);
                throw error;
            });
        }
        else {
            if (this.operation === "overlay_area") {
                return (0, clipBatch_1.clipBatch)({
                    features: batch.features,
                    differenceMultiPolygon: differenceMultiPolygon,
                    subjectFeature: this.subjectFeature,
                    groupBy: this.groupBy,
                }).catch((error) => {
                    console.error(`Error processing batch: ${error.message}`);
                    throw error;
                });
            }
            else if (this.operation === "count") {
                return (0, clipBatch_1.countFeatures)({
                    features: batch.features,
                    differenceMultiPolygon: differenceMultiPolygon,
                    subjectFeature: this.subjectFeature,
                    groupBy: this.groupBy,
                }).catch((error) => {
                    console.error(`Error counting features: ${error.message}`);
                    throw error;
                });
            }
            else {
                throw new Error(`Unknown operation type: ${this.operation}`);
            }
        }
    }
    async getDifferenceMultiPolygon() {
        // fetch the difference features, and combine into a single multipolygon
        const differenceMultiPolygon = [];
        await Promise.all(Object.keys(this.batchData.differenceSourceReferences).map(async (layerId) => {
            const refs = this.batchData.differenceSourceReferences[layerId].references;
            const d = this.differenceSources.find((s) => s.layerId === layerId);
            if (!d) {
                throw new Error(`Difference source not found for layer ID: ${layerId}`);
            }
            const { source, cql2Query } = d;
            const queryPlan = source.getQueryPlan(refs);
            for await (const feature of source.getFeaturesAsync([], {
                queryPlan,
            })) {
                if (cql2Query &&
                    !(0, cql2_1.evaluateCql2JSONQuery)(cql2Query, feature.properties)) {
                    continue;
                }
                if (feature.geometry.type === "Polygon") {
                    differenceMultiPolygon.push(feature.geometry.coordinates);
                }
                else {
                    for (const poly of feature.geometry.coordinates) {
                        differenceMultiPolygon.push(poly);
                    }
                }
            }
        }));
        return differenceMultiPolygon;
    }
    addFeatureToTotals(feature) {
        var _a, _b, _c;
        if (this.operation === "overlay_area") {
            // get area in square kilometers
            const area = ((_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__area)
                ? feature.properties.__area
                : (0, area_1.default)(feature) * 1e-6;
            this.results["*"] += area;
            if (this.groupBy) {
                const classKey = (_b = feature.properties) === null || _b === void 0 ? void 0 : _b[this.groupBy];
                if (classKey) {
                    this.results[classKey] = this.results[classKey] || 0;
                    this.results[classKey] += area;
                }
            }
        }
        else if (this.operation === "count") {
            console.log("add to count", this.results);
            // Count the feature (or points in MultiPoint)
            this.results["*"] += 1;
            if (this.groupBy) {
                const classKey = (_c = feature.properties) === null || _c === void 0 ? void 0 : _c[this.groupBy];
                if (classKey) {
                    this.results[classKey] = this.results[classKey] || 0;
                    this.results[classKey] += 1;
                }
            }
        }
    }
    addDifferenceFeatureReferencesToBatch(layerId, refs) {
        for (const ref of refs) {
            if (!this.batchData.differenceSourceReferences[layerId].offsets.has(ref[0])) {
                this.batchData.differenceSourceReferences[layerId].offsets.add(ref[0]);
                this.batchData.differenceSourceReferences[layerId].references.push(ref);
                this.batchData.weight += ref[1] || 1000; // default to 1KB if no byte length is provided
            }
        }
    }
    addFeatureToBatch(feature, requiresIntersection, requiresDifference) {
        var _a;
        this.batchData.features.push({
            feature,
            requiresIntersection,
            requiresDifference,
        });
        this.batchData.weight += this.weightForFeature(feature);
        this.batchData.progressWorth += ((_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__byteLength) || 1000;
    }
    weightForFeature(feature) {
        var _a;
        let weight = (_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__byteLength;
        if (weight === undefined || weight === null) {
            // base weight on number of vertices/points in the feature
            if (feature.geometry.type === "Polygon") {
                weight = feature.geometry.coordinates.reduce((acc, ring) => acc + ring.length, 0);
            }
            else if (feature.geometry.type === "MultiPolygon") {
                weight = feature.geometry.coordinates.reduce((acc, poly) => acc + poly.reduce((acc2, ring) => acc2 + ring.length, 0), 0);
            }
            else if (feature.geometry.type === "Point") {
                weight = 1;
            }
            else if (feature.geometry.type === "MultiPoint") {
                weight = feature.geometry.coordinates.length;
            }
            else {
                // Default weight for other geometry types
                weight = 1000;
            }
        }
        return weight;
    }
}
exports.OverlappingAreaBatchedClippingProcessor = OverlappingAreaBatchedClippingProcessor;
//# sourceMappingURL=OverlappingAreaBatchedClippingProcessor.js.map