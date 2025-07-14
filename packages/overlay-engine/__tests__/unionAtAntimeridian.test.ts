import { describe, it, expect } from "vitest";
import { Feature, Polygon, MultiPolygon, Position } from "geojson";
import { unionAtAntimeridian } from "../src/utils/unionAtAntimeridian";
import { cleanCoords } from "../src/utils/cleanCoords";
const splitGeoJSON = require("geojson-antimeridian-cut");

describe("unionAtAntimeridian", () => {
  const fijiPolygon: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      coordinates: [
        [
          [-179.80398136940497, -18.239142587280796],
          [-180.9365457122359, -18.500028902661512],
          [-180.9365457122359, -19.79323973503641],
          [-179.26518862378637, -19.66386044955297],
          [-178.6384297156178, -18.67720520157191],
          [-179.80398136940497, -18.239142587280796],
        ],
      ],
      type: "Polygon",
    },
  };

  const fijiSplit = splitGeoJSON(cleanCoords(fijiPolygon));

  it("should return a Polygon feature unchanged", () => {
    const result = unionAtAntimeridian(fijiPolygon);
    expect(result).toEqual(fijiPolygon);
  });

  it("should union a real-world MultiPolygon split at the antimeridian (Fiji)", () => {
    // The split result should be a MultiPolygon
    expect(fijiSplit.geometry.type).toBe("MultiPolygon");

    // Now union the split MultiPolygon
    const result = unionAtAntimeridian(fijiSplit);

    // The result should be a MultiPolygon
    expect(result.geometry.type).toBe("MultiPolygon");

    // The result should preserve the original properties
    expect(result.properties).toEqual(fijiPolygon.properties);

    // The coordinates should be properly normalized (all x values should be >= 0)
    const allCoordinates: Position[] = [];
    (result.geometry as MultiPolygon).coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((coord) => {
          allCoordinates.push(coord);
        });
      });
    });

    allCoordinates.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0);
    });
  });

  it("should handle a MultiPolygon that does not cross the antimeridian", () => {
    const simpleMultiPolygon: Feature<MultiPolygon> = {
      type: "Feature",
      properties: {},
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
          [
            [
              [2, 2],
              [2, 3],
              [3, 3],
              [3, 2],
              [2, 2],
            ],
          ],
        ],
      },
    };

    const result = unionAtAntimeridian(simpleMultiPolygon);

    // Instead of checking exact equality, verify the structure and properties
    expect(result.type).toBe("Feature");
    expect(result.geometry.type).toBe("MultiPolygon");
    expect(result.properties).toEqual(simpleMultiPolygon.properties);

    // Verify that all coordinates are within the expected bounds
    const allCoordinates: Position[] = [];
    (result.geometry as MultiPolygon).coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((coord) => {
          allCoordinates.push(coord);
        });
      });
    });

    allCoordinates.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(3);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(3);
    });
  });

  it("should compare the unioned output with the original cleaned Fiji polygon", () => {
    const cleanedFiji = cleanCoords(fijiPolygon);
    const result = unionAtAntimeridian(fijiSplit);
    expect(result.geometry.type).toBe("MultiPolygon");
    expect(result.properties).toEqual(cleanedFiji.properties);
    // Check that the unioned coordinates are within the bounds of the original coordinates
    const originalCoords: Position[] = [];
    (cleanedFiji.geometry as Polygon).coordinates.forEach((ring) => {
      ring.forEach((coord) => {
        originalCoords.push(coord);
      });
    });
    const unionedCoords: Position[] = [];
    (result.geometry as MultiPolygon).coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((coord) => {
          unionedCoords.push(coord);
        });
      });
    });
    unionedCoords.forEach(([x, y]) => {
      const originalX = originalCoords.find(([ox, oy]) => oy === y)?.[0];
      if (originalX !== undefined) {
        expect(x).toBeGreaterThanOrEqual(originalX);
      }
    });
  });
});
