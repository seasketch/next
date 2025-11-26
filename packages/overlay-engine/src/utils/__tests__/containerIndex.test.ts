import { describe, it, expect } from "vitest";
import { ContainerIndex } from "../containerIndex";
import type {
  Feature,
  Polygon,
  LineString,
  MultiLineString,
} from "geojson";

const square: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  },
};

const index = new ContainerIndex(square);

describe("ContainerIndex classify - linear features", () => {
  it("returns inside for a LineString fully within the container", () => {
    const insideLine: Feature<LineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [2, 2],
          [8, 2],
        ],
      },
    };

    expect(index.classify(insideLine)).toBe("inside");
  });

  it("returns outside for a LineString completely outside the container", () => {
    const outsideLine: Feature<LineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [20, 20],
          [25, 25],
        ],
      },
    };

    expect(index.classify(outsideLine)).toBe("outside");
  });

  it("returns mixed for a MultiLineString with both inside and outside parts", () => {
    const multiLine: Feature<MultiLineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [2, 2],
            [3, 3],
          ],
          [
            [12, 12],
            [13, 13],
          ],
        ],
      },
    };

    expect(index.classify(multiLine)).toBe("mixed");
  });

  it("detects boundary crossings for LineStrings that exit the container", () => {
    const crossingLine: Feature<LineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [5, 5],
          [15, 15],
        ],
      },
    };

    expect(index.classify(crossingLine)).toBe("mixed");
  });
});

