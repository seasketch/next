import {
  FeatureReference,
  FeatureWithMetadata,
  FlatGeobufSource,
} from "fgb-source";
import { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import { ContainerIndex } from "./utils/containerIndex";
import {
  GuaranteedOverlayWorkerHelpers,
  guaranteeHelpers,
  OverlayWorkerHelpers,
  OverlayWorkerLogFeatureLayerConfig,
} from "./utils/helpers";
import { bboxToEnvelope, splitBBoxAntimeridian } from "./utils/bboxUtils";
import bbox from "@turf/bbox";
import calcArea from "@turf/area";
import { Cql2Query, evaluateCql2JSONQuery } from "./cql2";
import * as clipping from "polyclip-ts";
import { clipBatch } from "./workers/clipBatch";
import PQueue from "p-queue";
import { createClippingWorkerPool, WorkerPool } from "./workers/pool";
import truncate from "@turf/truncate";

export { createClippingWorkerPool };

const layers: Record<string, OverlayWorkerLogFeatureLayerConfig> = {
  classifiedFeatures: {
    name: "classified-features",
    geometryType: "Polygon",
    fields: {
      classification: "string",
      groupBy: "string",
    },
  },
  containerIndexBoxes: {
    name: "container-index-boxes",
    geometryType: "Polygon",
    fields: {
      id: "number",
    },
  },
  subjectFeature: {
    name: "subject-feature",
    geometryType: "Polygon",
    fields: {},
  },
};

type BatchData = {
  weight: number;
  progressWorth: number;
  differenceSourceReferences: {
    [layerId: string]: {
      offsets: Set<number>;
      references: FeatureReference[];
    };
  };
  features: {
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[];
};

export class OverlappingAreaBatchedClippingProcessor {
  /**
   * Current weight of the batch. Once the weight exceeds the batch size, the
   * batch is processed. These values should be based on the complexity of the
   * features in the batch. If the input is an fgb features with a __byteLength
   * property, that should be used. For features that area already deserialized
   * or processed into GeoJSON, a comparable value should be used such as the
   * byte length of the GeoJSON / 10, to account for the difference of the
   * buffer fgb features size vs GeoJSON text.
   */
  maxBatchSize: number = 0;
  subjectFeature: Feature<Polygon | MultiPolygon>;
  containerIndex: ContainerIndex;
  intersectionSource: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
  differenceSources: {
    layerId: string;
    source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
    cql2Query?: Cql2Query | undefined;
  }[];
  helpers: GuaranteedOverlayWorkerHelpers;
  groupBy?: string;
  results: { [classKey: string]: number } = { "*": 0 };
  batchData!: BatchData;
  batchPromises: Promise<any>[] = [];
  pool?: WorkerPool<any, any>;
  queue: PQueue;

  private progress: number = 0;
  private progressTarget: number = 0;

  constructor(
    maxBatchSize: number,
    subjectFeature: Feature<Polygon | MultiPolygon>,
    intersectionSource: FlatGeobufSource<Feature<Polygon | MultiPolygon>>,
    differenceSources: {
      layerId: string;
      source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
      cql2Query?: Cql2Query | undefined;
    }[],
    helpers: OverlayWorkerHelpers,
    groupBy?: string,
    pool?: WorkerPool<any, any>
  ) {
    this.pool = pool;
    this.intersectionSource = intersectionSource;
    this.differenceSources = differenceSources;
    this.maxBatchSize = maxBatchSize;
    this.subjectFeature = subjectFeature;
    this.helpers = guaranteeHelpers(helpers);
    console.time("build container index");
    this.containerIndex = new ContainerIndex(subjectFeature);
    console.timeEnd("build container index");
    const boxes = this.containerIndex.getBBoxPolygons();
    let id = 0;
    for (const box of boxes.features) {
      box.properties = { id: id++ };
      if (this.helpers.logFeature) {
        this.helpers.logFeature(layers.containerIndexBoxes, box);
      }
    }
    this.groupBy = groupBy;
    this.resetBatchData();

    this.queue = new PQueue({
      concurrency: this.pool?.size || 1,
    });
    if (this.helpers.logFeature) {
      this.helpers.logFeature(layers.subjectFeature, subjectFeature);
    }
  }

  resetBatchData() {
    this.batchData = {
      weight: this.weightForFeature(
        this.subjectFeature as FeatureWithMetadata<
          Feature<Polygon | MultiPolygon>
        >
      ),
      progressWorth: 0,
      differenceSourceReferences: this.differenceSources.reduce(
        (acc, curr) => {
          return {
            ...acc,
            [curr.layerId]: {
              offsets: new Set<number>(),
              references: [],
            },
          };
        },
        {} as {
          [layerId: string]: {
            offsets: Set<number>;
            references: FeatureReference[];
          };
        }
      ),
      features: [] as {
        feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
      }[],
    };
  }

  async calculateOverlap(): Promise<{ [classKey: string]: number }> {
    return new Promise(async (resolve, reject) => {
      try {
        this.progress = 0;
        // Step 1. Create query plan for fetching features from the intersection
        // source which overlap the bounding box of the subject feature. Based on
        // how many bytes of features are estimated to be returned, determine the
        // batch size to use when clipping.
        const envelopes = splitBBoxAntimeridian(
          bbox(this.subjectFeature.geometry)
        ).map(bboxToEnvelope);
        const queryPlan = this.intersectionSource.createPlan(envelopes);
        const concurrency = this.pool?.size || 1;
        // The default max batch size is helpful when working with very large
        // datasets. For example, if clipping to 100MB of features, we may want to
        // work in batches of 5MB, rather than 100MB / 6 threads. That could cause
        // very large pauses in the processing of the features.
        let BATCH_SIZE = this.maxBatchSize;
        if (
          queryPlan.estimatedBytes.features / concurrency <
          this.maxBatchSize
        ) {
          // Ideally, batch size would be based on the number of threads used to
          // perform the clipping operation.
          BATCH_SIZE = Math.round(
            queryPlan.estimatedBytes.features / concurrency
          );
        }
        this.helpers.log(
          `Using batch size of ${BATCH_SIZE} for ${queryPlan.estimatedBytes.features} estimated bytes of features. Concurrency is ${concurrency}, and max batch size setting is ${this.maxBatchSize}`
        );

        this.progressTarget = queryPlan.estimatedBytes.features;

        // Step 2. Start working through the features, quickly discarding those that
        // are completely outside the subject feature, and collecting size data from
        // those entirely within. For those that are partially within, or need to be
        // clipping against a difference layer, put them into the current batch.
        for await (const feature of this.intersectionSource.getFeaturesAsync(
          envelopes,
          {
            queryPlan,
          }
        )) {
          truncate(feature, { mutate: true });
          this.helpers.progress(
            (this.progress / this.progressTarget) * 100,
            `Processing features: (${this.progress}/${this.progressTarget} bytes)`
          );
          let requiresIntersection = false;
          const classification = this.containerIndex.classify(feature);
          if (this.helpers.logFeature) {
            this.helpers.logFeature(layers.classifiedFeatures, {
              type: "Feature",
              geometry: feature.geometry,
              properties: {
                classification,
                groupBy: feature.properties?.[this.groupBy || ""] || "",
              },
            });
          }
          if (classification === "outside") {
            // We can safely skip this feature.
            this.progress++;
            // requiresIntersection = true;
            continue;
          } else if (classification === "mixed") {
            // This feature will need to be clipped against the subject feature to
            // find the intersection.
            requiresIntersection = true;
          } else {
            // Requires no clipping against the subject feature, but still may need
            // to be clipped against a difference layer(s) to find the difference.
          }
          let requiresDifference = false;
          for (const differenceSource of this.differenceSources) {
            // Note that since we're searching without first clipping the feature
            // to the subject feature, we may be matching on a bigger bounding box
            // than optimal. But since sources are subdivided into smaller chunks
            // this shouldn't have a significant impact.
            const matches = differenceSource.source.search(
              bboxToEnvelope(bbox(feature.geometry))
            );
            if (matches.features > 0) {
              requiresDifference = true;
              this.addDifferenceFeatureReferencesToBatch(
                differenceSource.layerId,
                matches.refs
              );
            }
          }
          if (!requiresIntersection && !requiresDifference) {
            // feature is entirely within the subject feature, so we can skip
            // clipping. Just need to add it's area to the appropriate total(s).
            this.addFeatureToTotals(feature, true);
            this.progress += feature.properties?.__byteLength;
          } else {
            // add feature to batch for clipping
            this.addFeatureToBatch(
              feature,
              requiresIntersection,
              requiresDifference
            );
          }
          if (this.batchData.weight >= BATCH_SIZE) {
            const differenceMultiPolygon =
              await this.getDifferenceMultiPolygon();
            if (this.queue && this.queue.isSaturated) {
              this.helpers.log("Waiting for worker pool to drain");
              await this.queue.onSizeLessThan(this.queue.concurrency);
            }
            let batchData = this.batchData;
            this.batchPromises.push(
              this.queue.add(() =>
                this.processBatch(batchData, differenceMultiPolygon).catch(
                  (e) => {
                    console.error(`Error processing batch: ${e.message}`);
                    reject(e);
                  }
                )
              )
            );
            this.resetBatchData();
          }
        }
        if (this.batchData.features.length > 0) {
          const differenceMultiPolygon = await this.getDifferenceMultiPolygon();
          this.batchPromises.push(
            this.processBatch(this.batchData, differenceMultiPolygon)
          );
          this.resetBatchData();
        }
        const resolvedBatchData = await Promise.all(this.batchPromises);
        this.helpers.log(`Resolved ${resolvedBatchData.length} batches`);
        for (const batchData of resolvedBatchData) {
          for (const classKey in batchData) {
            if (!(classKey in this.results)) {
              this.results[classKey] = 0;
            }
            this.results[classKey] += batchData[classKey];
          }
        }
        // Do not destroy the shared Piscina instance here; it may be reused by subsequent batches/invocations.
        // await pool.destroy();
        resolve(this.results);
      } catch (e) {
        reject(e);
      }
    });
  }

  async processBatch(
    batch: BatchData,
    differenceMultiPolygon: clipping.Geom[]
  ): Promise<{ [classKey: string]: number }> {
    if (batch.features.length === 0) {
      throw new Error("Batch has no features");
    }
    this.progress += batch.progressWorth;
    this.helpers.progress((this.progress / this.progressTarget) * 100);
    const classKeysInBatch = batch.features.map(
      (f) => f.feature.properties?.[this.groupBy || ""]
    );
    if (this.pool) {
      return this.pool
        .run({
          features: batch.features,
          differenceMultiPolygon: differenceMultiPolygon,
          subjectFeature: this.subjectFeature,
          groupBy: this.groupBy,
        })
        .catch((error) => {
          console.error(
            `Error processing batch in worker: ${
              error && (error.stack || error.message || error)
            }`
          );
          throw error;
        });
    } else {
      return clipBatch({
        features: batch.features,
        differenceMultiPolygon: differenceMultiPolygon,
        subjectFeature: this.subjectFeature,
        groupBy: this.groupBy,
      }).catch((error) => {
        console.error(`Error processing batch: ${error.message}`);
        throw error;
      });
    }
  }

  async getDifferenceMultiPolygon(): Promise<clipping.Geom[]> {
    // fetch the difference features, and combine into a single multipolygon
    const differenceMultiPolygon = [] as clipping.Geom[];
    await Promise.all(
      Object.keys(this.batchData.differenceSourceReferences).map(
        async (layerId) => {
          const refs =
            this.batchData.differenceSourceReferences[layerId].references;
          const d = this.differenceSources.find((s) => s.layerId === layerId);
          if (!d) {
            throw new Error(
              `Difference source not found for layer ID: ${layerId}`
            );
          }
          const { source, cql2Query } = d;
          const queryPlan = source.getQueryPlan(refs);
          for await (const feature of source.getFeaturesAsync([], {
            queryPlan,
          })) {
            if (
              cql2Query &&
              !evaluateCql2JSONQuery(cql2Query, feature.properties)
            ) {
              continue;
            }
            if (feature.geometry.type === "Polygon") {
              differenceMultiPolygon.push(
                feature.geometry.coordinates as clipping.Geom
              );
            } else {
              for (const poly of feature.geometry.coordinates) {
                differenceMultiPolygon.push(poly as clipping.Geom);
              }
            }
          }
        }
      )
    );
    return differenceMultiPolygon;
  }

  addFeatureToTotals(
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>,
    usePrecomputedArea: boolean = false
  ) {
    // get area in square kilometers
    const area =
      usePrecomputedArea && feature.properties?.__area
        ? feature.properties?.__area
        : calcArea(feature) * 1e-6;
    this.results["*"] += area;
    if (this.groupBy) {
      const classKey = feature.properties?.[this.groupBy];
      if (classKey) {
        this.results[classKey] = this.results[classKey] || 0;
        this.results[classKey] += area;
      }
    }
  }

  addDifferenceFeatureReferencesToBatch(
    layerId: string,
    refs: FeatureReference[]
  ) {
    for (const ref of refs) {
      if (
        !this.batchData.differenceSourceReferences[layerId].offsets.has(ref[0])
      ) {
        this.batchData.differenceSourceReferences[layerId].offsets.add(ref[0]);
        this.batchData.differenceSourceReferences[layerId].references.push(ref);
        this.batchData.weight += ref[1] || 1000; // default to 1KB if no byte length is provided
      }
    }
  }

  addFeatureToBatch(
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>,
    requiresIntersection: boolean,
    requiresDifference: boolean
  ) {
    this.batchData.features.push({
      feature,
      requiresIntersection,
      requiresDifference,
    });
    this.batchData.weight += this.weightForFeature(feature);
    this.batchData.progressWorth += feature.properties?.__byteLength || 1000;
  }

  weightForFeature(
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>
  ) {
    let weight = feature.properties?.__byteLength;
    if (weight === undefined || weight === null) {
      // base weight on number of vertices in the feature
      if (feature.geometry.type === "Polygon") {
        weight = feature.geometry.coordinates.length;
      } else {
        weight = feature.geometry.coordinates.reduce(
          (acc, curr) => acc + curr.length,
          0
        );
      }
    }
    return weight;
  }
}
