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
async function calculateGeographyOverlap(geography, sourceCache, sourceUrl, sourceType, groupBy, helpersOption) {
    let differenceReferences = 0;
    const helpers = (0, helpers_1.guaranteeHelpers)(helpersOption);
    if (sourceType !== "FlatGeobuf") {
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
    const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } = await (0, geographies_1.initializeGeographySources)(geography, sourceCache, helpers);
    const differenceSources = await Promise.all(differenceLayers.map(async (layer) => {
        const diffSource = await sourceCache.get(layer.source);
        return {
            cql2Query: layer.cql2Query,
            source: diffSource,
        };
    }));
    helpers.log("initialized geography sources");
    let progress = 0;
    let featuresProcessed = 0;
    helpers.time("initializing layer source");
    const source = await sourceCache.get(sourceUrl);
    helpers.timeEnd("initializing layer source");
    const envelope = (0, bboxUtils_1.bboxToEnvelope)((0, bbox_1.bbox)(intersectionFeatureGeojson));
    const estimate = await source.countAndBytesForQuery(envelope);
    helpers.log(`Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}, requests: ${estimate.requests}`);
    helpers.progress(progress, `Processing ${estimate.features} features`);
    helpers.time("time to first feature");
    const areaByClassId = { "*": 0 };
    const intersectionGeom = intersectionFeatureGeojson.geometry
        .coordinates;
    for await (const feature of source.getFeaturesAsync(envelope)) {
        if (featuresProcessed === 0) {
            helpers.timeEnd("time to first feature");
        }
        featuresProcessed++;
        const percent = (featuresProcessed / estimate.features) * 100;
        await helpers.progress(percent, `Processing features: (${featuresProcessed}/${estimate.features})`);
        let intersection = clipping.intersection(intersectionGeom, feature.geometry.coordinates);
        if (differenceSources.length > 0) {
            for (const diffLayer of differenceSources) {
                let differenceGeoms = [];
                const featureEnvelope = (0, bboxUtils_1.bboxToEnvelope)((0, bbox_1.bbox)(feature.geometry));
                for await (const differenceFeature of diffLayer.source.getFeaturesAsync(featureEnvelope)) {
                    differenceReferences++;
                    if (!diffLayer.cql2Query ||
                        (0, cql2_1.evaluateCql2JSONQuery)(diffLayer.cql2Query, differenceFeature.properties)) {
                        differenceGeoms.push(differenceFeature.geometry.coordinates);
                    }
                }
                if (differenceGeoms.length > 0) {
                    console.log("difference geoms", differenceGeoms.length);
                    intersection = clipping.difference(intersection, ...differenceGeoms);
                }
                else {
                    console.log("no difference geoms");
                }
            }
        }
        const area = (0, area_1.default)({
            type: "Feature",
            properties: {},
            geometry: {
                type: "MultiPolygon",
                coordinates: intersection,
            },
        }) / 1000000;
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
    console.log("difference references", differenceReferences);
    return areaByClassId;
}
//# sourceMappingURL=calculateOverlap.js.map