import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { parseFeatureInfo } from "../interactivity";
import { getLegendItems } from "../legends";
import { buildLayerMetadata } from "../metadata";
import { parseCapabilities } from "../capabilities";
import { WMSDynamicSource } from "../WMSDynamicSource";
import { WMSTiledSource } from "../WMSTiledSource";

const fixturesDir = join(__dirname, "..", "__fixtures__");

function loadMeta130() {
  const xml = readFileSync(
    join(fixturesDir, "wms130-capabilities.xml"),
    "utf8"
  );
  return parseCapabilities(xml, "https://example.com/wms?");
}

describe("parseFeatureInfo", () => {
  it("parses JSON feature info", () => {
    const body = readFileSync(
      join(fixturesDir, "featureinfo-json.json"),
      "utf8"
    );
    const result = parseFeatureInfo(body, "application/json");
    expect(result.features.length).toBe(1);
    expect(result.features[0].properties.country).toBe("Testland");
  });

  it("passes through HTML feature info", () => {
    const body = readFileSync(
      join(fixturesDir, "featureinfo-html.html"),
      "utf8"
    );
    const result = parseFeatureInfo(body, "text/html");
    expect(result.html).toContain("Testland");
  });
});

describe("legends and metadata", () => {
  it("builds legend items from capabilities LegendURL", () => {
    const meta = loadMeta130();
    const items = getLegendItems(meta, "bathymetry");
    expect(items.length).toBe(1);
    expect(items[0].imageUrl).toBe("https://example.com/legend.png");
  });

  it("builds prosemirror metadata document", () => {
    const meta = loadMeta130();
    const doc = buildLayerMetadata(meta, "bathymetry");
    expect(doc.title).toBe("Bathymetry");
    expect(doc.prosemirror.type).toBe("doc");
    expect(doc.prosemirror.content.length).toBeGreaterThan(0);
  });
});

describe("WMS source classes", () => {
  const meta = loadMeta130();

  function createFakeMap() {
    const listeners: Record<string, Function[]> = {};
    const source = {
      type: "image",
      url: "",
      updateImage: (opts: { url: string }) => {
        source.url = opts.url;
      },
    };
    return {
      source,
      listeners,
      getZoom: () => 2,
      getBounds: () => ({
        getNorthWest: () => ({ lng: -10, lat: 50 }),
        getNorthEast: () => ({ lng: 10, lat: 50 }),
        getSouthEast: () => ({ lng: 10, lat: 40 }),
        getSouthWest: () => ({ lng: -10, lat: 40 }),
      }),
      getSource: () => source,
      addSource: () => {},
      on: (event: string, fn: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      },
      off: (event: string, fn: Function) => {
        listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
      },
      fire: (event: string, data: unknown) => {
        for (const fn of listeners[event] || []) {
          fn(data);
        }
      },
      getStyle: () => ({ layers: [] }),
      removeLayer: () => {},
      removeSource: () => {},
      isSourceLoaded: () => true,
    };
  }

  it("WMSDynamicSource returns image source", async () => {
    const map = createFakeMap();
    const source = new WMSDynamicSource({
      url: "https://example.com/wms?",
      metadata: meta,
    });
    await source.prepare();
    const glSource = await source.getGLSource(map as any);
    expect(glSource.type).toBe("image");
    expect((glSource as any).coordinates.length).toBe(4);
  });

  it("WMSDynamicSource updateLayers changes GetMap layers param", async () => {
    const map = createFakeMap();
    const source = new WMSDynamicSource({
      url: "https://example.com/wms?",
      metadata: meta,
    });
    await source.prepare();
    source.updateLayers([
      { id: "bathymetry", opacity: 1 },
      { id: "coastline", opacity: 1 },
    ]);
    const url = (source as any).getMapUrl(map);
    expect(url).toContain("LAYERS=bathymetry%2Ccoastline");
  });

  it("WMSTiledSource returns raster source with bbox template", async () => {
    const map = createFakeMap();
    const source = new WMSTiledSource({
      url: "https://example.com/wms?",
      metadata: meta,
    });
    await source.prepare();
    source.updateLayers([{ id: "bathymetry", opacity: 1 }]);
    const glSource = await source.getGLSource(map as any);
    expect(glSource.type).toBe("raster");
    expect((glSource as any).tiles[0]).toContain("{bbox-epsg-3857}");
  });

  it("exposes supportsDynamicRendering without per-layer opacity", async () => {
    const source = new WMSDynamicSource({
      url: "https://example.com/wms?",
      metadata: meta,
    });
    const computed = await source.getComputedMetadata();
    expect(computed.supportsDynamicRendering).toEqual({
      layerOrder: true,
      layerVisibility: true,
      layerOpacity: false,
    });
  });
});
