import { Map } from "mapbox-gl";
import { SimpleMarkerSymbol, PictureFillSymbol, PictureMarkerSymbol, SimpleFillSymbol } from "arcgis-rest-api";
export interface Image {
    pixelRatio: number;
    dataURI: string;
    width: number;
    height: number;
}
export interface ImageSet {
    id: string;
    images: Image[];
}
export declare class ImageList {
    private imageSets;
    private supportsHighDPILegends;
    constructor(arcGISVersion?: number);
    /**
     * Add a fill image for a PictureFillSymbol to the image set.
     *
     * PictureFillSymbol images cannot be requested at high-dpi from the legend
     * endpoint because they would include an outline and not the full pattern. If
     * there is a way to request a high-dpi image I do not know it. Instead,
     * serialized image data is just pulled from the symbol itself.
     *
     * @hidden
     * @param {PictureFillSymbol} symbol
     * @returns {string} imageid
     */
    addEsriPFS(symbol: PictureFillSymbol): string;
    /**
     * Add a PictureMarkerSymbol image to the set. If the server supports high-dpi
     * legends (10.6+), this function will fetch high resolution markers from the
     * origin server. Otherwise it will just use serialized image data from the
     * symbol definition.
     *
     * @param {PictureMarkerSymbol} symbol
     * @param {string} serviceBaseUrl
     * @param {number} sublayer
     * @param {number} legendIndex
     * @returns {string} imageid
     * @hidden
     */
    addEsriPMS(symbol: PictureMarkerSymbol, serviceBaseUrl: string, sublayer: number, legendIndex: number): string;
    /**
     * Adds a SimpleMarkerSymbol to the ImageSet. These markers will be generated
     * in multiple resolutions using html canvas to support multiple device pixel
     * ratios (1, 2 and 3)
     *
     * @param {SimpleMarkerSymbol} symbol
     * @returns {string} imageid
     * @hidden
     */
    addEsriSMS(symbol: SimpleMarkerSymbol): string;
    /**
     * @hidden
     * @param {SimpleFillSymbol} symbol
     * @returns
     * @memberof ImageList
     */
    addEsriSFS(symbol: SimpleFillSymbol): string;
    /**
     * Add all images to a MapBox GL JS map instance so that they may be used in
     * style layers. Call before adding layers created by {@link styleForFeatureLayer | styleForFeatureLayer}.
     *
     * The ImageList may contain multiple copies of images at different dpi. Since
     * MapBox GL does not currently support adding images at multiple resolutions
     * this function will pick those that best match the current [devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio).
     * If the devicePixelRatio changes (e.g. switching monitors), the images
     * *will not* be updated and may be at a less than ideal resolution, though
     * mapbox gl will still show them at the correct size.
     *
     * @param {Map} map
     * @returns
     * @memberof ImageList
     */
    addToMap(map: Map): Promise<void[]>;
}
