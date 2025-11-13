import { FeatureWithMetadata } from "fgb-source";
import { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
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
//# sourceMappingURL=clipBatch.d.ts.map