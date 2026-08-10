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
  OverlayFeatureClipEntry,
  pick,
  testForPresenceInSubject,
} from "./workers/clipBatch";
import PQueue from "p-queue";
import { createClippingWorkerPool, WorkerPool } from "./workers/pool";
import truncate from "@turf/truncate";
import booleanIntersects from "@turf/boolean-intersects";
import {
  OverlayAreaMetric,
  OverlayAreaOverlapInfo,
  CountMetric,
  PresenceMetric,
  PresenceTableMetric,
  PresenceTableValue,
  ColumnValuesMetric,
  ColumnValuesEntry,
  NumberColumnValueStats,
  StringOrBooleanColumnValueStats,
  ValuesForColumns,
  capColumnValueEntries,
  numberColumnStatsFromEntries,
  stringOrBooleanColumnStatsFromEntries,
  MAX_OVERLAY_AREA_OVERLAP_ENTRIES,
  isOverlayAreaClassKey,
} from "./metrics/metrics";
import { createUniqueIdIndex, countUniqueIds } from "./utils/uniqueIdIndex";
import turfLength from "@turf/length";

/**
 * Options for collecting buffered fragment `overlay_area` overlap metadata.
 * Produced by the worker only when `bufferDistanceKm > 0` on a fragment
 * subject; consumed when finalizing results.
 *
 * When omitted (unbuffered / geography / non-`overlay_area`), the processor
 * does not collect per-feature collar entries or attach `__overlap`.
 *
 * @see OverlayAreaOverlapInfo
 */
export type OverlayAreaOverlapCollectionOptions = {
  collar: Feature<Polygon | MultiPolygon>;
  bbox: [number, number, number, number];
  bufferKm: number;
};

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
  overlappingFeatures = false;
  /**
   * Whether the subject feature was expanded with a distance buffer. Buffered
   * subjects may overlap sibling fragments' subjects, so per-feature entry
   * offsets are retained to detect shared parts when combining. Unbuffered
   * fragments are disjoint, making offsets useless weight.
   */
  subjectIsBuffered = false;

  /**
   * When set (buffered fragment `overlay_area` only), the processor collects
   * per-feature collar entries and attaches {@link OverlayAreaOverlapInfo}
   * under `__overlap` on the result value. Left undefined for unbuffered
   * subjects — no collar work, no `__overlap` payload.
   */
  overlayOverlapOptions?: OverlayAreaOverlapCollectionOptions;

  /**
   * Accumulated per-feature clip records for buffered fragment overlay_area
   * overlap detection. Only populated when {@link overlayOverlapOptions} is
   * set; stays empty (unused) on the unbuffered path.
   */
  private overlayFeatureEntries: OverlayFeatureClipEntry[] = [];

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
    overlappingFeatures?: boolean,
    subjectIsBuffered?: boolean,
    overlayOverlapOptions?: OverlayAreaOverlapCollectionOptions,
  ) {
    this.operation = operation;
    this.pool = pool;
    this.intersectionSource = intersectionSource;
    this.differenceSources = differenceSources;
    this.maxBatchSize = maxBatchSize;
    this.subjectFeature = subjectFeature;
    this.helpers = guaranteeHelpers(helpers);
    this.overlappingFeatures = overlappingFeatures ?? false;

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
    this.subjectIsBuffered = subjectIsBuffered ?? false;
    this.overlayOverlapOptions = overlayOverlapOptions;
  }

  /**
   * True only for buffered fragment `overlay_area` (options provided by the
   * worker). Gates the per-feature clip path and `__overlap` finalization so
   * unbuffered runs keep the ordinary batch clip cost.
   */
  private collectsOverlayOverlapEntries(): boolean {
    return (
      this.isOverlayAreaOperation() && this.overlayOverlapOptions !== undefined
    );
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
        // check to ensure source fgb index bounds are within [-180, 180, -90, 90]
        const sourceBounds = this.intersectionSource.bounds;
        if (
          sourceBounds.minX < -180.0001 ||
          sourceBounds.maxX > 180.0001 ||
          sourceBounds.minY < -90.0001 ||
          sourceBounds.maxY > 90.0001
        ) {
          throw new Error(
            "Source fgb index bounds are out of range. Expected maximum of [-180, 180, -90, 90], but got [" +
              sourceBounds.minX +
              ", " +
              sourceBounds.maxX +
              ", " +
              sourceBounds.minY +
              ", " +
              sourceBounds.maxY +
              "]"
          );
        }
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
          this.finalizeOverlayOverlapMetadata();
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
      overlappingFeatures: this.overlappingFeatures,
      collectOverlapEntries: this.collectsOverlayOverlapEntries(),
      collarFeature: this.overlayOverlapOptions?.collar,
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
      properties: this.includedProperties,
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
      overlappingFeatures: this.overlappingFeatures,
      collectOverlapEntries: this.collectsOverlayOverlapEntries(),
      collarFeature: this.overlayOverlapOptions?.collar,
    }).catch((error) => {
      console.error(`Error processing batch: ${error.message}`);
      throw error;
    }) as Promise<OperationResultType<"overlay_area">>;
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
      const overlayBatchData = batchData as OperationResultType<"overlay_area"> & {
        __featureEntries?: OverlayFeatureClipEntry[];
      };
      for (const classKey in overlayBatchData) {
        if (classKey === "__featureEntries") {
          const entries = overlayBatchData.__featureEntries;
          if (Array.isArray(entries)) {
            this.overlayFeatureEntries.push(...entries);
          }
          continue;
        }
        if (!isOverlayAreaClassKey(classKey)) {
          continue;
        }
        const amount = overlayBatchData[classKey];
        if (typeof amount !== "number") {
          continue;
        }
        if (!(classKey in results) || typeof results[classKey] !== "number") {
          results[classKey] = 0;
        }
        results[classKey] = (results[classKey] as number) + amount;
      }
    }
  }

  /**
   * Builds {@link OverlayAreaOverlapInfo} from collected per-feature collar
   * entries and attaches it under `__overlap` on the overlay_area result.
   * No-op when {@link overlayOverlapOptions} is unset (unbuffered path).
   *
   * @see OverlayAreaOverlapInfo
   */
  private finalizeOverlayOverlapMetadata() {
    const options = this.overlayOverlapOptions;
    if (!options || !this.isOverlayAreaOperation()) {
      return;
    }

    // Merge duplicate oidx within the same class (subdivided parts).
    // Sum part areas to reconstruct the original feature's total size when
    // multiple subdivided pieces of the same __oidx appear in this fragment.
    type Acc = {
      area: number;
      featureArea: number;
      collarArea: number;
      /** True when every seen part was fully covered by the buffered subject. */
      fullyCovered: boolean;
    };
    const byClass = new Map<string, Map<number, Acc>>();

    for (const entry of this.overlayFeatureEntries) {
      let classMap = byClass.get(entry.classKey);
      if (!classMap) {
        classMap = new Map();
        byClass.set(entry.classKey, classMap);
      }
      const partFullyCovered =
        Math.abs(entry.featureArea - entry.clippedArea) < 1e-9;
      const existing = classMap.get(entry.oidx);
      if (!existing) {
        classMap.set(entry.oidx, {
          area: entry.clippedArea,
          featureArea: entry.featureArea,
          collarArea: entry.collarArea,
          fullyCovered: partFullyCovered,
        });
      } else {
        existing.area += entry.clippedArea;
        existing.collarArea += entry.collarArea;
        existing.featureArea += entry.featureArea;
        existing.fullyCovered =
          existing.fullyCovered && partFullyCovered;
      }
    }

    // Also ensure classes that only appear as numeric totals get a collarArea.
    const results = this.getOverlayResults();
    const classes: OverlayAreaOverlapInfo["classes"] = {};

    const allClassKeys = new Set<string>([
      ...byClass.keys(),
      ...Object.keys(results).filter(isOverlayAreaClassKey),
    ]);

    type FlatEntry = {
      classKey: string;
      oidx: number;
      area: number;
      featureArea: number;
      collarArea: number;
    };
    const flat: FlatEntry[] = [];

    for (const classKey of allClassKeys) {
      const classMap = byClass.get(classKey);
      let collarArea = 0;
      if (classMap) {
        for (const [oidx, acc] of classMap) {
          collarArea += acc.collarArea;
          flat.push({
            classKey,
            oidx,
            area: acc.area,
            // Encode fully-covered as 0 so combine can apply exact correction.
            featureArea: acc.fullyCovered ? 0 : acc.featureArea,
            collarArea: acc.collarArea,
          });
        }
      }
      classes[classKey] = { collarArea };
    }

    // Cap across all classes; keep largest-area entries.
    flat.sort((a, b) => b.area - a.area);
    const truncated = flat.length > MAX_OVERLAY_AREA_OVERLAP_ENTRIES;
    const kept = truncated
      ? flat.slice(0, MAX_OVERLAY_AREA_OVERLAP_ENTRIES)
      : flat;

    const keptByClass = new Map<string, FlatEntry[]>();
    for (const entry of kept) {
      const list = keptByClass.get(entry.classKey) || [];
      list.push(entry);
      keptByClass.set(entry.classKey, list);
    }

    for (const classKey of Object.keys(classes)) {
      const list = keptByClass.get(classKey) || [];
      if (list.length === 0) {
        if (truncated) {
          classes[classKey].entriesTruncated = true;
        }
        continue;
      }
      const oidx: number[] = [];
      const area: number[] = [];
      const featureArea: number[] = [];
      let anyPartial = false;
      for (const e of list) {
        oidx.push(e.oidx);
        area.push(e.area);
        // 0 = fully covered (featureArea === area)
        const fa =
          Math.abs(e.featureArea - e.area) < 1e-9 ? 0 : e.featureArea;
        featureArea.push(fa);
        if (fa !== 0) {
          anyPartial = true;
        }
      }
      classes[classKey].oidx = oidx;
      classes[classKey].area = area;
      if (anyPartial) {
        classes[classKey].featureArea = featureArea;
      }
      if (truncated) {
        classes[classKey].entriesTruncated = true;
      }
    }

    const overlap: OverlayAreaOverlapInfo = {
      bufferKm: options.bufferKm,
      bbox: options.bbox,
      classes,
    };

    results.__overlap = overlap;
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
          if (
            !(attr in results[classKey]) ||
            !Array.isArray(results[classKey][attr])
          ) {
            results[classKey][attr] = [];
          }
          results[classKey][attr].push(...batchData[classKey][attr]);
        }
      }
    }
    // Per-feature entries are only retained when the metric is scoped to a
    // specific column list (includedColumns), to keep stored metric sizes
    // bounded. Weight is still computed once per feature for all columns.
    const includeEntries = Boolean(
      this.includedProperties && this.includedProperties.length > 0
    );
    for (const classKey in results) {
      columnStats[classKey] = {};
      for (const attr in results[classKey]) {
        columnStats[classKey][attr] = calculateColumnValueStats(
          results[classKey][attr],
          includeEntries,
          this.subjectIsBuffered
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
    const results = this.getColumnValuesResults();
    addColumnValuesToResults(
      results,
      feature,
      this.groupBy,
      this.includedProperties
    );
  }

  private addOverlayFeatureToTotals(
    feature: FeatureWithMetadata<Feature<Geometry>>
  ) {
    // get area in square kilometers
    const size = this.getSize(feature);
    const results = this.getOverlayResults();
    results["*"] = ((results["*"] as number) || 0) + size;
    let classKey = "*";
    if (this.groupBy) {
      const key = feature.properties?.[this.groupBy];
      if (key) {
        classKey = String(key);
        results[classKey] = ((results[classKey] as number) || 0) + size;
      }
    }

    // Fully-inside features skip the clip batch; still record collar entries
    // when collecting buffered overlap metadata.
    // @see OverlayAreaOverlapInfo
    if (this.collectsOverlayOverlapEntries()) {
      const oidx = feature.properties?.__oidx;
      if (typeof oidx !== "number") {
        return;
      }
      const collar = this.overlayOverlapOptions!.collar;
      let inCollar = true;
      try {
        inCollar = booleanIntersects(feature as Feature, collar);
      } catch {
        inCollar = true;
      }
      if (!inCollar) {
        return;
      }
      this.overlayFeatureEntries.push({
        oidx,
        classKey,
        clippedArea: size,
        featureArea: size, // fully inside subject ⇒ fully covered
        collarArea: size,
      });
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

/**
 * Computes statistics for a single column from the interim per-part records
 * collected during batch processing.
 *
 * Sources preprocessed for reporting are subdivided at upload time, so a
 * single original feature may intersect the subject as several parts. Parts
 * are first grouped by original feature id (`__oidx`), summing their overlap
 * weights, so that whole-feature values (count, sum, distinct values) are
 * only counted once per original feature.
 *
 * When `includeEntries` is true, the per-feature records are retained on the
 * returned stats so that stats from multiple fragments can later be combined
 * exactly. If the feature count exceeds MAX_COLUMN_VALUE_ENTRIES, entries
 * are omitted entirely (a partial list cannot support exact merging) and
 * `entriesTruncated` is set instead.
 *
 * Part offsets are only recorded on entries when `includeOffsets` is true
 * (i.e. the subject was buffered). Their sole purpose is detecting shared
 * parts across overlapping buffered subjects; unbuffered fragments are
 * disjoint, so offsets would just add payload weight.
 */
function calculateColumnValueStats(
  values: ColumnValues[],
  includeEntries: boolean,
  includeOffsets: boolean
): NumberColumnValueStats | StringOrBooleanColumnValueStats {
  // Group subdivided parts by original feature id.
  const byId = new Map<number, ColumnValuesEntry>();
  for (const [value, weight, id, offset] of values) {
    const existing = byId.get(id);
    if (existing) {
      existing.weight += weight;
      if (includeOffsets) {
        existing.offsets.push(offset);
      }
    } else {
      byId.set(id, {
        id,
        value,
        weight,
        offsets: includeOffsets ? [offset] : [],
      });
    }
  }
  const entries = Array.from(byId.values());

  const firstValue = entries[0]?.value;
  const stats =
    typeof firstValue === "string" || typeof firstValue === "boolean"
      ? stringOrBooleanColumnStatsFromEntries(entries)
      : numberColumnStatsFromEntries(entries);

  if (includeEntries) {
    const capped = capColumnValueEntries(entries);
    if (capped.entries) {
      stats.entries = capped.entries;
    }
    if (capped.entriesTruncated) {
      stats.entriesTruncated = true;
    }
  }

  return stats;
}
