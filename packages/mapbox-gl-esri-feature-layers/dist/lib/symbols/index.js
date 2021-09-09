"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.symbolToLayers = void 0;
const esriSLS_1 = __importDefault(require("./esriSLS"));
const esriSFS_1 = __importDefault(require("./esriSFS"));
const esriPMS_1 = __importDefault(require("./esriPMS"));
const esriSMS_1 = __importDefault(require("./esriSMS"));
const esriPFS_1 = __importDefault(require("./esriPFS"));
/** @hidden */
function symbolToLayers(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) {
    var layers;
    switch (symbol.type) {
        case "esriSFS":
            layers = esriSFS_1.default(symbol, sourceId, imageList);
            break;
        case "esriPFS":
            layers = esriPFS_1.default(symbol, sourceId, imageList);
            break;
        case "esriSLS":
            layers = esriSLS_1.default(symbol, sourceId);
            break;
        case "esriPMS":
            layers = esriPMS_1.default(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex);
            break;
        case "esriSMS":
            layers = esriSMS_1.default(symbol, sourceId, imageList);
            break;
        default:
            throw new Error(`Unknown symbol type ${symbol.type}`);
    }
    return layers;
}
exports.symbolToLayers = symbolToLayers;
