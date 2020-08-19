import esriSLS from "./esriSLS";
import esriSFS from "./esriSFS";
import esriPMS from "./esriPMS";
import esriSMS from "./esriSMS";
import esriPFS from "./esriPFS";
/** @hidden */
export function symbolToLayers(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) {
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
