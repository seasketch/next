/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { clientsClaim, skipWaiting } from "workbox-core";
import { PrecacheEntry } from "workbox-precaching/_types";
import { MESSAGE_TYPES } from "./offline/ServiceWorkerWindow";
import StaticAssetCache from "./StaticAssetCache";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

clientsClaim();

const MANIFEST = self.__WB_MANIFEST;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    // This allows the web app to trigger skipWaiting via
    // registration.waiting.postMessage({type: 'SKIP_WAITING'})
    self.skipWaiting();
  } else if (event.data && event.data.type === MESSAGE_TYPES.GET_MANIFEST) {
    event.ports[0].postMessage(MANIFEST);
  }
});

const staticAssetCache = new StaticAssetCache(MANIFEST);

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin === self.location.origin &&
    staticAssetCache.urlInManifest(url)
  ) {
    event.respondWith(staticAssetCache.handleRequest(url, event));
  }
});
