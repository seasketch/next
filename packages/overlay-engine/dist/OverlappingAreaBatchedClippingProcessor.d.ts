import { FeatureReference, FeatureWithMetadata, FlatGeobufSource } from "fgb-source";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { ContainerIndex } from "./utils/containerIndex";
import { GuaranteedOverlayWorkerHelpers, OverlayWorkerHelpers } from "./utils/helpers";
import { Cql2Query } from "./cql2";
type BatchData = {
    weight: number;
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
    minimumBatchDivisionFactor: number;
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
    results: {
        [classKey: string]: number;
    };
    batchData: BatchData;
    batchPromises: Promise<any>[];
    options: {
        useWorkers?: boolean;
    };
    constructor(maxBatchSize: number, subjectFeature: Feature<Polygon | MultiPolygon>, intersectionSource: FlatGeobufSource<Feature<Polygon | MultiPolygon>>, differenceSources: {
        layerId: string;
        source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
        cql2Query?: Cql2Query | undefined;
    }[], helpers: OverlayWorkerHelpers, groupBy?: string, options?: {
        useWorkers?: boolean;
    });
    resetBatchData(): void;
    calculateOverlap(): Promise<{
        [classKey: string]: number;
    }>;
    processBatch(batch: BatchData): Promise<{
        [classKey: string]: number;
    }>;
    addFeatureToTotals(feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>, usePrecomputedArea?: boolean): void;
    addDifferenceFeatureReferencesToBatch(layerId: string, refs: FeatureReference[]): void;
    addFeatureToBatch(feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>, requiresIntersection: boolean, requiresDifference: boolean): void;
    weightForFeature(feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>): number;
}
export {};
//# sourceMappingURL=OverlappingAreaBatchedClippingProcessor.d.ts.map