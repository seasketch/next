import { describe, expect, it } from "vitest";
import {
  MAX_MERCATOR_EXTENT,
  tileBounds3857,
  tilesForBbox,
  lonLatToMercator,
  bufferedTileBounds3857,
} from "../webmercator";

describe("web mercator tiles", () => {
  it("places z0 at the full world extent", () => {
    const b = tileBounds3857(0, 0, 0);
    expect(b.minX).toBeCloseTo(-MAX_MERCATOR_EXTENT, 6);
    expect(b.maxX).toBeCloseTo(MAX_MERCATOR_EXTENT, 6);
    expect(b.minY).toBeCloseTo(-MAX_MERCATOR_EXTENT, 6);
    expect(b.maxY).toBeCloseTo(MAX_MERCATOR_EXTENT, 6);
  });

  it("keeps y=0 at the north pole", () => {
    const nw = tileBounds3857(1, 0, 0);
    expect(nw.maxY).toBeCloseTo(MAX_MERCATOR_EXTENT, 6);
    expect(nw.minX).toBeCloseTo(-MAX_MERCATOR_EXTENT, 6);
  });

  it("lists intersecting tiles for a 1° cell", () => {
    const sw = lonLatToMercator(-81, 25);
    const ne = lonLatToMercator(-80, 26);
    const tiles = tilesForBbox(
      { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y },
      8,
    );
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.z === 8)).toBe(true);
  });

  it("expands bounds by buffer pixels", () => {
    const inner = tileBounds3857(3, 2, 1);
    const padded = bufferedTileBounds3857(3, 2, 1, 256, 1);
    expect(padded.minX).toBeLessThan(inner.minX);
    expect(padded.maxX).toBeGreaterThan(inner.maxX);
    const pad = (inner.maxX - inner.minX) / 256;
    expect(inner.minX - padded.minX).toBeCloseTo(pad, 6);
  });
});
