import { FeatureReference, FeatureWithMetadata, FlatGeobufSource } from "fgb-source";
import { Feature, MultiPolygon, Polygon, Geometry } from "geojson";
import { ContainerIndex } from "./utils/containerIndex";
import { GuaranteedOverlayWorkerHelpers, OverlayWorkerHelpers } from "./utils/helpers";
import { Cql2Query } from "./cql2";
import { ColumnValues } from "./workers/clipBatch";
import PQueue from "p-queue";
import { createClippingWorkerPool, WorkerPool } from "./workers/pool";
import { OverlayAreaMetric, CountMetric, PresenceMetric, PresenceTableMetric, PresenceTableValue, ColumnValuesMetric } from "./metrics/metrics";
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
export type OperationType = "overlay_area" | "count" | "presence" | "presence_table" | "column_values";
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
export type OperationResultType<TOp extends OperationType> = OperationResultTypeMap[TOp];
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
export declare class OverlayEngineBatchProcessor<TOp extends OperationType = OperationType> {
    /**
     * Current weight of the batch. Once the weight exceeds the batch size, the
     * batch is processed. These values should be based on the complexity of the
     * features in the batch. If the input is an fgb features with a __byteLength
     * property, that should be used. For features that area already deserialized
     * or processed into GeoJSON, a comparable value should be used such as the
     * byte length of the GeoJSON / 10, to account for the difference of the
     * buffer fgb features size vs GeoJSON text.
     */
    maxBatchSize: number;
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
    results: OperationResultType<TOp> | {
        [classKey: string]: ColumnValues[];
    };
    private countInterimIds;
    batchData: BatchData;
    batchPromises: Promise<any>[];
    pool?: WorkerPool<any, any>;
    queue: PQueue;
    presenceOperationEarlyReturn: boolean;
    includedProperties?: string[];
    resultsLimit: number;
    overlappingFeatures: boolean;
    /**
     * Whether the subject feature was expanded with a distance buffer. Buffered
     * subjects may overlap sibling fragments' subjects, so per-feature entry
     * offsets are retained to detect shared parts when combining. Unbuffered
     * fragments are disjoint, making offsets useless weight.
     */
    subjectIsBuffered: boolean;
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
    private overlayFeatureEntries;
    private progress;
    private progressTarget;
    private isOverlayAreaOperation;
    private isCountOperation;
    private isPresenceOperation;
    private isPresenceTableOperation;
    private isColumnValuesOperation;
    private getColumnValuesResults;
    private getOverlayResults;
    private getPresenceTableResults;
    private initializeResults;
    constructor(operation: TOp, maxBatchSize: number, subjectFeature: Feature<Polygon | MultiPolygon>, intersectionSource: FlatGeobufSource<Feature<Geometry>>, differenceSources: {
        layerId: string;
        source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
        cql2Query?: Cql2Query | undefined;
    }[], helpers: OverlayWorkerHelpers, groupBy?: string, pool?: WorkerPool<any, any>, includedProperties?: string[], resultsLimit?: number, overlappingFeatures?: boolean, subjectIsBuffered?: boolean, overlayOverlapOptions?: OverlayAreaOverlapCollectionOptions);
    /**
     * True only for buffered fragment `overlay_area` (options provided by the
     * worker). Gates the per-feature clip path and `__overlap` finalization so
     * unbuffered runs keep the ordinary batch clip cost.
     */
    private collectsOverlayOverlapEntries;
    private resetBatchData;
    calculate(): Promise<OperationResultType<TOp>>;
    private processBatch;
    private processColumnValuesBatch;
    private processOverlayBatch;
    private processCountBatch;
    private processPresenceBatch;
    private mergeOverlayBatchResults;
    /**
     * Builds {@link OverlayAreaOverlapInfo} from collected per-feature collar
     * entries and attaches it under `__overlap` on the overlay_area result.
     * No-op when {@link overlayOverlapOptions} is unset (unbuffered path).
     *
     * @see OverlayAreaOverlapInfo
     */
    private finalizeOverlayOverlapMetadata;
    private mergeCountBatchResults;
    private mergeColumnValuesBatchResults;
    /**
     * Finalizes count results by converting interim ID arrays to UniqueIdIndex
     * and calculating counts. Called at the end of calculate().
     */
    private finalizeCountResults;
    private getDifferenceMultiPolygon;
    addIndividualFeatureToResults(feature: FeatureWithMetadata<Feature<Geometry>>): void;
    private addColumnValuesFeatureToResults;
    private addOverlayFeatureToTotals;
    private getSize;
    addCountFeatureToTotals(feature: FeatureWithMetadata<Feature<Geometry>>): void;
    addPresenceTableFeatureToResults(feature: Pick<FeatureWithMetadata<Feature<Geometry>>, "properties">): void;
    addToPresenceTableResults(value: PresenceTableValue): void;
    private mergePresenceTableBatchResults;
    addDifferenceFeatureReferencesToBatch(layerId: string, refs: FeatureReference[]): void;
    addFeatureToBatch(feature: FeatureWithMetadata<Feature<Geometry>>, requiresIntersection: boolean, requiresDifference: boolean): void;
    weightForFeature(feature: FeatureWithMetadata<Feature<Geometry>>): number;
}
//# sourceMappingURL=OverlayEngineBatchProcessor.d.ts.map