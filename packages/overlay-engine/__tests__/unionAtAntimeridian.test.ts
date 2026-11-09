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
    // Stitching across ±180 must not take the long way around the globe.
    expect(maxLongitudeEdge(result)).toBeLessThan(5);
  });

  it("keeps a prime-meridian ring near longitude 0", () => {
    // Will's zone from issue 959: North Yorkshire coast to Hull, then east
    // into the North Sea. The ring crosses Greenwich and stays far from ±180.
    const primeMeridian: Feature<MultiPolygon> = {
      type: "Feature",
      properties: { name: "Will's zone" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-0.34, 53.76],
              [1.66, 54.06],
              [1.32, 54.94],
              [-0.83, 54.45],
              [-0.34, 53.76],
            ],
          ],
        ],
      },
    };

    const result = unionAtAntimeridian(primeMeridian);
    const longitudes = longitudesOf(result);

    expect(Math.min(...longitudes)).toBeCloseTo(-0.83, 5);
    expect(Math.max(...longitudes)).toBeCloseTo(1.66, 5);
    expect(maxLongitudeEdge(result)).toBeLessThan(5);
    expect(longitudes.some((longitude) => longitude > 180)).toBe(false);
  });

  it("does not move a western prime-meridian part to longitude 360", () => {
    const splitByLand: Feature<MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-2, 54],
              [-0.15, 54],
              [-0.15, 55],
              [-2, 55],
              [-2, 54],
            ],
          ],
          [
            [
              [0.15, 54],
              [2, 54],
              [2, 55],
              [0.15, 55],
              [0.15, 54],
            ],
          ],
        ],
      },
    };

    const result = unionAtAntimeridian(splitByLand);
    const longitudes = longitudesOf(result);

    expect(Math.min(...longitudes)).toBeCloseTo(-2, 5);
    expect(Math.max(...longitudes)).toBeCloseTo(2, 5);
    expect(maxLongitudeEdge(result)).toBeLessThan(5);
    expect(result.geometry.coordinates).toHaveLength(2);
  });

  it("leaves a western-hemisphere polygon west of Greenwich", () => {
    const hawaii: Feature<MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-155.86, 18.8],
              [-155.65, 18.8],
              [-155.65, 19.05],
              [-155.86, 19.05],
              [-155.86, 18.8],
            ],
          ],
        ],
      },
    };

    const result = unionAtAntimeridian(hawaii);
    const longitudes = longitudesOf(result);

    expect(Math.min(...longitudes)).toBeCloseTo(-155.86, 5);
    expect(Math.max(...longitudes)).toBeCloseTo(-155.65, 5);
  });

  it("stitches an antimeridian split without moving an unrelated prime-meridian part", () => {
    const mixed: Feature<MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          ...fijiSplit.geometry.coordinates,
          [
            [
              [-0.7, 53.8],
              [0.4, 53.8],
              [0.4, 54.2],
              [-0.7, 54.2],
              [-0.7, 53.8],
            ],
          ],
        ],
      },
    };

    const result = unionAtAntimeridian(mixed);
    const rings = (result.geometry as MultiPolygon).coordinates.map(
      (polygon) => polygon[0]
    );
    const ukRing = rings.find((ring) =>
      ring.some((position) => position[1] > 0)
    );
    const fijiRing = rings.find((ring) =>
      ring.some((position) => position[1] < 0)
    );

    expect(ukRing).toBeDefined();
    expect(fijiRing).toBeDefined();
    const ukLongitudes = ukRing!.map((position) => position[0]);
    expect(Math.min(...ukLongitudes)).toBeCloseTo(-0.7, 5);
    expect(Math.max(...ukLongitudes)).toBeCloseTo(0.4, 5);
    expect(maxLongitudeEdge(result)).toBeLessThan(5);
  });

  it("draws an antimeridian hop as a short edge past 180, not across the world", () => {
    // Auckland to Macauley Island. The geographic step is about 7°, but the
    // stored longitudes are 174° and -178°. Mapbox would paint the long way
    // around unless the western vertex is rewritten to about 182°.
    const hop: Feature<MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [174.76398, -36.9],
              [-178.43054, -36.9],
              [-178.43054, -36.8],
              [174.76398, -36.8],
              [174.76398, -36.9],
            ],
          ],
        ],
      },
    };

    const result = unionAtAntimeridian(hop);
    const longitudes = longitudesOf(result);

    expect(Math.max(...longitudes) - Math.min(...longitudes)).toBeLessThan(10);
    expect(maxLongitudeEdge(result)).toBeLessThan(10);
    expect(Math.max(...longitudes)).toBeGreaterThan(180);
  });

  it("leaves a prime-meridian hop in place", () => {
    // London to Birmingham. These longitudes are close to each other and far
    // from ±180, so rewriting them into 0..360 space would cross the globe.
    const hop: Feature<MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-0.12119, 51.5],
              [-1.92913, 51.5],
              [-1.92913, 52.5],
              [-0.12119, 52.5],
              [-0.12119, 51.5],
            ],
          ],
        ],
      },
    };

    const result = unionAtAntimeridian(hop);
    const longitudes = longitudesOf(result);

    expect(Math.min(...longitudes)).toBeGreaterThan(-2);
    expect(Math.max(...longitudes)).toBeLessThan(0);
    expect(maxLongitudeEdge(result)).toBeLessThan(2);
  });

  it("leaves a west-only antimeridian part in place when nothing meets it", () => {
    const westOnly: Feature<MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-180, -19],
              [-179, -19],
              [-179, -18],
              [-180, -18],
              [-180, -19],
            ],
          ],
        ],
      },
    };

    const result = unionAtAntimeridian(westOnly);
    const longitudes = longitudesOf(result);
    expect(Math.min(...longitudes)).toBeCloseTo(-180, 5);
    expect(Math.max(...longitudes)).toBeCloseTo(-179, 5);
  });
});

function longitudesOf(feature: Feature<Polygon | MultiPolygon>): number[] {
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  const longitudes: number[] = [];
  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach(([longitude]) => longitudes.push(longitude));
    });
  });
  return longitudes;
}

function maxLongitudeEdge(feature: Feature<Polygon | MultiPolygon>): number {
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  let maxEdge = 0;
  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      for (let index = 1; index < ring.length; index++) {
        maxEdge = Math.max(
          maxEdge,
          Math.abs(ring[index][0] - ring[index - 1][0])
        );
      }
    });
  });
  return maxEdge;
}
