import { PrecacheEntry } from "workbox-precaching/_types";
import { Workbox } from "workbox-window";

export const MESSAGE_TYPES = {
  GET_MANIFEST: "GET_MANIFEST",
  GET_BUILD: "GET_BUILD",
  UPDATE_GRAPHQL_STRATEGY_ARGS: "UPDATE_GRAPHQL_STRATEGY_ARGS",
  GRAPHQL_CACHE_REVALIDATION: "GRAPHQL_CACHE_REVALIDATION",
  UPDATE_GRAPHQL_CACHE_ENABLED: "UPDATE_GRAPHQL_CACHE_ENABLED",
  SKIP_WAITING: "SKIP_WAITING",
};

declare const self:
  | undefined
  | (ServiceWorkerGlobalScope & {
      __WB_MANIFEST: (PrecacheEntry | string)[];
    });

/**
 * Use as a communication channel between the host page and ServiceWorker.
 *
 * Uses workbox-window under the hood, but provides a discrete list of typed
 * functions to avoid sending messages that may not match the ServicesWorker's
 * expected message types or outputs.
 */
class ServiceWorkerWindow {
  private wb: Pick<Workbox, "messageSW">;

  constructor() {
    if ("serviceWorker" in navigator && (!self || !("skipWaiting" in self))) {
      const wb = new Workbox("/serviceWorker.js");
      wb.register();
      this.wb = wb;
    } else {
      this.wb = {
        messageSW: (message: object) => {
          throw new Error(
            "ServiceWorkerWindow can only be used from main context"
          );
        },
      };
    }
  }

  /**
   * Retrieve the prefetch cache manifest
   */
  getManifest() {
    return this.wb.messageSW({ type: MESSAGE_TYPES.GET_MANIFEST }) as Promise<
      (PrecacheEntry | string)[]
    >;
  }

  /**
   * Get the build ref of the service worker. Useful for comparing worker and
   * client build. If they do not match, one is out of date.
   * @returns string
   */
  getSWBuild() {
    return this.wb.messageSW({
      type: MESSAGE_TYPES.GET_BUILD,
    }) as Promise<string>;
  }

  /**
   * Notifies the service worker that changes have been made to persistence
   * strategy configuration for the GraphqlQueryCache. SW GraphqlQueryCache
   * should restore these settings from localforage.
   */
  updateGraphqlQueryCacheStrategyArgs() {
    return this.wb.messageSW({
      type: MESSAGE_TYPES.UPDATE_GRAPHQL_STRATEGY_ARGS,
    });
  }

  /**
   * Notifies service worker to changes in graphql query cache enabled state
   */
  updateGraphqlQueryCacheStrategyEnabled(enabled: boolean) {
    return this.wb.messageSW({
      type: MESSAGE_TYPES.UPDATE_GRAPHQL_CACHE_ENABLED,
      enabled,
    });
  }

  /**
   * Tell installed ServiceWorker to take control of all clients
   */
  skipWaiting() {
    this.wb.messageSW({ type: MESSAGE_TYPES.SKIP_WAITING });
  }
}

export default new ServiceWorkerWindow();
