import { PrecacheEntry } from "workbox-precaching/_types";
import { Workbox } from "workbox-window";

export const MESSAGE_TYPES = {
  GET_MANIFEST: "GET_MANIFEST",
};

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
    if ("serviceWorker" in navigator) {
      const wb = new Workbox("/service-worker.js");
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
}

export default new ServiceWorkerWindow();
