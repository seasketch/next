import {
  Feature,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import { PreparedSketch, prepareSketch } from "./utils/prepareSketch";
import {
  Cql2Query,
  consolidateCql2Queries,
  evaluateCql2JSONQuery,
} from "./cql2";
import * as polygonClipping from "polygon-clipping";
import {
  createFragments,
  eliminateOverlap,
  FragmentResult,
  GeographySettings,
  SketchFragment,
} from "./fragments";
import area from "@turf/area";
import { unionAtAntimeridian } from "./utils/unionAtAntimeridian";
import { union, difference, intersection } from "./utils/polygonClipping";
import { SourceCache } from "fgb-source";
import { featureCollection } from "@turf/helpers";
import bbox from "@turf/bbox";
import { bboxToEnvelope, splitBBoxAntimeridian } from "./utils/bboxUtils";
import { makeMultipolygon } from "./utils/utils";
import { cleanCoords } from "./utils/cleanCoords";
import splitGeoJSON from "geojson-antimeridian-cut";
import contains from "@turf/boolean-contains";
import bboxPolygon from "@turf/bbox-polygon";
import fs from "fs";

export type ClippingOperation = "INTERSECT" | "DIFFERENCE";

/**
 * The result of a single clipping operation, as returned by a ClippingSource
 * clip method.
 */
export type PolygonClipResult = {
  /**
   * Whether the sketch was changed by this operation. This is particularly
   * useful to know when running multiple interesect and difference operations,
   * as an unchanged diff output can be ignored.
   */
  changed: boolean;
  /**
   * The operation that was performed.
   */
  op: ClippingOperation;
  /**
   * The output of the clipping operation. This will be null if the sketch is
   * completely outside the clipping geometry for intersect, or completely
   * inside the clipping geometry for difference.
   */
  output: Feature<MultiPolygon> | null;
};

export type ClippingFn = (
  preparedSketch: PreparedSketch,
  source: string,
  op: ClippingOperation,
  cql2Query?: Cql2Query
) => Promise<PolygonClipResult>;

/**
 * Options for configuring a clipping layer operation. A Geography consists of
 * one or more clipping layers, at least one of which must be an INTERSECT
 * operation.
 */
export interface ClippingLayerOption {
  source: string;

  /**
   * The clipping operation to perform:
   * - INTERSECT: Keep only the parts of the sketch that overlap with
   *   features from this layer
   * - DIFFERENCE: Remove the parts of the sketch that overlap with
   *   features from this layer
   */
  op: ClippingOperation;

  /**
   * Optional CQL2 query to filter which features from the source are used
   * for clipping. The query follows OGC CQL2 specification and supports
   * comparison and logical operators. If not provided, all features from
   * the source will be used.
   * @see evaluateCql2JSONQuery for supported query syntax
   */
  cql2Query?: Cql2Query;
}

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
export async function clipToGeography(
  preparedSketch: PreparedSketch,
  clippingLayers: ClippingLayerOption[],
  clippingFn: ClippingFn
): Promise<PreparedSketch["feature"] | null> {
  clippingLayers = consolidateClippingLayers(clippingLayers);
  // ensure there's at least one INTERSECT layer
  const intersectLayers = clippingLayers.filter(
    (layer) => layer.op === "INTERSECT"
  );
  if (intersectLayers.length === 0) {
    throw new Error("At least one INTERSECT layer is required");
  }
  const differenceLayers = clippingLayers.filter(
    (layer) => layer.op === "DIFFERENCE"
  );

  // Kick off the clipping operations in parallel, starting with the INTERSECT
  // layers.
  const intersectResults = Promise.all(
    intersectLayers.map((layer) =>
      clippingFn(preparedSketch, layer.source, "INTERSECT", layer.cql2Query)
    )
  );
  const differenceResults = Promise.all(
    differenceLayers.map((layer) =>
      clippingFn(preparedSketch, layer.source, "DIFFERENCE", layer.cql2Query)
    )
  );

  let results = await intersectResults;
  // if all intersect results are null, the sketch is completely outside
  // the geography
  if (!results.find((r) => r.output !== null)) {
    // Fire and forget, but handle errors to avoid unhandled promise rejections
    differenceResults.catch(() => {});
    return null;
  }

  results.push(...(await differenceResults));

  const features: Feature<MultiPolygon>[] = [];
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
  } else if (filteredFeatures.length === 0) {
    return null;
  } else {
    const intersection = polygonClipping.intersection(
      features[0].geometry.coordinates as polygonClipping.Geom,
      ...filteredFeatures
        .slice(1)
        .map((f) => f.geometry.coordinates as polygonClipping.Geom)
    );
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
function consolidateClippingLayers(
  clippingLayers: ClippingLayerOption[]
): ClippingLayerOption[] {
  let unconsolidated = [...clippingLayers];
  let consolidated: ClippingLayerOption[] = [];

  while (unconsolidated.length > 0) {
    const layer = unconsolidated.shift();
    if (layer) {
      // look through consolidated layers for a match. If there is a match,
      // combine the cql2Query's and remove the layer from unconsolidated.
      // If there is no match, add the layer to consolidated.
      const match = consolidated.find(
        (l) => l.source === layer.source && l.op === layer.op
      );
      if (match) {
        match.cql2Query = consolidateCql2Queries(
          match.cql2Query,
          layer.cql2Query
        );
      } else {
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
export async function clipSketchToPolygons(
  preparedSketch: PreparedSketch,
  op: ClippingOperation,
  cql2Query: Cql2Query | undefined,
  polygonSource: AsyncIterable<Feature<MultiPolygon | Polygon>>
): Promise<PolygonClipResult> {
  const polygons = [] as polygonClipping.Polygon[];
  for await (const feature of polygonSource) {
    if (cql2Query && !evaluateCql2JSONQuery(cql2Query, feature.properties)) {
      continue;
    }
    // // determine if the geometry is a polygon or a multipolygon, so that it can
    // // be added to the polygons array
    if (feature.geometry.type === "Polygon") {
      polygons.push(feature.geometry.coordinates as polygonClipping.Polygon);
    } else if (feature.geometry.type === "MultiPolygon") {
      polygons.push(
        ...feature.geometry.coordinates.map((p) => p as polygonClipping.Polygon)
      );
    }
  }

  if (polygons.length === 0 && op === "INTERSECT") {
    return { changed: true, output: null, op };
  } else if (polygons.length === 0 && op === "DIFFERENCE") {
    return { changed: false, output: preparedSketch.feature, op };
  }

  let output: typeof preparedSketch.feature.geometry.coordinates;
  if (op === "INTERSECT") {
    output = polygonClipping.intersection(
      preparedSketch.feature.geometry.coordinates as polygonClipping.Geom,
      polygons
    );
  } else if (op === "DIFFERENCE") {
    output = polygonClipping.difference(
      preparedSketch.feature.geometry.coordinates as polygonClipping.Geom,
      polygons
    );
  } else {
    throw new Error(`Unknown operation: ${op}`);
  }

  if (output.length === 0) {
    return { changed: true, output: null, op };
  }

  return {
    changed:
      JSON.stringify(output) !==
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
export async function clipToGeographies(
  preparedSketch: PreparedSketch,
  geographies: GeographySettings[],
  geographiesForClipping: number[],
  existingSketchFragments: SketchFragment[],
  existingSketchId: number | null,
  clippingFn: ClippingFn
): Promise<{
  clipped: PreparedSketch["feature"] | null;
  fragments: FragmentResult[];
}> {
  // Create fragments for all overlapping geographies
  let fragments: SketchFragment[] = (
    await createFragments(preparedSketch, geographies, clippingFn)
  ).map((f) => ({
    ...f,
    properties: {
      ...f.properties,
      __sketchIds: [0],
    },
  }));

  // Now, we need to figure out if there are any fragments that are within the
  // clipping geographies, and count how many overlapping clipping geographies
  // there are.
  const fragmentsInClippingGeographies: SketchFragment[] = [];
  const matchingGeographyIds = new Set<number>();
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
  let clippedFragments: SketchFragment[];
  let primaryGeographyId: number = Array.from(matchingGeographyIds)[0];
  if (matchingGeographyIds.size === 1) {
    // If there's only one overlap, we can use the fragments as is.
    clippedFragments = fragmentsInClippingGeographies;
  } else {
    // If there is overlap with more than one clipping geography, we need to
    // choose the one with the most overlap. We'll do that by first calculating
    // the area of each fragment, then summing the areas of the fragments by
    // geography, and picking the biggest one. We'll replace clippedFragments with
    // the fragments that belong to the biggest geography.
    const areaByGeographyId: { [geographyId: number]: number } = {};
    // prepopulate with 0
    for (const geographyId of Array.from(matchingGeographyIds)) {
      areaByGeographyId[geographyId] = 0;
    }
    // calculate areas first
    for (const fragment of fragmentsInClippingGeographies) {
      const val = area(fragment);
      for (const geographyId of fragment.properties.__geographyIds) {
        areaByGeographyId[geographyId] += val;
      }
    }
    // find the geography with the most area
    let biggest = 0;
    let biggestGeographyId: number | null = null;
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
    clippedFragments = fragmentsInClippingGeographies.filter((f) =>
      f.properties.__geographyIds.includes(biggestGeographyId)
    );
  }

  // filter the fragments to only include the primary geography
  fragments = fragments.filter((f) =>
    f.properties.__geographyIds.includes(primaryGeographyId)
  );

  // union the fragments to get the final clipped geometry using polygon-clipping
  const geometry = union(
    clippedFragments.map((f) => f.geometry.coordinates as polygonClipping.Geom)
  );

  const clipped = {
    ...preparedSketch.feature,
    geometry: {
      ...preparedSketch.feature.geometry,
      coordinates: geometry,
    },
  } as PreparedSketch["feature"];

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
      const consolidatedFragments: (Feature<MultiPolygon> & {
        properties: { __sketchIds: number[]; __geographyIds: number[] } & {
          [key: string]: any;
        };
      })[] = [];
      for (const fragment of existingSketchFragments) {
        if (
          fragment.properties.__sketchIds.includes(existingSketchId) &&
          fragment.properties.__sketchIds.length === 1
        ) {
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
          const consolidatedFragment = consolidatedFragments.find(
            (f) =>
              f.properties.__sketchIds.length === 1 &&
              f.properties.__sketchIds.includes(sketchId) &&
              f.properties.__geographyIds.length ===
                fragment.properties.__geographyIds.length &&
              f.properties.__geographyIds.every((id) =>
                fragment.properties.__geographyIds.includes(id)
              )
          );
          if (consolidatedFragment) {
            // add the fragment to the consolidated fragment
            consolidatedFragment.geometry.coordinates = union([
              consolidatedFragment.geometry.coordinates as polygonClipping.Geom,
              fragment.geometry.coordinates as polygonClipping.Geom,
            ]);
          } else {
            // create a new consolidated fragment
            consolidatedFragments.push({
              ...fragment,
              properties: {
                ...fragment.properties,
                __sketchIds: [sketchId],
                __geographyIds: fragment.properties.__geographyIds.filter(
                  (id) => id !== existingSketchId
                ),
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

    fragments = eliminateOverlap(fragments, existingSketchFragments);
  }

  return {
    clipped: unionAtAntimeridian(clipped) as PreparedSketch["feature"],
    fragments,
  };
}

// Determines whether to apply a difference operation against an entire diff
// layer vs the intersection layer union, or to apply an intersection against
// each feature in the difference layer and sum up the overlapping area
// piecemeal.
// I noticed problems > 40MB, but it probably makes sense to set it lower just
// in case. TODO: check for pathological performance differences
const MAX_SAFE_CLIPPING_OPERATION_BYTES = 10_000_000;
const MAX_SAFE_CLIPPING_OPERATION_FEATURE_COUNT = 2_000;

export async function calculateArea(
  geography: ClippingLayerOption[],
  sourceCache: SourceCache
) {
  // first, fetch all intersection layers and union the features
  const intersectionLayers = geography.filter((l) => l.op === "INTERSECT");
  const differenceLayers = geography.filter((l) => l.op === "DIFFERENCE");
  const intersectionFeatures = [] as Feature<Polygon | MultiPolygon>[];
  let intersectionFeatureBytes = 0;
  await Promise.all(
    intersectionLayers.map(async (l) => {
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        l.source
      );
      for await (const {
        properties,
        getFeature,
      } of source.getFeatureProperties()) {
        if (evaluateCql2JSONQuery(l.cql2Query, properties)) {
          intersectionFeatures.push(getFeature());
          intersectionFeatureBytes += properties?.__byteLength || 0;
        }
      }
    })
  );
  console.log(
    "got intersection features",
    intersectionFeatures.length,
    intersectionFeatureBytes + " bytes"
  );
  if (differenceLayers.length === 0) {
    console.log("no difference layers, calculate area");
    const sumArea = intersectionFeatures.reduce((acc, f) => acc + area(f), 0);
    // convert to square kilometers
    return sumArea / 1_000_000;
  } else {
    // first, create a union of the intersection features
    let intersectionFeature = union(
      intersectionFeatures.map(
        (f) => f.geometry.coordinates as polygonClipping.Geom
      )
    );

    // turn back into geojson feature
    let intersectionFeatureGeojson = unionAtAntimeridian({
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: intersectionFeature },
      properties: {},
    });
    fs.writeFileSync(
      "/Users/cburt/Downloads/union.geojson.json",
      JSON.stringify(intersectionFeatureGeojson, null, 2)
    );

    const prepared = prepareSketch(intersectionFeatureGeojson);
    const envelopes = prepared.envelopes;
    fs.writeFileSync(
      "/Users/cburt/Downloads/envelopes.geojson.json",
      JSON.stringify(
        featureCollection(
          envelopes.map((e) => {
            return bboxPolygon([e.minX, e.minY, e.maxX, e.maxY]);
          })
        ),
        null,
        2
      )
    );
    const differenceGeoms = [] as polygonClipping.Geom[];
    let bytesFetched = 0;
    let overlappingDifferenceFeaturesSqKm = 0;
    for (const layer of differenceLayers) {
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        layer.source
      );
      const { bytes, features } = await source.countAndBytesForQuery(envelopes);
      console.log("bytes", bytes, "features", features, envelopes);
      if (
        bytes > MAX_SAFE_CLIPPING_OPERATION_BYTES ||
        features > MAX_SAFE_CLIPPING_OPERATION_FEATURE_COUNT
      ) {
        console.log(
          "Large difference layer. Performing piecemeal intersection to calculate area"
        );
        let i = 0;
        let fullyContainedFeatures = 0;
        let intersectingFeatures = 0;
        let lastLoggedPercent = 0;
        // get features from difference layer
        for await (const f of source.getFeaturesAsync(envelopes)) {
          if (
            !layer.cql2Query ||
            evaluateCql2JSONQuery(layer.cql2Query, f.properties)
          ) {
            i++;
            const percent = (i / features) * 100;
            if (percent - lastLoggedPercent > 0.2) {
              lastLoggedPercent = percent;
              console.log(
                `running overlap ${percent.toFixed(2)}%`,
                `fully contained features: ${fullyContainedFeatures}, intersecting features: ${intersectingFeatures}, total features: ${i}`
              );
            }
            if (
              contains(
                {
                  type: "Feature",
                  geometry: {
                    type: "MultiPolygon",
                    coordinates: intersectionFeature,
                  },
                  properties: {},
                },
                f
              )
            ) {
              overlappingDifferenceFeaturesSqKm += area(f) / 1_000_000;
              fullyContainedFeatures++;
            } else {
              const overlap = intersection([
                intersectionFeature,
                f.geometry.coordinates as polygonClipping.Geom,
              ]);
              const overlappingSqKm =
                area({
                  type: "Feature",
                  geometry: { type: "MultiPolygon", coordinates: overlap },
                  properties: {},
                }) / 1_000_000;
              overlappingDifferenceFeaturesSqKm += overlappingSqKm;
              if (overlappingSqKm > 0) {
                intersectingFeatures++;
              }
            }
          }
        }
        console.log(
          `fully contained features: ${fullyContainedFeatures}, intersecting features: ${intersectingFeatures}, total features: ${i}`
        );
      } else {
        console.log(
          "Small difference layer. Performing union to calculate area"
        );
        for (const b of envelopes) {
          for await (const f of source.getFeaturesAsync(b)) {
            bytesFetched += f.properties?.__byteLength || 0;
            if (bytesFetched > 40_000_000) {
              throw new Error(
                "bytes fetched too high, aborting. " + bytesFetched
              );
            }
            if (
              !layer.cql2Query ||
              evaluateCql2JSONQuery(layer.cql2Query, f.properties)
            ) {
              differenceGeoms.push(
                f.geometry.coordinates as polygonClipping.Geom
              );
            }
          }
        }
      }
    }

    if (differenceGeoms.length > 0) {
      intersectionFeature = difference([
        intersectionFeature,
        ...differenceGeoms,
      ]);
    }

    const productGeojson = {
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: intersectionFeature },
      properties: {},
    } as Feature<MultiPolygon>;

    console.log("product made, calculate area");
    const sqKm = area(productGeojson) / 1_000_000;
    return sqKm - overlappingDifferenceFeaturesSqKm;
  }
}
