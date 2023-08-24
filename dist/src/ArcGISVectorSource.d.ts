import { Map, GeoJSONSource } from "mapbox-gl";
import { FeatureCollection } from "geojson";
export interface ArcGISVectorSourceOptions {
    /**
     * Number of digits precision after the decimal to fetch from the origin
     * server. The default of 6 a good compromise between precision (~10cm) and
     * download size.
     * @type {number}
     * @default 6
     */
    geometryPrecision?: number;
    /**
     * Set to false if the service is known not to support pagination, which will
     * be true for services that have only a single feature but is also indicated
     * by the main service metadata.
     *
     * If left to the default of true and the server does not support pagination,
     * the initial fetch of data will fail but a second request will be
     * constructed without pagination parameters which should succeed.
     *
     * @type {boolean}
     * @default true
     */
    supportsPagination?: boolean;
    /**
     * Can be used to limit fields in GeoJSON properties.
     * @type {string}
     * @default "*"
     */
    outFields?: string;
    bytesLimit?: number;
    onError?: (error: Error) => void;
}
/**
 * Add ArcGIS Feature Layers to MapBox GL JS maps as a geojson source. These
 * data sources can be styled using output from
 * {@link styleForFeatureLayer } or custom layers that
 * reference the provided source id.
 *
 * ### Usage
 *
 * ```typescript
 * import { ArcGISVectorSource } from "mapbox-gl-esri-sources";
 *
 * // setup map...
 *
 * const esriSource = new ArcGISVectorSource(
 *   map,
 *   'cities-source-id',
 *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0"),
 *   {
 *     geometryPrecision: 5,
 *     outFields: "POP,CITY_NAME"
 *   }
 * );
 * ```
 * @class ArcGISVectorSource
 */
export declare class ArcGISVectorSource {
    private data;
    /**
     * GeoJSONSource instance added to the map
     * @type {GeoJSONSource}
     */
    protected source: GeoJSONSource;
    private _id;
    private baseUrl;
    private options;
    private map;
    private outFields;
    private supportsPagination;
    /** Set to true when source is fetching data */
    private _loading;
    /**
     * Creates an instance of ArcGISVectorSource.
     * @param {Map} map MapBox GL JS map instance where source will be added
     * @param {string} id ID will be assigned to the GeoJSONSource instance
     * @param {string} url Base url for an [ArcGIS Server Feature Layer](https://developers.arcgis.com/rest/services-reference/layer-table.htm). Should end in _/MapServer/0..n_
     */
    constructor(map: Map, id: string, url: string, options?: ArcGISVectorSourceOptions);
    get loading(): boolean;
    get id(): string;
    /**
     * Remove the source from the map and any related event listeners
     */
    destroy(): void;
}
export declare function fetchFeatureLayerData(url: string, outFields: string, onError: (error: Error) => void, geometryPrecision?: number, abortController?: AbortController | null, onPageReceived?: ((bytes: number, loadedFeatures: number, estimatedFeatures: number) => void) | null, disablePagination?: boolean, pageSize?: number, bytesLimit?: number): Promise<FeatureCollection<import("geojson").Geometry, import("geojson").GeoJsonProperties>>;
