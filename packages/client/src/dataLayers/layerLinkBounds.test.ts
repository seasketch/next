import { describe, expect, it } from "@jest/globals";
import {
  boundsAreUsable,
  cameraForLayerBounds,
} from "./layerLinkBounds";

describe("boundsAreUsable", () => {
  it("rejects null, undefined, and non-arrays", () => {
    expect(boundsAreUsable(null)).toBe(false);
    expect(boundsAreUsable(undefined)).toBe(false);
    expect(boundsAreUsable("0,0,1,1")).toBe(false);
    expect(boundsAreUsable([0, 0, 1])).toBe(false);
  });

  it("rejects the empty-extent sentinel and inverted latitudes", () => {
    expect(boundsAreUsable([180, 90, -180, -90])).toBe(false);
    expect(boundsAreUsable([0, 10, 1, 0])).toBe(false);
    expect(boundsAreUsable([0, 0, 1, Number.NaN])).toBe(false);
  });

  it("accepts a normal extent, including one that crosses the antimeridian", () => {
    expect(boundsAreUsable([-123.5, 48.2, -122.4, 49.1])).toBe(true);
    expect(boundsAreUsable([170, -10, -170, 10])).toBe(true);
  });
});

describe("cameraForLayerBounds", () => {
  it("frames a small extent more tightly than a world extent", () => {
    const world = cameraForLayerBounds([-180, -60, 180, 60]);
    const bay = cameraForLayerBounds([-123.2, 48.3, -123.0, 48.5]);
    expect(world.zoom).toBeLessThan(3);
    expect(bay.zoom).toBeGreaterThan(world.zoom);
    expect(bay.bearing).toBe(0);
    expect(bay.pitch).toBe(0);
  });

  it("centers a normal extent on its midpoint", () => {
    const camera = cameraForLayerBounds([-10, -10, 10, 10]);
    expect(camera.center[0]).toBeCloseTo(0);
    expect(camera.center[1]).toBeCloseTo(0);
  });

  it("centers an antimeridian extent on the far side of the date line", () => {
    const camera = cameraForLayerBounds([170, -5, -170, 5]);
    expect(camera.center[0]).toBeCloseTo(180);
    expect(camera.center[1]).toBeCloseTo(0);
  });
});
