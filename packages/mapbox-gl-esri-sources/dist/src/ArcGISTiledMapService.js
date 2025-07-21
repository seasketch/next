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
exports.ArcGISTiledMapService = void 0;
exports.isArcGISTiledMapservice = isArcGISTiledMapservice;
const uuid_1 = require("uuid");
const utils_1 = require("./utils");
const tilebelt = __importStar(require("@mapbox/tilebelt"));
const ArcGISDynamicMapService_1 = require("./ArcGISDynamicMapService");
/**
 * CustomGLSource used to add an ArcGIS Tile MapService.
 */
class ArcGISTiledMapService {
    /**
     *
     * @param requestManager ArcGISRESTServiceRequestManager instance
     * @param options.url URL to ArcGIS REST MapServer (should end in /MapServer)
     * @param options.supportHighDpiDisplays If true, will detect high-dpi displays and request more tiles at higher resolution
     * @param options.credentials Optional. If provided, will use these credentials to request a token for the service.
     *
     */
    constructor(requestManager, options) {
        this.type = "ArcGISTiledMapService";
        // remove trailing slash if present
        options.url = options.url.replace(/\/$/, "");
        this.url = options.url;
        if (!/rest\/services/.test(options.url) || !/MapServer/.test(options.url)) {
            throw new Error("Invalid ArcGIS REST Service URL");
        }
        this.requestManager = requestManager;
        this.sourceId = options.sourceId || (0, uuid_1.v4)();
        this.options = options;
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
        try {
            if (!this._computedMetadata) {
                const { serviceMetadata, layers } = await this.getMetadata();
                const { bounds, minzoom, maxzoom, tileSize, attribution } = await this.getComputedProperties();
                const legendData = await this.requestManager.getLegendMetadata(this.options.url);
                const results = /\/([^/]+)\/MapServer/.exec(this.options.url);
                let label = results && results.length >= 1 ? results[1] : false;
                if (!label) {
                    if ((_b = (_a = this.layerMetadata) === null || _a === void 0 ? void 0 : _a.layers) === null || _b === void 0 ? void 0 : _b[0]) {
                        label = this.layerMetadata.layers[0].name;
                    }
                }
                this._computedMetadata = {
                    bounds: bounds || undefined,
                    minzoom,
                    maxzoom,
                    attribution,
                    tableOfContentsItems: [
                        {
                            type: "data",
                            id: this.sourceId,
                            label: label || "Layer",
                            defaultVisibility: true,
                            metadata: (0, utils_1.generateMetadataForLayer)(this.options.url, this.serviceMetadata, this.layerMetadata.layers[0]),
                            legend: (0, utils_1.makeLegend)(legendData, legendData.layers[0].layerId),
                        },
                    ],
                    supportsDynamicRendering: {
                        layerOrder: false,
                        layerOpacity: false,
                        layerVisibility: false,
                    },
                };
            }
            return this._computedMetadata;
        }
        catch (e) {
            this.error = e.toString();
            throw e;
        }
    }
    async getThumbnailForCurrentExtent() {
        if (!this.map) {
            throw new Error("Map not set");
        }
        const { minzoom } = await this.getComputedProperties();
        const map = this.map;
        const bounds = map.getBounds();
        const boundsArray = bounds.toArray();
        const primaryTile = tilebelt.bboxToTile([
            boundsArray[0][0],
            boundsArray[0][1],
            boundsArray[1][0],
            boundsArray[1][1],
        ]);
        let [x, y, z] = primaryTile;
        if (primaryTile[2] < minzoom) {
            let tile = primaryTile;
            while (tile[2] < minzoom) {
                tile = tilebelt.getChildren(tile)[0];
            }
            [x, y, z] = tile;
        }
        const url = `${this.options.url}/tile/${z}/${y}/${x}`;
        const res = await fetch(url);
        if (res.ok) {
            return url;
        }
        else {
            const children = tilebelt.getChildren(primaryTile);
            for (const child of children) {
                let [x, y, z] = primaryTile;
                const res = await fetch(url);
                if (res.ok) {
                    return url;
                }
            }
            return ArcGISDynamicMapService_1.blankDataUri;
            console.error(new Error("Could not find valid thumbnail tile"));
        }
    }
    /**
     * Returns true if the source is not yet loaded. Will return to false if tiles
     * are loading when the map is moved.
     */
    get loading() {
        var _a, _b;
        return Boolean(((_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId)) &&
            ((_b = this.map) === null || _b === void 0 ? void 0 : _b.isSourceLoaded(this.sourceId)) === false);
    }
    /**
     * Private method used as the basis for getComputedMetadata and also used
     * when generating the source data for addToMap.
     * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
     */
    async getComputedProperties() {
        var _a, _b, _c;
        const { serviceMetadata, layers } = await this.getMetadata();
        const levels = ((_a = serviceMetadata.tileInfo) === null || _a === void 0 ? void 0 : _a.lods.map((l) => l.level)) || [];
        const attribution = (0, utils_1.contentOrFalse)(layers.layers[0].copyrightText) ||
            (0, utils_1.contentOrFalse)(serviceMetadata.copyrightText) ||
            (0, utils_1.contentOrFalse)((_b = serviceMetadata.documentInfo) === null || _b === void 0 ? void 0 : _b.Author) ||
            undefined;
        const minzoom = serviceMetadata.minLOD
            ? serviceMetadata.minLOD
            : Math.min(...levels);
        const maxzoom = serviceMetadata.maxLOD
            ? serviceMetadata.maxLOD
            : Math.max(...levels);
        if (!((_c = serviceMetadata.tileInfo) === null || _c === void 0 ? void 0 : _c.rows)) {
            throw new Error("Invalid tile info");
        }
        return {
            minzoom,
            maxzoom,
            bounds: await (0, utils_1.extentToLatLngBounds)(serviceMetadata.fullExtent),
            tileSize: serviceMetadata.tileInfo.rows,
            ...(attribution ? { attribution } : {}),
        };
    }
    /**
     * Add source to map. Does not add any layers to the map.
     * @param map Mapbox GL JS Map
     * @returns sourceId
     */
    async addToMap(map) {
        this.map = map;
        const sourceData = await this.getGLSource();
        // It's possible that the map has changed since we started fetching metadata
        if (this.map.getSource(this.sourceId)) {
            (0, utils_1.replaceSource)(this.sourceId, this.map, sourceData);
        }
        else {
            this.map.addSource(this.sourceId, sourceData);
        }
        return this.sourceId;
    }
    async getGLSource() {
        let { minzoom, maxzoom, bounds, tileSize, attribution } = await this.getComputedProperties();
        attribution = this.options.attributionOverride || attribution;
        let url = `${this.options.url}/tile/{z}/{y}/{x}`;
        if (url.indexOf("services.arcgisonline.com") !== -1 &&
            this.options.developerApiKey) {
            url = `${url}?token=${this.options.developerApiKey}`;
        }
        const sourceData = {
            type: "raster",
            tiles: [url],
            tileSize,
            minzoom,
            maxzoom: this.options.maxZoom || maxzoom,
            ...(attribution ? { attribution } : {}),
            ...(bounds ? { bounds } : {}),
        };
        return sourceData;
    }
    /**
     * Returns a raster layer for the source.
     * @returns RasterLayer[]
     */
    async getGLStyleLayers() {
        return {
            layers: [
                {
                    type: "raster",
                    source: this.sourceId,
                    id: (0, uuid_1.v4)(),
                    paint: {
                        "raster-fade-duration": 300,
                    },
                },
            ],
        };
    }
    /**
     * Remove source from map. If there are any layers on the map that use this
     * source, they will also be removed.
     * @param map Mapbox GL JS Map
     */
    removeFromMap(map) {
        const removedLayers = [];
        if (map.getSource(this.sourceId)) {
            const layers = map.getStyle().layers || [];
            for (const layer of layers) {
                if ("source" in layer && layer.source === this.sourceId) {
                    map.removeLayer(layer.id);
                    removedLayers.push(layer);
                }
            }
            map.removeSource(this.sourceId);
            this.map = undefined;
        }
        return removedLayers;
    }
    /**
     * Removes the source from the map and removes any event listeners
     */
    destroy() {
        if (this.map) {
            this.removeFromMap(this.map);
        }
    }
    async updateMaxZoom(maxZoom) {
        const currentMaxZoom = (await this.getGLSource()).maxzoom;
        if (currentMaxZoom !== maxZoom) {
            this.options.maxZoom = maxZoom;
            if (this.map) {
                const map = this.map;
                const removedLayers = this.removeFromMap(map);
                this.addToMap(map);
                for (const layer of removedLayers) {
                    map.addLayer(layer);
                }
            }
        }
    }
    /** noop */
    updateLayers(layers) { }
    get ready() {
        return Boolean(this._computedMetadata);
    }
    async prepare() {
        await this.getComputedMetadata();
        return;
    }
    addEventListeners(map) {
        this.map = map;
    }
    removeEventListeners(map) { }
}
exports.ArcGISTiledMapService = ArcGISTiledMapService;
function isArcGISTiledMapservice(source) {
    return source.type === "ArcGISTiledMapService";
}
//# sourceMappingURL=ArcGISTiledMapService.js.map