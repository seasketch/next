/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { PrecacheEntry } from "workbox-precaching/_types";
import { GraphqlQueryCache } from "./offline/GraphqlQueryCache/sw";
import { MESSAGE_TYPES } from "./offline/ServiceWorkerWindow";
import StaticAssetCache from "./offline/StaticAssetCache";
import { strategies } from "./offline/GraphqlQueryCache/strategies";
import * as SurveyAssetCache from "./offline/SurveyAssetCache";
import LRUCache from "mnemonist/lru-cache-with-delete";
import {
  isSimulatorUrl,
  MapTileCache,
  OfflineTileSettings,
} from "./offline/MapTileCache";

const mapTileCache = new MapTileCache();

const graphqlQueryCache = new GraphqlQueryCache(
  process.env.REACT_APP_GRAPHQL_ENDPOINT,
  strategies
);

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

clientsClaim();

const MANIFEST = self.__WB_MANIFEST;
const staticAssetCache = new StaticAssetCache(MANIFEST);

const offlineTileSimulatorSettings = new LRUCache<string, OfflineTileSettings>(
  5
);

self.addEventListener("install", (event) => {
  // Ensure stale query data that no longer matches application code are removed
  graphqlQueryCache.invalidateChangedQuerySchemas();
  // These can happen in the background, so are not await'd
  (async () => {
    if (await staticAssetCache.precacheEnabled()) {
      await staticAssetCache.populateCache();
    }
  })();
});

self.addEventListener("activate", () => {
  staticAssetCache.purgeStaleEntries();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === MESSAGE_TYPES.SKIP_WAITING) {
    // This allows the web app to trigger skipWaiting via
    // registration.waiting.postMessage({type: 'SKIP_WAITING'})
    self.skipWaiting();
  } else if (event.data && event.data.type === MESSAGE_TYPES.GET_MANIFEST) {
    event.ports[0].postMessage(MANIFEST);
  } else if (event.data && event.data.type === MESSAGE_TYPES.GET_BUILD) {
    event.ports[0].postMessage(process.env.REACT_APP_BUILD || "local");
  } else if (
    event.data &&
    event.data.type === MESSAGE_TYPES.UPDATE_GRAPHQL_STRATEGY_ARGS
  ) {
    graphqlQueryCache.updateStrategyArgs();
  } else if (
    event.data &&
    event.data.type === MESSAGE_TYPES.UPDATE_GRAPHQL_CACHE_ENABLED
  ) {
    graphqlQueryCache.restoreEnabledState();
  } else if (
    event.data &&
    event.data.type === MESSAGE_TYPES.ENABLE_OFFLINE_TILE_SIMULATOR
  ) {
    var sourceId = (event.source as any).id as string;
    if (sourceId) {
      console.warn(
        "Enabling offline tile simulator. Tile requests will be intercepted and blocked if not in offline tileset settings.",
        event.data.settings,
        sourceId
      );
      offlineTileSimulatorSettings.set(sourceId, event.data.settings);
      event.ports[0].postMessage(true);
    }
  } else if (
    event.data &&
    event.data.type === MESSAGE_TYPES.DISABLE_OFFLINE_TILE_SIMULATOR
  ) {
    console.warn("Disabling offline tile simulator.");
    var sourceId = (event.source as any).id as string;
    if (sourceId) {
      offlineTileSimulatorSettings.delete(sourceId);
    }
    event.ports[0].postMessage(false);
  }
});

const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin === self.location.origin &&
    staticAssetCache.urlInManifest(url)
  ) {
    event.respondWith(staticAssetCache.handleRequest(url, event));
  } else if (graphqlQueryCache.isGraphqlRequest(event.request)) {
    event.respondWith(graphqlQueryCache.handleRequest(url, event));
  } else if (
    url.host === self.location.host &&
    !fileExtensionRegexp.test(url.pathname)
  ) {
    event.respondWith(staticAssetCache.networkThenIndexHtmlCache(event));
  } else if (
    /unsplash/.test(url.host) ||
    (/consentDocs/.test(url.pathname) && url.host === self.location.host)
  ) {
    event.respondWith(SurveyAssetCache.handler(event));
  } else if (isSimulatorUrl(url)) {
    const settings = offlineTileSimulatorSettings.get(event.clientId);
    if (settings) {
      event.respondWith(
        mapTileCache.handleSimulatorRequest(url, event, settings)
      );
    }
  }
});
