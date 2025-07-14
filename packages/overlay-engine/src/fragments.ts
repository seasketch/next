import { BBox, Feature, GeoJsonProperties, Polygon } from "geojson";
import {
  ClippingFn,
  ClippingLayerOption,
  clipToGeography,
} from "./geographies";
import { PreparedSketch } from "./utils/prepareSketch";
import * as polygonClipping from "polygon-clipping";
import { cleanCoords } from "./utils/cleanCoords";
import { multiPartToSinglePart } from "./utils/utils";
import calcBBox from "@turf/bbox";
import booleanEqual from "@turf/boolean-equal";
import booleanIntersects from "@turf/boolean-intersects";
import { bboxIntersects } from "./utils/bboxUtils";
import calcArea from "@turf/area";
import booleanTouches from "@turf/boolean-touches";
import bboxPolygon from "@turf/bbox-polygon";

export type GeographySettings = {
  id: number;
  clippingLayers: ClippingLayerOption[];
};

export type FragmentResult = Feature<
  Polygon,
  { __geographyIds: number[] } & GeoJsonProperties
>;

export type PendingFragmentResult = FragmentResult & {
  properties: { __id: number };
  bbox: BBox;
};

let idCounter = 0;

export async function createFragments(
  preparedSketch: PreparedSketch,
  geographies: GeographySettings[],
  clippingFn: ClippingFn
): Promise<FragmentResult[]> {
  if (idCounter > 1_000_000) {
    console.warn("resetting idCounter");
    idCounter = 0;
  }
  let fragments: PendingFragmentResult[] = [];

  await Promise.all(
    geographies.map(async (geography) => {
      const result = await clipToGeography(
        preparedSketch,
        geography.clippingLayers,
        clippingFn
      );
      if (!result) {
        return null;
      } else {
        fragments.push(
          ...multiPartToSinglePart({
            type: "Feature",
            properties: {
              __geographyIds: [geography.id],
              __id: idCounter++,
              ...result.properties,
            },
            geometry: result.geometry,
          })
            .map((f) => cleanCoords(f))
            .map((f) => ({
              ...f,
              properties: {
                ...f.properties,
                __id: idCounter++,
              },
            }))
        );
      }
    })
  );

  // compute bounding box and assign one to each PendingFragmentResult
  for (const fragment of fragments) {
    fragment.bbox = calcBBox(fragment, { recompute: true });
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
  return output.filter((f) => calcArea(f) > 1);
}

function buildFragments(fragments: PendingFragmentResult[]) {
  // find any fragments that overlap with other fragments, and split them into
  // new fragments that will later be merged.
  fragments = decomposeFragments(fragments, ["__geographyIds"]);

  // merge any fragments that have the exact same geometry, associating them
  // with all applicable geographies.
  fragments = mergeFragmentsWithMatchingGeometry(fragments, ["__geographyIds"]);

  return fragments;
}

function mergeFragmentsWithMatchingGeometry(
  fragments: PendingFragmentResult[],
  numericPropertiesToMerge: string[]
) {
  const removedFragments = new Set<number>();
  const mergedFragments: PendingFragmentResult[] = [];
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
    const mergedIds = new Set<number>();
    for (const other of fragments) {
      if (fragment === other || removedFragments.has(other.properties.__id)) {
        continue;
      }
      if (
        bboxIntersects(fragment.bbox!, other.bbox!) &&
        booleanEqual(fragment.geometry, other.geometry)
      ) {
        fragment.properties = {
          ...fragment.properties,
          ...mergeNumericProperties(
            fragment.properties,
            other.properties,
            numericPropertiesToMerge
          ),
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
    } else {
      mergedFragments.push(fragment);
    }
  }
  return mergedFragments;
}

// Eliminates overlap between fragments by splitting them into new fragments.
// Will run recursively until there is no overlap between any two fragments.
function decomposeFragments(
  fragments: PendingFragmentResult[],
  numericPropertiesToMerge: string[],
  loopCount = 0
): PendingFragmentResult[] {
  const startingLength = fragments.length;
  if (loopCount > 100) {
    throw new Error("Loop count exceeded");
  }

  let anyOverlap = false;

  const outputFragments: PendingFragmentResult[] = [];
  const processedFragments = new Set<number>();

  for (const fragment of fragments) {
    if (processedFragments.has(fragment.properties.__id)) {
      continue;
    }

    let foundOverlap = false;
    for (const f of fragments) {
      if (f === fragment || processedFragments.has(f.properties.__id)) {
        continue;
      }

      if (
        bboxIntersects(fragment.bbox!, f.bbox!) &&
        booleanIntersects(fragment, f)
      ) {
        const newFragments = splitFragments(
          fragment,
          f,
          numericPropertiesToMerge
        );
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
  const ids = new Set<number>();
  for (const fragment of outputFragments) {
    if (ids.has(fragment.properties.__id)) {
      throw new Error(`Duplicate id: ${fragment.properties.__id}`);
    }
    ids.add(fragment.properties.__id);
  }

  // const anyOverlap = startingLength !== outputFragments.length;
  if (anyOverlap) {
    return decomposeFragments(
      outputFragments,
      numericPropertiesToMerge,
      loopCount + 1
    );
  } else {
    return outputFragments;
  }
}

function splitFragments(
  a: PendingFragmentResult,
  b: PendingFragmentResult,
  numericPropertiesToMerge: string[]
) {
  // calculates the intersection and difference of the two fragments, and returns
  // the new fragments.
  const intersection = polygonClipping.intersection(
    [a.geometry.coordinates] as polygonClipping.Geom,
    [b.geometry.coordinates] as polygonClipping.Geom
  );
  const differenceA = polygonClipping.difference(
    [a.geometry.coordinates] as polygonClipping.Geom,
    [b.geometry.coordinates] as polygonClipping.Geom
  );
  const differenceB = polygonClipping.difference(
    [b.geometry.coordinates] as polygonClipping.Geom,
    [a.geometry.coordinates] as polygonClipping.Geom
  );
  const newFragments: PendingFragmentResult[] = [];

  if (intersection?.length > 0) {
    // create a new fragment with the merged geography ids
    for (const geometry of geometryFromCoords(intersection)) {
      newFragments.push({
        ...a,
        properties: {
          ...a.properties,
          ...mergeNumericProperties(
            a.properties,
            b.properties,
            numericPropertiesToMerge
          ),
          __id: idCounter++,
        },
        geometry,
      });
    }

    if (differenceA?.length > 0) {
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
    if (differenceB?.length > 0) {
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
  } else {
    return null;
  }
  return newFragments;
}

function mergeNumericProperties(
  a: GeoJsonProperties,
  b: GeoJsonProperties,
  propNames: string[]
) {
  const mergedProps: GeoJsonProperties = {};
  for (const propName of propNames) {
    if ((a && propName in a) || (b && propName in b)) {
      const merged = [] as number[];
      if (a && propName in a) {
        if (Array.isArray(a[propName])) {
          merged.push(...a[propName]);
        } else {
          merged.push(a[propName]);
        }
      }
      if (b && propName in b) {
        if (Array.isArray(b[propName])) {
          merged.push(...b[propName]);
        } else {
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

function geometryFromCoords(coords: polygonClipping.Geom): Polygon[] {
  return coords.map((polygon) => ({
    type: "Polygon" as const,
    coordinates: polygon as number[][][],
  }));
}

// function throwErrorOnDuplicateIds(fragments: PendingFragmentResult[]) {
//   const ids = new Set<number>();
//   for (const fragment of fragments) {
//     if (ids.has(fragment.properties.__id)) {
//       console.warn(
//         `Duplicate id: ${fragment.properties.__id} in ${fragments.length} fragments`
//       );
//     }
//     ids.add(fragment.properties.__id);
//   }
// }

export type SketchFragment = FragmentResult & {
  properties: { __sketchIds: number[] } & GeoJsonProperties;
};

type PendingSketchFragmentResult = SketchFragment & {
  properties: { __id: number; __sketchIds: number[] };
  bbox: BBox;
};

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
export function eliminateOverlap(
  newFragments: SketchFragment[],
  existingFragments: SketchFragment[]
): SketchFragment[] {
  let idCounter = 0;
  const pendingFragments: PendingSketchFragmentResult[] = [
    ...newFragments.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        __id: idCounter++,
      },
      bbox: calcBBox(f),
    })),
    ...existingFragments.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        __id: idCounter++,
      },
      bbox: calcBBox(f),
    })),
  ];

  // compute bounding box for each fragment
  for (const fragment of pendingFragments) {
    fragment.bbox = calcBBox(fragment, { recompute: true });
  }

  // decompose fragments until there is no overlap
  const decomposedFragments = decomposeFragments(pendingFragments, [
    "__sketchIds",
    "__geographyIds",
  ]);

  // merge fragments with matching geometry
  let mergedFragments = mergeFragmentsWithMatchingGeometry(
    decomposedFragments,
    ["__geographyIds", "__sketchIds"]
  ).filter((f) => calcArea(f) > 1);

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
export function mergeTouchingFragments(
  fragments: PendingFragmentResult[],
  keyNumericProperties: string[]
) {
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

    const mergedFragments: PendingFragmentResult[] = [];

    // Group fragments by their key properties
    const fragmentsByKey = new Map<string, PendingFragmentResult[]>();

    for (const fragment of currentFragments) {
      const keyProps = getKeyProperties(
        fragment.properties,
        keyNumericProperties
      );
      const normalizedKeyProps = normalizeKeyProperties(keyProps);
      const key = JSON.stringify(normalizedKeyProps);

      if (!fragmentsByKey.has(key)) {
        fragmentsByKey.set(key, []);
      }
      fragmentsByKey.get(key)!.push(fragment);
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
          const mergedFragment = mergeTouchingFragmentGroup(
            component,
            keyNumericProperties
          );
          if (mergedFragment) {
            mergedFragments.push(mergedFragment);
            hasChanges = true; // Indicate that merging occurred
          } else {
            // If merging failed, add all fragments individually
            mergedFragments.push(...component);
          }
        } else {
          // Single fragment, no merging needed
          mergedFragments.push(component[0]);
        }
      }
    }

    // Update current fragments for next pass
    currentFragments = mergedFragments;
  }

  if (passCount >= maxPasses) {
    console.warn(
      `mergeTouchingFragments: Maximum passes (${maxPasses}) reached. Some fragments may not have been fully merged.`
    );
  }

  return currentFragments;
}

/**
 * Finds connected components in a group of fragments using a depth-first search.
 * Two fragments are considered connected if they are touching.
 */
function findConnectedComponents(
  fragments: PendingFragmentResult[]
): PendingFragmentResult[][] {
  const visited = new Set<number>();
  const components: PendingFragmentResult[][] = [];

  for (const fragment of fragments) {
    if (visited.has(fragment.properties.__id)) {
      continue;
    }

    // Start a new connected component
    const component: PendingFragmentResult[] = [];
    const stack: PendingFragmentResult[] = [fragment];

    while (stack.length > 0) {
      const current = stack.pop()!;

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
        if (
          booleanTouches(
            bboxPolygon(current.bbox!),
            bboxPolygon(other.bbox!)
          ) &&
          booleanTouches(current, other)
        ) {
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
function getKeyProperties(
  properties: GeoJsonProperties,
  keyNumericProperties: string[]
) {
  const keyProps: { [key: string]: any } = {};
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
function normalizeKeyProperties(keyProps: { [key: string]: any }): {
  [key: string]: any;
} {
  const normalized: { [key: string]: any } = {};
  for (const [key, value] of Object.entries(keyProps)) {
    if (Array.isArray(value)) {
      // Sort arrays to normalize order
      normalized[key] = [...value].sort();
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Checks if two property objects have matching key properties (regardless of order)
 */
function propertiesMatch(
  props1: { [key: string]: any },
  props2: { [key: string]: any }
): boolean {
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
    } else if (val1 !== val2) {
      return false;
    }
  }

  return true;
}

/**
 * Attempts to merge a group of touching fragments into a single fragment
 */
export function mergeTouchingFragmentGroup(
  fragments: PendingFragmentResult[],
  keyNumericProperties: string[]
): PendingFragmentResult | null {
  if (fragments.length < 2) {
    return null;
  }

  try {
    // filter out fragments that are too small
    // fragments = fragments.filter((f) => calcArea(f) > 1);

    // Convert all fragments to polygon-clipping format
    const geometries = fragments.map(
      (f) => [f.geometry.coordinates] as polygonClipping.Geom
    );

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
          ...mergeNumericProperties(
            mergedProperties,
            fragments[i].properties,
            keyNumericProperties
          ),
        };
      }

      const result = {
        ...fragments[0],
        geometry: mergedGeometry,
        properties: {
          ...mergedProperties,
          __id: idCounter++,
        },
        bbox: calcBBox(
          {
            type: "Feature",
            properties: mergedProperties,
            geometry: mergedGeometry,
          },
          { recompute: true }
        ),
      } as PendingFragmentResult;
      return result;
    }
  } catch (error) {
    // If union operation fails, return null to indicate merge failure
    console.warn("Failed to merge touching fragments:", error);
  }

  return null;
}
