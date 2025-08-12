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
exports.clipToGeography = clipToGeography;
exports.clipSketchToPolygons = clipSketchToPolygons;
exports.clipToGeographies = clipToGeographies;
exports.calculateArea = calculateArea;
const cql2_1 = require("./cql2");
const polygonClipping = __importStar(require("polygon-clipping"));
const fragments_1 = require("./fragments");
const area_1 = __importDefault(require("@turf/area"));
const unionAtAntimeridian_1 = require("./utils/unionAtAntimeridian");
const polygonClipping_1 = require("./utils/polygonClipping");
/**
 * Clips a sketch to a geography defined by one or more clipping layers.
 *
 * This function is designed to be flexible in how it handles the CPU and
 * memory-intensive polygon clipping operations. The actual clipping work is
 * delegated to the provided `clippingFn`, allowing different deployment
 * strategies:
 *
 * 1. If you just want to do clipping in the same process, use an inline
 *    function paired with SourceCache and clipSketchToPolygons() as in the
 *    example below.
 * 2. On node.js, you may want to use worker threads to offload the clipping
 *    work to a separate process.
 * 3. On Cloudflare Workers, you can use a DurableObject to handle the
 *    clipping work and communicate over RPC.
 * 4. In a browser client, it probably makes sense to use a Web Worker to
 *    offload the clipping work to a separate process.
 *
 * If the sketch is completely outside all INTERSECT layers, it returns null.
 * Otherwise, it combines the results of all clipping operations to produce the
 * final geometry.
 *
 * @param preparedSketch - The sketch to clip, wrapped in a PreparedSketch
 *                        object that includes both the feature and its bounding
 *                        envelopes. Use prepareSketch() to create this.
 * @param clippingLayers - Array of clipping layer configurations. Must include
 *                        at least one INTERSECT operation
 * @param clippingFn - Function that performs the actual clipping operation.
 *                    This function is responsible for fetching geometries and
 *                    performing the clipping, allowing for different deployment
 *                    strategies
 * @returns The clipped sketch feature, or null if the sketch is completely
 *          outside the geography
 * @throws Error if no INTERSECT layers are provided
 *
 * @example
 *
 * // Simple example without multi-threading or DurableObjects
 *
 * const sourceCache = new SourceCache("50mb");
 * const preparedSketch = prepareSketch(sketch);
 *
 * const offshoreZoneGeography = [
 *   {
 *     source: "https://uploads.seasketch.org/eez-land-joined.fgb",
 *     op: "INTERSECT",
 *     cql2Query: { op: "=", args: [{ property: "name" }, "US"] }
 *   },
 *   {
 *     source: "https://uploads.seasketch.org/territorial-sea-land-joined.fgb",
 *     op: "DIFFERENCE",
 *   }
 * ];
 *
 * const result = await clipToGeography(
 *   preparedSketch,
 *   offshoreZoneGeography,
 *   async (sketch, source, op, query) => {
 *     const fgbSource = await sourceCache.get(source);
 *     return clipSketchToPolygons(
 *       sketch,
 *       op,
 *       query,
 *       fgbSource.getFeaturesAsync(sketch.envelopes)
 *     );
 *   }
 * );
 */
async function clipToGeography(preparedSketch, clippingLayers, clippingFn) {
    clippingLayers = consolidateClippingLayers(clippingLayers);
    // ensure there's at least one INTERSECT layer
    const intersectLayers = clippingLayers.filter((layer) => layer.op === "INTERSECT");
    if (intersectLayers.length === 0) {
        throw new Error("At least one INTERSECT layer is required");
    }
    const differenceLayers = clippingLayers.filter((layer) => layer.op === "DIFFERENCE");
    // Kick off the clipping operations in parallel, starting with the INTERSECT
    // layers.
    const intersectResults = Promise.all(intersectLayers.map((layer) => clippingFn(preparedSketch, layer.source, "INTERSECT", layer.cql2Query)));
    const differenceResults = Promise.all(differenceLayers.map((layer) => clippingFn(preparedSketch, layer.source, "DIFFERENCE", layer.cql2Query)));
    let results = await intersectResults;
    // if all intersect results are null, the sketch is completely outside
    // the geography
    if (!results.find((r) => r.output !== null)) {
        // Fire and forget, but handle errors to avoid unhandled promise rejections
        differenceResults.catch(() => { });
        return null;
    }
    results.push(...(await differenceResults));
    const features = [];
    let anyChanges = false;
    for (const result of results) {
        if (result.changed) {
            anyChanges = true;
            if (result.output !== null) {
                // We've already checked to make sure the sketch is within at least one
                // intersect layer, so we can safely ignore null outputs.
                features.push(result.output);
            }
        }
    }
    // filter out features with empty coordinates
    let filteredFeatures = features
        .filter((f) => f.geometry.coordinates.length > 0)
        .filter((f) => f.geometry.coordinates[0].length > 0);
    if (anyChanges === false) {
        return preparedSketch.feature;
    }
    else if (filteredFeatures.length === 0) {
        return null;
    }
    else {
        const intersection = polygonClipping.intersection(features[0].geometry.coordinates, ...filteredFeatures
            .slice(1)
            .map((f) => f.geometry.coordinates));
        return {
            ...preparedSketch.feature,
            geometry: {
                ...preparedSketch.feature.geometry,
                coordinates: intersection,
            },
        };
    }
}
/**
 * Consolidates clipping layers that share the same source and operation by
 * combining their CQL2 queries. This optimization reduces the number of
 * clipping operations needed by merging compatible layers.
 *
 * For example, if two layers both intersect with the same source but have
 * different CQL2 filters, they will be combined into a single layer with a
 * merged CQL2 query using an OR operator.
 *
 * @example
 * // These layers:
 * [
 *   { source: "eez", op: "INTERSECT", cql2Query: { op: "=", args: [{ property: "name" }, "US"] } },
 *   { source: "eez", op: "INTERSECT", cql2Query: { op: "=", args: [{ property: "name" }, "Mexico"] } }
 * ]
 * // Will be consolidated to:
 * [
 *   {
 *     source: "eez",
 *     op: "INTERSECT",
 *     cql2Query: {
 *       or: [
 *         { op: "=", args: [{ property: "name" }, "US"] },
 *         { op: "=", args: [{ property: "name" }, "Mexico"] }
 *       ]
 *     }
 *   }
 * ]
 */
function consolidateClippingLayers(clippingLayers) {
    let unconsolidated = [...clippingLayers];
    let consolidated = [];
    while (unconsolidated.length > 0) {
        const layer = unconsolidated.shift();
        if (layer) {
            // look through consolidated layers for a match. If there is a match,
            // combine the cql2Query's and remove the layer from unconsolidated.
            // If there is no match, add the layer to consolidated.
            const match = consolidated.find((l) => l.source === layer.source && l.op === layer.op);
            if (match) {
                match.cql2Query = (0, cql2_1.consolidateCql2Queries)(match.cql2Query, layer.cql2Query);
            }
            else {
                consolidated.push(layer);
            }
        }
    }
    return consolidated;
}
/**
 * Performs a single clipping operation between a sketch and a set of polygons.
 *
 * This is a lower-level function that is typically used by the clippingFn
 * passed to clipToGeography(). It handles the actual polygon clipping operation
 * using the polygon-clipping library, which is CPU and memory intensive.
 *
 * The function first collects all polygons from the provided source that
 * intersect with the sketch's envelopes and match the optional CQL2 query. It
 * then performs either an INTERSECT or DIFFERENCE operation between the sketch
 * and the collected polygons.
 *
 * For INTERSECT operations:
 * - If no polygons are found, returns { changed: true, output: null }
 * - If the sketch is completely within the polygons, returns { changed: false, output: sketch }
 * - If polygons are found, returns the intersection of the sketch with all
 *   polygons
 *
 * For DIFFERENCE operations:
 * - If no polygons intersect, returns { changed: false, output: sketch }
 * - If the sketch is completely outside the layer, returns { changed: true, output: null }
 * - If polygons are found, returns the difference of the sketch minus all
 *   polygons
 *
 * @param preparedSketch - The sketch to clip, wrapped in a PreparedSketch
 * object
 * @param op - The clipping operation to perform: "INTERSECT" or "DIFFERENCE"
 * @param cql2Query - Optional CQL2 query to filter which polygons are used for
 * clipping
 * @param polygonSource - Async iterable that yields polygon features. Typically
 *                       this would be the result of
 *                       fgbSource.getFeaturesAsync()
 * @returns A PolygonClipResult object containing: - changed: whether the sketch
 *          was modified by the operation - output: the resulting geometry, or
 *          null if the operation eliminated the sketch entirely - op: the
 *          operation that was performed
 *
 * @example
 * // Using with fgb-source
 * const source = await createSource("https://example.com/polygons.fgb");
 * const result = await clipSketchToPolygons(
 *   preparedSketch,
 *   "INTERSECT",
 *   { op: "=", args: [{ property: "type" }, "marine"] },
 *   source.getFeaturesAsync(preparedSketch.envelopes)
 * );
 */
async function clipSketchToPolygons(preparedSketch, op, cql2Query, polygonSource) {
    const polygons = [];
    for await (const feature of polygonSource) {
        if (cql2Query && !(0, cql2_1.evaluateCql2JSONQuery)(cql2Query, feature.properties)) {
            continue;
        }
        // // determine if the geometry is a polygon or a multipolygon, so that it can
        // // be added to the polygons array
        if (feature.geometry.type === "Polygon") {
            polygons.push(feature.geometry.coordinates);
        }
        else if (feature.geometry.type === "MultiPolygon") {
            polygons.push(...feature.geometry.coordinates.map((p) => p));
        }
    }
    if (polygons.length === 0 && op === "INTERSECT") {
        return { changed: true, output: null, op };
    }
    else if (polygons.length === 0 && op === "DIFFERENCE") {
        return { changed: false, output: preparedSketch.feature, op };
    }
    let output;
    if (op === "INTERSECT") {
        output = polygonClipping.intersection(preparedSketch.feature.geometry.coordinates, polygons);
    }
    else if (op === "DIFFERENCE") {
        output = polygonClipping.difference(preparedSketch.feature.geometry.coordinates, polygons);
    }
    else {
        throw new Error(`Unknown operation: ${op}`);
    }
    if (output.length === 0) {
        return { changed: true, output: null, op };
    }
    return {
        changed: JSON.stringify(output) !==
            JSON.stringify(preparedSketch.feature.geometry.coordinates),
        output: {
            ...preparedSketch.feature,
            geometry: { ...preparedSketch.feature.geometry, coordinates: output },
        },
        op,
    };
}
/**
 * Clips a prepared sketch to a set of geographies, and returns the clipped
 * sketch and the fragments that were generated.
 *
 * @param preparedSketch - The sketch to clip, wrapped in a PreparedSketch
 * object that includes both the feature and its bounding envelopes. Use
 * prepareSketch() to create this.
 * @param geographies - All the geographies that will be used for clipping and
 * fragment generation.
 * @param geographiesForClipping - The IDs of the geographies that will be
 * used for clipping. Throws an error if no geographies are specified. If more
 * that one geography is specified, the geography with the most overlap will be
 * the one clipped to.
 * @param existingSketchFragments - Any sketch fragments from sketches in the
 * same collection. For performance reasons, it's best to pass only the
 * fragments which overlap the sketch of interest, using psql's spatial index.
 * @param existingSketchId - The ID of the sketch, if it already exists. This
 * will be compared with existingSketchFragments, to filter out old fragments
 * and consolidate existing fragmentation with it's neighbors.
 * @param clippingFn - The function to use for clipping.
 * @returns
 */
async function clipToGeographies(preparedSketch, geographies, geographiesForClipping, existingSketchFragments, existingSketchId, clippingFn) {
    // Create fragments for all overlapping geographies
    let fragments = (await (0, fragments_1.createFragments)(preparedSketch, geographies, clippingFn)).map((f) => ({
        ...f,
        properties: {
            ...f.properties,
            __sketchIds: [0],
        },
    }));
    // Now, we need to figure out if there are any fragments that are within the
    // clipping geographies, and count how many overlapping clipping geographies
    // there are.
    const fragmentsInClippingGeographies = [];
    const matchingGeographyIds = new Set();
    for (const fragment of fragments) {
        for (const geographyId of fragment.properties.__geographyIds || []) {
            if (geographiesForClipping.includes(geographyId)) {
                fragmentsInClippingGeographies.push(fragment);
                matchingGeographyIds.add(geographyId);
            }
        }
    }
    // Early return if no overlap
    if (fragmentsInClippingGeographies.length === 0) {
        return {
            clipped: null,
            fragments,
        };
    }
    // clippedFragments will need to end up being all the fragments belonging to
    // the biggest geography.
    let clippedFragments;
    let primaryGeographyId = Array.from(matchingGeographyIds)[0];
    if (matchingGeographyIds.size === 1) {
        // If there's only one overlap, we can use the fragments as is.
        clippedFragments = fragmentsInClippingGeographies;
    }
    else {
        // If there is overlap with more than one clipping geography, we need to
        // choose the one with the most overlap. We'll do that by first calculating
        // the area of each fragment, then summing the areas of the fragments by
        // geography, and picking the biggest one. We'll replace clippedFragments with
        // the fragments that belong to the biggest geography.
        const areaByGeographyId = {};
        // prepopulate with 0
        for (const geographyId of Array.from(matchingGeographyIds)) {
            areaByGeographyId[geographyId] = 0;
        }
        // calculate areas first
        for (const fragment of fragmentsInClippingGeographies) {
            const val = (0, area_1.default)(fragment);
            for (const geographyId of fragment.properties.__geographyIds) {
                areaByGeographyId[geographyId] += val;
            }
        }
        // find the geography with the most area
        let biggest = 0;
        let biggestGeographyId = null;
        for (const geographyId in areaByGeographyId) {
            if (areaByGeographyId[geographyId] > biggest) {
                biggest = areaByGeographyId[geographyId];
                biggestGeographyId = Number(geographyId);
            }
        }
        if (!biggestGeographyId) {
            throw new Error("No biggest geography id");
        }
        primaryGeographyId = biggestGeographyId;
        clippedFragments = fragmentsInClippingGeographies.filter((f) => f.properties.__geographyIds.includes(biggestGeographyId));
    }
    // filter the fragments to only include the primary geography
    fragments = fragments.filter((f) => f.properties.__geographyIds.includes(primaryGeographyId));
    // union the fragments to get the final clipped geometry using polygon-clipping
    const geometry = (0, polygonClipping_1.union)(clippedFragments.map((f) => f.geometry.coordinates));
    const clipped = {
        ...preparedSketch.feature,
        geometry: {
            ...preparedSketch.feature.geometry,
            coordinates: geometry,
        },
    };
    // Finally, deal with overlap between generated fragments, and those already
    // in the existingSketchFragments argument (sketches in the same collection)
    if (existingSketchFragments.length > 0) {
        if (existingSketchId) {
            // if there's an existing sketchId, that means existingSketchFragments
            // might contain fragments that already exist in the database for this
            // sketch, which are stale and need to be filtered out. Importantly, it
            // also means that fragments generated by decomposing overlap with it's
            // neighbors may also exist. This needs to be consolidated so that the
            // fragmenting process doesn't just create more and more fragments as the
            // collection is edited.
            const consolidatedFragments = [];
            for (const fragment of existingSketchFragments) {
                if (fragment.properties.__sketchIds.includes(existingSketchId) &&
                    fragment.properties.__sketchIds.length === 1) {
                    // this fragment belongs to the existing sketch, and only the existing sketch
                    // so we can remove it from the list
                    continue;
                }
                // for all others, remove sketchId from the __sketchIds array if
                // present, and combine fragments which share the same __geographyIds
                // into a single fragment.
                for (const sketchId of fragment.properties.__sketchIds) {
                    if (sketchId === existingSketchId) {
                        // this fragment belongs to the existing sketch, and only the existing sketch
                        // so we can remove it from the list
                        continue;
                    }
                    // find a fragment with the same sketchId and __geographyIds
                    const consolidatedFragment = consolidatedFragments.find((f) => f.properties.__sketchIds.length === 1 &&
                        f.properties.__sketchIds.includes(sketchId) &&
                        f.properties.__geographyIds.length ===
                            fragment.properties.__geographyIds.length &&
                        f.properties.__geographyIds.every((id) => fragment.properties.__geographyIds.includes(id)));
                    if (consolidatedFragment) {
                        // add the fragment to the consolidated fragment
                        consolidatedFragment.geometry.coordinates = (0, polygonClipping_1.union)([
                            consolidatedFragment.geometry.coordinates,
                            fragment.geometry.coordinates,
                        ]);
                    }
                    else {
                        // create a new consolidated fragment
                        consolidatedFragments.push({
                            ...fragment,
                            properties: {
                                ...fragment.properties,
                                __sketchIds: [sketchId],
                                __geographyIds: fragment.properties.__geographyIds.filter((id) => id !== existingSketchId),
                            },
                            geometry: {
                                type: "MultiPolygon",
                                coordinates: [fragment.geometry.coordinates],
                            },
                        });
                    }
                }
            }
            existingSketchFragments = [];
            for (const consolidatedFragment of consolidatedFragments) {
                for (const coordinates of consolidatedFragment.geometry.coordinates) {
                    existingSketchFragments.push({
                        type: "Feature",
                        geometry: { type: "Polygon", coordinates },
                        properties: consolidatedFragment.properties,
                    });
                }
            }
        }
        fragments = (0, fragments_1.eliminateOverlap)(fragments, existingSketchFragments);
    }
    return {
        clipped: (0, unionAtAntimeridian_1.unionAtAntimeridian)(clipped),
        fragments,
    };
}
async function calculateArea(geography, sourceCache) {
    // first, fetch all intersection layers and union the features
    const intersectionLayers = geography.filter((l) => l.op === "INTERSECT");
    const differenceLayers = geography.filter((l) => l.op === "DIFFERENCE");
    const intersectionFeatures = [];
    await Promise.all(intersectionLayers.map(async (l) => {
        const source = await sourceCache.get(l.source);
        for await (const { properties, getFeature, } of source.getFeatureProperties()) {
            if ((0, cql2_1.evaluateCql2JSONQuery)(l.cql2Query, properties)) {
                intersectionFeatures.push(getFeature());
            }
        }
    }));
    console.log("got intersection features", intersectionFeatures.length);
    console.log(JSON.stringify(intersectionFeatures.map((f) => {
        var _a, _b, _c;
        return ({
            name: ((_a = f.properties) === null || _a === void 0 ? void 0 : _a.NAME) || ((_b = f.properties) === null || _b === void 0 ? void 0 : _b.UNION),
            size: (_c = f.properties) === null || _c === void 0 ? void 0 : _c.__byteLength,
        });
    }), null, 2));
    if (differenceLayers.length === 0) {
        const sumArea = intersectionFeatures.reduce((acc, f) => acc + (0, area_1.default)(f), 0);
        // convert to square kilometers
        return sumArea / 1000000;
    }
    else {
        throw new Error("Difference layers not yet implemented");
    }
}
//# sourceMappingURL=geographies.js.map