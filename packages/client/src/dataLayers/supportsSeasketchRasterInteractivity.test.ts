import { describe, expect, it } from "@jest/globals";
import {
  SuggestedRasterPresentation,
  isGeostatsLayer,
  type RasterInfo,
} from "@seasketch/geostats-types";
import {
  resolveSourceGeostats,
  supportsSeasketchRasterInteractivity,
} from "./supportsSeasketchRasterInteractivity";
import gfwGeostats from "./__fixtures__/raster-interactivity/gfw.geostats.json";
import nlcdGeostats from "./__fixtures__/raster-interactivity/nlcd.geostats.json";

// Avoid importing generated/graphql (Flow syntax breaks Jest transform).
const SEASKETCH_RASTER = "SEASKETCH_RASTER";
const SEASKETCH_MVT = "SEASKETCH_MVT";

describe("supportsSeasketchRasterInteractivity", () => {
  it("accepts single-band Gray SEASKETCH_RASTER", () => {
    expect(
      supportsSeasketchRasterInteractivity(SEASKETCH_RASTER, gfwGeostats)
    ).toBe(true);
  });

  it("accepts single-band Palette (categorical) SEASKETCH_RASTER", () => {
    expect(
      supportsSeasketchRasterInteractivity(SEASKETCH_RASTER, nlcdGeostats)
    ).toBe(true);
  });

  it("rejects RGB presentation and multi-band", () => {
    const rgb: RasterInfo = {
      ...(gfwGeostats as RasterInfo),
      presentation: SuggestedRasterPresentation.rgb,
    };
    expect(supportsSeasketchRasterInteractivity(SEASKETCH_RASTER, rgb)).toBe(
      false
    );

    const multi = {
      ...(gfwGeostats as RasterInfo),
      bands: [
        (gfwGeostats as RasterInfo).bands[0],
        { ...(gfwGeostats as RasterInfo).bands[0], name: "band 2" },
      ],
    };
    expect(supportsSeasketchRasterInteractivity(SEASKETCH_RASTER, multi)).toBe(
      false
    );
  });

  it("rejects non-raster sources", () => {
    expect(
      supportsSeasketchRasterInteractivity(SEASKETCH_MVT, gfwGeostats)
    ).toBe(false);
  });
});

describe("resolveSourceGeostats", () => {
  it("returns RasterInfo as-is", () => {
    expect(resolveSourceGeostats(gfwGeostats)).toBe(gfwGeostats);
  });

  it("finds a vector layer by sourceLayer", () => {
    const blob = {
      layers: [
        { layer: "a", attributes: [] },
        { layer: "b", attributes: [{ attribute: "x" }] },
      ],
    };
    const resolved = resolveSourceGeostats(blob, "b");
    expect(isGeostatsLayer(resolved)).toBe(true);
    if (!isGeostatsLayer(resolved)) {
      return;
    }
    expect(resolved.layer).toBe("b");
  });
});
