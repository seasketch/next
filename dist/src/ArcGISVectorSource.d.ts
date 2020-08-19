import { Map, GeoJSONSource } from "mapbox-gl";
export interface ArcGISVectorSourceOptions {
    /**
     * If given and the data host provides a `content-length` header, data will
     * only be fetched until this limit is reached.
     * @type {number}
     * @default unlimited
     */
    bytesLimit?: number;
    /**
     * ArcGISVectorSource will page through results until the entire dataset is
     * downloaded or the `bytesLimit` is reached. If set to true, data will be
     * rendered each time a page of features are downloaded. Otherwise, the source
     * data will only be updated once upon completion.
     * @type {boolean}
     * @default true
     */
    displayIncompleteFeatureCollections?: boolean;
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
}
/**
 * Add ArcGIS Feature Layers to MapBox GL JS maps as a geojson source. These
 * data sources can be styled using output from
 * {@link styleForFeatureLayer | styleForFeatureLayer } or custom layers that
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
 *     bytesLimit: 1000 * 1000 * 2, // 2mb
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
    /**
     * Size of the dataset added to the map. Relies on `content-length` header
     * from the data host, which may not be available.
     */
    protected totalBytes: number;
    private id;
    private baseUrl;
    private options;
    private map;
    private outFields;
    private supportsPagination;
    private displayIncompleteFeatureCollections;
    /**
     * Creates an instance of ArcGISVectorSource.
     * @param {Map} map MapBox GL JS map instance where source will be added
     * @param {string} id ID will be assigned to the GeoJSONSource instance
     * @param {string} url Base url for an [ArcGIS Server Feature Layer](https://developers.arcgis.com/rest/services-reference/layer-table.htm). Should end in _/MapServer/0..n_
     */
    constructor(map: Map, id: string, url: string, options?: ArcGISVectorSourceOptions);
    private fetchGeoJSON;
}
