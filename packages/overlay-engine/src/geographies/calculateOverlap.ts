import { FeatureReference, FeatureWithMetadata, SourceCache } from "fgb-source";
import { ClippingLayerOption, initializeGeographySources } from "./geographies";
import { SourceType } from "../metrics/metrics";
import {
  guaranteeHelpers,
  OverlayWorkerHelpers,
  OverlayWorkerLogFeatureLayerConfig,
} from "../utils/helpers";
import { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import { evaluateCql2JSONQuery } from "../cql2";
import { bbox } from "@turf/bbox";
import { bboxToEnvelope, splitBBoxAntimeridian } from "../utils/bboxUtils";
import * as clipping from "polyclip-ts";
import calcArea from "@turf/area";
import simplify from "@turf/simplify";
import { ContainerIndex } from "../utils/containerIndex";
import fs from "fs";
import isValid from "@turf/boolean-valid";
import { union } from "union-subdivided-polygons";

const layers: Record<string, OverlayWorkerLogFeatureLayerConfig> = {
  batchedDifferenceFeatures: {
    name: "batched-difference-features",
    geometryType: "MultiPolygon",
    fields: {
      id: "number",
    },
  },
  batchedOriginalFeatures: {
    name: "batched-original-features",
    geometryType: "MultiPolygon",
    fields: {
      id: "number",
      category: "string",
    },
  },
  batchedJoinedFeatures: {
    name: "batched-joined-features",
    geometryType: "Polygon",
    fields: {
      id: "number",
      category: "string",
    },
  },
  batchedDiffProducts: {
    name: "batched-diff-products",
    geometryType: "MultiPolygon",
    fields: {
      id: "number",
      category: "string",
    },
  },
  unbatchedFeatures: {
    name: "unbatched-features",
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
        layerId: layer.source,
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
  const estimate = await source.search(envelope);
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
      area = calcArea(feature) * 1e-6;
    }
    areaByClassId["*"] += area;
    if (groupBy && feature.properties) {
      const classKey = feature.properties[groupBy];
      if (classKey !== undefined) {
        areaByClassId[classKey] = areaByClassId[classKey] || 0;
        areaByClassId[classKey] += area;
      }
    }
  }

  const intersectionGeom = intersectionFeatureGeojson.geometry
    .coordinates as clipping.Geom;

  const batch = new DifferenceClippingBatch(
    differenceLayers.map((d) => d.source)
  );

  async function processBatch() {
    const refscount = Object.values(batch.offsets).reduce(
      (acc, curr) => acc + curr.length,
      0
    );
    console.log(
      `processing batch #${batch.id}`,
      batch.features.length,
      batch.bytes + " bytes",
      `${refscount} offsets`
    );

    const diffGeoms = [] as clipping.Geom[];

    for (const diffSource of differenceSources) {
      const refs = batch.offsets[diffSource.layerId];
      const queryPlan = diffSource.source.getQueryPlan(refs);
      if (refs.length > 0) {
        for await (const diffFeature of diffSource.source.getFeaturesAsync(
          bboxToEnvelope(batch.bbox),
          {
            queryPlan,
          }
        )) {
          if (
            diffSource.cql2Query &&
            !evaluateCql2JSONQuery(diffSource.cql2Query, diffFeature.properties)
          ) {
            continue;
          }
          diffGeoms.push(diffFeature.geometry.coordinates as clipping.Geom);
        }
      }
    }

    if (helpers.logFeature) {
      for (const geom of diffGeoms) {
        helpers.logFeature(layers.batchedDifferenceFeatures, {
          type: "Feature",
          properties: { id: batch.id, category: "difference-layer" },
          geometry: {
            type: "Polygon",
            // @ts-ignore
            coordinates: geom,
          },
        });
      }
    }

    if (helpers.logFeature) {
      for (const feature of batch.features) {
        helpers.logFeature(layers.batchedOriginalFeatures, {
          ...feature,
          properties: {
            id: feature.properties?.__offset,
            category: feature.properties?.[groupBy || ""] || "original-feature",
          },
        });
      }
    }

    const groupedGeoms = groupGeomsByClassKey(batch.features, groupBy);

    if (helpers.logFeature) {
      for (const classKey in groupedGeoms) {
        if (groupedGeoms[classKey].length === 0) {
          continue;
        }
        for (const geom of groupedGeoms[classKey]) {
          const f = {
            type: "Feature",
            properties: { id: batch.id, category: classKey + `-joined` },
            geometry: {
              type: "Polygon",
              // @ts-ignore
              coordinates: geom,
            },
          } as Feature<Polygon>;
          helpers.logFeature(layers.batchedJoinedFeatures, f);
        }
      }
    }

    if (groupBy) {
      for (const classKey in groupedGeoms) {
        if (classKey === "*") {
          continue;
        }
        const product = {
          type: "Feature",
          properties: {
            id: batch.id,
            [groupBy]: classKey,
          },
          geometry: {
            type: "MultiPolygon",
            // coordinates: groupedGeoms[classKey],
            coordinates: clipping.difference(
              groupedGeoms[classKey] as clipping.Geom,
              ...diffGeoms
            ),
          },
        } as Feature<Polygon | MultiPolygon>;
        // if (!isValid(product)) {
        //   throw new Error("Invalid product");
        // }
        if (helpers.logFeature) {
          helpers.logFeature(layers.batchedDiffProducts, {
            ...product,
            properties: {
              id: batch.id,
              category: classKey + `-diffed`,
            },
          });
        }
        addFeatureToTotals(product, true);
      }
    } else {
      const product = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: clipping.difference(
            groupedGeoms["*"] as clipping.Geom,
            ...diffGeoms
          ),
        },
      } as Feature<Polygon | MultiPolygon>;
      addFeatureToTotals(product, true);
    }

    batch.reset();
  }

  const clippingBatchSize =
    estimate.bytes < 1024 * 1024 ? estimate.bytes / 4 : CLIPPING_BATCH_SIZE;

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
    if (classification === "outside") {
      // This feature is completely outside the geography, so we can skip it.
      continue;
    } else if (classification === "mixed") {
      // This feature is partially within the geography, so we need to perform
      // a clipping operation.
      hasChanged = true;
      // clipping always results in a MultiPolygon
      feature.geometry.type = "MultiPolygon";
      feature.geometry.coordinates = clipping.intersection(
        intersectionGeom,
        feature.geometry.coordinates as clipping.Geom
      );
    } else {
      // This feature is entirely within the geography, so we can skip clipping
      // but still need to check the difference layer(s), then count it's
      // remaining area.
    }

    const bboxes = splitBBoxAntimeridian(bbox(feature.geometry));
    const splitEnvelopes = bboxes.map(bboxToEnvelope);

    let hasHits = false;
    for (const diffLayer of differenceSources) {
      const matches = diffLayer.source.search(splitEnvelopes);
      if (matches.features > 0) {
        batch.addDifferenceFeatureReferences(diffLayer.layerId, matches.refs);
        hasHits = true;
      }
    }
    if (hasHits) {
      batch.addFeature(feature);
      if (batch.bytes >= clippingBatchSize) {
        await processBatch();
      }
    } else {
      if (helpers.logFeature) {
        helpers.logFeature(layers.unbatchedFeatures, {
          ...feature,
          properties: {
            id: feature.properties?.__offset,
            category:
              feature.properties?.[groupBy || ""] || "unbatched-feature",
          },
        });
      }
      addFeatureToTotals(feature, hasChanged);
    }
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

class DifferenceClippingBatch {
  id: number;
  features: Feature<Polygon | MultiPolygon>[];
  offsets: { [sourceId: string]: FeatureReference[] };
  offsetIds: { [sourceId: string]: Set<number> };
  bbox: [number, number, number, number];
  bytes: number;
  layerIds: string[];

  constructor(layerIds: string[]) {
    this.id = batchedFeaturesId++;
    this.features = [];
    this.offsets = layerIds.reduce((l, id) => ({ ...l, [id]: [] }), {}) as {
      [sourceId: string]: FeatureReference[];
    };
    this.offsetIds = layerIds.reduce(
      (l, id) => ({ ...l, [id]: new Set<number>() }),
      {}
    ) as { [sourceId: string]: Set<number> };
    this.bbox = [Infinity, Infinity, -Infinity, -Infinity];
    this.layerIds = layerIds;
    this.bytes = 0;
  }

  reset() {
    this.features = [];
    this.bbox = [Infinity, Infinity, -Infinity, -Infinity];
    this.bytes = 0;
    this.id = batchedFeaturesId++;
    this.offsets = this.layerIds.reduce(
      (l, id) => ({ ...l, [id]: [] }),
      {}
    ) as { [sourceId: string]: FeatureReference[] };
  }

  addFeature(feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>) {
    this.features.push(feature as unknown as Feature<Polygon | MultiPolygon>);
    this.bytes += feature.properties?.__byteLength || 0;
    this.bbox = combineBBoxes(
      this.bbox,
      feature.bbox as [number, number, number, number]
    );
  }

  addDifferenceFeatureReferences(layerId: string, refs: FeatureReference[]) {
    for (const ref of refs) {
      if (!this.offsetIds[layerId].has(ref[0])) {
        this.offsets[layerId].push(ref);
        this.offsetIds[layerId].add(ref[0]);
        this.bytes += ref[1] || 0;
      }
    }
  }
}

export function groupGeomsByClassKey(
  features: Feature<Polygon | MultiPolygon>[],
  groupBy?: string
) {
  const geoms = {
    "*": [] as clipping.Geom[],
  } as { [key: string]: clipping.Geom[] };

  for (const feature of features) {
    const area = calcArea(feature) * 1e-6;
    if (groupBy) {
      const classKey = feature.properties?.[groupBy];
      if (classKey) {
        if (!(classKey in geoms)) {
          geoms[classKey] = [];
        }
        if (feature.geometry.type === "Polygon") {
          geoms[classKey].push(feature.geometry.coordinates as clipping.Geom);
        } else {
          for (const poly of feature.geometry.coordinates) {
            geoms[classKey].push(poly as clipping.Geom);
          }
        }
      }
    } else {
      if (feature.geometry.type === "Polygon") {
        geoms["*"].push(feature.geometry.coordinates as clipping.Geom);
      } else {
        for (const poly of feature.geometry.coordinates) {
          geoms["*"].push(poly as clipping.Geom);
        }
      }
    }
  }
  return geoms;
}
