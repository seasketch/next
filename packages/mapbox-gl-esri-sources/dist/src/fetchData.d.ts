import { FeatureCollection } from "geojson";
export declare function fetchFeatureCollection(url: string, geometryPrecision?: number, outFields?: string, bytesLimit?: number, abortController?: AbortController | null, disablePagination?: boolean): Promise<FeatureCollection<import("geojson").Geometry, import("geojson").GeoJsonProperties>>;
export declare function fetchFeatureLayerData(url: string, outFields: string, onError: (error: Error) => void, geometryPrecision?: number, abortController?: AbortController | null, onPageReceived?: ((bytes: number, loadedFeatures: number, estimatedFeatures: number) => void) | null, disablePagination?: boolean, pageSize?: number, bytesLimit?: number): Promise<FeatureCollection<import("geojson").Geometry, import("geojson").GeoJsonProperties>>;
export declare function urlForRawGeoJSONData(baseUrl: string, outFields?: string, geometryPrecision?: number, queryOptions?: {
    [key: string]: string;
}): string;
//# sourceMappingURL=fetchData.d.ts.map