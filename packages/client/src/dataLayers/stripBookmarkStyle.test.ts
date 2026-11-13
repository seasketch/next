import { describe, expect, it } from "@jest/globals";
import { stripEphemeralLayers } from "./stripBookmarkStyle";

describe("stripEphemeralLayers", () => {
  it("keeps the basemap and the overlay, and drops sketch and draw layers", () => {
    const style = {
      layers: [
        { id: "basemap", source: "basemap" },
        { id: "overlay-a", source: "overlay-1" },
        { id: "sketch-class-4", source: "sketch-class-4" },
        { id: "gl-draw-line", source: "mapbox-gl-draw-cold" },
        { id: "filter-layer-1", source: "filter-src" },
        { id: "all-cells", source: "all-cells" },
        { id: "a-sketch", source: "sketch-9" },
      ],
      sources: {
        basemap: { type: "raster" },
        "overlay-1": { type: "vector" },
        "sketch-class-4": { type: "geojson" },
        "mapbox-gl-draw-cold": { type: "geojson" },
        "filter-src": { type: "vector" },
        "all-cells": { type: "geojson" },
        "sketch-9": { type: "geojson" },
        "terrain-source": { type: "raster-dem" },
      },
      terrain: { source: "terrain-source" },
    };
    const next = stripEphemeralLayers(style, ["sketch-class-4"]);
    expect(next.layers?.map((layer) => layer.id)).toEqual([
      "basemap",
      "overlay-a",
    ]);
    expect(Object.keys(next.sources || {}).sort()).toEqual([
      "basemap",
      "overlay-1",
      "terrain-source",
    ]);
    expect(style.layers).toHaveLength(7);
  });
});
