import { FeatureWithMetadata } from "fgb-source";
import { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
import { PresenceTableValue } from "../metrics/metrics";
export declare function clipBatch({ features, differenceMultiPolygon, subjectFeature, groupBy, }: {
    features: {
        feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    groupBy?: string;
}): Promise<{
    [classKey: string]: number;
}>;
export declare function performClipping(features: {
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
}[], differenceGeoms: clipping.Geom[], subjectFeature: Feature<Polygon | MultiPolygon>): Promise<number>;
export declare function countFeatures({ features, differenceMultiPolygon, subjectFeature, groupBy, }: {
    features: {
        feature: FeatureWithMetadata<Feature<Geometry>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    groupBy?: string;
}): Promise<{
    [k: string]: number[];
}>;
export declare function testForPresenceInSubject({ features, differenceMultiPolygon, subjectFeature, }: {
    features: {
        feature: FeatureWithMetadata<Feature<Geometry>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
}): Promise<boolean>;
export declare function createPresenceTable({ features, differenceMultiPolygon, subjectFeature, limit, includedProperties, }: {
    features: {
        feature: FeatureWithMetadata<Feature<Geometry>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    limit?: number;
    includedProperties?: string[];
}): Promise<{
    exceededLimit: boolean;
    values: PresenceTableValue[];
}>;
export declare function pick(object: any, keys?: string[]): any;
//# sourceMappingURL=clipBatch.d.ts.map