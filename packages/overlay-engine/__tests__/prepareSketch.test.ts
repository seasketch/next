import { describe, it, expect } from "vitest";
import { Feature, Polygon, MultiPolygon, Position } from "geojson";
import { prepareSketch } from "../src/utils/prepareSketch";

describe("prepareSketch", () => {
  // Fiji (spans antimeridian)
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

  // Santa Cruz Island, Scorpion Anchorage (does not span antimeridian)
  const santaCruzPolygon: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      coordinates: [
        [
          [-119.58587240373465, 34.04280353222843],
          [-119.52338779103391, 34.04280353222843],
          [-119.52338779103391, 34.130980885369],
          [-119.58587240373465, 34.130980885369],
          [-119.58587240373465, 34.04280353222843],
        ],
      ],
      type: "Polygon",
    },
  };

  it("should throw error for feature with no geometry", () => {
    const feature = { type: "Feature", properties: {} } as Feature;
    expect(() => prepareSketch(feature)).toThrow("feature has no geometry");
  });

  it("should throw error for non-polygon geometry", () => {
    const feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
    } as Feature;
    expect(() => prepareSketch(feature)).toThrow(
      "feature geometry is not a polygon or multipolygon"
    );
  });

  it("should convert Polygon to MultiPolygon and handle simple case (Santa Cruz Island)", () => {
    const result = prepareSketch(santaCruzPolygon);

    expect(result.feature.type).toBe("Feature");
    expect(result.feature.geometry.type).toBe("MultiPolygon");
    expect(result.feature.properties).toEqual(santaCruzPolygon.properties);
    expect(result.envelopes).toHaveLength(1);

    // Verify the coordinates are properly wrapped in MultiPolygon structure
    expect(result.feature.geometry.coordinates).toEqual([
      santaCruzPolygon.geometry.coordinates,
    ]);
  });

  it("should handle antimeridian-crossing polygon (Fiji case)", () => {
    const result = prepareSketch(fijiPolygon);

    expect(result.feature.type).toBe("Feature");
    expect(result.feature.geometry.type).toBe("MultiPolygon");
    expect(result.feature.properties).toEqual(fijiPolygon.properties);

    // Should have multiple envelopes due to antimeridian split
    expect(result.envelopes.length).toBeGreaterThan(1);

    // Verify the coordinates are cleaned and split
    const allCoordinates: Position[] = [];
    result.feature.geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((coord) => {
          allCoordinates.push(coord);
        });
      });
    });
    allCoordinates.forEach(([x, y]) => {
      // Coordinates should be within valid ranges
      expect(x).toBeGreaterThanOrEqual(-180);
      expect(x).toBeLessThanOrEqual(180);
      expect(y).toBeGreaterThanOrEqual(-90);
      expect(y).toBeLessThanOrEqual(90);
    });
  });

  it("should preserve properties when converting to MultiPolygon", () => {
    const polygonWithProps: Feature<Polygon> = {
      type: "Feature",
      properties: {
        name: "test",
        area: 100,
        metadata: { type: "test" },
      },
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
    };

    const result = prepareSketch(polygonWithProps);
    expect(result.feature.properties).toEqual(polygonWithProps.properties);
  });

  it("should handle MultiPolygon input unchanged", () => {
    const multiPolygon: Feature<MultiPolygon> = {
      type: "Feature",
      properties: { name: "test" },
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
    };

    const result = prepareSketch(multiPolygon);
    expect(result.feature.geometry.type).toBe("MultiPolygon");
    expect(result.feature.properties).toEqual(multiPolygon.properties);
    expect(result.envelopes).toHaveLength(1);
  });

  it("should not mutate the original feature in-place", () => {
    const originalFeature: Feature<Polygon> = {
      type: "Feature",
      properties: {
        name: "original",
        area: 100,
        metadata: { type: "test" },
      },
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
    };

    // Create a deep copy to compare against
    const originalFeatureCopy = JSON.parse(JSON.stringify(originalFeature));

    const result = prepareSketch(originalFeature);

    // Verify the original feature is unchanged
    expect(originalFeature).toEqual(originalFeatureCopy);
    expect(originalFeature.geometry.type).toBe("Polygon");
    expect(originalFeature.properties.name).toBe("original");

    // Verify the result is a modified copy
    expect(result.feature.geometry.type).toBe("MultiPolygon");
    expect(result.feature).not.toBe(originalFeature);
    expect(result.feature.geometry).not.toBe(originalFeature.geometry);
    expect(result.feature.properties).not.toBe(originalFeature.properties);

    // Verify properties are preserved but in a new object (shallow copy)
    expect(result.feature.properties).toEqual(originalFeature.properties);

    // Verify the original feature's geometry coordinates are unchanged
    expect(originalFeature.geometry.coordinates).toEqual(
      originalFeatureCopy.geometry.coordinates
    );
  });

  it("should create shallow copy of properties (nested objects still reference original)", () => {
    const nestedObject = { type: "test", value: 42 };
    const originalFeature: Feature<Polygon> = {
      type: "Feature",
      properties: {
        name: "original",
        nested: nestedObject,
      },
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
    };

    const result = prepareSketch(originalFeature);

    // Verify the top-level properties object is copied
    expect(result.feature.properties).not.toBe(originalFeature.properties);

    // Verify nested objects still reference the original (shallow copy behavior)
    expect(result.feature.properties.nested).toBe(
      originalFeature.properties.nested
    );
    expect(result.feature.properties.nested).toBe(nestedObject);

    // Verify we can modify the nested object and it affects both
    result.feature.properties.nested.value = 100;
    expect(originalFeature.properties.nested.value).toBe(100);
    expect(nestedObject.value).toBe(100);
  });
});
