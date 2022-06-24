/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { PrecacheEntry } from "workbox-precaching/_types";
import { GraphqlQueryCache } from "./offline/GraphqlQueryCache/sw";
import { MESSAGE_TYPES } from "./offline/ServiceWorkerWindow";
import StaticAssetCache from "./offline/StaticAssetCache";
import { strategies } from "./offline/GraphqlQueryCache/strategies";
import * as SurveyAssetCache from "./offline/SurveyAssetCache";

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
  }
});
