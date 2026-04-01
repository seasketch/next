import { describe, expect, it } from "vitest";
import { buildGlStyle } from "../lib/buildGlStyle";

describe("buildGlStyle", () => {
  it("returns an empty array as a placeholder", () => {
    expect(
      buildGlStyle({
        geostats: { layers: [], layerCount: 0 } as any,
      }),
    ).toEqual([]);
  });
});
