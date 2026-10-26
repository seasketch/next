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

const FIREFOX_153_MESSAGE =
  "Could not load image because of The image could not be decoded. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.";

const CHROME_MESSAGE =
  "Could not load image because of The source image could not be decoded. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.";

const FIREFOX_LEGACY_MESSAGE =
  "Could not load image because of An attempt was made to use an object that is not, or is no longer usable. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.";

function managerWithRasterSource() {
  const map = fakeMap();
  const manager = new LayerStateManager<LayerState>("overlays");
  manager.addLayer("toc-1", { visible: true, loading: false });
  manager.setSourceForKey("toc-1", "overlays-42");
  manager.attachToMap(map as any);
  return { map, manager };
}

describe("LayerStateManager empty raster tile decode errors", () => {
  it("ignores the Firefox 153 createImageBitmap message for empty tiles", () => {
    const { map, manager } = managerWithRasterSource();
    map.emit("error", {
      sourceId: "overlays-42",
      error: new Error(FIREFOX_153_MESSAGE),
    });
    expect(manager.getRaw("toc-1")?.error).toBeUndefined();
    manager.destroy();
  });

  it("still ignores the Chrome and pre-153 Firefox messages from #953", () => {
    const { map, manager } = managerWithRasterSource();
    map.emit("error", {
      sourceId: "overlays-42",
      error: new Error(CHROME_MESSAGE),
    });
    map.emit("error", {
      sourceId: "overlays-42",
      error: new Error(FIREFOX_LEGACY_MESSAGE),
    });
    expect(manager.getRaw("toc-1")?.error).toBeUndefined();
    manager.destroy();
  });

  it("still records a real source error", () => {
    const { map, manager } = managerWithRasterSource();
    const error = new Error("Failed to fetch");
    map.emit("error", { sourceId: "overlays-42", error });
    expect(manager.getRaw("toc-1")?.error).toBe(error);
    manager.destroy();
  });

  it("ignores a decode failure whose inner text is an unknown browser message", () => {
    const { map, manager } = managerWithRasterSource();
    map.emit("error", {
      sourceId: "overlays-42",
      error: new Error(
        "Could not load image because of something new. Please make sure to " +
          "use a supported image type such as PNG or JPEG. Note that SVGs " +
          "are not supported."
      ),
    });
    expect(manager.getRaw("toc-1")?.error).toBeUndefined();
    manager.destroy();
  });

  it("does not apply errors from sources outside this manager", () => {
    const { map, manager } = managerWithRasterSource();
    map.emit("error", {
      sourceId: "basemap-1",
      error: new Error(FIREFOX_153_MESSAGE),
    });
    expect(manager.getRaw("toc-1")?.error).toBeUndefined();
    manager.destroy();
  });
});
