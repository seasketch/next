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
exports.createFragments = createFragments;
exports.eliminateOverlap = eliminateOverlap;
exports.mergeTouchingFragments = mergeTouchingFragments;
exports.mergeTouchingFragmentGroup = mergeTouchingFragmentGroup;
const geographies_1 = require("./geographies");
const polygonClipping = __importStar(require("polygon-clipping"));
const cleanCoords_1 = require("./utils/cleanCoords");
const utils_1 = require("./utils/utils");
const bbox_1 = __importDefault(require("@turf/bbox"));
const boolean_equal_1 = __importDefault(require("@turf/boolean-equal"));
const boolean_intersects_1 = __importDefault(require("@turf/boolean-intersects"));
const bboxUtils_1 = require("./utils/bboxUtils");
const area_1 = __importDefault(require("@turf/area"));
const boolean_touches_1 = __importDefault(require("@turf/boolean-touches"));
const bbox_polygon_1 = __importDefault(require("@turf/bbox-polygon"));
let idCounter = 0;
async function createFragments(preparedSketch, geographies, clippingFn) {
    if (idCounter > 1000000) {
        console.warn("resetting idCounter");
        idCounter = 0;
    }
    let fragments = [];
    await Promise.all(geographies.map(async (geography) => {
        const result = await (0, geographies_1.clipToGeography)(preparedSketch, geography.clippingLayers, clippingFn);
        if (!result) {
            return null;
        }
        else {
            fragments.push(...(0, utils_1.multiPartToSinglePart)({
                type: "Feature",
                properties: {
                    __geographyIds: [geography.id],
                    __id: idCounter++,
                    ...result.properties,
                },
                geometry: result.geometry,
            })
                .map((f) => (0, cleanCoords_1.cleanCoords)(f))
                .map((f) => ({
                ...f,
                properties: {
                    ...f.properties,
                    __id: idCounter++,
                },
            })));
        }
    }));
    // compute bounding box and assign one to each PendingFragmentResult
    for (const fragment of fragments) {
        fragment.bbox = (0, bbox_1.default)(fragment, { recompute: true });
    }
    // decompose fragments, assigning them to geographies, until there is no
    // overlap between any two fragments.
    const output = buildFragments(fragments).map((f) => ({
        ...f,
        properties: {
            __geographyIds: f.properties.__geographyIds,
            __id: f.properties.__id,
        },
    }));
    return output.filter((f) => (0, area_1.default)(f) > 1);
}
function buildFragments(fragments) {
    // find any fragments that overlap with other fragments, and split them into
    // new fragments that will later be merged.
    fragments = decomposeFragments(fragments, ["__geographyIds"]);
    // merge any fragments that have the exact same geometry, associating them
    // with all applicable geographies.
    fragments = mergeFragmentsWithMatchingGeometry(fragments, ["__geographyIds"]);
    return fragments;
}
function mergeFragmentsWithMatchingGeometry(fragments, numericPropertiesToMerge) {
    const removedFragments = new Set();
    const mergedFragments = [];
    // compare each fragment to all other fragments, merging them into a single
    // fragment if they have the same geometry. If no matches are found, the
    // unchanged fragment is added to the mergedFragments array.
    // If a fragment has been merged, it is added to the removedFragments set so
    // that it can be skipped by the processing loop.
    for (const fragment of fragments) {
        if (removedFragments.has(fragment.properties.__id)) {
            continue;
        }
        removedFragments.add(fragment.properties.__id);
        const mergedIds = new Set();
        for (const other of fragments) {
            if (fragment === other || removedFragments.has(other.properties.__id)) {
                continue;
            }
            if ((0, bboxUtils_1.bboxIntersects)(fragment.bbox, other.bbox) &&
                (0, boolean_equal_1.default)(fragment.geometry, other.geometry)) {
                fragment.properties = {
                    ...fragment.properties,
                    ...mergeNumericProperties(fragment.properties, other.properties, numericPropertiesToMerge),
                };
                removedFragments.add(other.properties.__id);
                mergedIds.add(other.properties.__id);
            }
        }
        if (mergedIds.size > 0) {
            const mergeOutput = {
                ...fragment,
                properties: {
                    ...fragment.properties,
                },
            };
            mergedFragments.push(mergeOutput);
        }
        else {
            mergedFragments.push(fragment);
        }
    }
    return mergedFragments;
}
// Eliminates overlap between fragments by splitting them into new fragments.
// Will run recursively until there is no overlap between any two fragments.
function decomposeFragments(fragments, numericPropertiesToMerge, loopCount = 0) {
    const startingLength = fragments.length;
    if (loopCount > 100) {
        throw new Error("Loop count exceeded");
    }
    let anyOverlap = false;
    const outputFragments = [];
    const processedFragments = new Set();
    for (const fragment of fragments) {
        if (processedFragments.has(fragment.properties.__id)) {
            continue;
        }
        let foundOverlap = false;
        for (const f of fragments) {
            if (f === fragment || processedFragments.has(f.properties.__id)) {
                continue;
            }
            if ((0, bboxUtils_1.bboxIntersects)(fragment.bbox, f.bbox) &&
                (0, boolean_intersects_1.default)(fragment, f)) {
                const newFragments = splitFragments(fragment, f, numericPropertiesToMerge);
                if (newFragments) {
                    anyOverlap = true;
                    processedFragments.add(fragment.properties.__id);
                    processedFragments.add(f.properties.__id);
                    outputFragments.push(...newFragments);
                    foundOverlap = true;
                    break;
                }
            }
        }
        if (!foundOverlap) {
            processedFragments.add(fragment.properties.__id);
            outputFragments.push(fragment);
        }
    }
    // TODO: This can be removed once we're sure the algorithm is working
    // correctly. Otherwise it's just going to make the calculation slower.
    // ensure that there are no duplicate ids
    const ids = new Set();
    for (const fragment of outputFragments) {
        if (ids.has(fragment.properties.__id)) {
            throw new Error(`Duplicate id: ${fragment.properties.__id}`);
        }
        ids.add(fragment.properties.__id);
    }
    // const anyOverlap = startingLength !== outputFragments.length;
    if (anyOverlap) {
        return decomposeFragments(outputFragments, numericPropertiesToMerge, loopCount + 1);
    }
    else {
        return outputFragments;
    }
}
function splitFragments(a, b, numericPropertiesToMerge) {
    // calculates the intersection and difference of the two fragments, and returns
    // the new fragments.
    const intersection = polygonClipping.intersection([a.geometry.coordinates], [b.geometry.coordinates]);
    const differenceA = polygonClipping.difference([a.geometry.coordinates], [b.geometry.coordinates]);
    const differenceB = polygonClipping.difference([b.geometry.coordinates], [a.geometry.coordinates]);
    const newFragments = [];
    if ((intersection === null || intersection === void 0 ? void 0 : intersection.length) > 0) {
        // create a new fragment with the merged geography ids
        for (const geometry of geometryFromCoords(intersection)) {
            newFragments.push({
                ...a,
                properties: {
                    ...a.properties,
                    ...mergeNumericProperties(a.properties, b.properties, numericPropertiesToMerge),
                    __id: idCounter++,
                },
                geometry,
            });
        }
        if ((differenceA === null || differenceA === void 0 ? void 0 : differenceA.length) > 0) {
            for (const geometry of geometryFromCoords(differenceA)) {
                newFragments.push({
                    ...a,
                    properties: {
                        ...a.properties,
                        __id: idCounter++,
                    },
                    geometry,
                });
            }
        }
        if ((differenceB === null || differenceB === void 0 ? void 0 : differenceB.length) > 0) {
            for (const geometry of geometryFromCoords(differenceB)) {
                newFragments.push({
                    ...b,
                    properties: {
                        ...b.properties,
                        __id: idCounter++,
                    },
                    geometry,
                });
            }
        }
    }
    else {
        return null;
    }
    return newFragments;
}
function mergeNumericProperties(a, b, propNames) {
    const mergedProps = {};
    for (const propName of propNames) {
        if ((a && propName in a) || (b && propName in b)) {
            const merged = [];
            if (a && propName in a) {
                if (Array.isArray(a[propName])) {
                    merged.push(...a[propName]);
                }
                else {
                    merged.push(a[propName]);
                }
            }
            if (b && propName in b) {
                if (Array.isArray(b[propName])) {
                    merged.push(...b[propName]);
                }
                else {
                    merged.push(b[propName]);
                }
            }
            const s = new Set(merged);
            // @ts-ignore
            mergedProps[propName] = [...s];
        }
    }
    return mergedProps;
}
function geometryFromCoords(coords) {
    return coords.map((polygon) => ({
        type: "Polygon",
        coordinates: polygon,
    }));
}
/**
 * Sketch Collections may not have overlapping fragments. It is assumed that any
 * overlap between sketches produces additional fragments, similar to how new
 * fragments are created when a sketch overlaps multiple geographies.
 *
 * This function accepts new fragments for a sketch, and merges them with
 * existing fragments in a collection, returning a new collection of fragments
 * that do not overlap.
 *
 * This function can be called with all the existing fragments in a collection,
 * or just the subset of fragments that overlap the bounding box of the new
 * sketch. It will operate correctly in either case, but with better performance
 * on large collections if the spatial index of postgres is used to limit the
 * number of fragments that need to be processed.
 *
 * @param newFragments - The new fragments to add to the collection.
 * @param existingFragments - The existing fragments in the collection.
 * @returns A new collection of fragments that do not overlap.
 */
function eliminateOverlap(newFragments, existingFragments) {
    let idCounter = 0;
    const pendingFragments = [
        ...newFragments.map((f) => ({
            ...f,
            properties: {
                ...f.properties,
                __id: idCounter++,
            },
            bbox: (0, bbox_1.default)(f),
        })),
        ...existingFragments.map((f) => ({
            ...f,
            properties: {
                ...f.properties,
                __id: idCounter++,
            },
            bbox: (0, bbox_1.default)(f),
        })),
    ];
    // compute bounding box for each fragment
    for (const fragment of pendingFragments) {
        fragment.bbox = (0, bbox_1.default)(fragment, { recompute: true });
    }
    // decompose fragments until there is no overlap
    const decomposedFragments = decomposeFragments(pendingFragments, [
        "__sketchIds",
        "__geographyIds",
    ]);
    // merge fragments with matching geometry
    let mergedFragments = mergeFragmentsWithMatchingGeometry(decomposedFragments, ["__geographyIds", "__sketchIds"]).filter((f) => (0, area_1.default)(f) > 1);
    // merge touching fragments with the same key properties
    mergedFragments = mergeTouchingFragments(mergedFragments, [
        "__sketchIds",
        "__geographyIds",
    ]);
    // convert back to SketchFragment type
    return mergedFragments.map((f) => ({
        ...f,
        properties: {
            __geographyIds: f.properties.__geographyIds,
            __sketchIds: f.properties.__sketchIds,
        },
    }));
}
/**
 * Finds fragments that have matching key properties and are touching, and
 * attempts to merge them into a single fragment if their intersection results
 * in a single polygon.
 *
 * Uses a connected components algorithm to find all fragments that can be
 * merged through chains of touching fragments, not just direct neighbors.
 * Makes multiple passes until no more merges are possible.
 */
function mergeTouchingFragments(fragments, keyNumericProperties) {
    if (fragments.length < 2) {
        return fragments;
    }
    let currentFragments = [...fragments];
    let hasChanges = true;
    let passCount = 0;
    const maxPasses = 10; // Prevent infinite loops
    while (hasChanges && passCount < maxPasses) {
        hasChanges = false;
        passCount++;
        const mergedFragments = [];
        // Group fragments by their key properties
        const fragmentsByKey = new Map();
        for (const fragment of currentFragments) {
            const keyProps = getKeyProperties(fragment.properties, keyNumericProperties);
            const normalizedKeyProps = normalizeKeyProperties(keyProps);
            const key = JSON.stringify(normalizedKeyProps);
            if (!fragmentsByKey.has(key)) {
                fragmentsByKey.set(key, []);
            }
            fragmentsByKey.get(key).push(fragment);
        }
        // Process each group of fragments with matching key properties
        for (const [key, fragmentGroup] of fragmentsByKey) {
            if (fragmentGroup.length < 2) {
                // No merging possible for single fragments
                mergedFragments.push(...fragmentGroup);
                continue;
            }
            // Find connected components within this group
            const connectedComponents = findConnectedComponents(fragmentGroup);
            for (const component of connectedComponents) {
                if (component.length > 1) {
                    // Try to merge the connected component
                    const mergedFragment = mergeTouchingFragmentGroup(component, keyNumericProperties);
                    if (mergedFragment) {
                        mergedFragments.push(mergedFragment);
                        hasChanges = true; // Indicate that merging occurred
                    }
                    else {
                        // If merging failed, add all fragments individually
                        mergedFragments.push(...component);
                    }
                }
                else {
                    // Single fragment, no merging needed
                    mergedFragments.push(component[0]);
                }
            }
        }
        // Update current fragments for next pass
        currentFragments = mergedFragments;
    }
    if (passCount >= maxPasses) {
        console.warn(`mergeTouchingFragments: Maximum passes (${maxPasses}) reached. Some fragments may not have been fully merged.`);
    }
    return currentFragments;
}
/**
 * Finds connected components in a group of fragments using a depth-first search.
 * Two fragments are considered connected if they are touching.
 */
function findConnectedComponents(fragments) {
    const visited = new Set();
    const components = [];
    for (const fragment of fragments) {
        if (visited.has(fragment.properties.__id)) {
            continue;
        }
        // Start a new connected component
        const component = [];
        const stack = [fragment];
        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current.properties.__id)) {
                continue;
            }
            visited.add(current.properties.__id);
            component.push(current);
            // Find all unvisited fragments that are touching the current fragment
            for (const other of fragments) {
                if (visited.has(other.properties.__id)) {
                    continue;
                }
                // Check if fragments are touching
                if ((0, boolean_touches_1.default)((0, bbox_polygon_1.default)(current.bbox), (0, bbox_polygon_1.default)(other.bbox)) &&
                    (0, boolean_touches_1.default)(current, other)) {
                    stack.push(other);
                }
            }
        }
        components.push(component);
    }
    return components;
}
/**
 * Gets the key properties from a fragment's properties object
 */
function getKeyProperties(properties, keyNumericProperties) {
    const keyProps = {};
    for (const propName of keyNumericProperties) {
        if (properties && propName in properties) {
            keyProps[propName] = properties[propName];
        }
    }
    return keyProps;
}
/**
 * Normalizes key properties by sorting arrays to handle different orders
 */
function normalizeKeyProperties(keyProps) {
    const normalized = {};
    for (const [key, value] of Object.entries(keyProps)) {
        if (Array.isArray(value)) {
            // Sort arrays to normalize order
            normalized[key] = [...value].sort();
        }
        else {
            normalized[key] = value;
        }
    }
    return normalized;
}
/**
 * Checks if two property objects have matching key properties (regardless of order)
 */
function propertiesMatch(props1, props2) {
    const keys1 = Object.keys(props1);
    const keys2 = Object.keys(props2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    for (const key of keys1) {
        if (!(key in props2)) {
            return false;
        }
        const val1 = props1[key];
        const val2 = props2[key];
        // Handle arrays (like __geographyIds, __sketchIds)
        if (Array.isArray(val1) && Array.isArray(val2)) {
            if (val1.length !== val2.length) {
                return false;
            }
            // Sort arrays to handle different orders
            const sortedVal1 = [...val1].sort();
            const sortedVal2 = [...val2].sort();
            for (let i = 0; i < sortedVal1.length; i++) {
                if (sortedVal1[i] !== sortedVal2[i]) {
                    return false;
                }
            }
        }
        else if (val1 !== val2) {
            return false;
        }
    }
    return true;
}
/**
 * Attempts to merge a group of touching fragments into a single fragment
 */
function mergeTouchingFragmentGroup(fragments, keyNumericProperties) {
    if (fragments.length < 2) {
        return null;
    }
    try {
        // filter out fragments that are too small
        // fragments = fragments.filter((f) => calcArea(f) > 1);
        // Convert all fragments to polygon-clipping format
        const geometries = fragments.map((f) => [f.geometry.coordinates]);
        // Union all geometries
        const union = polygonClipping.union(geometries[0], ...geometries.slice(1));
        if (!union || union.length === 0) {
            return null;
        }
        // Check if the union results in a single polygon
        if (union.length === 1) {
            // Successfully merged into a single polygon
            const mergedGeometry = geometryFromCoords(union)[0];
            // Merge properties from all fragments
            let mergedProperties = { ...fragments[0].properties };
            for (let i = 1; i < fragments.length; i++) {
                mergedProperties = {
                    ...mergedProperties,
                    ...mergeNumericProperties(mergedProperties, fragments[i].properties, keyNumericProperties),
                };
            }
            const result = {
                ...fragments[0],
                geometry: mergedGeometry,
                properties: {
                    ...mergedProperties,
                    __id: idCounter++,
                },
                bbox: (0, bbox_1.default)({
                    type: "Feature",
                    properties: mergedProperties,
                    geometry: mergedGeometry,
                }, { recompute: true }),
            };
            return result;
        }
    }
    catch (error) {
        // If union operation fails, return null to indicate merge failure
        console.warn("Failed to merge touching fragments:", error);
    }
    return null;
}
//# sourceMappingURL=fragments.js.map