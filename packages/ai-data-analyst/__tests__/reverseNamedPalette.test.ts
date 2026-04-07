import { describe, expect, it } from "vitest";
import { effectiveReverseNamedPalette } from "../lib/reverseNamedPalette";

describe("effectiveReverseNamedPalette", () => {
  it("is false when reverse_palette is missing or false", () => {
    expect(effectiveReverseNamedPalette(null)).toBe(false);
    expect(effectiveReverseNamedPalette(undefined)).toBe(false);
    expect(
      effectiveReverseNamedPalette({
        reverse_palette: false,
        palette: "plasma",
      }),
    ).toBe(false);
  });

  it("is false without a named palette", () => {
    expect(
      effectiveReverseNamedPalette({
        reverse_palette: true,
        palette: null,
      }),
    ).toBe(false);
    expect(
      effectiveReverseNamedPalette({
        reverse_palette: true,
        palette: "   ",
      }),
    ).toBe(false);
  });

  it("is false when a custom palette object is in use", () => {
    expect(
      effectiveReverseNamedPalette({
        reverse_palette: true,
        palette: "viridis",
        custom_palette: { a: "#ff0000" },
      }),
    ).toBe(false);
  });

  it("is false when custom_palette is a non-empty string", () => {
    expect(
      effectiveReverseNamedPalette({
        reverse_palette: true,
        palette: "viridis",
        custom_palette: "#abc",
      }),
    ).toBe(false);
  });

  it("is true for named palette with reverse and no custom palette", () => {
    expect(
      effectiveReverseNamedPalette({
        reverse_palette: true,
        palette: "interpolatePlasma",
        custom_palette: null,
      }),
    ).toBe(true);
    expect(
      effectiveReverseNamedPalette({
        reverse_palette: true,
        palette: "inferno",
      }),
    ).toBe(true);
  });
});
