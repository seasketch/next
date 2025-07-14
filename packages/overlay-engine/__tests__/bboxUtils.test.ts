import { describe, it, expect } from "vitest";
import { Feature, Polygon, MultiPolygon, BBox } from "geojson";
import {
  bboxForFeature,
  splitBBoxAntimeridian,
  cleanBBox,
  bboxToEnvelope,
} from "../src/utils/bboxUtils";

describe("bboxUtils", () => {
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

  describe("bboxForFeature", () => {
    it("should handle a polygon that crosses the antimeridian", () => {
      const bbox = bboxForFeature(fijiPolygon);
      // The bbox should be adjusted to handle the antimeridian crossing
      expect(bbox[0]).toBeLessThan(-179); // minX should be less than -179
      expect(bbox[2]).toBeGreaterThan(-179); // maxX should be greater than -179
      expect(bbox[1]).toBeCloseTo(-19.79323973503641); // minY
      expect(bbox[3]).toBeCloseTo(-18.239142587280796); // maxY
    });

    it("should handle a simple polygon not crossing the antimeridian", () => {
      const simplePolygon: Feature<Polygon> = {
        type: "Feature",
        properties: {},
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
      const bbox = bboxForFeature(simplePolygon);
      expect(bbox).toEqual([0, 0, 1, 1]);
    });

    it("should handle a MultiPolygon", () => {
      const multiPolygon: Feature<MultiPolygon> = {
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
      const bbox = bboxForFeature(multiPolygon);
      expect(bbox).toEqual([0, 0, 3, 3]);
    });
  });

  describe("splitBBoxAntimeridian", () => {
    it("should split a bbox that crosses the antimeridian", () => {
      const bbox: BBox = [170, -20, -170, 20, 0, 0];
      const result = splitBBoxAntimeridian(bbox);
      expect(result).toEqual([
        [170, -20, 180, 20],
        [-180, -20, -170, 20],
      ]);
    });

    it("should not split a bbox that does not cross the antimeridian", () => {
      const bbox: BBox = [0, 0, 10, 10, 0, 0];
      const result = splitBBoxAntimeridian(bbox);
      expect(result).toEqual([bbox]);
    });
  });

  describe("cleanBBox", () => {
    it("should normalize longitudes to [-180, 180] range", () => {
      const bbox: BBox = [190, -20, 200, 20, 0, 0];
      const result = cleanBBox(bbox);
      expect(result[0]).toBeGreaterThanOrEqual(-180);
      expect(result[0]).toBeLessThanOrEqual(180);
      expect(result[2]).toBeGreaterThanOrEqual(-180);
      expect(result[2]).toBeLessThanOrEqual(180);
    });

    it("should handle negative longitudes", () => {
      const bbox: BBox = [-190, -20, -180, 20, 0, 0];
      const result = cleanBBox(bbox);
      expect(result[0]).toBeGreaterThanOrEqual(-180);
      expect(result[0]).toBeLessThanOrEqual(180);
      expect(result[2]).toBeGreaterThanOrEqual(-180);
      expect(result[2]).toBeLessThanOrEqual(180);
    });

    it("should preserve valid longitudes", () => {
      const bbox: BBox = [-90, -45, 90, 45, 0, 0];
      const result = cleanBBox(bbox);
      expect(result).toEqual([-90, -45, 90, 45]);
    });
  });

  describe("bboxToEnvelope", () => {
    it("should convert a bbox array to an envelope object", () => {
      const bbox: BBox = [0, 0, 10, 10, 0, 0];
      const result = bboxToEnvelope(bbox);
      expect(result).toEqual({
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10,
      });
    });

    it("should handle negative coordinates", () => {
      const bbox: BBox = [-10, -10, 10, 10, 0, 0];
      const result = bboxToEnvelope(bbox);
      expect(result).toEqual({
        minX: -10,
        minY: -10,
        maxX: 10,
        maxY: 10,
      });
    });
  });
});
