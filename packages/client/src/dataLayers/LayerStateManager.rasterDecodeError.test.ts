import { describe, expect, it } from "@jest/globals";
import { LayerStateManager } from "./LayerStateManager";
import { LayerState } from "./MapContextManager";

/**
 * Minimal stand-in for the Mapbox map event emitter. LayerStateManager only
 * uses on/off for the error path under test.
 */
function fakeMap() {
  const listeners: { [type: string]: Array<(event: unknown) => void> } = {};
  return {
    on(type: string, fn: (event: unknown) => void) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    off(type: string, fn: (event: unknown) => void) {
      listeners[type] = (listeners[type] || []).filter(
        (listener) => listener !== fn
      );
    },
    emit(type: string, event: unknown) {
      for (const listener of listeners[type] || []) listener(event);
    },
  };
}

function managerWithRasterSource() {
  const map = fakeMap();
  const manager = new LayerStateManager<LayerState>("overlays");
  manager.addLayer("toc-1", { visible: true, loading: false });
  manager.setSourceForKey("toc-1", "overlays-42");
  manager.attachToMap(map as any);
  return { map, manager };
}

const FIREFOX_153_MESSAGE =
  "Could not load image because of The image could not be decoded. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.";

const CHROME_MESSAGE =
  "Could not load image because of The source image could not be decoded. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.";

const FIREFOX_LEGACY_MESSAGE =
  "Could not load image because of An attempt was made to use an object that is not, or is no longer usable. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.";

describe("LayerStateManager empty raster tile decode errors", () => {
  it("ignores cached-204 decode messages from Chrome and Firefox", () => {
    const { map, manager } = managerWithRasterSource();
    for (const message of [
      FIREFOX_153_MESSAGE,
      CHROME_MESSAGE,
      FIREFOX_LEGACY_MESSAGE,
    ]) {
      map.emit("error", {
        sourceId: "overlays-42",
        error: new Error(message),
      });
      expect(manager.getRaw("toc-1")?.error).toBeUndefined();
    }
    manager.destroy();
  });

  it("still records a real source error", () => {
    const { map, manager } = managerWithRasterSource();
    const error = new Error("Failed to fetch");
    map.emit("error", { sourceId: "overlays-42", error });
    expect(manager.getRaw("toc-1")?.error).toBe(error);
    manager.destroy();
  });

  it("does not apply errors from sources outside this manager", () => {
    const { map, manager } = managerWithRasterSource();
    map.emit("error", {
      sourceId: "basemap-1",
      error: new Error("Failed to fetch"),
    });
    expect(manager.getRaw("toc-1")?.error).toBeUndefined();
    manager.destroy();
  });
});
