import { AnyLayer, Map, RasterLayer, RasterSource } from "mapbox-gl";
import { ArcGISRESTServiceRequestManager } from "./ArcGISRESTServiceRequestManager";
import { ComputedMetadata, CustomGLSource, CustomGLSourceOptions, CustomSourceType, LegendItem, OrderedLayerSettings } from "./CustomGLSource";
export interface ArcGISTiledMapServiceOptions extends CustomGLSourceOptions {
    url: string;
    supportHighDpiDisplays?: boolean;
    token?: string;
    maxZoom?: number;
    /**
     * Use to set a developer api key for accessing Esri basemaps.
     * Not needed for other services
     */
    developerApiKey?: string;
}
/**
 * CustomGLSource used to add an ArcGIS Tile MapService.
 */
export declare class ArcGISTiledMapService implements CustomGLSource<ArcGISTiledMapServiceOptions, LegendItem[]> {
    url: string;
    sourceId: string;
    options: ArcGISTiledMapServiceOptions;
    private map?;
    private requestManager;
    private serviceMetadata?;
    private layerMetadata?;
    error?: string;
    type: CustomSourceType;
    /**
     *
     * @param requestManager ArcGISRESTServiceRequestManager instance
     * @param options.url URL to ArcGIS REST MapServer (should end in /MapServer)
     * @param options.supportHighDpiDisplays If true, will detect high-dpi displays and request more tiles at higher resolution
     * @param options.credentials Optional. If provided, will use these credentials to request a token for the service.
     *
     */
    constructor(requestManager: ArcGISRESTServiceRequestManager, options: ArcGISTiledMapServiceOptions);
    /**
     * Use ArcGISRESTServiceRequestManager to fetch metadata for the service,
     * caching it on the instance for reuse.
     */
    private getMetadata;
    private _computedMetadata?;
    /**
     * Returns computed metadata for the service, including bounds, minzoom, maxzoom, and attribution.
     * @returns ComputedMetadata
     * @throws Error if metadata is not available
     * @throws Error if tileInfo is not available
     * */
    getComputedMetadata(): Promise<ComputedMetadata>;
    getThumbnailForCurrentExtent(): Promise<string>;
    /**
     * Returns true if the source is not yet loaded. Will return to false if tiles
     * are loading when the map is moved.
     */
    get loading(): boolean;
    /**
     * Private method used as the basis for getComputedMetadata and also used
     * when generating the source data for addToMap.
     * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
     */
    private getComputedProperties;
    /**
     * Add source to map. Does not add any layers to the map.
     * @param map Mapbox GL JS Map
     * @returns sourceId
     */
    addToMap(map: mapboxgl.Map): Promise<string>;
    getGLSource(): Promise<RasterSource>;
    /**
     * Returns a raster layer for the source.
     * @returns RasterLayer[]
     */
    getGLStyleLayers(): Promise<{
        layers: RasterLayer[];
    }>;
    /**
     * Remove source from map. If there are any layers on the map that use this
     * source, they will also be removed.
     * @param map Mapbox GL JS Map
     */
    removeFromMap(map: Map): AnyLayer[];
    /**
     * Removes the source from the map and removes any event listeners
     */
    destroy(): void;
    updateMaxZoom(maxZoom: number | undefined): Promise<void>;
    /** noop */
    updateLayers(layers: OrderedLayerSettings): void;
    get ready(): boolean;
    prepare(): Promise<void>;
    addEventListeners(map: Map): void;
    removeEventListeners(map: Map): void;
}
export declare function isArcGISTiledMapservice(source: CustomGLSource<any, any>): source is ArcGISTiledMapService;
//# sourceMappingURL=ArcGISTiledMapService.d.ts.map