import { Map, AnyLayer, AnySourceData } from "mapbox-gl";
import { ComputedMetadata, CustomGLSource, CustomGLSourceOptions, CustomSourceType, LegendItem, OrderedLayerSettings } from "./CustomGLSource";
import { ArcGISRESTServiceRequestManager } from "./ArcGISRESTServiceRequestManager";
/** @hidden */
export declare const blankDataUri = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
export interface ArcGISDynamicMapServiceOptions extends CustomGLSourceOptions {
    /**
     * URL for the service. Should end in /MapServer
     */
    url: string;
    /**
     * Fetch larger images for high-resolution devices.
     * @default true
     * */
    supportHighDpiDisplays?: boolean;
    /**
     * List of sublayers to display, in order. Order will be respected  only if
     * `supportsDynamicRendering` is true. If left undefined the service will be
     * with the default layers.
     * */
    layers?: OrderedLayerSettings;
    /**
     * All query parameters will be added to each MapServer export request,
     * overriding any settings made by this library. Useful for specifying image
     * format, or working with temporal data.
     * */
    queryParameters?: {
        [queryString: string]: string | number;
    };
    /**
     * Request tiles instead of a single image.
     * @default false
     */
    useTiles?: boolean;
    /**
     * 256 or 512 would be most appropriate. default is 256
     */
    tileSize?: number;
    token?: string;
}
export declare class ArcGISDynamicMapService implements CustomGLSource<ArcGISDynamicMapServiceOptions, LegendItem[]> {
    /** Source id used in the map style */
    sourceId: string;
    private map?;
    private requestManager;
    private serviceMetadata?;
    private layerMetadata?;
    private options;
    private layers?;
    private supportsDynamicLayers;
    private debounceTimeout?;
    private _loading;
    private resolution?;
    type: CustomSourceType;
    url: string;
    /**
     * @param {string} sourceId ID to be used when adding refering to this source from layers
     * @param {string} baseUrl Location of the service. Should end in /MapServer
     * @param {ArcGISDynamicMapServiceOptions} [options]
     */
    constructor(requestManager: ArcGISRESTServiceRequestManager, options: ArcGISDynamicMapServiceOptions);
    private respondToResolutionChange;
    /**
     * Use ArcGISRESTServiceRequestManager to fetch metadata for the service,
     * caching it on the instance for reuse.
     */
    private getMetadata;
    _computedMetadata?: ComputedMetadata;
    /**
     * Returns computed metadata for the service, including bounds, minzoom, maxzoom, and attribution.
     * @returns ComputedMetadata
     * @throws Error if metadata is not available
     * @throws Error if tileInfo is not available
     * */
    getComputedMetadata(): Promise<ComputedMetadata>;
    /**
     * Private method used as the basis for getComputedMetadata and also used
     * when generating the source data for addToMap.
     * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
     */
    private getComputedProperties;
    private onMapData;
    private onMapError;
    getGLSource(map: Map): Promise<AnySourceData>;
    private getCoordinates;
    addToMap(map: Map): Promise<string>;
    addEventListeners(map: Map): void;
    removeEventListeners(map: Map): void;
    removeFromMap(map: Map): void;
    /**
     * Clears all map event listeners setup by this instance.
     */
    destroy(): void;
    private getUrl;
    /** Whether a source image is currently being fetched over the network */
    get loading(): boolean;
    private updateSource;
    private debouncedUpdateSource;
    /**
     * Update the list of sublayers and re-render the the map. If
     * `supportsDynamicLayers` is enabled, sublayer order and opacity will be
     * respected.
     *
     * ```typescript
     * // reverses layer rendering order and sets one sublayer to 50% transparency
     * mapService.updateLayers([
     *   { sublayer: 1, opacity: 0.5 },
     *   { sublayer: 0, opacity: 1 }
     * ]);
     * ```
     *
     * @param layers SublayerState is an array of objects with `sublayer` and
     *               optional `opacity` props.
     *
     */
    updateLayers(layers: OrderedLayerSettings): void;
    /**
     * Update query params sent with each export request and re-render the map. A
     * list of supported parameters can be found in the [Esri REST API docs](https://developers.arcgis.com/rest/services-reference/export-map.htm#GUID-C93E8957-99FD-473B-B0E1-68EA315EBD98).
     * Query parameters will override any values set by this library, such as
     * `format`, `dpi`, `size`, and `bbox`.
     *
     * ```typescript
     *
     * mapServiceSource.updateQueryParameters({
     *  format: 'png32',
     *  // visualize temporal datasets!
     *  historicMoment: slider.value
     * })
     *
     * ```
     */
    updateQueryParameters(queryParameters: {
        [queryString: string]: string | number;
    }): void;
    /**
     * Update support for adjusting image resolution based on devicePixelRatio and
     * re-render the map. Useful for giving users the option to toggle
     * high-resolution images depending on network conditions.
     * @param enable
     */
    updateUseDevicePixelRatio(enable: boolean): void;
    getGLStyleLayers(): Promise<{
        layers: AnyLayer[];
    }>;
    get ready(): boolean;
    prepare(): Promise<void>;
}
export declare function isArcGISDynamicMapService(source: any): source is ArcGISDynamicMapService;
