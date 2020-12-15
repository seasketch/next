/**
 * Add ArcGIS Feature Layers to MapBox GL JS maps as a geojson source. These
 * data sources can be styled using output from
 * {@link styleForFeatureLayer } or custom layers that
 * reference the provided source id.
 *
 * ### Usage
 *
 * ```typescript
 * import { ArcGISVectorSource } from "mapbox-gl-esri-sources";
 *
 * // setup map...
 *
 * const esriSource = new ArcGISVectorSource(
 *   map,
 *   'cities-source-id',
 *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0"),
 *   {
 *     geometryPrecision: 5,
 *     outFields: "POP,CITY_NAME"
 *   }
 * );
 * ```
 * @class ArcGISVectorSource
 */
export class ArcGISVectorSource {
    /**
     * Creates an instance of ArcGISVectorSource.
     * @param {Map} map MapBox GL JS map instance where source will be added
     * @param {string} id ID will be assigned to the GeoJSONSource instance
     * @param {string} url Base url for an [ArcGIS Server Feature Layer](https://developers.arcgis.com/rest/services-reference/layer-table.htm). Should end in _/MapServer/0..n_
     */
    constructor(map, id, url, options) {
        var _a;
        this.data = {
            type: "FeatureCollection",
            features: [],
        };
        this.outFields = "*";
        this.supportsPagination = true;
        /** Set to true when source is fetching data */
        this._loading = true;
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
        if (options && options.outFields) {
            this.outFields = options.outFields;
        }
        this.source = this.map.getSource(this.id);
        let hadError = false;
        const onError = (e) => {
            hadError = true;
            this._loading = false;
            this.map.fire("error", {
                source: this.source,
                sourceId: this.id,
                error: e,
            });
        };
        this.map.fire("dataloading", {
            source: this.source,
            sourceId: this.id,
            dataType: "source",
            isSourceLoaded: false,
            sourceDataType: "content",
        });
        fetchFeatureLayerData(this.baseUrl, this.outFields, onError, (_a = this.options) === null || _a === void 0 ? void 0 : _a.geometryPrecision, null, null, false, 1000, options === null || options === void 0 ? void 0 : options.bytesLimit)
            .then((fc) => {
            this._loading = false;
            if (!hadError) {
                this.source.setData(fc);
            }
        })
            .catch(onError);
        // this.fetchGeoJSON().catch(options?.onError);
    }
    get loading() {
        return this._loading;
    }
}
export async function fetchFeatureLayerData(url, outFields, onError, geometryPrecision = 6, abortController = null, onPageReceived = null, disablePagination = false, pageSize = 1000, bytesLimit) {
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
    await fetchData(url, params, featureCollection, onError, abortController || new AbortController(), onPageReceived, disablePagination, pageSize, bytesLimit);
    return featureCollection;
}
async function fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination = false, pageSize = 1000, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount) {
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
        mode: "cors",
        signal: abortController.signal,
    });
    const str = await response.text();
    bytesReceived += byteLength(str);
    if (bytesLimit && bytesReceived >= bytesLimit) {
        const e = new Error(`Exceeded bytesLimit. ${bytesReceived} >= ${bytesLimit}`);
        return onError(e);
    }
    const fc = JSON.parse(str);
    if (fc.error) {
        return onError(new Error(fc.error.message));
    }
    else {
        featureCollection.features.push(...fc.features);
        if (fc.exceededTransferLimit) {
            if (!objectIdFieldName) {
                // Fetch objectIds to do manual paging
                params.set("returnIdsOnly", "true");
                try {
                    const r = await fetch(`${baseUrl}/query?${params.toString()}`, {
                        mode: "cors",
                        signal: abortController.signal,
                    });
                    const featureIds = featureCollection.features.map((f) => f.id);
                    const objectIdParameters = await r.json();
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
