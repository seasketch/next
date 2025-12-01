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
exports.calculateFragmentOverlap = calculateFragmentOverlap;
const clipping = __importStar(require("polyclip-ts"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const area_1 = __importDefault(require("@turf/area"));
const bboxUtils_1 = require("./utils/bboxUtils");
const helpers_1 = require("./utils/helpers");
const containerIndex_1 = require("./utils/containerIndex");
const simplify_1 = __importDefault(require("@turf/simplify"));
const calculateOverlap_1 = require("./geographies/calculateOverlap");
/**
 *
 * @deprecated Use the OverlappingAreaBatchedClippingProcessor instead.
 */
async function calculateFragmentOverlap(fragment, sourceCache, sourceUrl, sourceType, groupBy, helpersOption) {
    var _a, _b;
    const helpers = (0, helpers_1.guaranteeHelpers)(helpersOption);
    if (sourceType !== "FlatGeobuf") {
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
    let totalAreas = {};
    const bbox = (0, bbox_1.default)(fragment);
    const envelope = (0, bboxUtils_1.bboxToEnvelope)(bbox);
    const geom = fragment.geometry.coordinates;
    let featuresProcessed = 0;
    helpers.time("initializing source");
    const source = await sourceCache.get(sourceUrl, {
        pageSize: "5MB",
    });
    helpers.time("Creating container index");
    const containerIndex = new containerIndex_1.ContainerIndex((0, simplify_1.default)(fragment, {
        tolerance: 0.002,
    }));
    helpers.timeEnd("Creating container index");
    helpers.timeEnd("initializing source");
    const estimate = await source.search(envelope);
    helpers.log(`Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}`);
    helpers.progress(0, `Processing ${estimate.features} features`);
    const queryPlan = source.createPlan(envelope);
    console.log(`Query plan: ${queryPlan.pages.length} pages, ${queryPlan.pages.reduce((acc, page) => { var _a, _b; return acc + ((_a = page.range[1]) !== null && _a !== void 0 ? _a : 0) - ((_b = page.range[0]) !== null && _b !== void 0 ? _b : 0); }, 0)} bytes`);
    helpers.time("time to first feature");
    let clippingPerformed = 0;
    const clippingBatchProcessor = new BatchProcessor(1024 * 1024 * 5, (batch) => {
        console.time("clipping batch");
        console.log(`processing batch of ${batch.length} features`);
        const geoms = (0, calculateOverlap_1.groupGeomsByClassKey)(batch, groupBy);
        console.log(`grouped into ${Object.keys(geoms).length} classes`);
        for (const classKey in geoms) {
            console.log(`processing class ${classKey}. ${geoms[classKey].length} geoms`);
            const intersection = clipping.intersection(geom, ...geoms[classKey]);
            totalAreas[classKey] +=
                (0, area_1.default)({
                    type: "Feature",
                    geometry: { type: "MultiPolygon", coordinates: intersection },
                    properties: {},
                }) / 1000000;
            clippingPerformed++;
        }
        console.timeEnd("clipping batch");
    });
    for await (const feature of source.getFeaturesAsync(envelope, {
        queryPlan,
    })) {
        if (featuresProcessed === 0) {
            helpers.timeEnd("time to first feature");
        }
        featuresProcessed++;
        const percent = (featuresProcessed / estimate.features) * 100;
        helpers.progress(percent, `Processing features: (${featuresProcessed}/${estimate.features})`);
        const classKey = groupBy ? feature.properties[groupBy] : "*";
        if (!totalAreas[classKey]) {
            totalAreas[classKey] = 0;
        }
        const classification = containerIndex.classify(feature);
        if (classification === "outside") {
            // console.log(`outside ${featuresProcessed}/${estimate.features}`);
            continue;
        }
        else if (classification === "mixed") {
            // console.log(`mixed ${featuresProcessed}/${estimate.features}`);
            // clippingPerformed++;
            // const clipped = clipping.intersection(
            //   geom,
            //   feature.geometry.coordinates as clipping.Geom
            // );
            // totalAreas[classKey] +=
            //   calcArea({
            //     type: "Feature",
            //     geometry: {
            //       type: "MultiPolygon",
            //       coordinates: clipped,
            //     },
            //     properties: {},
            //   }) / 1_000_000;
            clippingBatchProcessor.addFeature(feature);
        }
        else {
            if (((_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__area) === undefined) {
                console.warn(`undefined area in completely-inside feature. ${featuresProcessed}/${estimate.features}`);
            }
            // completely inside
            totalAreas[classKey] +=
                ((_b = feature.properties) === null || _b === void 0 ? void 0 : _b.__area) || (0, area_1.default)(feature) / 1000000;
        }
    }
    clippingBatchProcessor.flush();
    console.log(`clipping performed: ${clippingPerformed}, features processed: ${featuresProcessed}`);
    if (groupBy) {
        return totalAreas;
    }
    return totalAreas["*"];
}
class BatchProcessor {
    constructor(batchSize, processBatch) {
        this.batch = [];
        this.bytes = 0;
        this.batchSize = batchSize;
        this.processBatch = processBatch;
    }
    addFeature(feature) {
        var _a;
        if (this.batch.length >= this.batchSize) {
            this.processBatch(this.batch);
            this.batch = [];
            this.bytes = 0;
        }
        this.batch.push(feature);
        this.bytes += ((_a = feature.properties) === null || _a === void 0 ? void 0 : _a.__byteLength) || 0;
    }
    flush() {
        this.processBatch(this.batch);
        this.batch = [];
        this.bytes = 0;
    }
}
//# sourceMappingURL=calculateFragmentOverlap.js.map