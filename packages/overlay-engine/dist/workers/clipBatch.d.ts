import { FeatureWithMetadata } from "fgb-source";
import { Feature, Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
import { PresenceTableValue } from "../metrics/metrics";
export declare function clipBatch({ features, differenceMultiPolygon, subjectFeature, groupBy, overlappingFeatures, }: {
    features: {
        feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon | LineString | MultiLineString>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    groupBy?: string;
    overlappingFeatures?: boolean;
}): Promise<{
    [classKey: string]: number;
}>;
export declare function calculatedClippedOverlapSize(features: {
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon | LineString | MultiLineString>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
}[], differenceGeoms: clipping.Geom[], subjectFeature: Feature<Polygon | MultiPolygon>, subdivisions?: number, overlappingFeatures?: boolean): number;
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
/**
 * Interim record for a single (possibly subdivided) feature part that
 * intersects the subject. Parts are grouped by original feature id when
 * statistics are finalized so that subdivided features are not
 * double-counted.
 */
export type ColumnValues = [
    /** column value */
    number | string | boolean,
    /**
     * Overlap weight: area in sq km if the feature is polygonal, length in km
     * if it is linear, or 0 for unweighted (e.g. point) features.
     */
    number,
    /** `__oidx` of the original (pre-subdivision) feature */
    number,
    /** `__offset` of this part in the FlatGeobuf file */
    number
];
export declare function collectColumnValues({ features, differenceMultiPolygon, subjectFeature, properties, groupBy, }: {
    features: {
        feature: FeatureWithMetadata<Feature<Geometry>>;
        requiresIntersection: boolean;
        requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    /** If provided, only values for these columns are collected. */
    properties?: string[];
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
}, feature: FeatureWithMetadata<Feature<Geometry>>, groupBy?: string, properties?: string[]): void;
export declare function pick(object: any, keys?: string[]): any;
//# sourceMappingURL=clipBatch.d.ts.map