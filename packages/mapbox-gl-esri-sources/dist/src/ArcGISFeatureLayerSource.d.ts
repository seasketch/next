import { ArcGISRESTServiceRequestManager, CustomGLSource, ImageList } from "../index";
import { ComputedMetadata, CustomGLSourceOptions, CustomSourceType, LegendItem, OrderedLayerSettings } from "./CustomGLSource";
import { AnyLayer, GeoJSONSourceRaw, Layer, Map } from "mapbox-gl";
export declare const FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT = 2000000;
export interface ArcGISFeatureLayerSourceOptions extends CustomGLSourceOptions {
    /**
     * URL for the service. Should end in /FeatureServer/{layerId} or /MapServer/{layerId}.
     */
    url: string;
    /**
     * All query parameters will be added to each query request, overriding any
     * settings made by this library. Useful for filtering or working with
     * temporal data.
     **/
    queryParameters?: {
        [queryString: string]: string | number;
    };
    token?: string;
    /**
     * Indicates how to fetch feature geometry from the service.
     * - "raw": The entire dataset will be downloaded and rendered client-side. This
     *   may be slow for large datasets but is the most efficient option for smaller ones.
     * - "quantized": Simplified vectors for only the current viewport will be
     *   fetched and updated when the map extent changes.
     * - "auto": Will attempt the "raw" strategy up to a byte limit (default 2MB) and
     *   fall back to "quantized" if the limit is exceeded.
     * @default "auto"
     */
    fetchStrategy?: "auto" | "raw" | "tiled";
    /**
     * If fetchStrategy is "auto", this is the byte limit before switching from
     * "raw" to "quantized" mode. Default 2MB.
     * @default 2_000_000
     */
    autoFetchByteLimit?: number;
    cacheKey?: string;
}
export declare function isFeatureLayerSource(source: CustomGLSource<any>): source is ArcGISFeatureLayerSource;
export default class ArcGISFeatureLayerSource implements CustomGLSource<ArcGISFeatureLayerSourceOptions, LegendItem[]> {
    /** Source id used in the map style */
    sourceId: string;
    layerId: number;
    options: ArcGISFeatureLayerSourceOptions;
    private map?;
    private requestManager;
    private serviceMetadata?;
    private layerMetadata?;
    private _loading;
    private featureData?;
    private rawFeaturesHaveBeenFetched;
    private exceededBytesLimit;
    private QuantizedVectorRequestManager?;
    private cache?;
    private initialFetchStrategy?;
    error?: string;
    type: CustomSourceType;
    url: string;
    constructor(requestManager: ArcGISRESTServiceRequestManager, options: ArcGISFeatureLayerSourceOptions);
    _computedMetadata?: ComputedMetadata;
    getComputedMetadata(): Promise<ComputedMetadata>;
    /**
     * Private method used as the basis for getComputedMetadata and also used
     * when generating the source data for addToMap.
     * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
     */
    private getComputedProperties;
    updateFetchStrategy(fetchStrategy: "auto" | "tiled" | "raw"): Promise<void>;
    private fireError;
    /**
     * Use ArcGISRESTServiceRequestManager to fetch metadata for the service,
     * caching it on the instance for reuse.
     */
    private getMetadata;
    get loading(): boolean;
    private _glStylePromise?;
    private _styleIsResolved;
    getGLStyleLayers(): Promise<{
        layers: Layer[];
        imageList: ImageList;
    }>;
    getGLSource(): Promise<GeoJSONSourceRaw>;
    addEventListeners(map: Map): void;
    removeEventListeners(map: Map): void;
    addToMap(map: Map): Promise<string>;
    private abortController;
    private fetchFeatures;
    private cacheAutoFetchStrategy;
    private getCachedAutoFetchStrategy;
    private tileFormat;
    private fetchTiles;
    updateLayers(layerSettings: OrderedLayerSettings): Promise<void>;
    paused: boolean;
    private pauseUpdates;
    private resumeUpdates;
    removeFromMap(map: Map): Promise<AnyLayer[]>;
    destroy(): void;
    getFetchStrategy(): Promise<unknown>;
    get ready(): boolean;
    prepare(): Promise<void>;
}
export declare function isArcgisFeatureLayerSource(source: CustomGLSource<any>): source is ArcGISFeatureLayerSource;
//# sourceMappingURL=ArcGISFeatureLayerSource.d.ts.map