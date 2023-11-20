"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArcGISDynamicMapService = exports.blankDataUri = void 0;
const uuid_1 = require("uuid");
const utils_1 = require("./utils");
/** @hidden */
exports.blankDataUri = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
class ArcGISDynamicMapService {
    /**
     * @param {string} sourceId ID to be used when adding refering to this source from layers
     * @param {string} baseUrl Location of the service. Should end in /MapServer
     * @param {ArcGISDynamicMapServiceOptions} [options]
     */
    constructor(requestManager, options) {
        this.supportsDynamicLayers = false;
        this._loading = true;
        this.respondToResolutionChange = () => {
            if (this.options.supportHighDpiDisplays) {
                this.updateSource();
            }
            if (this.resolution) {
                matchMedia(this.resolution).removeListener(this.respondToResolutionChange);
            }
            this.resolution = `(resolution: ${window.devicePixelRatio}dppx)`;
            matchMedia(this.resolution).addListener(this.respondToResolutionChange);
        };
        this.onMapData = (event) => {
            if (event.sourceId && event.sourceId === this.sourceId) {
                this._loading = false;
            }
        };
        this.onMapError = (event) => {
            if (event.sourceId === this.sourceId &&
                ((event.dataType === "source" && event.sourceDataType === "content") ||
                    (event.type === "error" &&
                        event.error &&
                        "status" in event.error &&
                        event.error.status !== 404))) {
                this._loading = false;
            }
        };
        this.updateSource = () => {
            var _a;
            this._loading = true;
            const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
            if (source && this.map) {
                if (source.type === "raster") {
                    // @ts-ignore - setTiles is in fact a valid method
                    source.setTiles([this.getUrl()]);
                }
                else if (source.type === "image") {
                    const bounds = this.map.getBounds();
                    const coordinates = [
                        [bounds.getNorthWest().lng, bounds.getNorthWest().lat],
                        [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
                        [bounds.getSouthEast().lng, bounds.getSouthEast().lat],
                        [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
                    ];
                    const url = this.getUrl();
                    if (
                    // @ts-ignore
                    source.url === url) {
                        return;
                    }
                    // @ts-ignore Using a private member here
                    if (source.image) {
                        source.updateImage({
                            url,
                            coordinates,
                        });
                    }
                    else {
                        let tries = 0;
                        const updater = () => {
                            var _a;
                            const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
                            if (source && this.getUrl() === url) {
                                // @ts-ignore
                                if (source.image && source.type === "image") {
                                    source.updateImage({
                                        url,
                                        coordinates,
                                    });
                                }
                                else if (tries < 10) {
                                    tries++;
                                    setTimeout(updater, 50);
                                }
                            }
                        };
                        setTimeout(updater, 50);
                    }
                }
                else {
                    // do nothing, source isn't added
                }
            }
        };
        this.debouncedUpdateSource = () => {
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }
            this.debounceTimeout = setTimeout(() => {
                delete this.debounceTimeout;
                this.updateSource();
            }, 5);
        };
        this.type = "ArcGISDynamicMapService";
        this.options = options;
        this.url = options.url;
        this.requestManager = requestManager;
        this.sourceId = (options === null || options === void 0 ? void 0 : options.sourceId) || (0, uuid_1.v4)();
        // remove trailing slash if present
        options.url = options.url.replace(/\/$/, "");
        if (!/rest\/services/.test(options.url) || !/MapServer/.test(options.url)) {
            throw new Error("Invalid ArcGIS REST Service URL");
        }
        this.resolution = `(resolution: ${window.devicePixelRatio}dppx)`;
        matchMedia(this.resolution).addListener(this.respondToResolutionChange);
    }
    /**
     * Use ArcGISRESTServiceRequestManager to fetch metadata for the service,
     * caching it on the instance for reuse.
     */
    getMetadata() {
        if (this.serviceMetadata && this.layerMetadata) {
            return Promise.resolve({
                serviceMetadata: this.serviceMetadata,
                layers: this.layerMetadata,
            });
        }
        else {
            return this.requestManager
                .getMapServiceMetadata(this.options.url, {
                token: this.options.token,
            })
                .then(({ serviceMetadata, layers }) => {
                this.serviceMetadata = serviceMetadata;
                this.layerMetadata = layers;
                this.supportsDynamicLayers = serviceMetadata.supportsDynamicLayers;
                return { serviceMetadata, layers };
            });
        }
    }
    /**
     * Returns computed metadata for the service, including bounds, minzoom, maxzoom, and attribution.
     * @returns ComputedMetadata
     * @throws Error if metadata is not available
     * @throws Error if tileInfo is not available
     * */
    async getComputedMetadata() {
        var _a, _b;
        if (!this._computedMetadata) {
            const { serviceMetadata, layers } = await this.getMetadata();
            const { bounds, minzoom, maxzoom, attribution } = await this.getComputedProperties();
            const results = /\/.+\/MapServer/.exec(this.options.url);
            let label = results ? results[0] : false;
            if (!label) {
                if ((_b = (_a = this.layerMetadata) === null || _a === void 0 ? void 0 : _a.layers) === null || _b === void 0 ? void 0 : _b[0]) {
                    label = this.layerMetadata.layers[0].name;
                }
            }
            const legendData = await this.requestManager.getLegendMetadata(this.options.url);
            // find hidden layers
            // Not as simple as just reading the defaultVisibility property, because
            // if a parent layer is hidden, all children are hidden as well. Folders can
            // be nested arbitrarily deep.
            const hiddenIds = new Set();
            for (const layer of layers.layers) {
                if (!layer.defaultVisibility) {
                    hiddenIds.add(layer.id);
                }
                else {
                    // check if parents are hidden
                    if (layer.parentLayer) {
                        if (hiddenIds.has(layer.parentLayer.id)) {
                            hiddenIds.add(layer.id);
                        }
                        else {
                            // may not be added yet
                            const parent = layers.layers.find((l) => { var _a; return l.id === ((_a = layer.parentLayer) === null || _a === void 0 ? void 0 : _a.id); });
                            if (parent && !parent.defaultVisibility) {
                                hiddenIds.add(layer.id);
                                hiddenIds.add(parent.id);
                            }
                        }
                    }
                }
            }
            this._computedMetadata = {
                bounds: bounds || undefined,
                minzoom,
                maxzoom,
                attribution,
                tableOfContentsItems: layers.layers.map((lyr) => {
                    const legendLayer = legendData.layers.find((l) => l.layerId === lyr.id);
                    const isFolder = lyr.type === "Group Layer";
                    if (isFolder) {
                        return {
                            type: "folder",
                            id: lyr.id.toString(),
                            label: lyr.name,
                            defaultVisibility: hiddenIds.has(lyr.id)
                                ? false
                                : lyr.defaultVisibility,
                            parentId: lyr.parentLayer
                                ? lyr.parentLayer.id.toString()
                                : undefined,
                        };
                    }
                    else {
                        return {
                            type: "data",
                            id: lyr.id.toString(),
                            label: lyr.name,
                            defaultVisibility: hiddenIds.has(lyr.id)
                                ? false
                                : lyr.defaultVisibility,
                            metadata: (0, utils_1.generateMetadataForLayer)(this.options.url + "/" + lyr.id, this.serviceMetadata, lyr),
                            parentId: lyr.parentLayer
                                ? lyr.parentLayer.id.toString()
                                : undefined,
                            legend: (0, utils_1.makeLegend)(legendData, lyr.id),
                        };
                    }
                }),
                supportsDynamicRendering: {
                    layerOpacity: this.supportsDynamicLayers,
                    layerOrder: true,
                    layerVisibility: true,
                },
            };
        }
        return this._computedMetadata;
    }
    /**
     * Private method used as the basis for getComputedMetadata and also used
     * when generating the source data for addToMap.
     * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
     */
    async getComputedProperties() {
        var _a, _b;
        const { serviceMetadata, layers } = await this.getMetadata();
        const levels = ((_a = serviceMetadata.tileInfo) === null || _a === void 0 ? void 0 : _a.lods.map((l) => l.level)) || [];
        const attribution = (0, utils_1.contentOrFalse)(layers.layers[0].copyrightText) ||
            (0, utils_1.contentOrFalse)(serviceMetadata.copyrightText) ||
            (0, utils_1.contentOrFalse)((_b = serviceMetadata.documentInfo) === null || _b === void 0 ? void 0 : _b.Author) ||
            undefined;
        const minzoom = Math.min(...levels);
        const maxzoom = Math.max(...levels);
        return {
            minzoom,
            maxzoom,
            bounds: await (0, utils_1.extentToLatLngBounds)(serviceMetadata.fullExtent),
            attribution,
        };
    }
    async getGLSource() {
        let { attribution, bounds } = await this.getComputedProperties();
        bounds = bounds || [-90, -180, 90, 180];
        if (this.options.useTiles) {
            return {
                type: "raster",
                tiles: [this.getUrl()],
                tileSize: this.options.tileSize || 256,
                bounds: bounds,
                attribution,
            };
        }
        else {
            let coordinates = [
                [bounds[0], bounds[1]],
                [bounds[2], bounds[1]],
                [bounds[2], bounds[3]],
                [bounds[0], bounds[3]],
            ];
            if (this.map) {
                const bounds = this.map.getBounds();
                coordinates = [
                    [bounds.getNorthWest().lng, bounds.getNorthWest().lat],
                    [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
                    [bounds.getSouthEast().lng, bounds.getSouthEast().lat],
                    [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
                ];
            }
            // return a blank image until map event listeners are setup
            return {
                type: "image",
                url: this.getUrl(),
                coordinates,
            };
        }
    }
    async addToMap(map) {
        if (!map) {
            throw new Error("Map not provided to addToMap");
        }
        const sourceData = await this.getGLSource();
        map.addSource(this.sourceId, sourceData);
        this.addEventListeners(map);
        return this.sourceId;
    }
    addEventListeners(map) {
        var _a;
        if (!map) {
            throw new Error("Map not provided to addEventListeners");
        }
        if (!((_a = this.options) === null || _a === void 0 ? void 0 : _a.useTiles)) {
            if (!this.map || (this.map && this.map !== map)) {
                if (this.map) {
                    this.removeEventListeners(this.map);
                }
                this.map = map;
                map.on("moveend", this.updateSource);
                map.on("data", this.onMapData);
                map.on("error", this.onMapError);
                // Source is added as a blank image at first. Initialize it with
                // proper bounds and image
                this.updateSource();
            }
        }
    }
    removeEventListeners(map) {
        if (!this.map) {
            throw new Error("Map not set");
        }
        else if (this.map !== map) {
            throw new Error("Map does not match");
        }
        delete this.map;
        map.off("moveend", this.updateSource);
        map.off("data", this.onMapData);
        map.off("error", this.onMapError);
    }
    removeFromMap(map) {
        if (map.getSource(this.sourceId)) {
            const layers = map.getStyle().layers || [];
            for (const layer of layers) {
                if ("source" in layer && layer.source === this.sourceId) {
                    map.removeLayer(layer.id);
                }
            }
            this.removeEventListeners(map);
            map.removeSource(this.sourceId);
            this.map = undefined;
        }
    }
    /**
     * Clears all map event listeners setup by this instance.
     */
    destroy() {
        matchMedia(this.resolution).removeListener(this.respondToResolutionChange);
        if (this.map) {
            this.removeFromMap(this.map);
        }
    }
    getUrl() {
        if (!this.map) {
            return exports.blankDataUri;
        }
        const bounds = this.map.getBounds();
        let url = new URL(this.options.url + "/export");
        url.searchParams.set("f", "image");
        url.searchParams.set("transparent", "true");
        // create bbox in web mercator
        let bbox = [
            lon2meters(bounds.getWest()),
            lat2meters(bounds.getSouth()),
            lon2meters(bounds.getEast()),
            lat2meters(bounds.getNorth()),
        ];
        const groundResolution = getGroundResolution(this.map.getZoom() +
            (this.options.supportHighDpiDisplays ? window.devicePixelRatio - 1 : 0));
        // Width and height can't be based on container width if the map is rotated
        const width = Math.round((bbox[2] - bbox[0]) / groundResolution);
        const height = Math.round((bbox[3] - bbox[1]) / groundResolution);
        url.searchParams.set("format", "png");
        url.searchParams.set("size", [width, height].join(","));
        if (this.options.supportHighDpiDisplays) {
            switch (window.devicePixelRatio) {
                case 1:
                    // standard pixelRatio looks best at 96
                    url.searchParams.set("dpi", "96");
                    break;
                case 2:
                    // for higher pixelRatios, esri's software seems to like the dpi
                    // bumped up somewhat higher than a simple formula would suggest
                    url.searchParams.set("dpi", "220");
                    break;
                case 3:
                    url.searchParams.set("dpi", "390");
                    break;
                default:
                    url.searchParams.set("dpi", 
                    // Bumping pixel ratio a bit. see above
                    (window.devicePixelRatio * 96 * 1.22).toString());
                    break;
            }
        }
        else {
            url.searchParams.set("dpi", "96");
        }
        // Default to epsg:3857
        url.searchParams.set("imageSR", "102100");
        url.searchParams.set("bboxSR", "102100");
        // If the map extent crosses the meridian, we need to create a new
        // projection and map the x coordinates to that space. The Esri JS API
        // exhibits this same behavior. Solution was inspired by:
        // * https://github.com/Esri/esri-leaflet/issues/672#issuecomment-160691149
        // * https://gist.github.com/perrygeo/4478844
        if (Math.abs(bbox[0]) > 20037508.34 || Math.abs(bbox[2]) > 20037508.34) {
            const centralMeridian = bounds.getCenter().lng;
            if (this.options.supportHighDpiDisplays && window.devicePixelRatio > 1) {
                bbox[0] = -(width * groundResolution) / (window.devicePixelRatio * 2);
                bbox[2] = (width * groundResolution) / (window.devicePixelRatio * 2);
            }
            else {
                bbox[0] = -(width * groundResolution) / 2;
                bbox[2] = (width * groundResolution) / 2;
            }
            const sr = JSON.stringify({
                wkt: `PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",${centralMeridian}],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]`,
            });
            url.searchParams.set("imageSR", sr);
            url.searchParams.set("bboxSR", sr);
        }
        if (Array.isArray(this.layers)) {
            if (this.layers.length === 0) {
                return exports.blankDataUri;
            }
            else {
                url.searchParams.set("layers", `show:${this.layers.map((lyr) => lyr.id).join(",")}`);
            }
        }
        url.searchParams.set("bbox", bbox.join(","));
        url.searchParams.delete("dynamicLayers");
        let layersInOrder = true;
        let hasOpacityUpdates = false;
        if (this.supportsDynamicLayers && this.layers) {
            for (var i = 0; i < this.layers.length; i++) {
                if (this.layers[i - 1] &&
                    parseInt(this.layers[i].id) < parseInt(this.layers[i - 1].id)) {
                    layersInOrder = false;
                }
                const opacity = this.layers[i].opacity;
                if (opacity !== undefined && opacity < 1) {
                    hasOpacityUpdates = true;
                }
            }
        }
        if (this.layers && (!layersInOrder || hasOpacityUpdates)) {
            // need to provide renderInfo
            const dynamicLayers = this.layers.map((lyr) => {
                return {
                    id: lyr.id,
                    source: {
                        mapLayerId: lyr.id,
                        type: "mapLayer",
                    },
                    drawingInfo: {
                        transparency: lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
                    },
                };
            });
            url.searchParams.set("dynamicLayers", JSON.stringify(dynamicLayers));
        }
        for (const key in this.options.queryParameters) {
            url.searchParams.set(key, this.options.queryParameters[key].toString());
        }
        const tileSize = this.options.tileSize || 256;
        if (this.options.useTiles) {
            url.searchParams.set("bbox", `seasketch-replace-me`);
            if (this.options.supportHighDpiDisplays && window.devicePixelRatio > 1) {
                const size = tileSize * window.devicePixelRatio;
                url.searchParams.set("size", [size, size].join(","));
            }
            else {
                url.searchParams.set("size", [tileSize, tileSize].join(","));
            }
        }
        return url.toString().replace("seasketch-replace-me", "{bbox-epsg-3857}");
    }
    /** Whether a source image is currently being fetched over the network */
    get loading() {
        var _a;
        const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
        if (source && source.type === "raster") {
            return this.map.isSourceLoaded(this.sourceId) === false;
        }
        else {
            return this._loading;
        }
    }
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
    updateLayers(layers) {
        // do a deep comparison of layers to detect whether there are any changes
        if (JSON.stringify(layers) !== JSON.stringify(this.layers)) {
            this.layers = layers;
            this.debouncedUpdateSource();
        }
    }
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
    updateQueryParameters(queryParameters) {
        // do a deep comparison of layers to detect whether there are any changes
        if (JSON.stringify(this.options.queryParameters) !==
            JSON.stringify(queryParameters)) {
            this.options.queryParameters = queryParameters;
            this.debouncedUpdateSource();
        }
    }
    /**
     * Update support for adjusting image resolution based on devicePixelRatio and
     * re-render the map. Useful for giving users the option to toggle
     * high-resolution images depending on network conditions.
     * @param enable
     */
    updateUseDevicePixelRatio(enable) {
        if (enable !== this.options.supportHighDpiDisplays) {
            this.options.supportHighDpiDisplays = enable;
            this.debouncedUpdateSource();
        }
    }
    async getGLStyleLayers() {
        return {
            layers: [
                {
                    id: (0, uuid_1.v4)(),
                    type: "raster",
                    source: this.sourceId,
                    paint: {
                        "raster-fade-duration": this.options.useTiles ? 300 : 0,
                    },
                },
            ],
        };
    }
    get ready() {
        return Boolean(this._computedMetadata);
    }
    async prepare() {
        await this.getComputedMetadata();
        return;
    }
}
exports.ArcGISDynamicMapService = ArcGISDynamicMapService;
/** @hidden */
function lat2meters(lat) {
    // thanks! https://gist.github.com/onderaltintas/6649521
    var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
    return (y * 20037508.34) / 180;
}
/** @hidden */
function lon2meters(lon) {
    return (lon * 20037508.34) / 180;
}
/** @hidden */
function getGroundResolution(level) {
    let groundResolution = resolutions[level];
    if (!groundResolution) {
        groundResolution = (2 * Math.PI * 6378137) / (256 * 2 ** (level + 1));
        resolutions[level] = groundResolution;
    }
    return groundResolution;
}
/** @hidden */
const resolutions = {};
