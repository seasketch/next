import { FeatureReference, FeatureWithMetadata, FlatGeobufSource } from "fgb-source";
import { Feature, MultiPolygon, Polygon, Geometry } from "geojson";
import { ContainerIndex } from "./utils/containerIndex";
import { GuaranteedOverlayWorkerHelpers, OverlayWorkerHelpers } from "./utils/helpers";
import { Cql2Query } from "./cql2";
import PQueue from "p-queue";
import { createClippingWorkerPool, WorkerPool } from "./workers/pool";
import { OverlayAreaMetric, CountMetric, PresenceMetric, PresenceTableMetric, PresenceTableValue } from "./metrics/metrics";
export { createClippingWorkerPool };
export type OperationType = "overlay_area" | "count" | "presence" | "presence_table";
/**
 * Maps operation types to their corresponding metric value types
 */
type OperationResultTypeMap = {
    overlay_area: OverlayAreaMetric["value"];
    count: CountMetric["value"];
    presence: PresenceMetric["value"];
    presence_table: PresenceTableMetric["value"];
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
    results: OperationResultType<TOp>;
    private countInterimIds;
    batchData: BatchData;
    batchPromises: Promise<any>[];
    pool?: WorkerPool<any, any>;
    queue: PQueue;
    presenceOperationEarlyReturn: boolean;
    includedProperties?: string[];
    resultsLimit: number;
    private progress;
    private progressTarget;
    private isOverlayAreaOperation;
    private isCountOperation;
    private isPresenceOperation;
    private isPresenceTableOperation;
    private getOverlayResults;
    private getPresenceTableResults;
    private initializeResults;
    constructor(operation: TOp, maxBatchSize: number, subjectFeature: Feature<Polygon | MultiPolygon>, intersectionSource: FlatGeobufSource<Feature<Geometry>>, differenceSources: {
        layerId: string;
        source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
        cql2Query?: Cql2Query | undefined;
    }[], helpers: OverlayWorkerHelpers, groupBy?: string, pool?: WorkerPool<any, any>, includedProperties?: string[], resultsLimit?: number);
    private resetBatchData;
    calculate(): Promise<OperationResultType<TOp>>;
    private processBatch;
    private processOverlayBatch;
    private processCountBatch;
    private processPresenceBatch;
    private mergeOverlayBatchResults;
    private mergeCountBatchResults;
    /**
     * Finalizes count results by converting interim ID arrays to UniqueIdIndex
     * and calculating counts. Called at the end of calculate().
     */
    private finalizeCountResults;
    private getDifferenceMultiPolygon;
    addIndividualFeatureToResults(feature: FeatureWithMetadata<Feature<Geometry>>): void;
    private addOverlayFeatureToTotals;
    addCountFeatureToTotals(feature: FeatureWithMetadata<Feature<Geometry>>): void;
    addPresenceTableFeatureToResults(feature: Pick<FeatureWithMetadata<Feature<Geometry>>, "properties">): void;
    addToPresenceTableResults(value: PresenceTableValue): void;
    private mergePresenceTableBatchResults;
    addDifferenceFeatureReferencesToBatch(layerId: string, refs: FeatureReference[]): void;
    addFeatureToBatch(feature: FeatureWithMetadata<Feature<Geometry>>, requiresIntersection: boolean, requiresDifference: boolean): void;
    weightForFeature(feature: FeatureWithMetadata<Feature<Geometry>>): number;
}
//# sourceMappingURL=OverlayEngineBatchProcessor.d.ts.map