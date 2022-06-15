import { PrecacheEntry } from "workbox-precaching/_types";
import ServiceWorkerWindow from "./ServiceWorkerWindow";
import localforage from "localforage";
import pTimeout from "p-timeout";
import {
  ClientCacheSettings,
  CLIENT_CACHE_SETTINGS_KEY,
} from "./ClientCacheSettings";
const STATIC_ASSET_CACHE_NAME = "static-assets";
type PrecacheManifest = (string | PrecacheEntry)[];

export interface StaticAssetCacheState {
  precacheEnabled: boolean;
  /** Entries identified in the precache manifest */
  entries: {
    /** Path to asset */
    path: string;
    /** Whether the entry is included in the offline cache */
    cached: boolean;
  }[];
  bytes: number;
}

/**
 * The StaticAssetCache is responsible for storing build artifacts from webpack
 * for offline use, mainly JS, CSS, images, and a couple videos. The Cache class
 * can be loaded on the service worker side to be used in responding to fetch
 * events and agressively precaching updated code, and it can also be loaded as
 * part of the main client application for manual populating of the caching.
 */
class StaticAssetCache {
  private readonly urlsToCacheKeys: Map<string, string> = new Map();
  private manifest?: PrecacheManifest;

  constructor(manifest?: PrecacheManifest) {
    if (manifest) {
      this.setManifest(manifest);
    } else if ("serviceWorker" in navigator) {
      this.setManifestFromServiceWorker();
    }
  }

  /**
   * Whether the user has static asset precaching enabled. Static assets may
   * still be cached if they have been loaded at runtime, but they will not be
   * precached in bulk by the ServiceWorker upon registration.
   */
  async precacheEnabled() {
    // return !!(await localforage.getItem(PRECACHING_ENABLED_KEY));
    const settings = await localforage.getItem<string | undefined>(
      CLIENT_CACHE_SETTINGS_KEY
    );
    const defaultCacheSetting = ClientCacheSettings.find(
      (c) => c.id === "default"
    )!;
    if (settings) {
      const clientCacheSetting = ClientCacheSettings.find(
        ({ id }) => id === settings
      );
      return (
        clientCacheSetting?.prefetchEnabled ||
        defaultCacheSetting.prefetchEnabled
      );
    } else {
      return defaultCacheSetting.prefetchEnabled;
    }
  }

  // /**
  //  * Enables static asset prefetching upon service worker registration.
  //  */
  // setPrecacheEnabled(enable: boolean) {
  //   return localforage.setItem(PRECACHING_ENABLED_KEY, enable);
  // }

  /**
   * Manifest must be set before most Cache operation can be performed.
   * @param entries [Precache manifest entries](https://developer.chrome.com/docs/workbox/modules/workbox-precaching/#explanation-of-the-precache-list)
   */
  setManifest(entries: PrecacheManifest) {
    this.manifest = entries;
    for (const key of this.urlsToCacheKeys.keys()) {
      this.urlsToCacheKeys.delete(key);
    }
    for (const entry of this.manifest) {
      const [url, cacheKey] = this.cacheKeyForEntry(entry);
      this.urlsToCacheKeys.set(url, cacheKey);
    }
  }

  async setManifestFromServiceWorker() {
    const manifest = await pTimeout(
      ServiceWorkerWindow.getManifest(),
      3000,
      "Failed to contact ServiceWorker. Refresh your browser."
    );
    this.setManifest(manifest);
  }

  /**
   * Includes whether precaching is enabled, and the cache state of each entry
   * in the precache manifest.
   *
   * @returns StaticAssetCacheState
   */
  async getState() {
    if (!this.manifest) {
      await this.setManifestFromServiceWorker();
    }
    if (!this.manifest) {
      throw new Error("Manifest not set");
    }
    const entries = [];
    let bytes = 0;
    for (const entry of this.manifest) {
      const response = await this.hasFile(entry);
      if (response) {
        bytes += (await response.blob()).size;
      }
      entries.push({
        path: this.cacheKeyForEntry(entry)[0],
        cached: !!response,
      });
    }
    const precacheEnabled = await this.precacheEnabled();
    return {
      precacheEnabled,
      entries,
      bytes,
    } as StaticAssetCacheState;
  }

  /**
   * Returns a cacheKey that can be used to get items from
   * STATIC_ASSET_CACHE_NAME. If no cacheKey is returned, that
   * means the given url was not listed in the precache manifest and is
   * unrelated to the current build.
   * @param url
   * @returns string
   */
  cacheKeyForUrl(url: string) {
    const Url = new URL(url);
    return this.urlsToCacheKeys.get(`${Url.pathname}${Url.search}`);
  }

  /**
   * Key used to fetch a manifest entry from the cache, if available.
   *
   * Cache prefetch manifest entries may be a simple url, or it may contain
   * [revision information](https://developer.chrome.com/docs/workbox/modules/workbox-precaching/#explanation-of-the-precache-list)
   * if that url does not contain a cache-busting hash. This function normalizes
   * this information into a consistent key.
   * @param entry
   * @returns Array<url:string, cacheKey:string>
   */
  cacheKeyForEntry(entry: string | PrecacheEntry) {
    const url = typeof entry === "string" ? entry : entry.url;
    let cacheKey = url;
    if (typeof entry !== "string" && entry.revision) {
      // eslint-disable-next-line i18next/no-literal-string
      cacheKey = `${url}?rev=${entry.revision}`;
    }
    return [url, cacheKey];
  }

  /**
   * Fetches and stores static assets in the cache based on the specified
   * precache manifest. Throws and exception if the manifest is not yet set.
   *
   * @param progressFn If provided, yields an updated state as each file is
   * cached.
   */
  async populateCache(progressFn?: (state: StaticAssetCacheState) => void) {
    let { entries } = await this.getState();
    let bytes = 0;
    if (!this.manifest) {
      throw new Error("Cache manifest not yet specified");
    }
    const cache = await caches.open(STATIC_ASSET_CACHE_NAME);
    const existingKeys = (await cache.keys()).map((r) => {
      const url = new URL(r.url);
      return `${url.pathname}${url.search}`;
    });
    const keysToCache = [...this.urlsToCacheKeys.values()];
    const filteredKeys = keysToCache.filter(
      (k) => existingKeys.indexOf(k) === -1
    );
    if (progressFn) {
      for (const key of filteredKeys) {
        const response = await fetch(key);
        await cache.put(key, response.clone());
        bytes += (await response.blob()).size;
        const path = key.replace(/\?rev=.*/, "");
        const idx = entries.findIndex((e) => e.path === path);
        if (idx > -1) {
          entries = [
            ...entries.slice(0, idx),
            {
              path: key,
              cached: true,
            },
            ...entries.slice(idx + 1),
          ];
        }
        progressFn({
          precacheEnabled: await this.precacheEnabled(),
          entries,
          bytes,
        });
      }
    } else {
      await cache.addAll([...filteredKeys]);
    }
    // Finally, add index.html. Note that this step is last. index.html will
    // contain references to all the javascript chunks. It should only be
    // updated if these other assets are cached successfully
    await cache.add("/index.html");
    await this.purgeStaleEntries();
    return this.getState();
  }

  /**
   * Check whether a precache manifest entry exists in the cache
   * @param entry
   * @returns
   */
  async hasFile(entry: string | PrecacheEntry) {
    const [url, cacheKey] = this.cacheKeyForEntry(entry);
    const cache = await caches.open(STATIC_ASSET_CACHE_NAME);
    const match = await cache.match(cacheKey);
    return match;
  }

  /** Deletes entire cache regardless of entry presence in manifest */
  clearCache() {
    return caches.delete(STATIC_ASSET_CACHE_NAME);
  }

  /**
   * Removes stale assets from the cache. Assets are considered stale if they
   * are not included in the precache manifest.
   */
  async purgeStaleEntries() {
    if (!this.manifest) {
      throw new Error(
        "Manifest has not been set. Cannot purge cache without information about current bundles."
      );
    }
    const cache = await caches.open(STATIC_ASSET_CACHE_NAME);
    const cachedUrls = (await cache.keys()).map((req) => {
      const url = new URL(req.url);
      return `${url.pathname}${url.search}`;
    });
    const manifestCacheKeys = this.manifest.map(
      (entry) => this.cacheKeyForEntry(entry)[1]
    );
    for (const cacheKey of cachedUrls) {
      if (
        manifestCacheKeys.indexOf(cacheKey) === -1 &&
        cacheKey !== "/index.html"
      ) {
        console.warn(`purging ${cacheKey} from static asset cache`);
        cache.delete(cacheKey);
      }
    }
  }

  urlInManifest(url: URL) {
    const cacheKey = this.urlsToCacheKeys.get(url.pathname);
    return !!cacheKey;
  }

  async handleRequest(url: URL, event: FetchEvent): Promise<Response> {
    const cacheKey = this.urlsToCacheKeys.get(url.pathname);
    if (cacheKey) {
      if (process.env.NODE_ENV === "development" && navigator.onLine && false) {
      } else {
        const cache = await caches.open(STATIC_ASSET_CACHE_NAME);
        const responseFromCache = await cache.match(cacheKey);
        if (responseFromCache) {
          return responseFromCache;
        } else {
          try {
            const response = await fetch(event.request);
            if (response.ok) {
              await cache.put(cacheKey, response.clone());
            }
            return response;
          } catch (e) {
            console.error(e);
            return new Response("Failed to fetch", {
              status: 408,
              headers: { "Content-Type": "text/plain" },
            });
          }
        }
      }
    } else {
      console.warn(
        `Does not exist in manifest but matched StaticAssetCache route. ${url}`
      );
      return fetch(event.request);
    }
  }

  async networkThenIndexHtmlCache(event: FetchEvent) {
    try {
      const response = await fetch(event.request);
      if (response) {
        const cache = await caches.open(STATIC_ASSET_CACHE_NAME);
        await cache.put("/index.html", response.clone());
        return response;
      } else {
        const cache = await caches.open(STATIC_ASSET_CACHE_NAME);
        console.warn("SW: Responding with cached index.html");
        const response = await cache.match("/index.html");
        if (response) {
          return response;
        } else {
          return new Response("Failed to fetch or retrieve from cache", {
            status: 408,
            headers: { "Content-Type": "text/plain" },
          });
        }
      }
    } catch (e) {
      const cache = await caches.open(STATIC_ASSET_CACHE_NAME);
      const response = await cache.match("/index.html");
      if (response) {
        console.warn("SW: Responding with cached index.html");
        return response;
      } else {
        return new Response("Failed to fetch or retrieve from cache", {
          status: 408,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }
  }
}

export default StaticAssetCache;
