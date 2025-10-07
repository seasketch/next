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
async function calculateFragmentOverlap(fragment, sourceCache, sourceUrl, sourceType, groupBy, helpersOption) {
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
    const source = await sourceCache.get(sourceUrl);
    helpers.timeEnd("initializing source");
    const estimate = await source.countAndBytesForQuery(envelope);
    helpers.log(`Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}`);
    helpers.progress(0, `Processing ${estimate.features} features`);
    helpers.time("time to first feature");
    for await (const feature of source.getFeaturesAsync(envelope)) {
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
        const clipped = clipping.intersection(geom, feature.geometry.coordinates);
        totalAreas[classKey] +=
            (0, area_1.default)({
                type: "Feature",
                geometry: {
                    type: "MultiPolygon",
                    coordinates: clipped,
                },
                properties: {},
            }) / 1000000;
    }
    if (groupBy) {
        return totalAreas;
    }
    return totalAreas["*"];
}
//# sourceMappingURL=calculateFragmentOverlap.js.map