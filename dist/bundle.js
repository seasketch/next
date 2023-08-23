var MapBoxGLEsriSources = (function (exports) {
    'use strict';

    const blankDataUri = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    class ArcGISDynamicMapService {
        constructor(map, id, baseUrl, options) {
            this.supportDevicePixelRatio = true;
            this.supportsDynamicLayers = false;
            this.useTiles = false;
            this.tileSize = 256;
            this.updateSource = () => {
                if (this.useTiles || this.source.type === "raster") {
                    this.source.setTiles([this.getUrl()]);
                }
                else {
                    const bounds = this.map.getBounds();
                    this.source.updateImage({
                        url: this.getUrl(),
                        coordinates: [
                            [bounds.getNorthWest().lng, bounds.getNorthWest().lat],
                            [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
                            [bounds.getSouthEast().lng, bounds.getSouthEast().lat],
                            [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
                        ],
                    });
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
            this.id = id;
            this.baseUrl = baseUrl;
            this.url = new URL(this.baseUrl + "/export");
            this.url.searchParams.set("f", "image");
            this.map = map;
            if (!(options === null || options === void 0 ? void 0 : options.useTiles)) {
                this.map.on("moveend", this.updateSource);
            }
            this.layers = options === null || options === void 0 ? void 0 : options.layers;
            this.useTiles = (options === null || options === void 0 ? void 0 : options.useTiles) || false;
            this.tileSize = (options === null || options === void 0 ? void 0 : options.tileSize) || 256;
            this.queryParameters = {
                transparent: "true",
                ...((options === null || options === void 0 ? void 0 : options.queryParameters) || {}),
            };
            if (options && "useDevicePixelRatio" in options) {
                this.supportDevicePixelRatio = !!options.useDevicePixelRatio;
            }
            matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addListener(() => {
                if (this.supportDevicePixelRatio) {
                    this.updateSource();
                }
            });
            this.supportsDynamicLayers = (options === null || options === void 0 ? void 0 : options.supportsDynamicLayers) || false;
            const bounds = this.map.getBounds();
            if (this.useTiles) {
                this.map.addSource(this.id, {
                    type: "raster",
                    tiles: [this.getUrl()],
                    tileSize: this.tileSize,
                });
            }
            else {
                this.map.addSource(this.id, {
                    type: "image",
                    url: this.getUrl(),
                    coordinates: [
                        [bounds.getWest(), bounds.getNorth()],
                        [bounds.getEast(), bounds.getNorth()],
                        [bounds.getEast(), bounds.getSouth()],
                        [bounds.getWest(), bounds.getSouth()],
                    ],
                });
            }
            this.source = this.map.getSource(this.id);
        }
        destroy() {
            this.map.off("moveend", this.updateSource);
        }
        getUrl() {
            const bounds = this.map.getBounds();
            let bbox = [
                lon2meters(bounds.getWest()),
                lat2meters(bounds.getSouth()),
                lon2meters(bounds.getEast()),
                lat2meters(bounds.getNorth()),
            ];
            const groundResolution = getGroundResolution(this.map.getZoom() +
                (this.supportDevicePixelRatio ? window.devicePixelRatio - 1 : 0));
            const width = Math.round((bbox[2] - bbox[0]) / groundResolution);
            const height = Math.round((bbox[3] - bbox[1]) / groundResolution);
            this.url.searchParams.set("format", "png");
            this.url.searchParams.set("size", [width, height].join(","));
            if (this.supportDevicePixelRatio) {
                switch (window.devicePixelRatio) {
                    case 1:
                        this.url.searchParams.set("dpi", "96");
                        break;
                    case 2:
                        this.url.searchParams.set("dpi", "220");
                        break;
                    case 3:
                        this.url.searchParams.set("dpi", "390");
                        break;
                    default:
                        this.url.searchParams.set("dpi",
                        (window.devicePixelRatio * 96 * 1.22).toString());
                        break;
                }
            }
            else {
                this.url.searchParams.set("dpi", "96");
            }
            this.url.searchParams.set("imageSR", "102100");
            this.url.searchParams.set("bboxSR", "102100");
            if (Math.abs(bbox[0]) > 20037508.34 || Math.abs(bbox[2]) > 20037508.34) {
                const centralMeridian = bounds.getCenter().lng;
                if (this.supportDevicePixelRatio && window.devicePixelRatio > 1) {
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
                this.url.searchParams.set("imageSR", sr);
                this.url.searchParams.set("bboxSR", sr);
            }
            if (Array.isArray(this.layers)) {
                if (this.layers.length === 0) {
                    return blankDataUri;
                }
                else {
                    this.url.searchParams.set("layers", `show:${this.layers.map((lyr) => lyr.sublayer).join(",")}`);
                }
            }
            this.url.searchParams.set("bbox", bbox.join(","));
            this.url.searchParams.delete("dynamicLayers");
            let layersInOrder = true;
            let hasOpacityUpdates = false;
            if (this.supportsDynamicLayers && this.layers) {
                for (var i = 0; i < this.layers.length; i++) {
                    if (this.layers[i - 1] &&
                        this.layers[i].sublayer < this.layers[i - 1].sublayer) {
                        layersInOrder = false;
                    }
                    const opacity = this.layers[i].opacity;
                    if (opacity !== undefined && opacity < 1) {
                        hasOpacityUpdates = true;
                    }
                }
            }
            if (this.layers && (!layersInOrder || hasOpacityUpdates)) {
                const dynamicLayers = this.layers.map((lyr) => {
                    return {
                        id: lyr.sublayer,
                        source: {
                            mapLayerId: lyr.sublayer,
                            type: "mapLayer",
                        },
                        drawingInfo: {
                            transparency: lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
                        },
                    };
                });
                this.url.searchParams.set("dynamicLayers", JSON.stringify(dynamicLayers));
            }
            for (const key in this.queryParameters) {
                this.url.searchParams.set(key, this.queryParameters[key].toString());
            }
            if (this.useTiles) {
                this.url.searchParams.set("bbox", `seasketch-replace-me`);
                if (this.supportDevicePixelRatio && window.devicePixelRatio > 1) {
                    const size = this.tileSize * window.devicePixelRatio;
                    this.url.searchParams.set("size", [size, size].join(","));
                }
                else {
                    this.url.searchParams.set("size", [this.tileSize, this.tileSize].join(","));
                }
            }
            return this.url
                .toString()
                .replace("seasketch-replace-me", "{bbox-epsg-3857}");
        }
        updateLayers(layers) {
            if (JSON.stringify(layers) !== JSON.stringify(this.layers)) {
                this.layers = layers;
                this.debouncedUpdateSource();
            }
        }
        updateQueryParameters(queryParameters) {
            if (JSON.stringify(this.queryParameters) !== JSON.stringify(queryParameters)) {
                this.queryParameters = queryParameters;
                this.debouncedUpdateSource();
            }
        }
        updateUseDevicePixelRatio(enable) {
            if (enable !== this.supportDevicePixelRatio) {
                this.supportDevicePixelRatio = enable;
                this.debouncedUpdateSource();
            }
        }
    }
    function lat2meters(lat) {
        var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
        return (y * 20037508.34) / 180;
    }
    function lon2meters(lon) {
        return (lon * 20037508.34) / 180;
    }
    function getGroundResolution(level) {
        let groundResolution = resolutions[level];
        if (!groundResolution) {
            groundResolution = (2 * Math.PI * 6378137) / (256 * 2 ** (level + 1));
            resolutions[level] = groundResolution;
        }
        return groundResolution;
    }
    const resolutions = {};

    class ArcGISVectorSource {
        constructor(map, id, url, options) {
            this.data = {
                type: "FeatureCollection",
                features: [],
            };
            this.outFields = "*";
            this.supportsPagination = true;
            this.displayIncompleteFeatureCollections = true;
            this.id = id;
            this.baseUrl = url;
            this.options = options;
            this.map = map;
            this.map.addSource(this.id, {
                data: this.data,
                type: "geojson",
            });
            if (options &&
                "supportsPagination" in options &&
                options["supportsPagination"] === false) {
                this.supportsPagination = false;
            }
            if (options &&
                "displayIncompleteFeatureCollections" in options &&
                options["displayIncompleteFeatureCollections"] === false) {
                this.displayIncompleteFeatureCollections = false;
            }
            if (options && options.outFields) {
                this.outFields = options.outFields;
            }
            this.source = this.map.getSource(this.id);
            this.fetchGeoJSON();
        }
        async fetchGeoJSON() {
            var _a, _b;
            const params = new URLSearchParams({
                inSR: "4326",
                outSR: "4326",
                where: "1>0",
                outFields: this.outFields,
                returnGeometry: "true",
                geometryPrecision: ((_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.geometryPrecision) === null || _b === void 0 ? void 0 : _b.toString()) || "6",
                returnIdsOnly: "false",
                f: "geojson",
                resultOffset: this.supportsPagination
                    ? this.data.features.length.toString()
                    : "",
            });
            const response = await fetch(`${this.baseUrl}/query?${params.toString()}`, {
                mode: "cors",
            });
            const featureCollection = await response.json();
            if (featureCollection.error) {
                if (this.supportsPagination &&
                    /pagination/i.test(featureCollection.error.message)) {
                    this.supportsPagination = false;
                    this.fetchGeoJSON();
                }
                else {
                    throw new Error(`Error retrieving feature data. ${featureCollection.error.message}`);
                }
            }
            else {
                this.data = {
                    type: "FeatureCollection",
                    features: [...this.data.features, ...featureCollection.features],
                };
                if (featureCollection.exceededTransferLimit) {
                    if (this.supportsPagination === false) {
                        this.source.setData(this.data);
                        throw new Error("Data source does not support pagination but exceeds transfer limit");
                    }
                    else {
                        if (this.displayIncompleteFeatureCollections) {
                            this.source.setData(this.data);
                        }
                        console.log("fetching more data");
                        this.fetchGeoJSON();
                    }
                }
                else {
                    this.source.setData(this.data);
                }
            }
        }
    }

    var getRandomValues;
    var rnds8 = new Uint8Array(16);
    function rng() {
      if (!getRandomValues) {
        getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);
        if (!getRandomValues) {
          throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
        }
      }
      return getRandomValues(rnds8);
    }

    var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

    function validate(uuid) {
      return typeof uuid === 'string' && REGEX.test(uuid);
    }

    var byteToHex = [];
    for (var i = 0; i < 256; ++i) {
      byteToHex.push((i + 0x100).toString(16).substr(1));
    }
    function stringify(arr) {
      var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
      if (!validate(uuid)) {
        throw TypeError('Stringified UUID is invalid');
      }
      return uuid;
    }

    function v4(options, buf, offset) {
      options = options || {};
      var rnds = options.random || (options.rng || rng)();
      rnds[6] = rnds[6] & 0x0f | 0x40;
      rnds[8] = rnds[8] & 0x3f | 0x80;
      if (buf) {
        offset = offset || 0;
        for (var i = 0; i < 16; ++i) {
          buf[offset + i] = rnds[i];
        }
        return buf;
      }
      return stringify(rnds);
    }

    function generateId() {
        return v4();
    }
    function createCanvas(w, h) {
        const canvas = document.createElement("canvas");
        canvas.setAttribute("width", w.toString());
        canvas.setAttribute("height", h.toString());
        return canvas;
    }
    const rgba = (color) => {
        color = color || [0, 0, 0, 0];
        return `rgba(${color[0]},${color[1]},${color[2]},${color[3]})`;
    };
    const colorAndOpacity = (color) => {
        color = color || [0, 0, 0, 0];
        return {
            color: `rgb(${color[0]},${color[1]},${color[2]})`,
            opacity: color[3] / 255,
        };
    };
    const ptToPx = (pt) => Math.round(pt * 1.33);
    const ANCHORS = {
        esriServerPointLabelPlacementAboveCenter: "bottom",
        esriServerPointLabelPlacementAboveLeft: "bottom-right",
        esriServerPointLabelPlacementAboveRight: "bottom-left",
        esriServerPointLabelPlacementBelowCenter: "top",
        esriServerPointLabelPlacementBelowLeft: "top-right",
        esriServerPointLabelPlacementBelowRight: "top-left",
        esriServerPointLabelPlacementCenterCenter: "center",
        esriServerPointLabelPlacementCenterLeft: "right",
        esriServerPointLabelPlacementCenterRight: "left",
        esriServerLinePlacementAboveAlong: "bottom",
        esriServerLinePlacementAboveBefore: "bottom-left",
        esriServerLinePlacementAboveStart: "bottom-left",
        esriServerLinePlacementAboveEnd: "bottom-right",
        esriServerLinePlacementBelowAfter: "top-right",
        esriServerLinePlacementBelowAlong: "top",
        esriServerLinePlacementBelowBefore: "top-left",
        esriServerLinePlacementBelowStart: "top-left",
        esriServerLinePlacementBelowEnd: "top-right",
        esriServerLinePlacementCenterAfter: "right",
        esriServerLinePlacementCenterAlong: "center",
        esriServerLinePlacementCenterBefore: "center-left",
        esriServerLinePlacementCenterStart: "center-left",
        esriServerLinePlacementCenterEnd: "center-right",
        esriServerPolygonPlacementAlwaysHorizontal: "center",
    };
    const toTextAnchor = (labelPlacement) => ANCHORS[labelPlacement] || "center";

    const patterns = {
        esriSLSDash: (strokeWidth) => [2, 0.5],
        esriSLSDashDot: (strokeWidth) => [3, 1, 1, 1],
        esriSLSDashDotDot: (strokeWidth) => [3, 1, 1, 1, 1, 1],
        esriSLSNull: () => [0, 10],
        esriSLSDot: (strokeWidth) => [1, 1],
    };

    var esriSLS = (symbol, sourceId) => {
        const { color, opacity } = colorAndOpacity(symbol.color);
        let strokeWidth = ptToPx(symbol.width || 1);
        if (strokeWidth === -1) {
            strokeWidth = 1;
        }
        const style = symbol.style || "esriSLSSolid";
        const layer = {
            id: generateId(),
            type: "line",
            paint: {
                "line-color": color,
                "line-opacity": opacity,
                "line-width": strokeWidth,
            },
            layout: {},
            source: sourceId,
        };
        if (style !== "esriSLSSolid") {
            layer.paint["line-dasharray"] = patterns[style](strokeWidth);
        }
        return [layer];
    };

    var esriSFS = (symbol, sourceId, imageList) => {
        const layers = [];
        switch (symbol.style) {
            case "esriSFSSolid":
                layers.push({
                    id: generateId(),
                    type: "fill",
                    source: sourceId,
                    paint: {
                        "fill-color": rgba(symbol.color),
                    },
                });
                break;
            case "esriSFSNull":
                break;
            case "esriSFSBackwardDiagonal":
            case "esriSFSCross":
            case "esriSFSDiagonalCross":
            case "esriSFSForwardDiagonal":
            case "esriSFSHorizontal":
            case "esriSFSVertical":
                const imageId = imageList.addEsriSFS(symbol);
                layers.push({
                    id: generateId(),
                    source: sourceId,
                    type: "fill",
                    paint: {
                        "fill-pattern": imageId,
                    },
                });
                break;
            default:
                throw new Error(`Unknown fill style ${symbol.style}`);
        }
        if (symbol.outline) {
            let outline = esriSLS(symbol.outline, sourceId);
            layers.push(...outline);
        }
        return layers;
    };

    var esriPMS = (symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) => {
        const imageId = imageList.addEsriPMS(symbol, serviceBaseUrl, sublayer, legendIndex);
        return [
            {
                id: generateId(),
                source: sourceId,
                type: "symbol",
                paint: {},
                layout: {
                    "icon-allow-overlap": true,
                    "icon-rotate": symbol.angle,
                    "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
                    "icon-image": imageId,
                },
            },
        ];
    };

    var esriSMS = (symbol, sourceId, imageList) => {
        const imageId = imageList.addEsriSMS(symbol);
        return [
            {
                id: generateId(),
                type: "symbol",
                source: sourceId,
                paint: {},
                layout: {
                    "icon-allow-overlap": true,
                    "icon-rotate": symbol.angle,
                    "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
                    "icon-image": imageId,
                    "icon-size": 1,
                },
            },
        ];
    };

    var esriPFS = (symbol, sourceId, imageList) => {
        const imageId = imageList.addEsriPFS(symbol);
        const layers = [
            {
                id: generateId(),
                source: sourceId,
                type: "fill",
                paint: {
                    "fill-pattern": imageId,
                },
                layout: {},
            },
        ];
        if ("outline" in symbol) {
            let outline = esriSLS(symbol.outline, sourceId);
            layers.push(...outline);
        }
        return layers;
    };

    function symbolToLayers(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) {
        var layers;
        switch (symbol.type) {
            case "esriSFS":
                layers = esriSFS(symbol, sourceId, imageList);
                break;
            case "esriPFS":
                layers = esriPFS(symbol, sourceId, imageList);
                break;
            case "esriSLS":
                layers = esriSLS(symbol, sourceId);
                break;
            case "esriPMS":
                layers = esriPMS(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex);
                break;
            case "esriSMS":
                layers = esriSMS(symbol, sourceId, imageList);
                break;
            default:
                throw new Error(`Unknown symbol type ${symbol.type}`);
        }
        return layers;
    }

    function drawSMS (symbol, pixelRatio) {
        var _a, _b;
        const size = ptToPx(symbol.size || 13);
        const scale = 2 ** (pixelRatio - 1);
        const width = (size + 1 * 2 + (((_a = symbol.outline) === null || _a === void 0 ? void 0 : _a.width) || 0) * 2) * scale;
        const height = width;
        let canvas = createCanvas(width, height);
        var ctx = canvas.getContext("2d");
        ctx.lineWidth =
            ptToPx(!!symbol.outline ? symbol.outline.width || 1 : 1) * scale;
        ctx.strokeStyle = !!symbol.outline
            ? rgba((_b = symbol.outline) === null || _b === void 0 ? void 0 : _b.color)
            : rgba(symbol.color);
        ctx.fillStyle = rgba(symbol.color);
        switch (symbol.style) {
            case "esriSMSCircle":
                ctx.beginPath();
                var x = width / 2;
                var y = height / 2;
                var diameter = size * scale;
                var radius = Math.round((diameter + ctx.lineWidth) / 2);
                ctx.arc(x, y, radius, 0, Math.PI * 2, true);
                ctx.fill();
                ctx.stroke();
                break;
            case "esriSMSCross":
                var w = size * scale;
                ctx.lineWidth = Math.round(w / 4);
                ctx.strokeStyle = rgba(symbol.color);
                ctx.moveTo(width / 2, (height - w) / 2);
                ctx.lineTo(width / 2, height - (height - w) / 2);
                ctx.moveTo((width - w) / 2, height / 2);
                ctx.lineTo(width - (width - w) / 2, height / 2);
                ctx.stroke();
                ctx.fill();
                break;
            case "esriSMSX":
                var w = size * scale;
                ctx.translate(width / 2, height / 2);
                ctx.rotate((45 * Math.PI) / 180);
                ctx.translate(-width / 2, -height / 2);
                ctx.moveTo(width / 2, (height - w) / 2);
                ctx.lineTo(width / 2, height - (height - w) / 2);
                ctx.moveTo((width - w) / 2, height / 2);
                ctx.lineTo(width - (width - w) / 2, height / 2);
                ctx.stroke();
                ctx.fill();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                break;
            case "esriSMSDiamond":
                var w = size * scale;
                var h = w;
                var x = width / 2 - w / 2;
                var y = height / 2 - h / 2;
                ctx.translate(x + w / 2, y + h / 2);
                ctx.rotate((45 * Math.PI) / 180);
                ctx.fillRect(-w / 2, -h / 2, w, h);
                ctx.strokeRect(-w / 2, -h / 2, w, h);
                break;
            case "esriSMSSquare":
                var w = size * scale;
                var h = w;
                var x = width / 2 - w / 2;
                var y = height / 2 - h / 2;
                ctx.fillRect(x, y, w, h);
                ctx.strokeRect(x, y, w, h);
                break;
            case "esriSMSTriangle":
                ctx.beginPath();
                var w = size * scale;
                var h = w;
                var midpoint = width / 2;
                var x1 = midpoint;
                var y1 = (height - width) / 2;
                var x2 = width - (width - width) / 2;
                var y2 = height - (height - width) / 2;
                var x3 = (width - width) / 2;
                var y3 = height - (height - width) / 2;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineTo(x3, y3);
                ctx.lineTo(x1, y1);
                ctx.fill();
                ctx.stroke();
                break;
            default:
                throw new Error(`Unknown symbol type ${symbol.style}`);
        }
        return { width, height, data: canvas.toDataURL() };
    }

    var fillPatterns = {
        esriSFSVertical: (strokeStyle = "#000000") => {
            var canvas = createCanvas(16, 16);
            var ctx = canvas.getContext("2d");
            ctx.strokeStyle = strokeStyle || "#000000";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(8, 16);
            ctx.stroke();
            return ctx.createPattern(canvas, "repeat");
        },
        esriSFSHorizontal: (strokeStyle = "#000000") => {
            var canvas = createCanvas(16, 16);
            var ctx = canvas.getContext("2d");
            ctx.strokeStyle = strokeStyle || "#000000";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(16, 8);
            ctx.stroke();
            return ctx.createPattern(canvas, "repeat");
        },
        esriSFSBackwardDiagonal: (strokeStyle = "#000000") => {
            var canvas = createCanvas(16, 16);
            var ctx = canvas.getContext("2d");
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(8, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 24);
            ctx.lineTo(24, 0);
            ctx.stroke();
            return ctx.createPattern(canvas, "repeat");
        },
        esriSFSForwardDiagonal: (strokeStyle = "#000000") => {
            var canvas = createCanvas(16, 16);
            var ctx = canvas.getContext("2d");
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(8, 16);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(16, 8);
            ctx.stroke();
            return ctx.createPattern(canvas, "repeat");
        },
        esriSFSCross: (strokeStyle = "#000000") => {
            var canvas = createCanvas(16, 16);
            var ctx = canvas.getContext("2d");
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(16, 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(8, 16);
            ctx.stroke();
            return ctx.createPattern(canvas, "repeat");
        },
        esriSFSDiagonalCross: (strokeStyle = "#000000") => {
            var canvas = createCanvas(16, 16);
            var ctx = canvas.getContext("2d");
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(8, 16);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(16, 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(8, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 24);
            ctx.lineTo(24, 0);
            ctx.stroke();
            return ctx.createPattern(canvas, "repeat");
        },
    };

    class ImageList {
        constructor(arcGISVersion) {
            this.imageSets = [];
            this.supportsHighDPILegends = false;
            if (arcGISVersion && arcGISVersion >= 10.6) {
                this.supportsHighDPILegends = true;
            }
        }
        addEsriPFS(symbol) {
            const imageid = v4();
            this.imageSets.push({
                id: imageid,
                images: [
                    {
                        pixelRatio: 1,
                        dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
                        width: ptToPx(symbol.width),
                        height: ptToPx(symbol.height),
                    },
                ],
            });
            return imageid;
        }
        addEsriPMS(symbol, serviceBaseUrl, sublayer, legendIndex) {
            const imageid = v4();
            if (this.supportsHighDPILegends) {
                this.imageSets.push(new Promise(async (resolve) => {
                    const imageSet = {
                        id: imageid,
                        images: [
                            {
                                pixelRatio: 1,
                                dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
                                width: ptToPx(symbol.width),
                                height: ptToPx(symbol.height),
                            },
                        ],
                    };
                    const legend2x = await fetchLegendImage(serviceBaseUrl, sublayer, legendIndex, 2);
                    const legend3x = await fetchLegendImage(serviceBaseUrl, sublayer, legendIndex, 3);
                    imageSet.images.push(legend2x, legend3x);
                    resolve(imageSet);
                }));
            }
            else {
                this.imageSets.push({
                    id: imageid,
                    images: [
                        {
                            pixelRatio: 1,
                            dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
                            width: ptToPx(symbol.width),
                            height: ptToPx(symbol.height),
                        },
                    ],
                });
            }
            return imageid;
        }
        addEsriSMS(symbol) {
            const imageid = v4();
            const images = [1, 2, 3].map((pixelRatio) => {
                const marker = drawSMS(symbol, pixelRatio);
                return {
                    dataURI: marker.data,
                    pixelRatio,
                    width: marker.width,
                    height: marker.height,
                };
            });
            this.imageSets.push({
                id: imageid,
                images: images,
            });
            return imageid;
        }
        addEsriSFS(symbol) {
            const imageId = v4();
            const pattern = fillPatterns[symbol.style](rgba(symbol.color));
            this.imageSets.push({
                id: imageId,
                images: [
                    createFillImage(pattern, 1),
                    createFillImage(pattern, 2),
                    createFillImage(pattern, 3),
                ],
            });
            return imageId;
        }
        addToMap(map) {
            return Promise.all(this.imageSets.map(async (imageSet) => {
                if (imageSet instanceof Promise) {
                    imageSet = await imageSet;
                }
                let imageData = imageSet.images[0];
                if (imageSet.images.length > 1) {
                    imageData =
                        imageSet.images.find((i) => i.pixelRatio === Math.round(window.devicePixelRatio)) || imageData;
                }
                const image = await createImage(imageData.width, imageData.height, imageData.dataURI);
                map.addImage(imageSet.id, image, {
                    pixelRatio: imageData.pixelRatio,
                });
            }));
        }
        removeFromMap(map) {
            return Promise.all(this.imageSets.map(async (imageSet) => {
                if (imageSet instanceof Promise) {
                    imageSet = await imageSet;
                }
                map.removeImage(imageSet.id);
            }));
        }
    }
    async function createImage(width, height, dataURI) {
        return new Promise((resolve) => {
            const image = new Image(width, height);
            image.src = dataURI;
            image.onload = () => {
                resolve(image);
            };
        });
    }
    function createFillImage(pattern, pixelRatio) {
        const size = 4 * 2 ** pixelRatio;
        const canvas = document.createElement("canvas");
        canvas.setAttribute("width", size.toString());
        canvas.setAttribute("height", size.toString());
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = pattern;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(size, size);
        ctx.lineTo(size, 0);
        ctx.closePath();
        ctx.fill();
        return {
            pixelRatio,
            dataURI: canvas.toDataURL(),
            width: size,
            height: size,
        };
    }
    const cache = {};
    async function fetchLegendImage(serviceRoot, sublayer, legendIndex, pixelRatio) {
        const legendData = await fetchLegendData(serviceRoot, pixelRatio);
        const sublayerData = legendData.layers.find((lyr) => lyr.layerId === sublayer);
        const legendItem = sublayerData.legend[legendIndex];
        return {
            dataURI: `data:${legendItem.contentType};base64,${legendItem.imageData}`,
            pixelRatio,
            width: legendItem.width,
            height: legendItem.height,
        };
    }
    async function fetchLegendData(serviceRoot, pixelRatio) {
        const dpi = pixelRatio === 2 ? 192 : 384;
        if (!cache[serviceRoot]) {
            cache[serviceRoot] = {};
        }
        if (!cache[serviceRoot][pixelRatio]) {
            cache[serviceRoot][pixelRatio] = fetch(`${serviceRoot}/legend?f=json&dpi=${dpi}`).then((r) => r.json());
        }
        return cache[serviceRoot][pixelRatio];
    }

    var esriTS = (labelingInfo, geometryType, fieldNames) => {
        return {
            id: generateId(),
            type: "symbol",
            layout: {
                "text-field": toExpression(labelingInfo.labelExpression, fieldNames),
                "text-anchor": toTextAnchor(labelingInfo.labelPlacement),
                "text-size": ptToPx(labelingInfo.symbol.font.size || 13),
                "symbol-placement": geometryType === "line" ? "line" : "point",
                "text-max-angle": 20,
            },
            paint: {
                "text-color": rgba(labelingInfo.symbol.color),
                "text-halo-width": ptToPx(labelingInfo.symbol.haloSize || 0),
                "text-halo-color": rgba(labelingInfo.symbol.haloColor || [255, 255, 255, 255]),
                "text-halo-blur": ptToPx(labelingInfo.symbol.haloSize || 0) * 0.5,
            },
        };
    };
    function toExpression(labelExpression, fieldNames) {
        const fields = (labelExpression.match(/\[\w+\]/g) || [])
            .map((val) => val.replace(/[\[\]]/g, ""))
            .map((val) => fieldNames.find((name) => name.toLowerCase() === val.toLowerCase()));
        const strings = labelExpression.split(/\[\w+\]/g);
        const expression = ["format"];
        while (strings.length) {
            expression.push(strings.shift());
            const field = fields.shift();
            if (field) {
                expression.push(["get", field]);
            }
        }
        return expression;
    }

    async function styleForFeatureLayer(url, sourceId) {
        const rootUrl = url.replace(/\/\d+[\/]*$/, "");
        const sublayer = parseInt(url.match(/\/(\d+)[\/]*$/)[1]);
        const response = await fetch(url + "?f=json").then((r) => r.json());
        const renderer = response.drawingInfo.renderer;
        let layers = [];
        const imageList = new ImageList(response.currentVersion);
        let legendItemIndex = 0;
        switch (renderer.type) {
            case "uniqueValue": {
                const fields = [renderer.field1];
                if (renderer.field2) {
                    fields.push(renderer.field2);
                    if (renderer.field3) {
                        fields.push(renderer.field3);
                    }
                }
                const filters = [];
                const field = renderer.field1;
                legendItemIndex = renderer.defaultSymbol ? 1 : 0;
                const fieldTypes = fields.map((f) => {
                    const fieldRecord = response.fields.find((r) => r.name === f);
                    return FIELD_TYPES[fieldRecord === null || fieldRecord === void 0 ? void 0 : fieldRecord.type] || "string";
                });
                for (const info of renderer.uniqueValueInfos) {
                    const values = normalizeValuesForFieldTypes(info.value, renderer.fieldDelimiter, fieldTypes);
                    layers.push(...symbolToLayers(info.symbol, sourceId, imageList, rootUrl, sublayer, legendItemIndex++).map((lyr) => {
                        if (fields.length === 1) {
                            lyr.filter = ["==", field, values[0]];
                            filters.push(lyr.filter);
                        }
                        else {
                            lyr.filter = [
                                "all",
                                ...fields.map((field) => [
                                    "==",
                                    field,
                                    values[fields.indexOf(field)],
                                ]),
                            ];
                            filters.push(lyr.filter);
                        }
                        return lyr;
                    }));
                }
                if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
                    layers.push(...symbolToLayers(renderer.defaultSymbol, sourceId, imageList, rootUrl, sublayer, 0).map((lyr) => {
                        lyr.filter = ["none", ...filters];
                        return lyr;
                    }));
                }
                break;
            }
            case "classBreaks":
                if (renderer.backgroundFillSymbol) {
                    layers.push(...symbolToLayers(renderer.backgroundFillSymbol, sourceId, imageList, rootUrl, sublayer, 0));
                }
                const field = renderer.field;
                const filters = [];
                legendItemIndex = renderer.classBreakInfos.length - 1;
                let minValue = 0;
                const minMaxValues = renderer.classBreakInfos.map((b) => {
                    const values = [b.classMinValue || minValue, b.classMaxValue];
                    minValue = values[1];
                    return values;
                });
                for (const info of [...renderer.classBreakInfos].reverse()) {
                    layers.push(...symbolToLayers(info.symbol, sourceId, imageList, rootUrl, sublayer, legendItemIndex--).map((lyr) => {
                        const [min, max] = minMaxValues[renderer.classBreakInfos.indexOf(info)];
                        if (renderer.classBreakInfos.indexOf(info) === 0) {
                            lyr.filter = ["all", ["<=", field, max]];
                        }
                        else {
                            lyr.filter = ["all", [">", field, min], ["<=", field, max]];
                        }
                        filters.push(lyr.filter);
                        return lyr;
                    }));
                }
                if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
                    const defaultLayers = await symbolToLayers(renderer.defaultSymbol, sourceId, imageList, rootUrl, sublayer, 0);
                    for (const index in defaultLayers) {
                        defaultLayers[index].filter = ["none", filters];
                    }
                    layers.push(...defaultLayers);
                }
                break;
            default:
                layers = symbolToLayers(renderer.symbol, sourceId, imageList, rootUrl, sublayer, 0);
                break;
        }
        if (response.drawingInfo.labelingInfo) {
            for (const info of response.drawingInfo.labelingInfo) {
                const layer = esriTS(info, response.geometryType, response.fields.map((f) => f.name));
                layer.source = sourceId;
                layer.id = generateId();
                layers.push(layer);
            }
        }
        return {
            imageList,
            layers,
        };
    }
    function normalizeValuesForFieldTypes(value, delimiter, fieldTypes) {
        const values = value.split(delimiter);
        return values.map((v, i) => {
            if (fieldTypes[i] === "string") {
                return v;
            }
            else if (fieldTypes[i] === "integer") {
                return parseInt(v);
            }
            else if (fieldTypes[i] === "float") {
                return parseFloat(v);
            }
        });
    }
    const FIELD_TYPES = {
        esriFieldTypeSmallInteger: "integer",
        esriFieldTypeInteger: "integer",
        esriFieldTypeSingle: "float",
        esriFieldTypeDouble: "float",
        esriFieldTypeString: "string",
        esriFieldTypeDate: "string",
        esriFieldTypeOID: "integer",
        esriFieldTypeGeometry: "string",
        esriFieldTypeBlob: "string",
        esriFieldTypeRaster: "string",
        esriFieldTypeGUID: "string",
        esriFieldTypeGlobalID: "string",
        esriFieldTypeXML: "string",
    };

    exports.ArcGISDynamicMapService = ArcGISDynamicMapService;
    exports.ArcGISVectorSource = ArcGISVectorSource;
    exports.styleForFeatureLayer = styleForFeatureLayer;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
