import { distancePathReportStyle } from "./distancePathStyle";

const line = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { kind: "path", rank: 0, distance: "12 km" },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
    },
  ],
};

describe("distancePathReportStyle", () => {
  it("includes the route, endpoints, and shoreline layers", () => {
    const style = distancePathReportStyle({ collection: line });
    const ids = style.layers.map((layer) => layer.id);
    expect(ids).toEqual([
      "distance-path-casing",
      "distance-path",
      "distance-path-distance",
      "distance-path-origin",
      "distance-path-dest",
      "distance-path-label",
      "distance-path-shoreline-halo",
      "distance-path-shoreline",
      "distance-path-shoreline-label",
    ]);
    expect(style.sources["distance-path"]).toBeDefined();
    expect(style.sources["distance-path-sketch"]).toBeUndefined();
  });

  it("adds the sketch source when a geometry URL is provided", () => {
    const style = distancePathReportStyle({
      collection: line,
      sketchGeojsonUrl: "https://example.test/sketch.geojson",
      basemap: "satellite",
    });
    expect(style.sources["distance-path-sketch"]).toMatchObject({
      type: "geojson",
      data: "https://example.test/sketch.geojson",
    });
    expect(style.layers[0].id).toBe("distance-path-sketch-fill");
    const shoreline = style.layers.find(
      (layer) => layer.id === "distance-path-shoreline"
    );
    expect(shoreline && "paint" in shoreline && shoreline.paint).toMatchObject({
      "line-width": 5,
    });
  });
});
