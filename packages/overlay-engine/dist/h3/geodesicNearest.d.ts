import { Feature, LineString, Polygon } from "geojson";
import { FlatGeobufSource } from "fgb-source";
export type GeodesicNearestLandResult = {
    meters: number;
    geojsonLine: Feature<LineString> | null;
};
export declare function searchGeodesicNearestLand(feature: Feature, land: FlatGeobufSource<Feature<Polygon>>, options?: {
    minimumDistanceMeters?: number;
}): Promise<GeodesicNearestLandResult>;
//# sourceMappingURL=geodesicNearest.d.ts.map