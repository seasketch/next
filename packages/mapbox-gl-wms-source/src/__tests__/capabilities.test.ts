import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  flattenLayers,
  getLayerBounds,
  getNamedLayers,
  getSupportedWebMercatorCrs,
  parseCapabilities,
} from "../capabilities";
import { normalizeWMSUrl } from "../urls";

const fixturesDir = join(__dirname, "..", "__fixtures__");

describe("parseCapabilities", () => {
  it("parses WMS 1.3.0 capabilities", () => {
    const xml = readFileSync(
      join(fixturesDir, "wms130-capabilities.xml"),
      "utf8"
    );
    const meta = parseCapabilities(xml, "https://example.com/wms");
    expect(meta.version).toBe("1.3.0");
    expect(meta.title).toBe("Test WMS Service 1.3.0");
    expect(meta.getMap.formats).toContain("image/png");
    const named = getNamedLayers(meta.layers);
    expect(named.map((l) => l.name)).toEqual(["bathymetry", "coastline"]);
    expect(named[0].queryable).toBe(true);
    expect(named[0].styles[0].legendUrl).toBe("https://example.com/legend.png");
  });

  it("parses WMS 1.1.1 capabilities", () => {
    const xml = readFileSync(
      join(fixturesDir, "wms111-capabilities.xml"),
      "utf8"
    );
    const meta = parseCapabilities(xml);
    expect(meta.version).toBe("1.1.1");
    const eez = getNamedLayers(meta.layers).find((l) => l.name === "eez");
    expect(eez?.title).toBe("Exclusive Economic Zones");
    expect(getSupportedWebMercatorCrs(meta)).toBe("EPSG:3857");
  });

  it("extracts geographic bounds", () => {
    const xml = readFileSync(
      join(fixturesDir, "wms130-capabilities.xml"),
      "utf8"
    );
    const meta = parseCapabilities(xml);
    const layer = getNamedLayers(meta.layers).find(
      (l) => l.name === "bathymetry"
    )!;
    expect(getLayerBounds(layer)).toEqual([-180, -90, 180, 90]);
  });

  it("flattens nested layer tree", () => {
    const xml = readFileSync(
      join(fixturesDir, "wms130-capabilities.xml"),
      "utf8"
    );
    const meta = parseCapabilities(xml);
    expect(flattenLayers(meta.layers).length).toBe(2);
  });
});

describe("normalizeWMSUrl", () => {
  it("strips GetMap params and builds GetCapabilities URL", () => {
    const result = normalizeWMSUrl(
      "https://example.com/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=test"
    );
    expect(result.baseUrl).toBe("https://example.com/wms");
    expect(result.getCapabilitiesUrl).toContain("REQUEST=GetCapabilities");
    expect(result.getCapabilitiesUrl).toContain("VERSION=1.3.0");
  });
});
