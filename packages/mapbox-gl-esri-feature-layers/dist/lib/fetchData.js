"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFeatureLayerData = exports.fetchFeatureCollection = void 0;
const bytes_1 = __importDefault(require("bytes"));
function fetchFeatureCollection(url, geometryPrecision = 6, outFields = "*", bytesLimit = 1000000 * 100) {
    return new Promise((resolve, reject) => {
        fetchFeatureLayerData(url, outFields, reject, geometryPrecision, null, null, undefined, undefined, bytesLimit)
            .then((data) => resolve(data))
            .catch((e) => reject(e));
    });
}
exports.fetchFeatureCollection = fetchFeatureCollection;
async function fetchFeatureLayerData(url, outFields, onError, geometryPrecision = 6, abortController = null, onPageReceived = null, disablePagination = false, pageSize = 1000, bytesLimit) {
    const featureCollection = {
        type: "FeatureCollection",
        features: [],
    };
    const params = new URLSearchParams({
        inSR: "4326",
        outSR: "4326",
        where: "1>0",
        outFields,
        returnGeometry: "true",
        geometryPrecision: geometryPrecision.toString(),
        returnIdsOnly: "false",
        f: "geojson",
    });
    await fetchData(url, params, featureCollection, onError, abortController, onPageReceived, disablePagination, pageSize, bytesLimit);
    return featureCollection;
}
exports.fetchFeatureLayerData = fetchFeatureLayerData;
async function fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination = false, pageSize = 1000, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount) {
    var _a;
    bytesReceived = bytesReceived || 0;
    const decoder = new TextDecoder("utf-8");
    params.set("returnIdsOnly", "false");
    if (featureCollection.features.length > 0) {
        // fetch next page using objectIds
        let featureIds;
        params.delete("where");
        params.delete("resultOffset");
        params.delete("resultRecordCount");
        params.set("orderByFields", objectIdFieldName);
        const lastFeature = featureCollection.features[featureCollection.features.length - 1];
        params.set("where", `${objectIdFieldName}>${lastFeature.id}`);
    }
    const response = await fetch(`${baseUrl}/query?${params.toString()}`, {
        // mode: "cors",
        ...(abortController ? { signal: abortController.signal } : {}),
    });
    const str = await response.text();
    bytesReceived += byteLength(str);
    if (bytesLimit && bytesReceived > bytesLimit) {
        const e = new Error(`Exceeded bytesLimit. ${bytes_1.default(bytesReceived)} > ${bytes_1.default(bytesLimit)}`);
        return onError(e);
    }
    const fc = JSON.parse(str);
    if (fc.error) {
        return onError(new Error(fc.error.message));
    }
    else {
        featureCollection.features.push(...fc.features);
        if (fc.exceededTransferLimit || ((_a = fc.properties) === null || _a === void 0 ? void 0 : _a.exceededTransferLimit)) {
            if (!objectIdFieldName) {
                // Fetch objectIds to do manual paging
                params.set("returnIdsOnly", "true");
                try {
                    const r = await fetch(`${baseUrl}/query?${params.toString()}`, {
                        // mode: "cors",
                        ...(abortController ? { signal: abortController.signal } : {}),
                    });
                    const featureIds = featureCollection.features.map((f) => f.id);
                    let objectIdParameters = await r.json();
                    // FeatureServers (at least on ArcGIS Online) behave differently
                    if (objectIdParameters.properties) {
                        objectIdParameters = objectIdParameters.properties;
                    }
                    expectedFeatureCount = objectIdParameters.objectIds.length;
                    objectIdFieldName = objectIdParameters.objectIdFieldName;
                }
                catch (e) {
                    return onError(e);
                }
            }
            if (onPageReceived) {
                onPageReceived(bytesReceived, featureCollection.features.length, expectedFeatureCount);
            }
            await fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination, pageSize, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount);
        }
    }
    return bytesReceived;
}
// https://stackoverflow.com/a/23329386/299467
function byteLength(str) {
    // returns the byte length of an utf8 string
    var s = str.length;
    for (var i = str.length - 1; i >= 0; i--) {
        var code = str.charCodeAt(i);
        if (code > 0x7f && code <= 0x7ff)
            s++;
        else if (code > 0x7ff && code <= 0xffff)
            s += 2;
        if (code >= 0xdc00 && code <= 0xdfff)
            i--; //trail surrogate
    }
    return s;
}
