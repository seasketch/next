"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT = void 0;
exports.isFeatureLayerSource = isFeatureLayerSource;
exports.isArcgisFeatureLayerSource = isArcgisFeatureLayerSource;
const index_1 = require("../index");
const uuid_1 = require("uuid");
const utils_1 = require("./utils");
const fetchData_1 = require("./fetchData");
const QuantizedVectorRequestManager_1 = require("./QuantizedVectorRequestManager");
const tilebelt = __importStar(require("@mapbox/tilebelt"));
const ArcGISRESTServiceRequestManager_1 = require("./ArcGISRESTServiceRequestManager");
const tileDecode = require("arcgis-pbf-parser");
exports.FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT = 2000000;
function isFeatureLayerSource(source) {
    return source.type === "ArcGISFeatureLayer";
}
class ArcGISFeatureLayerSource {
    constructor(requestManager, options) {
        var _a;
        this._loading = true;
        this.rawFeaturesHaveBeenFetched = false;
        this.exceededBytesLimit = false;
        this._styleIsResolved = false;
        this.abortController = null;
        this.tileFormat = "geojson";
        this.paused = false;
        this.type = "ArcGISFeatureLayer";
        this.sourceId = options.sourceId || (0, uuid_1.v4)();
        this.options = options;
        // options.fetchStrategy = "raw";
        this.requestManager = requestManager;
        this.url = this.options.url;
        // remove trailing slash if present
        options.url = options.url.replace(/\/$/, "");
        if (!/rest\/services/.test(options.url) ||
            (!/MapServer/.test(options.url) && !/FeatureServer/.test(options.url))) {
            throw new Error("Invalid ArcGIS REST Service URL");
        }
        if (!/\d+$/.test(options.url)) {
            throw new Error("URL must end in /FeatureServer/{layerId} or /MapServer/{layerId}");
        }
        this.layerId = parseInt(((_a = options.url.match(/\d+$/)) === null || _a === void 0 ? void 0 : _a[0]) || "0");
        this.initialFetchStrategy = options.fetchStrategy || "auto";
        const cache = caches
            .open((options === null || options === void 0 ? void 0 : options.cacheKey) || "seasketch-arcgis-rest-services")
            .then((cache) => {
            this.cache = cache;
        });
    }
    async getComputedMetadata() {
        try {
            if (!this._computedMetadata) {
                const { serviceMetadata, layers } = await this.getMetadata();
                const { bounds, minzoom, maxzoom, attribution } = await this.getComputedProperties();
                const layer = layers.layers.find((l) => l.id === this.layerId);
                const glStyle = await this.getGLStyleLayers();
                if (!layer) {
                    throw new Error("Layer not found");
                }
                this._computedMetadata = {
                    bounds,
                    minzoom,
                    maxzoom,
                    attribution,
                    supportsDynamicRendering: {
                        layerOpacity: false,
                        layerVisibility: false,
                        layerOrder: false,
                    },
                    tableOfContentsItems: [
                        {
                            type: "data",
                            defaultVisibility: true,
                            id: this.sourceId,
                            label: layer.name,
                            metadata: (0, utils_1.generateMetadataForLayer)(this.options.url.replace(/\/\d+$/, ""), serviceMetadata, layer),
                            glStyle: glStyle,
                        },
                    ],
                };
            }
            return this._computedMetadata;
        }
        catch (e) {
            this.error = e.toString();
            throw e;
        }
    }
    /**
     * Private method used as the basis for getComputedMetadata and also used
     * when generating the source data for addToMap.
     * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
     */
    async getComputedProperties() {
        const { serviceMetadata, layers } = await this.getMetadata();
        const attribution = this.options.attributionOverride ||
            (0, utils_1.contentOrFalse)(serviceMetadata.copyrightText) ||
            undefined;
        const layer = layers.layers.find((l) => l.id === this.layerId);
        if (!layer) {
            throw new Error(`Sublayer ${this.layerId} not found`);
        }
        const supportedFormats = ((layer === null || layer === void 0 ? void 0 : layer.supportedQueryFormats) || "")
            .split(",")
            .map((f) => f.toUpperCase().trim());
        this.tileFormat = supportedFormats.includes("PBF") ? "pbf" : "geojson";
        return {
            minzoom: 0,
            maxzoom: 24,
            bounds: (await (0, utils_1.extentToLatLngBounds)((layer === null || layer === void 0 ? void 0 : layer.extent) || serviceMetadata.fullExtent)) || undefined,
            attribution,
            supportedFormats,
        };
    }
    async updateFetchStrategy(fetchStrategy) {
        var _a;
        const map = this.map;
        if (this.initialFetchStrategy !== fetchStrategy && map) {
            this.initialFetchStrategy = fetchStrategy;
            (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.abort();
            const layers = await this.removeFromMap(map);
            this.options.fetchStrategy = fetchStrategy;
            delete this.featureData;
            this.rawFeaturesHaveBeenFetched = false;
            await this.addToMap(map);
            for (const layer of layers) {
                map.addLayer(layer);
            }
            this.exceededBytesLimit = false;
        }
    }
    fireError(e) {
        var _a;
        (_a = this.map) === null || _a === void 0 ? void 0 : _a.fire("error", {
            sourceId: this.sourceId,
            error: e.message,
        });
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
            if (/FeatureServer/.test(this.options.url)) {
                return this.requestManager
                    .getFeatureServerMetadata(this.options.url.replace(/\/\d+$/, ""), {
                    token: this.options.token,
                })
                    .then(({ serviceMetadata, layers }) => {
                    this.serviceMetadata = serviceMetadata;
                    this.layerMetadata = layers;
                    return { serviceMetadata, layers };
                });
            }
            else {
                return this.requestManager
                    .getMapServiceMetadata(this.options.url.replace(/\d+[\/]*$/, ""), {
                    token: this.options.token,
                })
                    .then(({ serviceMetadata, layers }) => {
                    this.serviceMetadata = serviceMetadata;
                    this.layerMetadata = layers;
                    return { serviceMetadata, layers };
                });
            }
        }
    }
    get loading() {
        var _a, _b;
        if (this.paused) {
            return false;
        }
        if (this.options.fetchStrategy === "raw") {
            return Boolean(((_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId)) &&
                ((_b = this.map) === null || _b === void 0 ? void 0 : _b.isSourceLoaded(this.sourceId)) === false);
        }
        else {
            return this._loading;
        }
    }
    async getGLStyleLayers() {
        if (this._glStylePromise) {
            return this._glStylePromise;
        }
        else {
            this._glStylePromise = new Promise(async (resolve, reject) => {
                const { serviceMetadata, layers } = await this.getMetadata();
                const layer = layers.layers.find((l) => l.id === this.layerId);
                if (!layer) {
                    throw new Error("Layer not found");
                }
                const styleInfo = (0, index_1.styleForFeatureLayer)(this.options.url.replace(/\/\d+$/, ""), this.layerId, this.sourceId, layer);
                this._styleIsResolved = true;
                resolve(styleInfo);
            });
            return this._glStylePromise;
        }
    }
    async getGLSource() {
        const { attribution } = await this.getComputedProperties();
        if (this.options.fetchStrategy === "raw") {
            return {
                type: "geojson",
                data: (0, fetchData_1.urlForRawGeoJSONData)(this.options.url, "*", 6),
                attribution: attribution ? attribution : "",
            };
        }
        else {
            return {
                type: "geojson",
                data: this.featureData || {
                    type: "FeatureCollection",
                    features: this.featureData || [],
                },
                attribution: attribution ? attribution : "",
            };
        }
    }
    addEventListeners(map) {
        if (this.map && this.map === map) {
            return;
        }
        else if (this.map) {
            this.removeEventListeners(map);
        }
        this.map = map;
        if (this.options.fetchStrategy === "raw") {
            return;
        }
        this.QuantizedVectorRequestManager =
            (0, QuantizedVectorRequestManager_1.getOrCreateQuantizedVectorRequestManager)(map);
        this._loading = this.featureData ? false : true;
        if (!this.rawFeaturesHaveBeenFetched) {
            this.fetchFeatures();
        }
    }
    removeEventListeners(map) {
        var _a;
        delete this.map;
        if (this.options.fetchStrategy === "raw") {
            return;
        }
        (_a = this.QuantizedVectorRequestManager) === null || _a === void 0 ? void 0 : _a.off("update");
        delete this.QuantizedVectorRequestManager;
    }
    async addToMap(map) {
        const source = await this.getGLSource();
        map.addSource(this.sourceId, source);
        this.addEventListeners(map);
        return this.sourceId;
    }
    async fetchFeatures() {
        var _a, _b, _c, _d;
        if (this.paused) {
            return;
        }
        if (((_a = this.options) === null || _a === void 0 ? void 0 : _a.fetchStrategy) === "tiled" ||
            this.getCachedAutoFetchStrategy() === "tiled") {
            this.options.fetchStrategy = "tiled";
            this.QuantizedVectorRequestManager.on("update", this.fetchTiles.bind(this));
            this.fetchTiles();
            return;
        }
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        setTimeout(() => {
            var _a;
            (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.abort("timeout");
        }, 10000);
        if (this.exceededBytesLimit) {
            return;
        }
        try {
            const data = await (0, fetchData_1.fetchFeatureCollection)(this.options.url, 6, "*", this.options.fetchStrategy === "raw"
                ? 120000000
                : this.options.autoFetchByteLimit ||
                    exports.FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT, this.abortController, this.options.fetchStrategy === "auto");
            this.featureData = data;
            const source = (_b = this.map) === null || _b === void 0 ? void 0 : _b.getSource(this.sourceId);
            if (source && source.type === "geojson") {
                this.options.fetchStrategy = "raw";
                source.setData(data);
            }
            this._loading = false;
            this.rawFeaturesHaveBeenFetched = true;
        }
        catch (e) {
            let shouldFireError = true;
            let shouldSetLoading = true;
            if ((typeof e === "string" && /timeout/.test(e)) ||
                ("message" in e && /limit/i.test(e.message)) ||
                ((_d = (_c = this.abortController) === null || _c === void 0 ? void 0 : _c.signal) === null || _d === void 0 ? void 0 : _d.reason) === "timeout") {
                this.exceededBytesLimit = true;
                if (this.options.fetchStrategy === "auto") {
                    shouldFireError = false;
                    shouldSetLoading = false;
                    this.options.fetchStrategy = "tiled";
                    this.QuantizedVectorRequestManager.on("update", this.fetchTiles.bind(this));
                    this.fetchTiles();
                    this.cacheAutoFetchStrategy("tiled");
                }
            }
            if (shouldFireError) {
                this.fireError(e);
                console.error(e);
            }
            if (shouldSetLoading) {
                this._loading = false;
            }
        }
    }
    cacheAutoFetchStrategy(mode) {
        localStorage.setItem(`${this.options.url}/fetchStrategy`, `${mode}-${new Date().getTime()}`);
    }
    getCachedAutoFetchStrategy() {
        const value = localStorage.getItem(`${this.options.url}/fetchStrategy`);
        if (!value || value.length === 0) {
            return null;
        }
        else {
            const [mode, timestamp] = value.split("-");
            if (new Date().getTime() - parseInt(timestamp) > 1000 * 60 * 60) {
                localStorage.setItem(`${this.options.url}/fetchStrategy`, "");
                return null;
            }
            else {
                return mode;
            }
        }
    }
    async fetchTiles() {
        var _a, _b, _c;
        if (this.paused) {
            return;
        }
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        this._loading = true;
        if (!this.QuantizedVectorRequestManager) {
            throw new Error("QuantizedVectorRequestManager not initialized");
        }
        else if (this.options.fetchStrategy !== "tiled") {
            throw new Error("fetchTiles called when fetchStrategy is not quantized. Was " +
                this.options.fetchStrategy);
        }
        const { tiles, tolerance } = this.QuantizedVectorRequestManager.viewportDetails;
        const fc = {
            type: "FeatureCollection",
            features: [],
        };
        const featureIds = new Set();
        try {
            let wasAborted = false;
            let errorCount = 0;
            await Promise.all(tiles.map((tile) => (async () => {
                var _a;
                const tileBounds = tilebelt.tileToBBOX(tile);
                const extent = {
                    spatialReference: {
                        latestWkid: 4326,
                        wkid: 4326,
                    },
                    xmin: tileBounds[0],
                    ymin: tileBounds[1],
                    xmax: tileBounds[2],
                    ymax: tileBounds[3],
                };
                const params = new URLSearchParams({
                    f: this.tileFormat,
                    geometry: JSON.stringify(extent),
                    outFields: "*",
                    outSR: "4326",
                    returnZ: "false",
                    returnM: "false",
                    precision: "8",
                    where: "1=1",
                    setAttributionFromService: "true",
                    quantizationParameters: JSON.stringify({
                        extent,
                        tolerance,
                        mode: "view",
                    }),
                    resultType: "tile",
                    spatialRel: "esriSpatialRelIntersects",
                    maxAllowableOffset: this.tileFormat === "geojson" ? tolerance.toString() : "",
                    geometryType: "esriGeometryEnvelope",
                    inSR: "4326",
                    ...this.options.queryParameters,
                });
                return (0, ArcGISRESTServiceRequestManager_1.fetchWithTTL)(`${`${this.options.url}/query?${params.toString()}`}`, 60 * 10, this.cache, { signal: (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.signal }, `${this.options.url}/query/tiled/${tilebelt.tileToQuadkey(tile)}/${params.get("f")}`)
                    .then((response) => params.get("f") === "pbf"
                    ? response.arrayBuffer()
                    : response.json())
                    .then((data) => {
                    var _a, _b;
                    if ((_b = (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.signal) === null || _b === void 0 ? void 0 : _b.aborted) {
                        return;
                    }
                    const collection = params.get("f") === "pbf"
                        ? tileDecode(new Uint8Array(data)).featureCollection
                        : data;
                    for (const feature of collection.features) {
                        if (!featureIds.has(feature.id)) {
                            featureIds.add(feature.id);
                            fc.features.push(feature);
                        }
                    }
                })
                    .catch((e) => {
                    if (!/aborted/i.test(e.toString())) {
                        this.fireError(e);
                        errorCount++;
                        console.error(e);
                    }
                    else {
                        wasAborted = true;
                    }
                });
            })()));
            if (((_b = (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.signal) === null || _b === void 0 ? void 0 : _b.aborted) || wasAborted) {
                return;
            }
            const source = (_c = this.map) === null || _c === void 0 ? void 0 : _c.getSource(this.sourceId);
            if (source && source.type === "geojson" && errorCount < tiles.length) {
                source.setData(fc);
                this.featureData = fc;
            }
            this._loading = false;
        }
        catch (e) {
            if (!/aborted/i.test(e.toString())) {
                this.fireError(e);
                console.error(e);
            }
            this._loading = false;
        }
    }
    async updateLayers(layerSettings) {
        // TODO: opacity changes
        const visible = Boolean(layerSettings.find((l) => l.id === this.sourceId));
        if (this.map) {
            const layers = this.map.getStyle().layers || [];
            for (const layer of layers) {
                if ("source" in layer && layer.source === this.sourceId) {
                    this.map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
                }
            }
        }
        if (!visible) {
            this.pauseUpdates();
        }
        else if (visible) {
            this.resumeUpdates();
        }
    }
    pauseUpdates() {
        if (this.paused === false) {
            this.paused = true;
        }
    }
    resumeUpdates() {
        if (this.paused === true) {
            this.paused = false;
            if ((this.options.fetchStrategy === "raw" ||
                this.options.fetchStrategy === "auto") &&
                !this.rawFeaturesHaveBeenFetched) {
                this.fetchFeatures();
            }
            else if (this.options.fetchStrategy === "tiled") {
                this.fetchTiles();
            }
        }
    }
    async removeFromMap(map) {
        const removedLayers = [];
        if (this.map) {
            const source = map.getSource(this.sourceId);
            if (source) {
                const layers = map.getStyle().layers || [];
                for (const layer of layers) {
                    if ("source" in layer && layer.source === this.sourceId) {
                        removedLayers.push(layer);
                        map.removeLayer(layer.id);
                    }
                }
                map.removeSource(this.sourceId);
            }
            this.removeEventListeners(map);
        }
        return removedLayers;
    }
    destroy() {
        if (this.map) {
            this.removeFromMap(this.map);
        }
        if (this.abortController) {
            this.abortController.abort();
        }
    }
    async getFetchStrategy() {
        if (this.paused) {
            this.resumeUpdates();
        }
        if (this.options.fetchStrategy === "auto") {
            if (this.rawFeaturesHaveBeenFetched) {
                return "raw";
            }
            else if (this.options.fetchStrategy === "auto" && !this.error) {
                // wait to finish loading then determine strategy
                return new Promise((resolve) => {
                    const interval = setInterval(() => {
                        if (this.options.fetchStrategy !== "auto") {
                            clearInterval(interval);
                            resolve(this.options.fetchStrategy || "auto");
                        }
                    }, 500);
                });
            }
            else {
                // not sure what to do here, punting
                return "auto";
            }
        }
        else {
            return this.options.fetchStrategy || "raw";
        }
    }
    get ready() {
        return this._styleIsResolved && Boolean(this._computedMetadata);
    }
    async prepare() {
        await this.getComputedMetadata();
        return;
    }
}
exports.default = ArcGISFeatureLayerSource;
function isArcgisFeatureLayerSource(source) {
    return source.type === "ArcGISFeatureLayer";
}
//# sourceMappingURL=ArcGISFeatureLayerSource.js.map