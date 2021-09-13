"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./symbols/index");
const ImageList_1 = require("./ImageList");
const esriTS_1 = __importDefault(require("./symbols/esriTS"));
const utils_1 = require("./symbols/utils");
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
 * @param {string} url Feature layer endpoint. Should terminate in _/MapServer/0..n_
 * @param {string} sourceId ID for the [source](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/) of vector data to be used in rendering.
 * @returns The {@link ImageList.addToMap} function should be called before adding the generated layers to the map.
 */
async function styleForFeatureLayer(url, sourceId) {
    const rootUrl = url.replace(/\/\d+[\/]*$/, "");
    const sublayer = parseInt(url.match(/\/(\d+)[\/]*$/)[1]);
    const response = await fetch(url + "?f=json").then((r) => r.json());
    const renderer = response.drawingInfo.renderer;
    let layers = [];
    const imageList = new ImageList_1.ImageList(response.currentVersion, /FeatureServer/.test(rootUrl));
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
                layers.push(...index_1.symbolToLayers(info.symbol, sourceId, imageList, rootUrl, sublayer, legendItemIndex++).map((lyr) => {
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
                layers.push(...index_1.symbolToLayers(renderer.defaultSymbol, sourceId, imageList, rootUrl, sublayer, 0).map((lyr) => {
                    lyr.filter = ["none", ...filters];
                    return lyr;
                }));
            }
            break;
        }
        case "classBreaks":
            // TODO: look for test dataset for backgroundFillSymbol
            if (renderer.backgroundFillSymbol) {
                layers.push(...index_1.symbolToLayers(renderer.backgroundFillSymbol, sourceId, imageList, rootUrl, sublayer, 0));
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
                layers.push(...index_1.symbolToLayers(info.symbol, sourceId, imageList, rootUrl, sublayer, legendItemIndex--).map((lyr) => {
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
                const defaultLayers = await index_1.symbolToLayers(renderer.defaultSymbol, sourceId, imageList, rootUrl, sublayer, 0);
                for (const index in defaultLayers) {
                    defaultLayers[index].filter = ["none", filters];
                }
                layers.push(...defaultLayers);
            }
            break;
        default:
            // simple
            layers = index_1.symbolToLayers(renderer.symbol, sourceId, imageList, rootUrl, sublayer, 0);
            break;
    }
    if (response.drawingInfo.labelingInfo) {
        for (const info of response.drawingInfo.labelingInfo) {
            const layer = esriTS_1.default(info, response.geometryType, response.fields.map((f) => f.name));
            layer.source = sourceId;
            layer.id = utils_1.generateId();
            layers.push(layer);
        }
    }
    return {
        imageList,
        layers,
    };
}
exports.default = styleForFeatureLayer;
/** @hidden */
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
/** @hidden */
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
