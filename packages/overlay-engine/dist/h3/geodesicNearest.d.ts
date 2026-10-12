import { Feature, LineString, MultiLineString, Polygon } from "geojson";
import { FlatGeobufSource } from "fgb-source";
export type GeodesicNearestLandResult = {
    meters: number;
    geojsonLine: Feature<LineString> | null;
    /** Shoreline lying in the subject. Set when the subject meets land. */
    shorelineIntersection?: Feature<LineString | MultiLineString> | null;
};
export declare function searchGeodesicNearestLand(feature: Feature, land: FlatGeobufSource<Feature<Polygon>>, options?: {
    minimumDistanceMeters?: number;
}): Promise<GeodesicNearestLandResult>;
//# sourceMappingURL=geodesicNearest.d.ts.map