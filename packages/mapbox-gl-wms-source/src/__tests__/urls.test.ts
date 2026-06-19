import { describe, expect, it } from "vitest";
import { blankDataUri } from "../util";
import {
  buildGetFeatureInfoUrl,
  buildGetLegendGraphicUrl,
  buildGetMapUrl,
  buildTiledGetMapUrlTemplate,
} from "../urls";

describe("URL builders", () => {
  it("builds WMS 1.3.0 GetMap URL", () => {
    const url = buildGetMapUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layers: ["bathymetry", "coastline"],
      styles: ["default", ""],
      crs: "EPSG:3857",
      bbox: [0, 0, 100, 100],
      width: 256,
      height: 256,
      format: "image/png",
      transparent: true,
    });
    expect(url).toContain("REQUEST=GetMap");
    expect(url).toContain("VERSION=1.3.0");
    expect(url).toContain("CRS=EPSG%3A3857");
    expect(url).toContain("LAYERS=bathymetry%2Ccoastline");
    expect(url).toContain("STYLES=default%2C");
  });

  it("builds WMS 1.1.1 GetMap URL with SRS", () => {
    const url = buildGetMapUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.1.1",
      layers: ["eez"],
      crs: "EPSG:3857",
      bbox: [0, 0, 100, 100],
      width: 256,
      height: 256,
    });
    expect(url).toContain("SRS=EPSG%3A3857");
    expect(url).not.toContain("CRS=");
  });

  it("always emits STYLES on GetMap even when empty (WMS spec mandatory)", () => {
    const url = buildGetMapUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layers: ["bathymetry"],
      styles: [""],
      crs: "EPSG:3857",
      bbox: [0, 0, 100, 100],
      width: 256,
      height: 256,
    });
    expect(url).toMatch(/[&?]STYLES=(&|$)/);
  });

  it("emits empty STYLES when styles param omitted entirely", () => {
    const url = buildGetMapUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layers: ["a", "b"],
      crs: "EPSG:3857",
      bbox: [0, 0, 100, 100],
      width: 256,
      height: 256,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has("STYLES")).toBe(true);
    // One empty style entry per layer, matching the LAYERS count.
    expect(parsed.searchParams.get("STYLES")).toBe(",");
  });

  it("tiled template includes mandatory STYLES", () => {
    const url = buildTiledGetMapUrlTemplate({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layers: ["bathymetry"],
      crs: "EPSG:3857",
      tileSize: 256,
    });
    expect(url).toMatch(/[&?]STYLES=(&|$)/);
  });

  it("GetFeatureInfo includes mandatory STYLES alongside LAYERS", () => {
    const url = buildGetFeatureInfoUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layers: ["eez"],
      queryLayers: ["eez"],
      crs: "EPSG:3857",
      bbox: [0, 0, 100, 100],
      width: 256,
      height: 256,
      x: 128,
      y: 64,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has("STYLES")).toBe(true);
  });

  it("returns blank data uri when no layers", () => {
    const url = buildGetMapUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layers: [],
      crs: "EPSG:3857",
      bbox: [0, 0, 1, 1],
      width: 1,
      height: 1,
    });
    expect(url).toBe(blankDataUri);
  });

  it("builds tiled template with bbox token", () => {
    const url = buildTiledGetMapUrlTemplate({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layers: ["bathymetry"],
      crs: "EPSG:3857",
      tileSize: 256,
    });
    expect(url).toContain("{bbox-epsg-3857}");
    expect(url).toContain("LAYERS=bathymetry");
  });

  it("builds GetFeatureInfo with I/J for 1.3.0", () => {
    const url = buildGetFeatureInfoUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layers: ["eez"],
      queryLayers: ["eez"],
      crs: "EPSG:3857",
      bbox: [0, 0, 100, 100],
      width: 256,
      height: 256,
      x: 128,
      y: 64,
      infoFormat: "application/json",
    });
    expect(url).toContain("I=128");
    expect(url).toContain("J=64");
    expect(url).not.toMatch(/[&?]X=\d/);
  });

  it("builds GetFeatureInfo with X/Y for 1.1.1", () => {
    const url = buildGetFeatureInfoUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.1.1",
      layers: ["eez"],
      queryLayers: ["eez"],
      crs: "EPSG:3857",
      bbox: [0, 0, 100, 100],
      width: 256,
      height: 256,
      x: 128,
      y: 64,
    });
    expect(url).toContain("X=128");
    expect(url).toContain("Y=64");
  });

  it("builds GetLegendGraphic URL", () => {
    const url = buildGetLegendGraphicUrl({
      baseUrl: "https://example.com/wms?",
      version: "1.3.0",
      layer: "bathymetry",
      style: "default",
    });
    expect(url).toContain("REQUEST=GetLegendGraphic");
    expect(url).toContain("LAYER=bathymetry");
  });
});
