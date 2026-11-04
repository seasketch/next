import { describe, expect, it } from "@jest/globals";
import {
  isBlankHoverMessage,
  rasterPaintStyleFromGlStyles,
  rasterValueIsVisible,
  RasterPaintStyle,
} from "./rasterPaintVisibility";

/** Bleaching Alert Area shape: no-data / below the first class is transparent. */
const bleachingAlert: RasterPaintStyle = {
  colorRange: [0, 255],
  rasterColor: [
    "step",
    ["round", ["raster-value"]],
    "transparent",
    1,
    "#ffff00",
    2,
    "#ff9900",
    3,
    "#ff0000",
    4,
    "#800000",
    5,
    "#ff00ff",
  ],
};

describe("rasterValueIsVisible", () => {
  it("hides the transparent default under the first categorical stop", () => {
    expect(rasterValueIsVisible(bleachingAlert, 0)).toBe(false);
    expect(rasterValueIsVisible(bleachingAlert, 1)).toBe(true);
    expect(rasterValueIsVisible(bleachingAlert, 5)).toBe(true);
  });

  it("follows round() so half-steps land on the painted class", () => {
    expect(rasterValueIsVisible(bleachingAlert, 0.4)).toBe(false);
    expect(rasterValueIsVisible(bleachingAlert, 0.6)).toBe(true);
  });

  it("hides an excluded class painted transparent or rgba alpha 0", () => {
    const excluded: RasterPaintStyle = {
      colorRange: [0, 255],
      rasterColor: [
        "step",
        ["round", ["raster-value"]],
        "transparent",
        0,
        "rgba(0, 0, 0, 0)",
        1,
        "yellow",
        2,
        "transparent",
      ],
    };
    expect(rasterValueIsVisible(excluded, 0)).toBe(false);
    expect(rasterValueIsVisible(excluded, 1)).toBe(true);
    expect(rasterValueIsVisible(excluded, 2)).toBe(false);
  });

  it("clamps outside raster-color-range to the endpoint color", () => {
    // Below the ramp: endpoint is the transparent step default.
    expect(rasterValueIsVisible(bleachingAlert, -5)).toBe(false);
    // Above the ramp: last stop's color (Alert Level), still painted.
    expect(rasterValueIsVisible(bleachingAlert, 400)).toBe(true);
  });

  it("treats a continuous ramp as visible, including clamped endpoints", () => {
    const sst: RasterPaintStyle = {
      colorRange: [0, 40],
      rasterColor: [
        "interpolate",
        ["linear"],
        ["raster-value"],
        0,
        "#000080",
        40,
        "#ff0000",
      ],
    };
    expect(rasterValueIsVisible(sst, 28.5)).toBe(true);
    expect(rasterValueIsVisible(sst, -10)).toBe(true);
    expect(rasterValueIsVisible(sst, 80)).toBe(true);
  });

  it("hides values that clamp onto a transparent ramp end", () => {
    const clipped: RasterPaintStyle = {
      colorRange: [-0.01, 10.01],
      rasterColor: [
        "interpolate",
        ["linear"],
        ["raster-value"],
        -0.01,
        "transparent",
        0,
        "#000000",
        10,
        "#ffffff",
        10.01,
        "hsla(0, 0%, 0%, 0)",
      ],
    };
    expect(rasterValueIsVisible(clipped, -5)).toBe(false);
    expect(rasterValueIsVisible(clipped, 4)).toBe(true);
    expect(rasterValueIsVisible(clipped, 20)).toBe(false);
    expect(rasterValueIsVisible(clipped, 0)).toBe(true);
  });

  it("resolves match stops and the fallback", () => {
    const matched: RasterPaintStyle = {
      colorRange: null,
      rasterColor: [
        "match",
        ["raster-value"],
        0,
        "transparent",
        [1, 2],
        "#ffff00",
        "#ff00ff",
      ],
    };
    expect(rasterValueIsVisible(matched, 0)).toBe(false);
    expect(rasterValueIsVisible(matched, 1)).toBe(true);
    expect(rasterValueIsVisible(matched, 2)).toBe(true);
    expect(rasterValueIsVisible(matched, 9)).toBe(true);
  });

  it("fails open when the color expression is not one we understand", () => {
    expect(
      rasterValueIsVisible(
        { colorRange: [0, 1], rasterColor: ["coalesce", ["raster-value"]] },
        0
      )
    ).toBe(true);
    expect(rasterValueIsVisible(null, 0)).toBe(true);
  });

  it("reads raster-color and raster-color-range off the gl style", () => {
    const style = rasterPaintStyleFromGlStyles([
      { type: "raster", paint: { "raster-opacity": 1 } },
      {
        type: "raster",
        paint: {
          "raster-color": bleachingAlert.rasterColor,
          "raster-color-range": [0, 255],
        },
      },
    ]);
    expect(style?.colorRange).toEqual([0, 255]);
    expect(rasterValueIsVisible(style, 0)).toBe(false);
    expect(rasterPaintStyleFromGlStyles(undefined)).toBeNull();
  });
});

describe("isBlankHoverMessage", () => {
  it("treats empty, whitespace, and empty markup as blank", () => {
    expect(isBlankHoverMessage("")).toBe(true);
    expect(isBlankHoverMessage("   ")).toBe(true);
    expect(isBlankHoverMessage("&nbsp;")).toBe(true);
    expect(isBlankHoverMessage("<span></span>")).toBe(true);
    expect(isBlankHoverMessage("\u200b")).toBe(true);
  });

  it("keeps real labels and numeric fallbacks", () => {
    expect(isBlankHoverMessage("Watch")).toBe(false);
    expect(isBlankHoverMessage("Alert Level 3")).toBe(false);
    expect(isBlankHoverMessage("0")).toBe(false);
    expect(isBlankHoverMessage("<b>Watch</b>")).toBe(false);
  });
});
