import { describe, expect, it } from "@jest/globals";
import {
  applyClockPaintHidden,
  canKeepTilesWhenClockHidden,
  snapClockOpacityTransitions,
} from "./mapTemporalStyle";

describe("canKeepTilesWhenClockHidden", () => {
  it("keeps hosted raster and vector tilesets", () => {
    expect(canKeepTilesWhenClockHidden("SEASKETCH_RASTER")).toBe(true);
    expect(canKeepTilesWhenClockHidden("SEASKETCH_MVT")).toBe(true);
  });

  it("does not treat ArcGIS services as preloadable", () => {
    expect(canKeepTilesWhenClockHidden("ARCGIS_DYNAMIC_MAPSERVER")).toBe(false);
    expect(canKeepTilesWhenClockHidden("ARCGIS_RASTER_TILES")).toBe(false);
    expect(canKeepTilesWhenClockHidden("ARCGIS_VECTOR")).toBe(false);
  });

  it("rejects missing types", () => {
    expect(canKeepTilesWhenClockHidden(undefined)).toBe(false);
  });
});

describe("applyClockPaintHidden", () => {
  it("sets raster-opacity to 0 without mutating the original", () => {
    const input = [
      {
        id: "gmw-2020",
        type: "raster",
        paint: { "raster-opacity": 0.8, "raster-resampling": "nearest" },
      },
    ];
    const out = applyClockPaintHidden(input);
    expect(out[0].paint).toEqual({
      "raster-opacity": 0,
      "raster-opacity-transition": { duration: 0, delay: 0 },
      "raster-fade-duration": 0,
      "raster-resampling": "nearest",
    });
    expect(input[0].paint["raster-opacity"]).toBe(0.8);
  });

  it("overwrites opacity expressions", () => {
    const out = applyClockPaintHidden([
      {
        type: "fill",
        paint: { "fill-opacity": ["*", 0.5, ["get", "a"]] },
      },
    ]);
    expect(out[0].paint!["fill-opacity"]).toBe(0);
  });

  it("leaves unknown layer types unchanged", () => {
    const layer = { type: "hillshade", paint: { "hillshade-exaggeration": 0.5 } };
    expect(applyClockPaintHidden([layer])[0]).toBe(layer);
  });
});

describe("snapClockOpacityTransitions", () => {
  it("sets instant raster opacity and tile fade", () => {
    const out = snapClockOpacityTransitions([
      { type: "raster", paint: { "raster-opacity": 1 } },
    ]);
    expect(out[0].paint).toEqual({
      "raster-opacity": 1,
      "raster-opacity-transition": { duration: 0, delay: 0 },
      "raster-fade-duration": 0,
    });
  });
});
