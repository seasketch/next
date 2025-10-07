import { SourceCache } from "fgb-source";
import { ClippingLayerOption, initializeGeographySources } from "./geographies";
import { SourceType } from "../metrics/metrics";
import {
  guaranteeHelpers,
  OverlayWorkerHelpers,
  OverlayWorkerLogFeatureLayerConfig,
} from "../utils/helpers";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { evaluateCql2JSONQuery } from "../cql2";
import { bbox } from "@turf/bbox";
import { bboxToEnvelope, splitBBoxAntimeridian } from "../utils/bboxUtils";
import * as clipping from "polyclip-ts";
import calcArea from "@turf/area";
import simplify from "@turf/simplify";
import { ContainerIndex } from "../utils/containerIndex";
import fs from "fs";
import isValid from "@turf/boolean-valid";

const layers: Record<string, OverlayWorkerLogFeatureLayerConfig> = {
  bboxes: {
    name: "outer-polygon-edge-box",
    geometryType: "Polygon",
    fields: { category: "string" },
  },
  classifiedSourceFeatures: {
    name: "classified-source-features",
    geometryType: "Polygon",
    fields: { category: "string" },
  },
  outerPolygonIntersectionResults: {
    name: "outer-polygon-intersection-results",
    geometryType: "MultiPolygon",
    fields: { category: "string" },
  },
  allDifferenceFeatures: {
    name: "all-difference-features",
    geometryType: "Polygon",
    fields: { offset: "number" },
  },
  finalProductFeatures: {
    name: "final-product-features",
    geometryType: "MultiPolygon",
    fields: {},
  },
  differenceLayerIntesectionState: {
    name: "difference-layer-intersection-state",
    geometryType: "Polygon",
    fields: { category: "string" },
  },
  batchedFeatures: {
    name: "batched-features",
    geometryType: "MultiPolygon",
    fields: {
      id: "number",
      category: "string",
    },
  },
};

let batchedFeaturesId = 0;

/**
 * The maximum number of features to process in a single batch.
 * Rather than performing a clipping operation for each individual feature,
 * we perform a clipping operation for a batch of features. Performing this
 * against entire layers could be slow or even run out available memory, and
 * also skips the opportunity to use the container index to achieve even greater
 * speed. This batch size is a compromise between these two factors.
 */
const CLIPPING_BATCH_SIZE = 1024 * 1024 * 5; // 2MB

export async function calculateGeographyOverlap(
  geography: ClippingLayerOption[],
  sourceCache: SourceCache,
  sourceUrl: string,
  sourceType: SourceType,
  groupBy?: string,
  helpersOption?: OverlayWorkerHelpers
) {
  let differenceReferences = 0;
  const loggedDifferenceFeatures = new Set<string>();
  const helpers = guaranteeHelpers(helpersOption);
  if (sourceType !== "FlatGeobuf") {
    throw new Error(`Unsupported source type: ${sourceType}`);
  }

  console.log("prefetch source layer of interest");
  // // Start source prefetching and capture the result without creating
  // // unhandled rejections. We'll check this later and propagate if needed.
  // const prefetchResultPromise: Promise<
  //   { ok: true } | { ok: false; error: unknown }
  // > = sourceCache
  //   .get<Feature<Polygon | MultiPolygon>>(sourceUrl, {
  //     pageSize: "5MB",
  //   })
  //   .then(() => ({ ok: true as const }))
  //   .catch((error) => ({ ok: false as const, error }));

  const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } =
    await initializeGeographySources(geography, sourceCache, helpers, {
      pageSize: "5MB",
    });

  const simplified = simplify(intersectionFeatureGeojson, {
    tolerance: 0.002,
  });

  const outerPolygonContainerIndex = new ContainerIndex(simplified);

  if (helpers.logFeature) {
    const bboxPolygons = outerPolygonContainerIndex.getBBoxPolygons();
    for (const f of bboxPolygons.features) {
      helpers.logFeature(layers.bboxes, {
        ...f,
        properties: { category: "outer-polygon-edge-box" },
      });
    }
  }

  // If prefetch failed, surface the error through the awaited path so the
  // caller's try/catch or .catch() reliably observes it.
  // {
  //   const prefetchResult = await prefetchResultPromise;
  //   if (!prefetchResult.ok) {
  //     throw prefetchResult.error;
  //   }
  // }

  const differenceSources = await Promise.all(
    differenceLayers.map(async (layer) => {
      const diffSource = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        layer.source,
        {
          pageSize: "5MB",
        }
      );
      return {
        cql2Query: layer.cql2Query,
        source: diffSource,
      };
    })
  );

  // throw new Error("stop");

  // difference layers often include the osm land layer, which is very large.
  // to optimize performance, start fetching pages from the difference layers
  // for every page that intersects the geography. Afterwards,
  // feature-by-feature calculations can be performed.

  const env = bboxToEnvelope(bbox(intersectionFeatureGeojson));

  // helpers.log("prefetching difference sources");
  // TODO: Work towards enabling this, or at least understanding why it happens.
  // Uncommenting this won't always cause issues, but if it does cause
  // connection terminations on lambda (and it will eventually), then somehow
  // those terminated range requests will get jammed up in a cache somewhere
  // (likely in AWS's network stack) and just repeatedly fail. If you wait, the
  // same code will work again eventually. I just don't think the network stack
  // likes repeated identical range requests.
  //
  // for (const differenceSource of differenceSources) {
  //   differenceSource.source
  //     .prefetch(env)
  //     .then(() => {
  //       console.log("prefetched difference source for", env);
  //     })
  //     .catch((error) => {
  //       console.log("error prefetching difference source for", env);
  //       console.error(error);
  //     });
  // }

  helpers.log("initialized geography sources");
  let progress = 0;

  let featuresProcessed = 0;
  const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
    sourceUrl
  );

  const envelope = bboxToEnvelope(bbox(intersectionFeatureGeojson));
  const estimate = await source.countAndBytesForQuery(envelope);
  helpers.log(
    `Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}`
  );
  helpers.progress(progress, `Processing ${estimate.features} features`);

  const areaByClassId: { [classId: string]: number } = { "*": 0 };

  function addFeatureToTotals(
    feature: Feature<Polygon | MultiPolygon>,
    hasChanged: boolean
  ) {
    let area = feature.properties?.__area || 0;
    if (hasChanged) {
      area = calcArea(feature) / 1_000_000;
    }
    areaByClassId["*"] += area;
    if (groupBy && feature.properties) {
      const classKey = feature.properties[groupBy];
      if (classKey !== undefined) {
        areaByClassId[classKey] += area;
      }
    }
  }

  const intersectionGeom = intersectionFeatureGeojson.geometry
    .coordinates as clipping.Geom;

  let batchedFeatures = [] as Feature<Polygon | MultiPolygon>[];
  let batchBBox = [Infinity, Infinity, -Infinity, -Infinity] as [
    number,
    number,
    number,
    number
  ];
  let batchBytes = 0;

  async function processBatch() {
    console.log(
      `processing batch #${batchedFeaturesId++}`,
      batchedFeatures.length,
      batchBBox,
      batchBytes + " bytes"
    );
    console.time(`processing batch #${batchedFeaturesId}`);
    const combinedMultiPolygon = [] as clipping.Geom[];
    for (const feature of batchedFeatures.filter(
      (f) => f.properties?.class === "Outer Reef Flat"
    )) {
      if (feature.geometry.type === "Polygon") {
        combinedMultiPolygon.push(
          feature.geometry.coordinates as clipping.Geom
        );
      } else {
        for (const poly of feature.geometry.coordinates as clipping.Geom[]) {
          combinedMultiPolygon.push(poly);
        }
      }
    }

    if (helpers.logFeature) {
      helpers.logFeature(layers.batchedFeatures, {
        type: "Feature",
        properties: { id: batchedFeaturesId, category: "batched-features" },
        geometry: {
          type: "MultiPolygon",
          // @ts-ignore
          coordinates: combinedMultiPolygon,
        },
      });
    }

    if (
      false &&
      !isValid({
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: combinedMultiPolygon,
        },
      })
    ) {
      console.log(
        isValid({
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: combinedMultiPolygon,
          },
        })
      );
      fs.writeFileSync(
        `/Users/cburt/Downloads/invalid-multipolygon.json`,
        JSON.stringify(
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "MultiPolygon",
              coordinates: combinedMultiPolygon,
            },
          },
          null,
          2
        )
      );
      throw new Error("Invalid combined multi polygon");
    }

    const diffMultiPolygon = [] as clipping.Geom;

    for (const diffSource of differenceSources) {
      for await (const diffFeature of diffSource.source.getFeaturesAsync(
        bboxToEnvelope(batchBBox)
      )) {
        if (
          diffSource.cql2Query &&
          !evaluateCql2JSONQuery(diffSource.cql2Query, diffFeature.properties)
        ) {
          continue;
        }
        if (diffFeature.geometry.type === "Polygon") {
          diffMultiPolygon.push(
            // @ts-ignore
            diffFeature.geometry.coordinates
          );
        } else {
          for (const poly of diffFeature.geometry.coordinates) {
            // @ts-ignore
            diffMultiPolygon.push(poly);
          }
        }
      }
    }

    if (
      false &&
      !isValid({
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: diffMultiPolygon,
        },
      })
    ) {
      console.log(
        isValid({
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: diffMultiPolygon,
          },
        })
      );
      fs.writeFileSync(
        `/Users/cburt/Downloads/invalid-diff-multipolygon.json`,
        JSON.stringify(
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "MultiPolygon",
              coordinates: diffMultiPolygon,
            },
          },
          null,
          2
        )
      );
      throw new Error("Invalid difference multi polygon");
    }

    if (helpers.logFeature) {
      helpers.logFeature(layers.batchedFeatures, {
        type: "Feature",
        properties: { category: "diff", id: batchedFeaturesId },
        geometry: {
          type: "MultiPolygon",
          // @ts-ignore
          coordinates: diffMultiPolygon,
        },
      });
    }

    try {
      const newFeature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          // @ts-ignore
          coordinates: clipping.difference(
            combinedMultiPolygon as clipping.Geom,
            // @ts-ignore
            ...diffMultiPolygon
          ),
        },
      } as Feature<Polygon | MultiPolygon>;
      console.log("New Feature Area: ", calcArea(newFeature) / 1_000_000);

      addFeatureToTotals(newFeature, true);

      batchedFeatures = [];
      batchBBox = [Infinity, Infinity, -Infinity, -Infinity];
      batchBytes = 0;
      console.timeEnd(`processing batch #${batchedFeaturesId}`);
    } catch (error) {
      console.error(`Error processing batch ${batchedFeaturesId}: `, error);
      fs.writeFileSync(
        `/Users/cburt/Downloads/batch-${batchedFeaturesId}.json`,
        JSON.stringify(
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "MultiPolygon",
              coordinates: combinedMultiPolygon as clipping.Geom,
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        `/Users/cburt/Downloads/batch-${batchedFeaturesId}-diff.json`,
        JSON.stringify(
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "MultiPolygon",
              coordinates: diffMultiPolygon,
            },
          },
          null,
          2
        )
      );
      throw error;
    }
    batchedFeatures = [];
    batchBBox = [Infinity, Infinity, -Infinity, -Infinity];
    batchBytes = 0;
  }

  for await (const feature of source.getFeaturesAsync(envelope)) {
    if (featuresProcessed === 0) {
      helpers.log("starting processing of first source feature");
    }
    featuresProcessed++;
    const percent = (featuresProcessed / estimate.features) * 100;
    await helpers.progress(
      percent,
      `Processing features: (${featuresProcessed}/${estimate.features})`
    );

    let hasChanged = false;
    let intersection: clipping.Geom;
    const classification = outerPolygonContainerIndex.classify(feature);
    if (helpers.logFeature) {
      helpers.logFeature(layers.classifiedSourceFeatures, {
        ...feature,
        properties: {
          category: classification,
        },
      });
    }
    if (classification === "outside") {
      // This feature is completely outside the geography, so we can skip it.
      continue;
    } else if (classification === "mixed") {
      // This feature is partially within the geography, so we need to perform
      // a clipping operation.
      hasChanged = true;
      feature.geometry.coordinates = clipping.intersection(
        intersectionGeom,
        feature.geometry.coordinates as clipping.Geom
      );
      // clipping always results in a MultiPolygon
      feature.geometry.type = "MultiPolygon";
      if (helpers.logFeature) {
        helpers.logFeature(layers.outerPolygonIntersectionResults, {
          ...feature,
          properties: { category: "outer-polygon-intersection-results" },
          geometry: {
            type: "MultiPolygon",
            coordinates: feature.geometry.coordinates,
          },
        });
      }
    } else {
      // This feature is entirely within the geography, so we can skip clipping
      // but still need to check the difference layer(s), then count it's
      // remaining area.
    }

    const bboxes = splitBBoxAntimeridian(bbox(feature.geometry));
    const splitEnvelopes = bboxes.map(bboxToEnvelope);

    if (splitEnvelopes.length > 1) {
      throw new Error("Split envelopes should not be greater than 1");
    }

    let hits = 0;
    for (const diffLayer of differenceSources) {
      const matches = diffLayer.source.countAndBytesForQuery(splitEnvelopes);
      if (matches.features > 0) {
        hits += matches.features;
        if (batchBytes + matches.bytes > CLIPPING_BATCH_SIZE) {
          await processBatch();
        }

        // If the combined bbox crosses the antimeridian, process the batch
        if (
          splitBBoxAntimeridian(
            combineBBoxes(
              batchBBox,
              bboxes[0] as [number, number, number, number]
            )
          ).length > 1
        ) {
          await processBatch();
        }

        batchBytes += matches.bytes;
        batchBBox = combineBBoxes(
          batchBBox,
          bboxes[0] as [number, number, number, number]
        );
        if (isValid(feature)) {
          batchedFeatures.push(feature);
        } else {
          console.log(isValid(feature));
          throw new Error("Invalid feature");
        }
      } else {
        addFeatureToTotals(feature, hasChanged);
      }
    }

    // let differenceGeoms = [] as clipping.Geom[];
    // if (differenceSources.length > 0) {
    //   for (const diffLayer of differenceSources) {
    //     for await (const differenceFeature of diffLayer.source.getFeaturesAsync(
    //       splitEnvelopes
    //     )) {
    //       differenceReferences++;
    //       if (
    //         !diffLayer.cql2Query ||
    //         evaluateCql2JSONQuery(
    //           diffLayer.cql2Query,
    //           differenceFeature.properties
    //         )
    //       ) {
    //         if (
    //           helpers.logFeature &&
    //           !loggedDifferenceFeatures.has(
    //             `${differenceSources.indexOf(diffLayer)}-${
    //               differenceFeature.properties?.__offset
    //             }`
    //           )
    //         ) {
    //           helpers.logFeature(layers.allDifferenceFeatures, {
    //             ...differenceFeature,
    //             properties: {
    //               offset: differenceFeature.properties?.__offset || 0,
    //             },
    //           });
    //         }
    //         differenceGeoms.push(
    //           differenceFeature.geometry.coordinates as clipping.Geom
    //         );
    //       }
    //     }
    //   }
    // }
    // if (differenceGeoms.length > 0) {
    //   hasChanged = true;
    //   feature.geometry.coordinates = clipping.difference(
    //     feature.geometry.coordinates as clipping.Geom,
    //     ...differenceGeoms
    //   );
    // } else {
    //   // no difference geoms to process
    // }
    // if (helpers.logFeature) {
    //   helpers.logFeature(layers.differenceLayerIntesectionState, {
    //     type: "Feature",
    //     properties: {
    //       category: hasChanged ? "would-clip" : "no-intersection-w-diff",
    //     },
    //     geometry: feature.geometry,
    //   });
    // }
    // if (helpers.logFeature) {
    //   if (hasChanged) {
    //     helpers.logFeature(layers.finalProductFeatures, {
    //       type: "Feature",
    //       properties: {},
    //       geometry: {
    //         type: "MultiPolygon",
    //         // @ts-ignore
    //         coordinates: feature.geometry.coordinates,
    //       },
    //     });
    //   } else {
    //     helpers.logFeature(layers.finalProductFeatures, {
    //       ...feature,
    //     });
    //   }
    // }
    // addFeatureToTotals(feature, hasChanged);
  }

  await processBatch();

  return areaByClassId;
}

function combineBBoxes(
  bboxA: [number, number, number, number],
  bboxB: [number, number, number, number]
): [number, number, number, number] {
  return [
    Math.min(bboxA[0], bboxB[0]),
    Math.min(bboxA[1], bboxB[1]),
    Math.max(bboxA[2], bboxB[2]),
    Math.max(bboxA[3], bboxB[3]),
  ];
}
