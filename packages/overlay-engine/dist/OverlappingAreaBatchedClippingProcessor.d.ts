import { FeatureReference, FeatureWithMetadata, FlatGeobufSource } from "fgb-source";
import { Feature, MultiPolygon, Polygon, Geometry } from "geojson";
import { ContainerIndex } from "./utils/containerIndex";
import { GuaranteedOverlayWorkerHelpers, OverlayWorkerHelpers } from "./utils/helpers";
import { Cql2Query } from "./cql2";
import * as clipping from "polyclip-ts";
import PQueue from "p-queue";
import { createClippingWorkerPool, WorkerPool } from "./workers/pool";
export { createClippingWorkerPool };
export type OperationType = "overlay_area" | "count";
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
export declare class OverlappingAreaBatchedClippingProcessor {
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
    operation: OperationType;
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
    results: {
        [classKey: string]: number;
    };
    batchData: BatchData;
    batchPromises: Promise<any>[];
    pool?: WorkerPool<any, any>;
    queue: PQueue;
    private progress;
    private progressTarget;
    constructor(operation: OperationType, maxBatchSize: number, subjectFeature: Feature<Polygon | MultiPolygon>, intersectionSource: FlatGeobufSource<Feature<Geometry>>, differenceSources: {
        layerId: string;
        source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
        cql2Query?: Cql2Query | undefined;
    }[], helpers: OverlayWorkerHelpers, groupBy?: string, pool?: WorkerPool<any, any>);
    resetBatchData(): void;
    calculate(): Promise<{
        [classKey: string]: number;
    }>;
    processBatch(batch: BatchData, differenceMultiPolygon: clipping.Geom[]): Promise<{
        [classKey: string]: number;
    }>;
    getDifferenceMultiPolygon(): Promise<clipping.Geom[]>;
    addFeatureToTotals(feature: FeatureWithMetadata<Feature<Geometry>>): void;
    addDifferenceFeatureReferencesToBatch(layerId: string, refs: FeatureReference[]): void;
    addFeatureToBatch(feature: FeatureWithMetadata<Feature<Geometry>>, requiresIntersection: boolean, requiresDifference: boolean): void;
    weightForFeature(feature: FeatureWithMetadata<Feature<Geometry>>): number;
}
//# sourceMappingURL=OverlappingAreaBatchedClippingProcessor.d.ts.map