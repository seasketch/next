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
    })),
    ...existingFragments.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        __id: idCounter++,
      },
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
  const mergedFragments = mergeFragmentsWithMatchingGeometry(
    decomposedFragments,
    ["__geographyIds", "__sketchIds"]
  );

  // convert back to SketchFragment type
  return mergedFragments
    .map((f) => ({
      ...f,
      properties: {
        __geographyIds: f.properties.__geographyIds,
        __sketchIds: f.properties.__sketchIds,
      },
    }))
    .filter((f) => calcArea(f) > 1);
}
