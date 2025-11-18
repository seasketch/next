"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlayEngineBatchProcessor = exports.createClippingWorkerPool = void 0;
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
const uniqueIdIndex_1 = require("./utils/uniqueIdIndex");
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
class OverlayEngineBatchProcessor {
    // Type guard helpers
    isOverlayAreaOperation() {
        return this.operation === "overlay_area";
    }
    isCountOperation() {
        return this.operation === "count";
    }
    isPresenceOperation() {
        return this.operation === "presence";
    }
    isPresenceTableOperation() {
        return this.operation === "presence_table";
    }
    isColumnValuesOperation() {
        return this.operation === "column_values";
    }
    getColumnValuesResults() {
        return this.results;
    }
    // Operation-specific result getters with proper typing
    getOverlayResults() {
        return this.results;
    }
    getPresenceTableResults() {
        return this.results;
    }
    // Initialize results based on operation type
    initializeResults(op) {
        if (op === "count") {
            // Initialize interim ID storage
            this.countInterimIds = { "*": [] };
            // Return empty structure - will be populated at the end
            return {};
        }
        else if (op === "presence_table") {
            return {
                values: [],
                exceededLimit: false,
            };
        }
        else if (op === "presence") {
            return false;
        }
        else if (op === "column_values") {
            return {
                "*": [],
            };
        }
        else if (op === "overlay_area") {
            return { "*": 0 };
        }
        else {
            throw new Error(`Invalid operation type: ${op}`);
        }
    }
    constructor(operation, maxBatchSize, subjectFeature, intersectionSource, differenceSources, helpers, groupBy, pool, includedProperties, resultsLimit, columnValuesProperty) {
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
        // Interim storage for count operation IDs (before converting to UniqueIdIndex)
        this.countInterimIds = {};
        this.batchPromises = [];
        this.presenceOperationEarlyReturn = false;
        this.resultsLimit = 50;
        this.progress = 0;
        this.progressTarget = 0;
        this.operation = operation;
        this.pool = pool;
        this.intersectionSource = intersectionSource;
        this.differenceSources = differenceSources;
        this.maxBatchSize = maxBatchSize;
        this.subjectFeature = subjectFeature;
        this.helpers = (0, helpers_1.guaranteeHelpers)(helpers);
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
        // Initialize results based on operation type
        this.results = this.initializeResults(operation);
        this.resetBatchData();
        this.queue = new p_queue_1.default({
            concurrency: ((_a = this.pool) === null || _a === void 0 ? void 0 : _a.size) || 1,
        });
        if (this.helpers.logFeature) {
            this.helpers.logFeature(layers.subjectFeature, subjectFeature);
        }
        this.includedProperties = includedProperties;
        if (resultsLimit) {
            this.resultsLimit = resultsLimit;
        }
        if (this.operation === "column_values") {
            this.columnValuesProperty = columnValuesProperty;
            if (!this.columnValuesProperty) {
                throw new Error("columnValuesProperty is required for column_values operation");
            }
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
                    if (this.presenceOperationEarlyReturn) {
                        this.progress = this.progressTarget;
                        this.results = true;
                        return resolve(this.results);
                    }
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
                        // Presence operations are a special case here, as it't the only
                        // one that triggers an early return.
                        if (this.operation === "presence") {
                            this.progress = this.progressTarget;
                            this.results = true;
                            return resolve(this.results);
                        }
                        else {
                            // feature is entirely within the subject feature, so we can skip
                            // clipping. Just need to add it to the appropriate total(s).
                            this.addIndividualFeatureToResults(feature);
                            this.progress += ((_c = feature.properties) === null || _c === void 0 ? void 0 : _c.__byteLength) || 0;
                        }
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
                            throw e;
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
                if (this.isOverlayAreaOperation()) {
                    this.mergeOverlayBatchResults(resolvedBatchData);
                }
                else if (this.isCountOperation()) {
                    this.mergeCountBatchResults(resolvedBatchData);
                    this.finalizeCountResults();
                }
                else if (this.isPresenceOperation()) {
                    const hasMatch = resolvedBatchData.some((result) => result === true);
                    if (hasMatch) {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    }
                }
                else if (this.isPresenceTableOperation()) {
                    this.mergePresenceTableBatchResults(resolvedBatchData);
                }
                else if (this.isColumnValuesOperation()) {
                    this.mergeColumnValuesBatchResults(resolvedBatchData);
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
            includedProperties: this.includedProperties,
            resultsLimit: this.resultsLimit,
            property: this.columnValuesProperty,
        };
        this.helpers.log(`submitting batchPayload: ${JSON.stringify({
            operation: this.operation,
            features: batch.features.length,
            differenceMultiPolygon: differenceMultiPolygon.length,
            subjectFeature: this.subjectFeature.geometry.type,
            groupBy: this.groupBy,
            includedProperties: this.includedProperties,
            resultsLimit: this.resultsLimit,
        })}`);
        if (this.pool) {
            const result = await this.pool.run(batchPayload).catch((error) => {
                console.error(`Error processing batch in worker: ${error && (error.stack || error.message || error)}`);
                throw error;
            });
            if (this.isPresenceOperation() && result === true) {
                this.presenceOperationEarlyReturn = true;
            }
            return result;
        }
        else {
            if (this.isOverlayAreaOperation()) {
                return this.processOverlayBatch(batch, differenceMultiPolygon);
            }
            else if (this.isCountOperation()) {
                return this.processCountBatch(batch, differenceMultiPolygon);
            }
            else if (this.isPresenceOperation()) {
                return this.processPresenceBatch(batch, differenceMultiPolygon);
            }
            else if (this.isColumnValuesOperation()) {
                return this.processColumnValuesBatch(batch, differenceMultiPolygon);
            }
            else {
                throw new Error(`Unknown operation type: ${this.operation}`);
            }
        }
    }
    async processColumnValuesBatch(batch, differenceMultiPolygon) {
        return (0, clipBatch_1.collectColumnValues)({
            features: batch.features,
            differenceMultiPolygon: differenceMultiPolygon,
            subjectFeature: this.subjectFeature,
            groupBy: this.groupBy,
            property: this.columnValuesProperty,
        }).catch((error) => {
            console.error(`Error collecting column values: ${error.message}`);
            throw error;
        });
    }
    async processOverlayBatch(batch, differenceMultiPolygon) {
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
    async processCountBatch(batch, differenceMultiPolygon) {
        // countFeatures returns { [classKey: string]: number[] } - interim format
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
    async processPresenceBatch(batch, differenceMultiPolygon) {
        return (0, clipBatch_1.testForPresenceInSubject)({
            features: batch.features,
            differenceMultiPolygon: differenceMultiPolygon,
            subjectFeature: this.subjectFeature,
        }).catch((error) => {
            console.error(`Error testing for presence in subject: ${error.message}`);
            throw error;
        });
    }
    mergeOverlayBatchResults(batchResults) {
        const results = this.getOverlayResults();
        for (const batchData of batchResults) {
            const overlayBatchData = batchData;
            for (const classKey in overlayBatchData) {
                if (!(classKey in results)) {
                    results[classKey] = 0;
                }
                results[classKey] += overlayBatchData[classKey];
            }
        }
    }
    mergeCountBatchResults(batchResults) {
        // Merge batch results into interim ID storage
        for (const countBatchData of batchResults) {
            for (const classKey in countBatchData) {
                if (!(classKey in this.countInterimIds)) {
                    this.countInterimIds[classKey] = [];
                }
                const ids = countBatchData[classKey];
                for (const id of ids) {
                    if (!this.countInterimIds[classKey].includes(id)) {
                        this.countInterimIds[classKey].push(id);
                    }
                }
            }
        }
    }
    mergeColumnValuesBatchResults(batchResults) {
        const results = this.getColumnValuesResults();
        for (const batchData of batchResults) {
            for (const classKey in batchData) {
                if (!(classKey in results)) {
                    results[classKey] = [];
                }
                results[classKey].push(...batchData[classKey]);
            }
        }
        // Sort all results by oidx (first element of tuple)
        for (const classKey in results) {
            results[classKey].sort((a, b) => a[0] - b[0]);
        }
    }
    /**
     * Finalizes count results by converting interim ID arrays to UniqueIdIndex
     * and calculating counts. Called at the end of calculate().
     */
    finalizeCountResults() {
        const finalResults = {};
        for (const classKey in this.countInterimIds) {
            const ids = this.countInterimIds[classKey];
            // Create UniqueIdIndex from the array of IDs
            const uniqueIdIndex = (0, uniqueIdIndex_1.createUniqueIdIndex)(ids);
            // Calculate count from the index
            const count = (0, uniqueIdIndex_1.countUniqueIds)(uniqueIdIndex);
            finalResults[classKey] = {
                count,
                uniqueIdIndex,
            };
        }
        this.results = finalResults;
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
    addIndividualFeatureToResults(feature) {
        if (this.isOverlayAreaOperation()) {
            this.addOverlayFeatureToTotals(feature);
        }
        else if (this.isCountOperation()) {
            this.addCountFeatureToTotals(feature);
        }
        else if (this.isPresenceTableOperation()) {
            this.addPresenceTableFeatureToResults(feature);
        }
        else if (this.isColumnValuesOperation()) {
            this.addColumnValuesFeatureToResults(feature);
        }
    }
    addColumnValuesFeatureToResults(feature) {
        var _a, _b;
        const value = (_a = feature.properties) === null || _a === void 0 ? void 0 : _a[this.columnValuesProperty];
        const results = this.getColumnValuesResults();
        if (typeof value === "number") {
            if (!("__oidx" in feature.properties || {})) {
                throw new Error("Feature properties must contain __oidx");
            }
            const oidx = feature.properties.__oidx;
            if (oidx === undefined || oidx === null) {
                throw new Error("Feature properties must contain __oidx");
            }
            const identifiedValue = [oidx, value];
            results["*"].push(identifiedValue);
            if (this.groupBy) {
                const classKey = (_b = feature.properties) === null || _b === void 0 ? void 0 : _b[this.groupBy];
                if (classKey) {
                    if (!(classKey in results)) {
                        results[classKey] = [];
                    }
                    results[classKey].push(identifiedValue);
                }
            }
        }
    }
    addOverlayFeatureToTotals(feature) {
        var _a, _b;
        // get area in square kilometers
        const area = ((_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__area)
            ? feature.properties.__area
            : (0, area_1.default)(feature) * 1e-6;
        const results = this.getOverlayResults();
        results["*"] = (results["*"] || 0) + area;
        if (this.groupBy) {
            const classKey = (_b = feature.properties) === null || _b === void 0 ? void 0 : _b[this.groupBy];
            if (classKey) {
                results[classKey] = (results[classKey] || 0) + area;
            }
        }
    }
    addCountFeatureToTotals(feature) {
        var _a;
        if (!("__oidx" in feature.properties || {})) {
            throw new Error("Feature properties must contain __oidx");
        }
        const oidx = feature.properties.__oidx;
        if (oidx === undefined || oidx === null) {
            throw new Error("Feature properties must contain __oidx");
        }
        // Add to interim ID storage
        if (!this.countInterimIds["*"].includes(oidx)) {
            this.countInterimIds["*"].push(oidx);
        }
        // Count the feature (or points in MultiPoint)
        if (this.groupBy) {
            const classKey = (_a = feature.properties) === null || _a === void 0 ? void 0 : _a[this.groupBy];
            if (classKey) {
                if (!(classKey in this.countInterimIds)) {
                    this.countInterimIds[classKey] = [];
                }
                if (!this.countInterimIds[classKey].includes(oidx)) {
                    this.countInterimIds[classKey].push(oidx);
                }
            }
        }
    }
    addPresenceTableFeatureToResults(feature) {
        var _a;
        const id = (_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__oidx;
        if (id === undefined || id === null) {
            throw new Error("Feature properties must contain __oidx");
        }
        this.addToPresenceTableResults({
            __id: id,
            ...(0, clipBatch_1.pick)(feature.properties, this.includedProperties),
        });
    }
    addToPresenceTableResults(value) {
        const results = this.getPresenceTableResults();
        if (!results.values.find((v) => v.__id === value.__id)) {
            results.values.push(value);
        }
    }
    mergePresenceTableBatchResults(batchResults) {
        const results = this.getPresenceTableResults();
        for (const batchData of batchResults) {
            if (batchData.exceededLimit) {
                results.exceededLimit = true;
            }
            for (const value of batchData.values) {
                this.addToPresenceTableResults(value);
            }
        }
        if (results.values.length >= this.resultsLimit) {
            results.exceededLimit = true;
            results.values = results.values.slice(0, this.resultsLimit);
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
exports.OverlayEngineBatchProcessor = OverlayEngineBatchProcessor;
//# sourceMappingURL=OverlayEngineBatchProcessor.js.map