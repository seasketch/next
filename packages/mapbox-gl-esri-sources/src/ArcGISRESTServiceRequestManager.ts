import {
  FeatureServerMetadata,
  LayerLegendData,
  LayersMetadata,
  MapServiceMetadata,
} from "./ServiceMetadata";

interface FetchOptions {
  signal?: AbortSignal;
  token?: string;
}

export interface MapServiceLegendMetadata {
  layers: {
    layerId: number;
    layerName: string;
    layerType: "Feature Layer" | "Raster Layer";
    legend: LayerLegendData[];
  }[];
}
export class ArcGISRESTServiceRequestManager {
  private cache?: Cache;

  constructor(options?: { cacheKey?: string }) {
    // TODO: respect cache headers if they exist
    if (window.caches) {
      const cache = window.caches
        .open(options?.cacheKey || "seasketch-arcgis-rest-services")
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

  async getMapServiceMetadata(url: string, options: FetchOptions) {
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
    if (options?.token) {
      params.set("token", options.token);
    }

    const requestUrl = `${url}?${params.toString()}`;
    const serviceMetadata = await this.fetch<MapServiceMetadata>(
      requestUrl,
      options?.signal
    );
    const layers = await this.fetch<LayersMetadata>(
      `${url}/layers/?${params.toString()}`
    );
    if ((layers as any).error) {
      throw new Error((layers as any).error.message);
    }
    return { serviceMetadata, layers };
  }

  async getFeatureServerMetadata(url: string, options: FetchOptions) {
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
    if (options?.token) {
      params.set("token", options.token);
    }

    const requestUrl = `${url}${
      url.endsWith("/") ? "" : "/"
    }?${params.toString()}`;
    const serviceMetadata = await this.fetch<FeatureServerMetadata>(
      requestUrl,
      options?.signal
    );
    const layers = await this.fetch<LayersMetadata>(
      `${url}/layers/?${params.toString()}`
    );
    if ((layers as any).error) {
      throw new Error((layers as any).error.message);
    }
    return { serviceMetadata, layers };
  }

  async getCatalogItems(url: string, options?: FetchOptions) {
    if (!/rest\/services/.test(url)) {
      throw new Error("Invalid ArcGIS REST Service URL");
    }
    // remove trailing slash if present
    url = url.replace(/\/$/, "");
    // remove url params if present
    url = url.replace(/\?.*$/, "");
    const params = new URLSearchParams();
    params.set("f", "json");
    if (options?.token) {
      params.set("token", options?.token);
    }

    const requestUrl = `${url}${
      url.endsWith("/") ? "" : "/"
    }?${params.toString()}`;
    const response = await this.fetch<{
      currentVersion: number;
      folders: string[];
      services: {
        name: string;
        type:
          | "MapServer"
          | "FeatureServer"
          | "GPServer"
          | "GeometryServer"
          | "ImageServer"
          | "GeocodeServer"
          | string;
      }[];
    }>(requestUrl, options?.signal);
    return response;
  }

  private inFlightRequests: { [url: string]: Promise<any> } = {};

  private async fetch<T>(url: string, signal?: AbortSignal) {
    if (url in this.inFlightRequests) {
      return this.inFlightRequests[url].then((json) => json as T);
    }
    const cache = await this.cache;
    this.inFlightRequests[url] = fetchWithTTL(url, 60 * 300, cache, {
      signal,
    }).then((r) => r.json());
    return new Promise<T>((resolve, reject) => {
      this.inFlightRequests[url]
        .then((json) => {
          if (json["error"]) {
            reject(new Error(json["error"].message));
          } else {
            resolve(json as T);
          }
        })
        .catch(reject)
        .finally(() => {
          delete this.inFlightRequests[url];
        });
    });
  }

  async getLegendMetadata(url: string, token?: string) {
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
    const response = await this.fetch<MapServiceLegendMetadata>(requestUrl);
    return response;
  }
}

function cachedResponseIsExpired(response: Response) {
  const cacheControlHeader = response.headers.get("Cache-Control");
  if (cacheControlHeader) {
    const expires = /expires=(.*)/i.exec(cacheControlHeader);
    if (expires) {
      const expiration = new Date(expires[1]);
      if (new Date().getTime() > expiration.getTime()) {
        return true;
      } else {
        return false;
      }
    }
  }
  return false;
}

export async function fetchWithTTL(
  url: string,
  ttl: number,
  cache?: Cache,
  options?: RequestInit,
  cacheKey?: string
): Promise<any> {
  if (!options?.signal?.aborted) {
    const request = new Request(url, options);
    if (options?.signal?.aborted) {
      Promise.reject("aborted");
    }
    let cachedResponse = await cache?.match(
      cacheKey ? new URL(cacheKey) : request
    );

    if (cachedResponse && cachedResponseIsExpired(cachedResponse)) {
      cache?.delete(cacheKey ? new URL(cacheKey) : request);
      cachedResponse = undefined;
    }
    if (cachedResponse && cachedResponse.ok) {
      return cachedResponse;
    } else {
      const response = await fetch(url, options);
      if (!options?.signal?.aborted) {
        const headers = new Headers(response.headers);
        headers.set(
          "Cache-Control",
          `Expires=${new Date(new Date().getTime() + 1000 * ttl).toUTCString()}`
        );
        const copy = response.clone();
        const clone = new Response(copy.body, {
          headers,
          status: response.status,
          statusText: response.statusText,
        });
        if (clone.ok && clone.status === 200) {
          cache?.put(cacheKey || url, clone).catch((e) => {
            // do nothing. can happen if request is aborted
          });
        }
      }
      return await response;
    }
  }
}

function fetchWithProxy(url: string, init?: RequestInit) {
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
