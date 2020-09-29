import { Map } from "mapbox-gl";
export interface SublayerState {
    /** 0-based sublayer index */
    sublayer: number;
    /** sublayer opacity from 0.0 - 1.0 */
    opacity?: number;
}
export interface ArcGISDynamicMapServiceOptions {
    /**
     * Fetch larger images for high-resolution devices.
     * @default true
     * */
    useDevicePixelRatio?: boolean;
    /**
     * List of sublayers to display, in order. Order will be respected  only if
     * `supportsDynamicLayers` is true. If left undefined the service will be
     * with the default layers.
     * */
    layers?: SublayerState[];
    /**
     * Set true if the Map Service supports [dynamic layers](https://developers.arcgis.com/rest/services-reference/export-map.htm#GUID-E781BA37-0260-485E-BB21-CA9B85206AAE)
     * , in which case sublayer order and opacity can be specified. If set false
     * any order and opacity settings will be ignored.
     * @default false
     * */
    supportsDynamicLayers?: boolean;
    /**
     * All query parameters will be added to each MapServer export request,
     * overriding any settings made by this library. Useful for specifying image
     * format, or working with temporal data.
     * */
    queryParameters?: {
        [queryString: string]: string | number;
    };
}
/**
 * Add an Esri Dynamic Map Service as an image source to a MapBox GL JS map, and
 * use the included methods to update visible sublayers, set layer order and
 * opacity, support high-dpi screens, and transparently deal with issues related
 * to crossing the central meridian.
 *
 * ```typescript
 * import { ArcGISDynamicMapService } from "mapbox-gl-esri-sources";
 *
 * // ... setup your map
 *
 * const populatedPlaces = new ArcGISDynamicMapService(
 *   map,
 *   "populated-places-source",
 *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer", {
 *     supportsDynamicLayers: true,
 *     sublayers: [
 *       { sublayer: 0, opacity: 1 },
 *       { sublayer: 1, opacity: 1 },
 *       { sublayer: 2, opacity: 0.5 },
 *     ],
 *     queryParameters: {
 *       format: 'png32'
 *     }
 *   }
 * });
 *
 * // Don't forget to add a layer to reference your source
 * map.addLayer({
 *   id: "ags-layer",
 *   type: "raster",
 *   source: populatedPlaces.id,
 *   paint: {
 *     "raster-fade-duration": 0,
 *     "raster-opacity": 0.9
 *   },
 * });
 *
 * // turn off the third sublayer and update opacity
 * populatedPlaces.updateLayers([
 *   { sublayer: 0, opacity: 0.5 },
 *   { sublayer: 1, opacity: 1 },
 * ]);
 *
 * // disable high-dpi screen support
 * populatedPlaces.updateUseDevicePixelRatio(false);
 * ```
 * @class ArcGISDynamicMapService
 */
export declare class ArcGISDynamicMapService {
    /** Source id used in the map style */
    id: string;
    private baseUrl;
    private url;
    private map;
    private layers?;
    private queryParameters;
    private source;
    private supportDevicePixelRatio;
    private supportsDynamicLayers;
    private debounceTimeout?;
    /**
     * @param {Map} map MapBox GL JS Map instance
     * @param {string} id ID to be used when adding refering to this source from layers
     * @param {string} baseUrl Location of the service. Should end in /MapServer
     * @param {ArcGISDynamicMapServiceOptions} [options]
     */
    constructor(map: Map, id: string, baseUrl: string, options?: ArcGISDynamicMapServiceOptions);
    /**
     * Clears all map event listeners setup by this instance.
     */
    destroy(): void;
    private getUrl;
    private updateSource;
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
    updateLayers(layers: SublayerState[]): void;
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
}
