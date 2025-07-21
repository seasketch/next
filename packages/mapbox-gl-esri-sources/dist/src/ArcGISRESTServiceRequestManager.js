"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArcGISRESTServiceRequestManager = void 0;
exports.fetchWithTTL = fetchWithTTL;
class ArcGISRESTServiceRequestManager {
    constructor(options) {
        this.inFlightRequests = {};
        // TODO: respect cache headers if they exist
        if (window.caches) {
            const cache = window.caches
                .open((options === null || options === void 0 ? void 0 : options.cacheKey) || "seasketch-arcgis-rest-services")
                .then((cache) => {
                this.cache = cache;
                // evict expired items from cache on startup
                cache.keys().then(async (keys) => {
                    for (const key of keys) {
                        const res = await cache.match(key);
                        if (res) {
                            if (cachedResponseIsExpired(res)) {
                                cache.delete(key);
                            }
                        }
                    }
                });
            });
        }
    }
    async getMapServiceMetadata(url, options) {
        if (!/rest\/services/.test(url)) {
            throw new Error("Invalid ArcGIS REST Service URL");
        }
        if (!/MapServer/.test(url)) {
            throw new Error("Invalid MapServer URL");
        }
        // remove trailing slash if present
        url = url.replace(/\/$/, "");
        // remove url params if present
        url = url.replace(/\?.*$/, "");
        const params = new URLSearchParams();
        params.set("f", "json");
        if (options === null || options === void 0 ? void 0 : options.token) {
            params.set("token", options.token);
        }
        const requestUrl = `${url}?${params.toString()}`;
        const serviceMetadata = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
        const layers = await this.fetch(`${url}/layers/?${params.toString()}`);
        if (layers.error) {
            throw new Error(layers.error.message);
        }
        return { serviceMetadata, layers };
    }
    async getFeatureServerMetadata(url, options) {
        // remove trailing slash if present
        url = url.replace(/\/$/, "");
        if (!/rest\/services/.test(url)) {
            throw new Error("Invalid ArcGIS REST Service URL");
        }
        if (!/FeatureServer/.test(url)) {
            throw new Error("Invalid FeatureServer URL");
        }
        // make sure the url does not include a feature layer id
        if (/\d+$/.test(url)) {
            throw new Error("Invalid FeatureServer URL");
        }
        // remove url params if present
        url = url.replace(/\?.*$/, "");
        const params = new URLSearchParams();
        params.set("f", "json");
        if (options === null || options === void 0 ? void 0 : options.token) {
            params.set("token", options.token);
        }
        const requestUrl = `${url}${url.endsWith("/") ? "" : "/"}?${params.toString()}`;
        const serviceMetadata = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
        const layers = await this.fetch(`${url}/layers/?${params.toString()}`);
        if (layers.error) {
            throw new Error(layers.error.message);
        }
        return { serviceMetadata, layers };
    }
    async getCatalogItems(url, options) {
        if (!/rest\/services/.test(url)) {
            throw new Error("Invalid ArcGIS REST Service URL");
        }
        // remove trailing slash if present
        url = url.replace(/\/$/, "");
        // remove url params if present
        url = url.replace(/\?.*$/, "");
        const params = new URLSearchParams();
        params.set("f", "json");
        if (options === null || options === void 0 ? void 0 : options.token) {
            params.set("token", options === null || options === void 0 ? void 0 : options.token);
        }
        const requestUrl = `${url}${url.endsWith("/") ? "" : "/"}?${params.toString()}`;
        const response = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
        return response;
    }
    async fetch(url, signal) {
        if (url in this.inFlightRequests) {
            return this.inFlightRequests[url].then((json) => json);
        }
        const cache = await this.cache;
        this.inFlightRequests[url] = fetchWithTTL(url, 60 * 300, cache, {
            signal,
        }).then((r) => r.json());
        return new Promise((resolve, reject) => {
            this.inFlightRequests[url]
                .then((json) => {
                if (json["error"]) {
                    reject(new Error(json["error"].message));
                }
                else {
                    resolve(json);
                }
            })
                .catch(reject)
                .finally(() => {
                delete this.inFlightRequests[url];
            });
        });
    }
    async getLegendMetadata(url, token) {
        if (!/rest\/services/.test(url)) {
            throw new Error("Invalid ArcGIS REST Service URL");
        }
        if (!/MapServer/.test(url) && !/FeatureServer/.test(url)) {
            throw new Error("Invalid MapServer or FeatureServer URL");
        }
        // remove trailing slash if present
        url = url.replace(/\/$/, "");
        // remove url params if present
        url = url.replace(/\?.*$/, "");
        const params = new URLSearchParams();
        params.set("f", "json");
        if (token) {
            params.set("token", token);
        }
        const requestUrl = `${url}/legend/?${params.toString()}`;
        const response = await this.fetch(requestUrl);
        return response;
    }
}
exports.ArcGISRESTServiceRequestManager = ArcGISRESTServiceRequestManager;
function cachedResponseIsExpired(response) {
    const cacheControlHeader = response.headers.get("Cache-Control");
    if (cacheControlHeader) {
        const expires = /expires=(.*)/i.exec(cacheControlHeader);
        if (expires) {
            const expiration = new Date(expires[1]);
            if (new Date().getTime() > expiration.getTime()) {
                return true;
            }
            else {
                return false;
            }
        }
    }
    return false;
}
async function fetchWithTTL(url, ttl, cache, options, cacheKey) {
    var _a, _b, _c;
    if (!((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.aborted)) {
        const request = new Request(url, options);
        if ((_b = options === null || options === void 0 ? void 0 : options.signal) === null || _b === void 0 ? void 0 : _b.aborted) {
            Promise.reject("aborted");
        }
        let cachedResponse = await (cache === null || cache === void 0 ? void 0 : cache.match(cacheKey ? new URL(cacheKey) : request));
        if (cachedResponse && cachedResponseIsExpired(cachedResponse)) {
            cache === null || cache === void 0 ? void 0 : cache.delete(cacheKey ? new URL(cacheKey) : request);
            cachedResponse = undefined;
        }
        if (cachedResponse && cachedResponse.ok) {
            return cachedResponse;
        }
        else {
            const response = await fetch(url, options);
            if (!((_c = options === null || options === void 0 ? void 0 : options.signal) === null || _c === void 0 ? void 0 : _c.aborted)) {
                const headers = new Headers(response.headers);
                headers.set("Cache-Control", `Expires=${new Date(new Date().getTime() + 1000 * ttl).toUTCString()}`);
                const copy = response.clone();
                const clone = new Response(copy.body, {
                    headers,
                    status: response.status,
                    statusText: response.statusText,
                });
                if (clone.ok && clone.status === 200) {
                    cache === null || cache === void 0 ? void 0 : cache.put(cacheKey || url, clone).catch((e) => {
                        // do nothing. can happen if request is aborted
                    });
                }
            }
            return await response;
        }
    }
}
function fetchWithProxy(url, init) {
    const Url = new URL(url);
    const searchParams = Url.searchParams;
    const location = Url.origin + Url.pathname;
    searchParams.set("location", location);
    Url.host = "arcgis-catalog-proxy.underbluewaters.workers.dev";
    Url.pathname = "";
    Url.protocol = "https:";
    console.log("fetchWithProxy", Url.toString());
    return fetch(Url, init);
}
//# sourceMappingURL=ArcGISRESTServiceRequestManager.js.map