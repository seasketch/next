import { OfflineTileSettings } from "@seasketch/map-tile-cache-calculator";
import { MapTileCacheCalculator as Calculator } from "@seasketch/map-tile-cache-calculator";
import { cacheFirst, CacheLike, networkFirst } from "./handlerStrategies";

let calculator: Calculator;

export function handleSimulatorRequest(
  url: URL,
  event: FetchEvent,
  settings: OfflineTileSettings
) {
  calculator =
    calculator || new Calculator("https://d3p1dsef9f0gjr.cloudfront.net/");
  const realUrl = url.toString().replace("-offline", "");
  const match = url.pathname.match(/\/(\d+)\/(\d+)\/(\d+).+$/);
  if (match && match.length) {
    const z = parseInt(match[1]);
    const x = parseInt(match[2]);
    const y = parseInt(match[3]);
    return calculator.tileInCache([x, y, z], settings).then((inCache) => {
      if (inCache) {
        return fetch(realUrl);
      } else {
        return new Response("Offline tile similator. Tile not in cache.", {
          status: 500,
        });
      }
    });
  } else {
    return fetch(realUrl).catch((e) => {
      return new Response(e.toString(), { status: 500 });
    });
  }
}

export function isSimulatorUrl(url: URL) {
  return /api.mapbox-offline/.test(url.host);
}

export function isMapTileOrAssetRequest(url: URL) {
  return url.searchParams.get("ssn-tr") === "true";
}

export async function handleMapTileRequest(
  url: URL,
  event: FetchEvent,
  resolution?: "network-first" | "cache-first"
) {
  url.searchParams.delete("ssn-tr");
  url.searchParams.delete("sku");
  url.searchParams.delete("access_token");
  url.searchParams.delete("secure");
  let cacheKey = url.toString();
  // Default is network-first resolution
  resolution = resolution || "network-first";
  if (resolution === "network-first") {
    return networkFirst(
      MapTileCacheLike,
      cacheKey,
      event.request,
      false,
      navigator.onLine ? 8000 : 3000
    );
  } else {
    return cacheFirst(MapTileCacheLike, cacheKey, event.request, false);
  }
}

const staticMapAssets = caches.open("offline-basemap-static-assets");

const MapTileCacheLike: CacheLike = {
  match: cachesMatch,
  put: () => Promise.resolve(),
};

async function cachesMatch(url: string) {
  const cacheKeys = await caches.keys();
  // check static assets first (styles, fonts, etc)
  const cache = await staticMapAssets;
  const existing = await cache.match(url);
  if (existing) {
    return existing;
  }
  // check map tiles
  if (/https:\/\/api.mapbox.com/.test(url)) {
    // normalize @1x/@2x component of url to match what is in cache
    url = removeDpiComponentFromMapboxUrl(url);
    // if not webp, make webp
    if (!/.pbf$/.test(url) && !/\.webp$/.test(url)) {
      url = url.replace(/\.\w+$/, ".webp");
    }
  }
  for (const key of cacheKeys) {
    if (/^data-source/.test(key)) {
      const cache = await caches.open(key);
      const cached = await cache.match(url);
      if (cached) {
        return cached;
      }
    }
  }
}

export function removeDpiComponentFromMapboxUrl(url: string) {
  return url.replace(/@\dx\./, ".");
}
