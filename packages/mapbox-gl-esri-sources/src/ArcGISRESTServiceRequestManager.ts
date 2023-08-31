import {
  LayerLegendData,
  LayersMetadata,
  MapServiceMetadata,
} from "./ServiceMetadata";

export class ArcGISRESTServiceRequestManager {
  private cache?: Cache;

  constructor(options?: { cacheKey?: string }) {
    // TODO: evict excess items from cache on startup
    // TODO: respect cache headers if they exist
    const cache = caches
      .open(options?.cacheKey || "seasketch-arcgis-rest-services")
      .then((cache) => {
        this.cache = cache;
      });
  }

  async getMapServiceMetadata(
    url: string,
    credentials?: { username: string; password: string }
  ) {
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
    if (credentials) {
      const token = await this.getToken(
        url.replace(/rest\/services\/.*/, "/rest/services/"),
        credentials
      );
      params.set("token", token);
    }

    const requestUrl = `${url}?${params.toString()}`;
    const serviceMetadata = await this.fetch<MapServiceMetadata>(requestUrl);
    const layers = await this.fetch<LayersMetadata>(
      `${url}/layers?${params.toString()}`
    );
    if ((layers as any).error) {
      throw new Error((layers as any).error.message);
    }
    return { serviceMetadata, layers };
  }

  async getToken(
    url: string,
    credentials: { username: string; password: string }
  ): Promise<string> {
    throw new Error("Not implemented");
  }

  private inFlightRequests: { [url: string]: Promise<any> } = {};

  private async fetch<T>(url: string) {
    if (url in this.inFlightRequests) {
      return this.inFlightRequests[url].then((json) => json as T);
    }
    const cache = await this.cache;
    if (!cache) {
      throw new Error("Cache not initialized");
    }
    this.inFlightRequests[url] = fetchWithTTL(url, 60 * 300, cache);
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

  async getLegendMetadata(
    url: string,
    credentials?: { username: string; password: string }
  ) {
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
    if (credentials) {
      const token = await this.getToken(
        url.replace(/rest\/services\/.*/, "/rest/services/"),
        credentials
      );
      params.set("token", token);
    }

    const requestUrl = `${url}/legend?${params.toString()}`;
    const response = await this.fetch<{
      layers: {
        layerId: number;
        layerName: string;
        layerType: "Feature Layer" | "Raster Layer";
        legend: LayerLegendData[];
      }[];
    }>(requestUrl);
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

async function fetchWithTTL(
  url: string,
  ttl: number,
  cache: Cache,
  options?: RequestInit
  // @ts-ignore
): Promise<any> {
  if (!options?.signal?.aborted) {
    const request = new Request(url, options);
    if (options?.signal?.aborted) {
      Promise.reject("aborted");
    }
    let cachedResponse = await cache.match(request);
    if (cachedResponse && cachedResponseIsExpired(cachedResponse)) {
      cache.delete(request);
      cachedResponse = undefined;
    }
    if (cachedResponse) {
      return cachedResponse.json();
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
        cache.put(url, clone);
      }
      return await response.json();
    }
  }
}
