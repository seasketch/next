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

const staticAssetCache = new StaticAssetCache(MANIFEST);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (await staticAssetCache.precacheEnabled()) {
        await staticAssetCache.populateCache();
      }
      skipWaiting();
    })()
  );
});

self.addEventListener("waiting", (event) => {
  console.log(
    `A new service worker has installed, but it can't activate` +
      `until all tabs running the current version have fully unloaded.`
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    // This allows the web app to trigger skipWaiting via
    // registration.waiting.postMessage({type: 'SKIP_WAITING'})
    self.skipWaiting();
  } else if (event.data && event.data.type === MESSAGE_TYPES.GET_MANIFEST) {
    event.ports[0].postMessage(MANIFEST);
  } else if (event.data && event.data.type === MESSAGE_TYPES.GET_BUILD) {
    event.ports[0].postMessage(process.env.REACT_APP_BUILD || "local");
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
  } else if (
    url.host === self.location.host &&
    !fileExtensionRegexp.test(url.pathname)
  ) {
    event.respondWith(staticAssetCache.networkThenIndexHtmlCache(event));
  }
});
