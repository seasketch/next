import { describe, expect, it } from "vitest";
import { buildGlStyle } from "../lib/buildGlStyle";

describe("buildGlStyle", () => {
  it("builds a circle layer for default simple point visualization", () => {
    const layers = buildGlStyle({
      geostats: {
        layer: "points",
        geometry: "Point",
        attributes: [],
        count: 0,
      },
    });
    expect(layers).toHaveLength(1);
    expect(layers[0]!.type).toBe("circle");
    const paint = (layers[0]! as { paint: Record<string, unknown> }).paint;
    expect(paint["circle-radius"]).toBe(4);
    expect(paint["circle-stroke-width"]).toBe(2);
    expect(paint["circle-stroke-opacity"]).toBe(0.8);
    expect(typeof paint["circle-color"]).toBe("string");
    expect(typeof paint["circle-stroke-color"]).toBe("string");
  });
});
