import { FeatureServerMetadata, LayerLegendData, LayersMetadata, MapServiceMetadata } from "./ServiceMetadata";
interface FetchOptions {
    signal?: AbortSignal;
    token?: string;
}
export interface MapServiceLegendMetadata {
    layers: {
        layerId: number;
        layerName: string;
        layerType: "Feature Layer" | "Raster Layer";
        legend: LayerLegendData[];
    }[];
}
export declare class ArcGISRESTServiceRequestManager {
    private cache?;
    constructor(options?: {
        cacheKey?: string;
    });
    getMapServiceMetadata(url: string, options: FetchOptions): Promise<{
        serviceMetadata: MapServiceMetadata;
        layers: LayersMetadata;
    }>;
    getFeatureServerMetadata(url: string, options: FetchOptions): Promise<{
        serviceMetadata: FeatureServerMetadata;
        layers: LayersMetadata;
    }>;
    getCatalogItems(url: string, options?: FetchOptions): Promise<{
        currentVersion: number;
        folders: string[];
        services: {
            name: string;
            type: "MapServer" | "FeatureServer" | "GPServer" | "GeometryServer" | "ImageServer" | "GeocodeServer" | string;
        }[];
    }>;
    private inFlightRequests;
    private fetch;
    getLegendMetadata(url: string, token?: string): Promise<MapServiceLegendMetadata>;
}
export declare function fetchWithTTL(url: string, ttl: number, cache?: Cache, options?: RequestInit, cacheKey?: string): Promise<any>;
export {};
//# sourceMappingURL=ArcGISRESTServiceRequestManager.d.ts.map