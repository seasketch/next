import { OfflineTileSettings } from "@seasketch/map-tile-cache-calculator";
import { MapTileCacheCalculator as Calculator } from "@seasketch/map-tile-cache-calculator";

const calculator = new Calculator("https://d3p1dsef9f0gjr.cloudfront.net/");

export function handleSimulatorRequest(
  url: URL,
  event: FetchEvent,
  settings: OfflineTileSettings
) {
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
        return new Response("", { status: 500 });
      }
    });
  } else {
    return fetch(event.request);
  }
}

export function isSimulatorUrl(url: URL) {
  return /api.mapbox-offline/.test(url.host);
}

export function isMapTileOrAssetRequest(url: URL) {
  return url.searchParams.get("ssn-tr") === "true";
}

export function handleMapTileRequest(url: URL, event: FetchEvent) {
  url.searchParams.delete("ssn-tr");
  url.searchParams.delete("sku");
  url.searchParams.delete("access_token");
  url.searchParams.delete("secure");
  const cacheKey = url.toString();
  return cachesMatch(cacheKey).then((response) => {
    if (response) {
      return response;
    } else {
      return fetch(event.request);
    }
  });
}

const staticMapAssets = caches.open("offline-basemap-static-assets");

async function cachesMatch(url: string) {
  const cacheKeys = await caches.keys();
  // check static assets first (styles, fonts, etc)
  const cache = await staticMapAssets;
  const existing = await cache.match(url);
  if (existing) {
    return existing;
  }
  // check map tiles
  for (const key of cacheKeys) {
    if (/^data-source/.test(key)) {
      console.log("checking", key);
      const cache = await caches.open(key);
      const cached = await cache.match(url);
      if (cached) {
        return cached;
      }
    }
  }
}
