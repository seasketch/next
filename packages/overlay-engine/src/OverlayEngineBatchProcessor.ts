import {
  FeatureReference,
  FeatureWithMetadata,
  FlatGeobufSource,
} from "fgb-source";
import {
  Feature,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
  Point,
  MultiPoint,
  Geometry,
} from "geojson";
import { ContainerIndex } from "./utils/containerIndex";
import type { CandidateFeature } from "./utils/containerIndex";
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
import {
  addColumnValuesToResults,
  clipBatch,
  collectColumnValues,
  ColumnValues,
  countFeatures,
  pick,
  testForPresenceInSubject,
} from "./workers/clipBatch";
import PQueue from "p-queue";
import { createClippingWorkerPool, WorkerPool } from "./workers/pool";
import truncate from "@turf/truncate";
import {
  OverlayAreaMetric,
  CountMetric,
  PresenceMetric,
  PresenceTableMetric,
  PresenceTableValue,
  ColumnValuesMetric,
  NumberColumnValueStats,
  StringOrBooleanColumnValueStats,
  ValuesForColumns,
} from "./metrics/metrics";
import { downsampleHistogram } from "./rasterStats";
import { createUniqueIdIndex, countUniqueIds } from "./utils/uniqueIdIndex";
import turfLength from "@turf/length";

export { createClippingWorkerPool };

export type OperationType =
  | "overlay_area"
  | "count"
  | "presence"
  | "presence_table"
  | "column_values";

/**
 * Maps operation types to their corresponding metric value types
 */
type OperationResultTypeMap = {
  overlay_area: OverlayAreaMetric["value"];
  count: CountMetric["value"];
  presence: PresenceMetric["value"];
  presence_table: PresenceTableMetric["value"];
  column_values: ColumnValuesMetric["value"];
};

/**
 * Gets the result type for a given operation type
 */
export type OperationResultType<TOp extends OperationType> =
  OperationResultTypeMap[TOp];

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
    feature: FeatureWithMetadata<Feature<Geometry>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[];
};

export class OverlayEngineBatchProcessor<
  TOp extends OperationType = OperationType
> {
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
  operation: TOp;
  subjectFeature: Feature<Polygon | MultiPolygon>;
  containerIndex: ContainerIndex;
  intersectionSource: FlatGeobufSource<Feature<Geometry>>;
  differenceSources: {
    layerId: string;
    source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
    cql2Query?: Cql2Query | undefined;
  }[];
  helpers: GuaranteedOverlayWorkerHelpers;
  groupBy?: string;
  results: OperationResultType<TOp> | { [classKey: string]: ColumnValues[] };
  // Interim storage for count operation IDs (before converting to UniqueIdIndex)
  private countInterimIds: { [groupBy: string]: number[] } = {};
  batchData!: BatchData;
  batchPromises: Promise<any>[] = [];
  pool?: WorkerPool<any, any>;
  queue: PQueue;
  presenceOperationEarlyReturn = false;
  includedProperties?: string[];
  resultsLimit = 50;
  columnValuesProperty?: string;

  private progress: number = 0;
  private progressTarget: number = 0;

  // Type guard helpers
  private isOverlayAreaOperation(): this is OverlayEngineBatchProcessor<"overlay_area"> {
    return this.operation === "overlay_area";
  }

  private isCountOperation(): this is OverlayEngineBatchProcessor<"count"> {
    return this.operation === "count";
  }

  private isPresenceOperation(): this is OverlayEngineBatchProcessor<"presence"> {
    return this.operation === "presence";
  }

  private isPresenceTableOperation(): this is OverlayEngineBatchProcessor<"presence_table"> {
    return this.operation === "presence_table";
  }

  private isColumnValuesOperation(): this is OverlayEngineBatchProcessor<"column_values"> {
    return this.operation === "column_values";
  }

  private getColumnValuesResults(): {
    [classKey: string]: {
      [attr: string]: ColumnValues[];
    };
  } {
    return this.results as unknown as {
      [classKey: string]: {
        [attr: string]: ColumnValues[];
      };
    };
  }

  // Operation-specific result getters with proper typing
  private getOverlayResults(): OperationResultType<"overlay_area"> {
    return this.results as OperationResultType<"overlay_area">;
  }

  private getPresenceTableResults(): OperationResultType<"presence_table"> {
    return this.results as OperationResultType<"presence_table">;
  }

  // Initialize results based on operation type
  private initializeResults(
    op: OperationType
  ): OperationResultType<TOp> | { [classKey: string]: ColumnValues[] } {
    if (op === "count") {
      // Initialize interim ID storage
      this.countInterimIds = { "*": [] };
      // Return empty structure - will be populated at the end
      return {} as unknown as OperationResultType<TOp>;
    } else if (op === "presence_table") {
      return {
        values: [],
        exceededLimit: false,
      } as unknown as OperationResultType<TOp>;
    } else if (op === "presence") {
      return false as unknown as OperationResultType<TOp>;
    } else if (op === "column_values") {
      return {
        "*": [],
      } as unknown as { [classKey: string]: ColumnValues[] };
    } else if (op === "overlay_area") {
      return { "*": 0 } as unknown as OperationResultType<TOp>;
    } else {
      throw new Error(`Invalid operation type: ${op}`);
    }
  }

  constructor(
    operation: TOp,
    maxBatchSize: number,
    subjectFeature: Feature<Polygon | MultiPolygon>,
    intersectionSource: FlatGeobufSource<Feature<Geometry>>,
    differenceSources: {
      layerId: string;
      source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
      cql2Query?: Cql2Query | undefined;
    }[],
    helpers: OverlayWorkerHelpers,
    groupBy?: string,
    pool?: WorkerPool<any, any>,
    includedProperties?: string[],
    resultsLimit?: number,
    columnValuesProperty?: string
  ) {
    this.operation = operation;
    this.pool = pool;
    this.intersectionSource = intersectionSource;
    this.differenceSources = differenceSources;
    this.maxBatchSize = maxBatchSize;
    this.subjectFeature = subjectFeature;
    this.helpers = guaranteeHelpers(helpers);

    this.containerIndex = new ContainerIndex(subjectFeature);
    const boxes = this.containerIndex.getBBoxPolygons();
    let id = 0;
    for (const box of boxes.features) {
      box.properties = { id: id++ };
      if (this.helpers.logFeature) {
        this.helpers.logFeature(layers.containerIndexBoxes, box);
      }
    }
    this.groupBy = groupBy;
    // Initialize results based on operation type
    this.results = this.initializeResults(operation);
    this.resetBatchData();

    this.queue = new PQueue({
      concurrency: this.pool?.size || 1,
    });
    if (this.helpers.logFeature) {
      this.helpers.logFeature(layers.subjectFeature, subjectFeature);
    }
    this.includedProperties = includedProperties;
    if (resultsLimit) {
      this.resultsLimit = resultsLimit;
    }
    if (this.operation === "column_values") {
      this.columnValuesProperty = columnValuesProperty;
      // if (!this.columnValuesProperty) {
      //   throw new Error(
      //     "columnValuesProperty is required for column_values operation"
      //   );
      // }
    }
  }

  private resetBatchData() {
    this.batchData = {
      weight: this.weightForFeature(
        this.subjectFeature as FeatureWithMetadata<Feature<Geometry>>
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
        feature: FeatureWithMetadata<Feature<Geometry>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
      }[],
    };
  }

  async calculate(): Promise<OperationResultType<TOp>> {
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
          if (this.presenceOperationEarlyReturn) {
            this.progress = this.progressTarget;
            this.results = true as OperationResultType<TOp>;
            return resolve(this.results);
          }
          truncate(feature, { mutate: true });
          this.helpers.progress(
            (this.progress / this.progressTarget) * 100,
            `Processing features: (${this.progress}/${this.progressTarget} bytes)`
          );
          let requiresIntersection = false;
          // ContainerIndex.classify supports Polygon, MultiPolygon, Point, MultiPoint, LineString, and MultiLineString
          const classification = this.containerIndex.classify(
            feature as CandidateFeature
          );
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
            // This feature will need to be clipped against the subject feature
            // to find the intersection, if we're doing an overlay area
            // operation. If we're doing a count operation, we don't need to
            // clip against the subject feature. We know it intersects in some
            // way, so we'll count it.
            requiresIntersection =
              this.operation === "overlay_area" ||
              this.operation === "column_values"
                ? true
                : false;
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
            // Presence operations are a special case here, as it't the only
            // one that triggers an early return.
            if (this.operation === "presence") {
              this.progress = this.progressTarget;
              this.results = true as OperationResultType<TOp>;
              return resolve(this.results);
            } else {
              // feature is entirely within the subject feature, so we can skip
              // clipping. Just need to add it to the appropriate total(s).
              this.addIndividualFeatureToResults(feature);
              this.progress += feature.properties?.__byteLength || 0;
            }
          } else {
            // add feature to batch for clipping
            this.addFeatureToBatch(
              feature,
              requiresIntersection,
              requiresDifference
            );
          }
          // Only process batch if it has features AND weight threshold is reached
          // (weight can exceed threshold due to difference references even without features)
          if (
            this.batchData.features.length > 0 &&
            this.batchData.weight >= BATCH_SIZE
          ) {
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
                    console.error(
                      `Error processing batch: ${(e as Error).message}`
                    );
                    reject(e);
                    throw e;
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

        if (this.isOverlayAreaOperation()) {
          this.mergeOverlayBatchResults(resolvedBatchData);
        } else if (this.isCountOperation()) {
          this.mergeCountBatchResults(resolvedBatchData);
          this.finalizeCountResults();
        } else if (this.isPresenceOperation()) {
          const hasMatch = resolvedBatchData.some((result) => result === true);
          if (hasMatch) {
            resolve(true as OperationResultType<TOp>);
          } else {
            resolve(false as OperationResultType<TOp>);
          }
        } else if (this.isPresenceTableOperation()) {
          this.mergePresenceTableBatchResults(resolvedBatchData);
        } else if (this.isColumnValuesOperation()) {
          this.mergeColumnValuesBatchResults(resolvedBatchData);
        }
        resolve(this.results as OperationResultType<TOp>);
      } catch (e) {
        reject(e);
      }
    });
  }

  private async processBatch(
    batch: BatchData,
    differenceMultiPolygon: clipping.Geom[]
  ): Promise<any> {
    if (batch.features.length === 0) {
      throw new Error("Batch has no features");
    }
    this.progress += batch.progressWorth;
    this.helpers.progress((this.progress / this.progressTarget) * 100);

    const batchPayload = {
      operation: this.operation,
      features: batch.features,
      differenceMultiPolygon: differenceMultiPolygon,
      subjectFeature: this.subjectFeature,
      groupBy: this.groupBy,
      includedProperties: this.includedProperties,
      resultsLimit: this.resultsLimit,
      property: this.columnValuesProperty,
    };

    this.helpers.log(
      `submitting batchPayload: ${JSON.stringify({
        operation: this.operation,
        features: batch.features.length,
        differenceMultiPolygon: differenceMultiPolygon.length,
        subjectFeature: this.subjectFeature.geometry.type,
        groupBy: this.groupBy,
        includedProperties: this.includedProperties,
        resultsLimit: this.resultsLimit,
      })}`
    );

    if (this.pool) {
      const result = await this.pool.run(batchPayload).catch((error) => {
        console.error(
          `Error processing batch in worker: ${
            error && (error.stack || error.message || error)
          }`
        );
        throw error;
      });
      if (this.isPresenceOperation() && result === true) {
        this.presenceOperationEarlyReturn = true;
      }
      return result;
    } else {
      if (this.isOverlayAreaOperation()) {
        return this.processOverlayBatch(batch, differenceMultiPolygon);
      } else if (this.isCountOperation()) {
        return this.processCountBatch(batch, differenceMultiPolygon);
      } else if (this.isPresenceOperation()) {
        return this.processPresenceBatch(batch, differenceMultiPolygon);
      } else if (this.isColumnValuesOperation()) {
        return this.processColumnValuesBatch(batch, differenceMultiPolygon);
      } else {
        throw new Error(`Unknown operation type: ${this.operation}`);
      }
    }
  }

  private async processColumnValuesBatch(
    batch: BatchData,
    differenceMultiPolygon: clipping.Geom[]
  ): Promise<{
    [classKey: string]: {
      [attr: string]: ColumnValues[];
    };
  }> {
    return collectColumnValues({
      features: batch.features,
      differenceMultiPolygon: differenceMultiPolygon,
      subjectFeature: this.subjectFeature,
      groupBy: this.groupBy,
      property: this.columnValuesProperty!,
    }).catch((error) => {
      console.error(`Error collecting column values: ${error.message}`);
      throw error;
    });
  }

  private async processOverlayBatch(
    batch: BatchData,
    differenceMultiPolygon: clipping.Geom[]
  ): Promise<OperationResultType<"overlay_area">> {
    return clipBatch({
      features: batch.features as {
        feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
      }[],
      differenceMultiPolygon: differenceMultiPolygon,
      subjectFeature: this.subjectFeature,
      groupBy: this.groupBy,
    }).catch((error) => {
      console.error(`Error processing batch: ${error.message}`);
      throw error;
    });
  }

  private async processCountBatch(
    batch: BatchData,
    differenceMultiPolygon: clipping.Geom[]
  ): Promise<{ [classKey: string]: number[] }> {
    // countFeatures returns { [classKey: string]: number[] } - interim format
    return countFeatures({
      features: batch.features,
      differenceMultiPolygon: differenceMultiPolygon,
      subjectFeature: this.subjectFeature,
      groupBy: this.groupBy,
    }).catch((error) => {
      console.error(`Error counting features: ${error.message}`);
      throw error;
    });
  }

  private async processPresenceBatch(
    batch: BatchData,
    differenceMultiPolygon: clipping.Geom[]
  ): Promise<OperationResultType<"presence">> {
    return testForPresenceInSubject({
      features: batch.features,
      differenceMultiPolygon: differenceMultiPolygon,
      subjectFeature: this.subjectFeature,
    }).catch((error) => {
      console.error(`Error testing for presence in subject: ${error.message}`);
      throw error;
    });
  }

  private mergeOverlayBatchResults(batchResults: OperationResultType<TOp>[]) {
    const results = this.getOverlayResults();
    for (const batchData of batchResults) {
      const overlayBatchData = batchData as OperationResultType<"overlay_area">;
      for (const classKey in overlayBatchData) {
        if (!(classKey in results)) {
          results[classKey] = 0;
        }
        results[classKey] += overlayBatchData[classKey];
      }
    }
  }

  private mergeCountBatchResults(
    batchResults: { [classKey: string]: number[] }[]
  ) {
    // Merge batch results into interim ID storage
    for (const countBatchData of batchResults) {
      for (const classKey in countBatchData) {
        if (!(classKey in this.countInterimIds)) {
          this.countInterimIds[classKey] = [];
        }
        const ids = countBatchData[classKey];
        for (const id of ids) {
          if (!this.countInterimIds[classKey].includes(id)) {
            this.countInterimIds[classKey].push(id);
          }
        }
      }
    }
  }

  private mergeColumnValuesBatchResults(
    batchResults: { [classKey: string]: { [attr: string]: ColumnValues[] } }[]
  ) {
    const columnStats = {} as { [classKey: string]: ValuesForColumns };
    const results = this.getColumnValuesResults();
    for (const batchData of batchResults) {
      for (const classKey in batchData) {
        if (!(classKey in results)) {
          results[classKey] = {};
        }
        for (const attr in batchData[classKey]) {
          if (!(attr in results[classKey])) {
            results[classKey][attr] = [];
          }
          results[classKey][attr].push(...batchData[classKey][attr]);
        }
      }
    }
    // calculate statistics for each class and attribute
    for (const classKey in results) {
      columnStats[classKey] = {};
      for (const attr in results[classKey]) {
        columnStats[classKey][attr] = calculateColumnValueStats(
          results[classKey][attr]
        );
      }
    }
    this.results = columnStats as unknown as OperationResultType<TOp>;
  }

  /**
   * Finalizes count results by converting interim ID arrays to UniqueIdIndex
   * and calculating counts. Called at the end of calculate().
   */
  private finalizeCountResults() {
    const finalResults: CountMetric["value"] = {};

    for (const classKey in this.countInterimIds) {
      const ids = this.countInterimIds[classKey];
      // Create UniqueIdIndex from the array of IDs
      const uniqueIdIndex = createUniqueIdIndex(ids);
      // Calculate count from the index
      const count = countUniqueIds(uniqueIdIndex);

      finalResults[classKey] = {
        count,
        uniqueIdIndex,
      };
    }

    this.results = finalResults as OperationResultType<TOp>;
  }

  private async getDifferenceMultiPolygon(): Promise<clipping.Geom[]> {
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

  addIndividualFeatureToResults(
    feature: FeatureWithMetadata<Feature<Geometry>>
  ) {
    if (this.isOverlayAreaOperation()) {
      this.addOverlayFeatureToTotals(feature);
    } else if (this.isCountOperation()) {
      this.addCountFeatureToTotals(feature);
    } else if (this.isPresenceTableOperation()) {
      this.addPresenceTableFeatureToResults(feature);
    } else if (this.isColumnValuesOperation()) {
      this.addColumnValuesFeatureToResults(feature);
    }
  }

  private addColumnValuesFeatureToResults(
    feature: FeatureWithMetadata<Feature<Geometry>>
  ) {
    const value = feature.properties?.[this.columnValuesProperty!];
    const results = this.getColumnValuesResults();
    addColumnValuesToResults(results, feature, this.groupBy);
  }

  private addOverlayFeatureToTotals(
    feature: FeatureWithMetadata<Feature<Geometry>>
  ) {
    // get area in square kilometers
    const size = this.getSize(feature);
    const results = this.getOverlayResults();
    results["*"] = (results["*"] || 0) + size;
    if (this.groupBy) {
      const classKey = feature.properties?.[this.groupBy];
      if (classKey) {
        results[classKey] = (results[classKey] || 0) + size;
      }
    }
  }

  private getSize(feature: FeatureWithMetadata<Feature<Geometry>>) {
    if (
      feature.geometry.type === "Polygon" ||
      feature.geometry.type === "MultiPolygon"
    ) {
      return calcArea(feature as Feature<Polygon | MultiPolygon>) * 1e-6;
    } else if (
      feature.geometry.type === "LineString" ||
      feature.geometry.type === "MultiLineString"
    ) {
      return (
        feature.properties?.__lengthKm ||
        turfLength(feature, { units: "kilometers" })
      );
    } else {
      throw new Error(`Unsupported geometry type: ${feature.geometry.type}`);
    }
  }

  addCountFeatureToTotals(feature: FeatureWithMetadata<Feature<Geometry>>) {
    if (!("__oidx" in feature.properties || {})) {
      throw new Error("Feature properties must contain __oidx");
    }
    const oidx = feature.properties.__oidx;
    if (oidx === undefined || oidx === null) {
      throw new Error("Feature properties must contain __oidx");
    }
    // Add to interim ID storage
    if (!this.countInterimIds["*"].includes(oidx)) {
      this.countInterimIds["*"].push(oidx);
    }
    // Count the feature (or points in MultiPoint)
    if (this.groupBy) {
      const classKey = feature.properties?.[this.groupBy];
      if (classKey) {
        if (!(classKey in this.countInterimIds)) {
          this.countInterimIds[classKey] = [];
        }
        if (!this.countInterimIds[classKey].includes(oidx)) {
          this.countInterimIds[classKey].push(oidx);
        }
      }
    }
  }

  addPresenceTableFeatureToResults(
    feature: Pick<FeatureWithMetadata<Feature<Geometry>>, "properties">
  ) {
    const id = feature.properties?.__oidx;
    if (id === undefined || id === null) {
      throw new Error("Feature properties must contain __oidx");
    }
    this.addToPresenceTableResults({
      __id: id,
      ...pick(feature.properties, this.includedProperties),
    });
  }

  addToPresenceTableResults(value: PresenceTableValue) {
    const results = this.getPresenceTableResults();
    if (!results.values.find((v) => v.__id === value.__id)) {
      results.values.push(value);
    }
  }

  private mergePresenceTableBatchResults(
    batchResults: { exceededLimit: boolean; values: PresenceTableValue[] }[]
  ) {
    const results = this.getPresenceTableResults();
    for (const batchData of batchResults) {
      if (batchData.exceededLimit) {
        results.exceededLimit = true;
      }
      for (const value of batchData.values) {
        this.addToPresenceTableResults(value);
      }
    }
    if (results.values.length >= this.resultsLimit) {
      results.exceededLimit = true;
      results.values = results.values.slice(0, this.resultsLimit);
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
    feature: FeatureWithMetadata<Feature<Geometry>>,
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

  weightForFeature(feature: FeatureWithMetadata<Feature<Geometry>>) {
    let weight = feature.properties?.__byteLength;
    if (weight === undefined || weight === null) {
      // base weight on number of vertices/points in the feature
      if (feature.geometry.type === "Polygon") {
        weight = feature.geometry.coordinates.reduce(
          (acc, ring) => acc + ring.length,
          0
        );
      } else if (feature.geometry.type === "MultiPolygon") {
        weight = feature.geometry.coordinates.reduce(
          (acc, poly) =>
            acc + poly.reduce((acc2, ring) => acc2 + ring.length, 0),
          0
        );
      } else if (feature.geometry.type === "Point") {
        weight = 1;
      } else if (feature.geometry.type === "MultiPoint") {
        weight = feature.geometry.coordinates.length;
      } else {
        // Default weight for other geometry types
        weight = 1000;
      }
    }
    return weight;
  }
}

function calculateColumnValueStats(
  values: ColumnValues[]
): NumberColumnValueStats | StringOrBooleanColumnValueStats {
  const count = values.length;

  if (count === 0) {
    return {
      type: "number",
      count: 0,
      min: NaN,
      max: NaN,
      mean: NaN,
      stdDev: NaN,
      histogram: [],
      countDistinct: 0,
      sum: 0,
    };
  }

  const firstValue = values[0][0];
  if (typeof firstValue === "string" || typeof firstValue === "boolean") {
    const distinctMap = new Map<string | boolean, number>();
    for (const entry of values) {
      const value = entry[0] as string | boolean;
      const current = distinctMap.get(value) ?? 0;
      distinctMap.set(value, current + 1);
    }
    const outputType = typeof firstValue === "boolean" ? "boolean" : "string";
    return {
      type: outputType,
      distinctValues: Array.from(distinctMap.entries()),
      countDistinct: distinctMap.size,
    };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let weightedSum = 0;
  let totalWeight = 0;

  const histogramMap = new Map<number, number>();
  const distinctValues = new Set<number>();

  for (const entry of values) {
    const value = entry[0];
    if (typeof value !== "number") {
      continue;
    }
    distinctValues.add(value);
    const weight = entry.length > 1 ? entry[1] : undefined;

    if (value < min) min = value;
    if (value > max) max = value;

    sum += value;
    if (
      typeof weight === "number" &&
      isFinite(weight) &&
      weight > 0 &&
      isFinite(value)
    ) {
      weightedSum += value * weight;
      totalWeight += weight;
    }

    const histogramContribution =
      typeof weight === "number" && isFinite(weight) && weight > 0 ? weight : 1;
    histogramMap.set(
      value,
      (histogramMap.get(value) || 0) + histogramContribution
    );
  }

  const mean = totalWeight > 0 ? weightedSum / totalWeight : sum / count;

  let varianceNumerator = 0;
  // Standard deviation - weighted if we have weights, otherwise unweighted
  if (totalWeight > 0) {
    for (const entry of values) {
      const value = entry[0] as number;
      const weight = entry.length > 1 ? entry[1] : undefined;
      if (typeof weight !== "number" || !isFinite(weight) || weight <= 0) {
        continue;
      }
      const diff = value - mean;
      varianceNumerator += weight * diff * diff;
    }
    varianceNumerator = varianceNumerator / totalWeight;
  } else {
    for (const entry of values) {
      const value = entry[0] as number;
      const diff = value - mean;
      varianceNumerator += diff * diff;
    }
    varianceNumerator = varianceNumerator / count;
  }
  const stdDev = Math.sqrt(varianceNumerator);

  let histogram: [number, number][] = Array.from(histogramMap.entries()).sort(
    (a, b) => {
      if (typeof a[0] === "number" && typeof b[0] === "number") {
        return a[0] - b[0];
      } else {
        return 0;
      }
    }
  );

  const MAX_HISTOGRAM_ENTRIES = 200;
  if (histogram.length > MAX_HISTOGRAM_ENTRIES) {
    if (typeof histogram[0][0] === "number") {
      histogram = downsampleHistogram(
        histogram as [number, number][],
        MAX_HISTOGRAM_ENTRIES
      );
    } else {
      histogram = histogram.slice(0, MAX_HISTOGRAM_ENTRIES);
    }
  }

  const countDistinct = distinctValues.size;

  return {
    type: "number",
    count,
    min,
    max,
    mean,
    stdDev,
    histogram,
    countDistinct,
    sum,
    totalAreaSqKm: totalWeight > 0 ? totalWeight : undefined,
  };
}
