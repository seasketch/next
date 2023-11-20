"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.symbolToLayers = void 0;
const esriSLS_1 = require("./esriSLS");
const esriSFS_1 = require("./esriSFS");
const esriPMS_1 = require("./esriPMS");
const esriSMS_1 = require("./esriSMS");
const esriPFS_1 = require("./esriPFS");
/** @hidden */
function symbolToLayers(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) {
    var layers;
    switch (symbol.type) {
        case "esriSFS":
            layers = (0, esriSFS_1.default)(symbol, sourceId, imageList);
            break;
        case "esriPFS":
            layers = (0, esriPFS_1.default)(symbol, sourceId, imageList);
            break;
        case "esriSLS":
            layers = (0, esriSLS_1.default)(symbol, sourceId);
            break;
        case "esriPMS":
            layers = (0, esriPMS_1.default)(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex);
            break;
        case "esriSMS":
            layers = (0, esriSMS_1.default)(symbol, sourceId, imageList);
            break;
        default:
            throw new Error(`Unknown symbol type ${symbol.type}`);
    }
    return layers;
}
exports.symbolToLayers = symbolToLayers;
