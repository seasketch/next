import { describe, it, expect } from "vitest";
import { Feature, Polygon, MultiPolygon } from "geojson";
import { makeMultipolygon } from "../src/utils/utils";

describe("makeMultipolygon", () => {
  it("should convert a Polygon feature to a MultiPolygon feature", () => {
    const polygonFeature: Feature<Polygon> = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
      },
      properties: { name: "test" },
    };

    const result = makeMultipolygon(polygonFeature);

    expect(result.type).toBe("Feature");
    expect(result.geometry.type).toBe("MultiPolygon");
    expect(result.geometry.coordinates).toEqual([
      [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    ]);
    expect(result.properties).toEqual({ name: "test" });
  });

  it("should return a MultiPolygon feature unchanged", () => {
    const multiPolygonFeature: Feature<MultiPolygon> = {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0],
            ],
          ],
        ],
      },
      properties: { name: "test" },
    };

    const result = makeMultipolygon(multiPolygonFeature);

    expect(result).toEqual(multiPolygonFeature);
  });

  it("should preserve properties when converting Polygon to MultiPolygon", () => {
    const polygonFeature: Feature<Polygon> = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
      },
      properties: {
        name: "test",
        area: 100,
        metadata: { type: "test" },
      },
    };

    const result = makeMultipolygon(polygonFeature);

    expect(result.properties).toEqual(polygonFeature.properties);
  });
});
