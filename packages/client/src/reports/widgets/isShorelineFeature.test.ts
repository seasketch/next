import { isShorelineFeature, shorelineLines } from "./isShorelineFeature";

describe("isShorelineFeature", () => {
  const line = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
  };

  it("rejects null, undefined, and non-objects", () => {
    expect(isShorelineFeature(null)).toBe(false);
    expect(isShorelineFeature(undefined)).toBe(false);
    expect(isShorelineFeature("line")).toBe(false);
    expect(isShorelineFeature(4)).toBe(false);
  });

  it("accepts a linestring and a multilinestring", () => {
    expect(isShorelineFeature(line)).toBe(true);
    expect(
      isShorelineFeature({
        type: "Feature",
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [0, 0],
              [1, 0],
            ],
          ],
        },
      })
    ).toBe(true);
    expect(shorelineLines(line)).toHaveLength(1);
  });
});