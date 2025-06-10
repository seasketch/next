import { BBox, Feature, GeoJsonProperties, Polygon } from "geojson";
import {
  ClippingFn,
  ClippingLayerOption,
  clipToGeography,
} from "./geographies";
import { PreparedSketch } from "./utils/prepareSketch";
import polygonClipping from "polygon-clipping";
import { cleanCoords } from "./utils/cleanCoords";
import { multiPartToSinglePart } from "./utils/utils";
import calcBBox from "@turf/bbox";
import booleanEqual from "@turf/boolean-equal";
import booleanIntersects from "@turf/boolean-intersects";
import { bboxIntersects } from "./utils/bboxUtils";

export type GeographySettings = {
  id: number;
  clippingLayers: ClippingLayerOption[];
};

export type FragmentResult = Feature<
  Polygon,
  { __geographyIds: number[] } & GeoJsonProperties
>;

export type PendingFragmentResult = FragmentResult & {
  properties: { __id: number; __overlappingFragments: number[] };
};

let idCounter = 0;

export async function createFragments(
  preparedSketch: PreparedSketch,
  geographies: GeographySettings[],
  clippingFn: ClippingFn
): Promise<FragmentResult[]> {
  if (idCounter > 1_000_000) {
    console.log("resetting idCounter");
    idCounter = 0;
  }
  const fragments: PendingFragmentResult[] = [];

  console.time("clipToGeography");
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
              __overlappingFragments: [],
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
  console.timeEnd("clipToGeography");

  console.time("unionFragments");
  // compute bounding box and assign one to each PendingFragmentResult
  for (const fragment of fragments) {
    fragment.bbox = calcBBox(fragment, { recompute: true });
  }

  // writeDebugOutput("createFragmentsGeographyClippingResults", {
  //   type: "FeatureCollection",
  //   features: fragments,
  // });

  // decompose fragments, assigning them to geographies, until there is no
  // overlap between any two fragments.
  const output = buildFragments(fragments).map((f) => ({
    ...f,
    properties: {
      __geographyIds: f.properties.__geographyIds,
      __id: f.properties.__id,
    },
  }));
  // writeDebugOutput("createFragmentsOutput", {
  //   type: "FeatureCollection",
  //   features: output,
  // });
  console.timeEnd("unionFragments");
  return output;
}

function buildFragments(fragments: PendingFragmentResult[], loopCount = 0) {
  if (loopCount > 10) {
    throw new Error("Loop count exceeded");
    // return fragments;
  }
  // first, computer __overlappingFragments for each fragment based on bbox
  for (const fragment of fragments) {
    fragment.properties.__overlappingFragments = fragments
      .filter(
        (f) =>
          fragment !== f &&
          bboxIntersects(fragment.bbox!, f.bbox!) &&
          booleanIntersects(fragment, f) &&
          polygonClipping.intersection(
            [fragment.geometry.coordinates] as polygonClipping.Geom,
            [f.geometry.coordinates] as polygonClipping.Geom
          )?.[0]?.length > 0
      )
      .map((f) => f.properties.__id);
  }
  // check if there's any overlap between any two fragments. if not, return the
  // fragments.
  const anyOverlap = fragments.find(
    (f) => f.properties.__overlappingFragments.length > 0
  );
  if (!anyOverlap) {
    return fragments;
  } else {
    // console.log("found overlap", {
    //   id: anyOverlap.properties.__id,
    //   overlappingFragments: anyOverlap.properties.__overlappingFragments,
    //   geographyIds: anyOverlap.properties.__geographyIds,
    // });
  }

  // if (loopCount === 0) {
  //   writeDebugOutput("build-0", {
  //     type: "FeatureCollection",
  //     features: fragments,
  //   });
  // }

  // merge any fragments that have the exact same geometry, associating them
  // with all applicable geographies.
  fragments = mergeFragmentsWithMatchingGeometry(fragments);
  throwErrorOnDuplicateIds(fragments);

  // if (loopCount === 0) {
  //   writeDebugOutput("build-1-merged", {
  //     type: "FeatureCollection",
  //     features: fragments,
  //   });
  // }

  // find any fragments that overlap with other fragments, and split them into
  // new fragments that will later be merged.
  fragments = decomposeFragments(fragments);
  throwErrorOnDuplicateIds(fragments);

  // if (loopCount === 0) {
  //   writeDebugOutput("build-2-decomposed", {
  //     type: "FeatureCollection",
  //     features: fragments,
  //   });
  // }

  // console.log("########################");
  // console.log({
  //   loop: loopCount,
  //   fragments: fragments.length,
  //   fragmentIds: fragments.map((f) => f.properties.__id),
  //   fragmentGeographyIds: fragments.map((f) => f.properties.__geographyIds),
  // });

  // run the loop recursively, until there's no overlap or the loop count is exceeded.
  return buildFragments(fragments, loopCount + 1);
}

function mergeFragmentsWithMatchingGeometry(
  fragments: PendingFragmentResult[]
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
        // console.log(
        //   "merge!",
        //   [fragment, other].map((f) => ({
        //     id: f.properties.__id,
        //     geographyIds: f.properties.__geographyIds,
        //   }))
        // );
        fragment.properties.__geographyIds = mergeGeographyIds([
          fragment,
          other,
        ]);
        removedFragments.add(other.properties.__id);
        mergedIds.add(other.properties.__id);
      }
    }
    if (mergedIds.size > 0) {
      const mergeOutput = {
        ...fragment,
        properties: {
          ...fragment.properties,
          __geographyIds: fragment.properties.__geographyIds,
          __overlappingFragments:
            fragment.properties.__overlappingFragments.filter(
              (id) => !mergedIds.has(id)
            ),
        },
      };
      // console.log("merge output", {
      //   id: mergeOutput.properties.__id,
      //   geographyIds: mergeOutput.properties.__geographyIds,
      // });
      mergedFragments.push(mergeOutput);
    } else {
      mergedFragments.push(fragment);
    }
  }
  return mergedFragments;
}

function decomposeFragments(
  fragments: PendingFragmentResult[]
): PendingFragmentResult[] {
  const outputFragments: PendingFragmentResult[] = [];
  const processedFragments = new Set<number>();

  for (const fragment of fragments) {
    let foundOverlap = false;
    // find a pair that overlaps
    for (const f of fragments) {
      if (f === fragment || processedFragments.has(f.properties.__id)) {
        if (processedFragments.has(f.properties.__id)) {
          foundOverlap = true;
        }
        continue;
      }
      if (
        bboxIntersects(fragment.bbox!, f.bbox!) &&
        booleanIntersects(fragment, f)
      ) {
        // split the fragments
        const newFragments = splitFragments(fragment, f);
        processedFragments.add(fragment.properties.__id);
        processedFragments.add(f.properties.__id);
        outputFragments.push(...newFragments);
        // console.log(
        //   `Split fragments ${fragment.properties.__id} and ${f.properties.__id} into ${newFragments.length} new fragments`
        // );
        // console.log(
        //   newFragments.map((f) => ({
        //     id: f.properties.__id,
        //     geographyIds: f.properties.__geographyIds,
        //   }))
        // );
        foundOverlap = true;
        break;
      }
    }
    if (!foundOverlap) {
      outputFragments.push(fragment);
    }
  }

  return outputFragments;
}

function splitFragments(a: PendingFragmentResult, b: PendingFragmentResult) {
  // if (idCounter < 13) {
  //   writeDebugOutput(`split-${idCounter}-input`, {
  //     type: "FeatureCollection",
  //     features: [a, b],
  //   });
  // }
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
          __geographyIds: mergeGeographyIds([a, b]),
          __overlappingFragments: [],
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
            __geographyIds: a.properties.__geographyIds,
            __overlappingFragments: [],
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
            __geographyIds: b.properties.__geographyIds,
            __overlappingFragments: [],
            __id: idCounter++,
          },
          geometry,
        });
      }
    }
  } else {
    // console.log("no intersection, returning original fragments");
    // remove __ids from a and b from a & b's __overlappingFragments
    newFragments.push({
      ...a,
      properties: {
        ...a.properties,
        __overlappingFragments: a.properties.__overlappingFragments.filter(
          (id) => id !== b.properties.__id
        ),
      },
    });
    newFragments.push({
      ...b,
      properties: {
        ...b.properties,
        __overlappingFragments: b.properties.__overlappingFragments.filter(
          (id) => id !== a.properties.__id
        ),
      },
    });
  }
  return newFragments;
}

function mergeGeographyIds(fragments: PendingFragmentResult[]) {
  return Array.from(
    new Set(fragments.flatMap((f) => f.properties.__geographyIds))
  );
}

function geometryFromCoords(coords: polygonClipping.Geom): Polygon[] {
  return coords.map((polygon) => ({
    type: "Polygon",
    coordinates: polygon as number[][][],
  }));
}

function writeDebugOutput(filename: string, data: any) {
  if (process.env.NODE_ENV === "test") {
    const fs = require("fs");
    const path = require("path");
    const outputPath = path.join(
      __dirname,
      "../__tests__/outputs",
      `${filename}.geojson.json`
    );

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  }
}

function throwErrorOnDuplicateIds(fragments: PendingFragmentResult[]) {
  const ids = new Set<number>();
  for (const fragment of fragments) {
    if (ids.has(fragment.properties.__id)) {
      console.log(
        `Duplicate id: ${fragment.properties.__id} in ${fragments.length} fragments`
      );
    }
    ids.add(fragment.properties.__id);
  }
}
