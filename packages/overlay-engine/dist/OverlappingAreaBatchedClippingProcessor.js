"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlappingAreaBatchedClippingProcessor = void 0;
const containerIndex_1 = require("./utils/containerIndex");
const helpers_1 = require("./utils/helpers");
const simplify_1 = __importDefault(require("@turf/simplify"));
const bboxUtils_1 = require("./utils/bboxUtils");
const bbox_1 = __importDefault(require("@turf/bbox"));
const area_1 = __importDefault(require("@turf/area"));
const cql2_1 = require("./cql2");
const piscina_1 = require("piscina");
const clipBatch_1 = __importDefault(require("./workers/clipBatch"));
const piscina = new piscina_1.Piscina({
    filename: __dirname + "/../dist/workers/clipBatch.js",
    // maxThreads: 5,
    // minThreads: 5,
    maxQueue: "auto",
});
class OverlappingAreaBatchedClippingProcessor {
    constructor(maxBatchSize, subjectFeature, intersectionSource, differenceSources, helpers, groupBy, options) {
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
        this.minimumBatchDivisionFactor = 4;
        this.results = { "*": 0 };
        this.batchPromises = [];
        this.options = {
            useWorkers: false,
        };
        this.intersectionSource = intersectionSource;
        this.differenceSources = differenceSources;
        this.maxBatchSize = maxBatchSize;
        this.subjectFeature = subjectFeature;
        this.containerIndex = new containerIndex_1.ContainerIndex((0, simplify_1.default)(subjectFeature, {
            tolerance: 0.002,
        }));
        this.helpers = (0, helpers_1.guaranteeHelpers)(helpers);
        this.groupBy = groupBy;
        this.resetBatchData();
        this.options = options || {
            useWorkers: false,
        };
    }
    resetBatchData() {
        this.batchData = {
            weight: this.weightForFeature(this.subjectFeature),
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
    async calculateOverlap() {
        // Step 1. Create query plan for fetching features from the intersection
        // source which overlap the bounding box of the subject feature. Based on
        // how many bytes of features are estimated to be returned, determine the
        // batch size to use when clipping.
        const envelopes = (0, bboxUtils_1.splitBBoxAntimeridian)((0, bbox_1.default)(this.subjectFeature.geometry)).map(bboxUtils_1.bboxToEnvelope);
        const queryPlan = this.intersectionSource.createPlan(envelopes);
        // The default max batch size is helpful when working with very large
        // datasets. For example, if clipping to 100MB of features, we may want to
        // work in batches of 5MB, rather than 100MB / 6 threads. That could cause
        // very large pauses in the processing of the features.
        let BATCH_SIZE = this.maxBatchSize;
        if (queryPlan.estimatedBytes.features / this.minimumBatchDivisionFactor <
            this.maxBatchSize) {
            // Ideally, batch size would be based on the number of threads used to
            // perform the clipping operation.
            BATCH_SIZE =
                queryPlan.estimatedBytes.features / this.minimumBatchDivisionFactor;
        }
        this.helpers.log(`Using batch size of ${BATCH_SIZE} for ${queryPlan.estimatedBytes.features} estimated bytes of features. Minimum batch division factor is ${this.minimumBatchDivisionFactor}, and max batch size setting is ${this.maxBatchSize}`);
        // Step 2. Start working through the features, quickly discarding those that
        // are completely outside the subject feature, and collecting size data from
        // those entirely within. For those that are partially within, or need to be
        // clipping against a difference layer, put them into the current batch.
        for await (const feature of this.intersectionSource.getFeaturesAsync(envelopes, {
            queryPlan,
        })) {
            let requiresIntersection = false;
            const classification = this.containerIndex.classify(feature);
            if (classification === "outside") {
                // We can safely skip this feature.
                continue;
            }
            else if (classification === "mixed") {
                // This feature will need to be clipped against the subject feature to
                // find the intersection.
                requiresIntersection = true;
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
                // clipping. Just need to add it's area to the appropriate total(s).
                this.addFeatureToTotals(feature, true);
            }
            else {
                // add feature to batch for clipping
                this.addFeatureToBatch(feature, requiresIntersection, requiresDifference);
            }
            if (this.batchData.weight >= BATCH_SIZE) {
                this.batchPromises.push(this.processBatch(this.batchData));
                this.resetBatchData();
                if (this.options.useWorkers && piscina.needsDrain) {
                    console.log("Draining workers");
                    await new Promise((resolve) => {
                        piscina.once("drain", resolve);
                    });
                }
            }
        }
        if (this.batchData.features.length > 0) {
            this.batchPromises.push(this.processBatch(this.batchData));
            this.resetBatchData();
        }
        const resolvedBatchData = await Promise.all(this.batchPromises);
        console.log(`Resolved ${resolvedBatchData.length} batches`);
        for (const batchData of resolvedBatchData) {
            for (const classKey in batchData) {
                this.results[classKey] += batchData[classKey];
            }
        }
        if (this.options.useWorkers) {
            console.log(piscina.utilization);
            await piscina.destroy();
        }
        return this.results;
    }
    async processBatch(batch) {
        const results = { "*": 0 };
        console.log(`Processing batch of ${batch.features.length} features, with weight of ${batch.weight}`);
        console.log(`Includes ${Object.values(batch.differenceSourceReferences).reduce((acc, curr) => acc + curr.references.length, 0)} difference source references`);
        // fetch the difference features, and combine into a single multipolygon
        const differenceMultiPolygon = [];
        await Promise.all(Object.keys(batch.differenceSourceReferences).map(async (layerId) => {
            const refs = batch.differenceSourceReferences[layerId].references;
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
        if (this.options.useWorkers) {
            console.log("Using workers");
            return await piscina.run({
                features: batch.features,
                differenceMultiPolygon: differenceMultiPolygon,
                subjectFeature: this.subjectFeature,
                groupBy: this.groupBy,
            });
        }
        else {
            console.log("Using single thread");
            return await (0, clipBatch_1.default)({
                features: batch.features,
                differenceMultiPolygon: differenceMultiPolygon,
                subjectFeature: this.subjectFeature,
                groupBy: this.groupBy,
            });
        }
    }
    addFeatureToTotals(feature, usePrecomputedArea = false) {
        var _a, _b, _c;
        // get area in square kilometers
        const area = usePrecomputedArea && ((_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__area)
            ? (_b = feature.properties) === null || _b === void 0 ? void 0 : _b.__area
            : (0, area_1.default)(feature) * 1e-6;
        this.results["*"] += area;
        if (this.groupBy) {
            const classKey = (_c = feature.properties) === null || _c === void 0 ? void 0 : _c[this.groupBy];
            if (classKey) {
                this.results[classKey] = this.results[classKey] || 0;
                this.results[classKey] += area;
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
        this.batchData.features.push({
            feature,
            requiresIntersection,
            requiresDifference,
        });
        this.batchData.weight += this.weightForFeature(feature);
    }
    weightForFeature(feature) {
        var _a;
        let weight = (_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__byteLength;
        if (weight === undefined || weight === null) {
            // base weight on number of vertices in the feature
            if (feature.geometry.type === "Polygon") {
                weight = feature.geometry.coordinates.length;
            }
            else {
                weight = feature.geometry.coordinates.reduce((acc, curr) => acc + curr.length, 0);
            }
        }
        return weight;
    }
}
exports.OverlappingAreaBatchedClippingProcessor = OverlappingAreaBatchedClippingProcessor;
//# sourceMappingURL=OverlappingAreaBatchedClippingProcessor.js.map