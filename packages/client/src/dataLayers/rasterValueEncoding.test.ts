import { describe, expect, it } from "@jest/globals";
import samples from "./__fixtures__/raster-interactivity/gfw.samples.json";
import {
  applyRasterScaleOffset,
  decodeRgbEncodedRasterValue,
  encodingParamsFromGlStyles,
  encodingParamsFromRasterColorMix,
  styleRespectsScaleAndOffset,
} from "./rasterValueEncoding";

/** Mirror of upload encodeValuesToRGB packing (integer path). */
function encodeValue(
  value: number,
  base: number,
  interval: number
): { r: number; g: number; b: number } {
  const n = Math.floor((value - base) / interval) + 32768;
  return {
    r: Math.floor(n / 65536),
    g: Math.floor((n % 65536) / 256),
    b: n % 256,
  };
}

describe("decodeRgbEncodedRasterValue", () => {
  it("round-trips full 24-bit encoding with base=0, interval=1", () => {
    for (const value of [0, 1, 30, 255, 256, 1000, 611]) {
      const { r, g, b } = encodeValue(value, 0, 1);
      expect(
        decodeRgbEncodedRasterValue(r, g, b, 255, {
          base: 0,
          interval: 1,
        })
      ).toBe(value);
    }
  });

  it("round-trips negative base (SST-style)", () => {
    const base = -3011;
    for (const value of [-3011, -100, 0, 25.5]) {
      const { r, g, b } = encodeValue(value, base, 1);
      expect(
        decodeRgbEncodedRasterValue(r, g, b, 255, { base, interval: 1 })
      ).toBeCloseTo(Math.floor(value - base) + base, 10);
    }
  });

  it("applies interval for stretched floats", () => {
    const base = 0;
    const interval = 0.01;
    for (const value of [0, 0.5, 1.23, 12.34]) {
      const { r, g, b } = encodeValue(value, base, interval);
      const decoded = decodeRgbEncodedRasterValue(r, g, b, 255, {
        base,
        interval,
      });
      expect(decoded).not.toBeNull();
      // Quantized to interval steps
      expect(decoded!).toBeCloseTo(
        Math.floor((value - base) / interval) * interval + base,
        10
      );
    }
  });

  it("uses blue-only path for byteEncoding", () => {
    expect(
      decodeRgbEncodedRasterValue(12, 34, 200, 255, {
        base: 5,
        interval: 1,
        byteEncoding: true,
      })
    ).toBe(205);
  });

  it("returns null for transparent / nodata pixels", () => {
    expect(
      decodeRgbEncodedRasterValue(0, 128, 30, 0, { base: 0, interval: 1 })
    ).toBeNull();
  });

  it("handles edge byte channels", () => {
    expect(
      decodeRgbEncodedRasterValue(255, 255, 255, 255, {
        base: 0,
        interval: 1,
      })
    ).toBe(255 * 65536 + 255 * 256 + 255 - 32768);
    expect(
      decodeRgbEncodedRasterValue(0, 0, 0, 255, { base: 0, interval: 1 })
    ).toBe(-32768);
  });

  it("decodes known pixels from the gfw fixture samples", () => {
    const params = samples.encoding;
    for (const sample of samples.opaque) {
      expect(
        decodeRgbEncodedRasterValue(
          sample.r,
          sample.g,
          sample.b,
          sample.a,
          params
        )
      ).toBe(sample.value);
    }
    for (const sample of samples.transparent) {
      expect(
        decodeRgbEncodedRasterValue(
          sample.r,
          sample.g,
          sample.b,
          sample.a,
          params
        )
      ).toBeNull();
    }
  });
});

describe("applyRasterScaleOffset", () => {
  it("returns value unchanged when scale/offset absent", () => {
    expect(applyRasterScaleOffset(42)).toBe(42);
    expect(applyRasterScaleOffset(42, null, null)).toBe(42);
  });

  it("applies scale and offset", () => {
    expect(applyRasterScaleOffset(100, 0.01, -273.15)).toBeCloseTo(
      100 * 0.01 - 273.15,
      10
    );
  });
});

describe("encodingParamsFromRasterColorMix", () => {
  it("parses full 24-bit continuous mix", () => {
    const mix = [
      ["*", 258, 65536],
      ["*", 258, 256],
      258,
      ["+", -32768, 0],
    ];
    expect(encodingParamsFromRasterColorMix(mix)).toEqual({
      base: 0,
      interval: 1,
      byteEncoding: false,
    });
  });

  it("parses mix with non-zero base", () => {
    const mix = [
      ["*", 258, 65536],
      ["*", 258, 256],
      258,
      ["+", -32768, -3011],
    ];
    expect(encodingParamsFromRasterColorMix(mix)).toEqual({
      base: -3011,
      interval: 1,
      byteEncoding: false,
    });
  });

  it("parses interval-wrapped mix", () => {
    const inner = [
      ["*", 258, 65536],
      ["*", 258, 256],
      258,
      ["+", -32768, 0],
    ];
    const mix = inner.map((channel) => ["*", 0.01, channel]);
    expect(encodingParamsFromRasterColorMix(mix)).toEqual({
      base: 0,
      interval: 0.01,
      byteEncoding: false,
    });
  });

  it("parses byteEncoding / categorical mix", () => {
    expect(encodingParamsFromRasterColorMix([0, 0, 258, 10])).toEqual({
      base: 10,
      interval: 1,
      byteEncoding: true,
    });
  });

  it("returns null for unrecognized mix", () => {
    expect(encodingParamsFromRasterColorMix(null)).toBeNull();
    expect(encodingParamsFromRasterColorMix([1, 2, 3])).toBeNull();
    expect(encodingParamsFromRasterColorMix([1, 2, 3, 4])).toBeNull();
  });

  it("round-trips encode→style mix→decode", () => {
    const params = encodingParamsFromRasterColorMix([
      ["*", 258, 65536],
      ["*", 258, 256],
      258,
      ["+", -32768, 0],
    ])!;
    const { r, g, b } = encodeValue(30, params.base, params.interval);
    expect(decodeRgbEncodedRasterValue(r, g, b, 255, params)).toBe(30);
  });
});

describe("encodingParamsFromGlStyles", () => {
  it("reads raster-color-mix from gl styles", () => {
    const styles = [
      {
        type: "raster",
        paint: {
          "raster-color-mix": [0, 0, 258, 0],
        },
        metadata: { "s:respect-scale-and-offset": true },
      },
    ];
    expect(encodingParamsFromGlStyles(styles)).toEqual({
      base: 0,
      interval: 1,
      byteEncoding: true,
    });
    expect(styleRespectsScaleAndOffset(styles)).toBe(true);
  });

  it("returns null when no mix present (RGB image)", () => {
    expect(
      encodingParamsFromGlStyles([
        { type: "raster", paint: { "raster-opacity": 1 } },
      ])
    ).toBeNull();
    expect(styleRespectsScaleAndOffset([])).toBe(false);
  });
});
