import { FeatureWithMetadata } from "fgb-source";
import { Feature, Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
import { PresenceTableValue } from "../metrics/metrics";
export declare function clipBatch({ features, differenceMultiPolygon, subjectFeature, groupBy, }: {
    features: {
        feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon | LineString | MultiLineString>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    groupBy?: string;
}): Promise<{
    [classKey: string]: number;
}>;
export declare function calculatedClippedOverlapSize(features: {
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon | LineString | MultiLineString>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
}[], differenceGeoms: clipping.Geom[], subjectFeature: Feature<Polygon | MultiPolygon>): number;
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
export type ColumnValues = [
    /** column value */
    number | string | boolean,
    number
] | [
    /** column value */
    number | string | boolean
];
export declare function collectColumnValues({ features, differenceMultiPolygon, subjectFeature, property, groupBy, }: {
    features: {
        feature: FeatureWithMetadata<Feature<Geometry>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    property: string;
    groupBy?: string;
}): Promise<{
    [classKey: string]: {
        [attr: string]: ColumnValues[];
    };
}>;
export declare function addColumnValuesToResults(results: {
    [classKey: string]: {
        [attr: string]: ColumnValues[];
    };
}, feature: FeatureWithMetadata<Feature<Geometry>>, groupBy?: string): void;
export declare function pick(object: any, keys?: string[]): any;
//# sourceMappingURL=clipBatch.d.ts.map