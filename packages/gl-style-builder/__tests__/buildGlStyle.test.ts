import { describe, expect, it } from "vitest";
import { buildGlStyle } from "../lib/buildGlStyle";

describe("buildGlStyle", () => {
  it("throws for geostats that resolve to an unsupported visualization type", () => {
    expect(() =>
      buildGlStyle({
        geostats: { layers: [], layerCount: 0 } as any,
      }),
    ).toThrow(/Unsupported visualization type/);
  });
});
