import { describe, expect, it } from "@jest/globals";
import gfwSamples from "./__fixtures__/raster-interactivity/gfw.samples.json";
import nlcdSamples from "./__fixtures__/raster-interactivity/nlcd.samples.json";
import {
  buildTileUrl,
  lngLatToTilePixel,
  sampleRgbaBuffer,
} from "./rasterPixelQuery";

describe("buildTileUrl", () => {
  it("leaves XYZ {y} unchanged (SeaSketch / Mapbox)", () => {
    expect(
      buildTileUrl("https://example.com/{z}/{x}/{y}.png", 2, 0, 2)
    ).toBe("https://example.com/2/0/2.png");
  });

  it("flips {-y} for TMS (2^z - 1 - y)", () => {
    // z=2 → y rows 0..3; XYZ y=0 → TMS y=3, XYZ y=2 → TMS y=1
    expect(
      buildTileUrl("https://example.com/{z}/{x}/{-y}.png", 2, 0, 0)
    ).toBe("https://example.com/2/0/3.png");
    expect(
      buildTileUrl("https://example.com/{z}/{x}/{-y}.png", 2, 0, 2)
    ).toBe("https://example.com/2/0/1.png");
  });
});

describe("lngLatToTilePixel", () => {
  it("maps a point inside the gfw z2 tile to that tile", () => {
    // Bounds roughly [-175.5, -17] – [-169.5, -9.9]; center of known tile 2/0/2
    const { z, x, y, px, py } = lngLatToTilePixel(-172.5, -13.5, 2, 512);
    expect(z).toBe(2);
    expect(x).toBe(0);
    expect(y).toBe(2);
    expect(px).toBeGreaterThanOrEqual(0);
    expect(px).toBeLessThan(512);
    expect(py).toBeGreaterThanOrEqual(0);
    expect(py).toBeLessThan(512);
  });

  it("maps a point inside the nlcd z9 tile to that tile", () => {
    // Santa Barbara area; tile 9/85/203 covers the NLCD fixture
    const { z, x, y, px, py } = lngLatToTilePixel(-119.85, 34.45, 9, 512);
    expect(z).toBe(9);
    expect(x).toBe(85);
    expect(y).toBe(203);
    expect(px).toBeGreaterThanOrEqual(0);
    expect(px).toBeLessThan(512);
    expect(py).toBeGreaterThanOrEqual(0);
    expect(py).toBeLessThan(512);
  });

  it("clamps fractional pixels into tile bounds", () => {
    const { px, py } = lngLatToTilePixel(-180, 85, 2, 512);
    expect(px).toBeGreaterThanOrEqual(0);
    expect(px).toBeLessThan(512);
    expect(py).toBeGreaterThanOrEqual(0);
    expect(py).toBeLessThan(512);
  });
});

function expectSamplesDecode(samples: typeof gfwSamples) {
  const width = 512;
  const data = new Uint8ClampedArray(width * width * 4);
  for (const sample of samples.opaque) {
    const i = (sample.py * width + sample.px) * 4;
    data[i] = sample.r;
    data[i + 1] = sample.g;
    data[i + 2] = sample.b;
    data[i + 3] = sample.a;
    expect(
      sampleRgbaBuffer(data, width, sample.px, sample.py, samples.encoding)
    ).toBe(sample.value);
  }
  for (const sample of samples.transparent) {
    const i = (sample.py * width + sample.px) * 4;
    data[i] = sample.r;
    data[i + 1] = sample.g;
    data[i + 2] = sample.b;
    data[i + 3] = sample.a;
    expect(
      sampleRgbaBuffer(data, width, sample.px, sample.py, samples.encoding)
    ).toBeNull();
  }
}

describe("sampleRgbaBuffer", () => {
  it("decodes continuous Gray fixture samples (GFW)", () => {
    expectSamplesDecode(gfwSamples);
  });

  it("decodes categorical Palette byte-encoded samples (NLCD)", () => {
    expectSamplesDecode(nlcdSamples);
  });
});
