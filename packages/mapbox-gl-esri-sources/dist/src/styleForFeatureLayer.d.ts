import { Layer } from "mapbox-gl";
import { ImageList } from "./ImageList";
/**
 * This function retrieves rendering and style information from the ArcGIS REST
 * API for a given [Feature Layer](https://developers.arcgis.com/rest/services-reference/layer-table.htm)
 * and produces images and style layers that can be used to faithfully represent
 * these services as vectors in MapBox GL. It can be used in conjunction with
 * {@link ArcGISVectorSource}.
 *
 * Style generation is seperated from source handling so that you could even
 * use tippecanoe or other tools to generate vector tiles from a service and
 * style them using the generated layers. With this seperation of concerns it's
 * also possible to cache style information so that it does not need to
 * always be generated dynamically.
 *
 * ### Usage
 *
 * ```typescript
 * import { ArcGISVectorSource, styleForFeatureLayer } from "mapbox-gl-esri-sources";
 *
 * // setup map...
 * // add source...
 *
 * const { imageList, layers } = styleForFeatureLayer(
 *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0",
 *   "cities-source-id"
 * );
 *
 * imageList.addToMap(map);
 *
 * for (const layer of layers) {
 *   map.addLayer(layer);
 * }
 *
 * ```
 *
 * @param {string} serviceBaseUrl Main Service url. Should end in MapServer or FeatureServer
 * @param {number} sublayer Sublayer to style
 * @param {string} sourceId ID for the [source](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/) of vector data to be used in rendering.
 * @param {any} [serviceMetadata] Optional metadata for the service. If not provided it will be fetched from the service.
 * @returns The {@link ImageList.addToMap} function should be called before adding the generated layers to the map.
 */
declare function styleForFeatureLayer(serviceBaseUrl: string, sublayer: number, sourceId: string, serviceMetadata?: any): Promise<{
    imageList: ImageList;
    layers: Layer[];
}>;
export default styleForFeatureLayer;