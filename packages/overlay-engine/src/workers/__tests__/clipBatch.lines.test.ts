import { describe, it, expect } from "vitest";
import type { Feature, LineString, MultiLineString, Polygon } from "geojson";
import type { FeatureWithMetadata } from "fgb-source";
import type { Geom } from "polyclip-ts";
import turfLength from "@turf/length";

import { calculatedClippedOverlapSize } from "../clipBatch";

type LineFeature = FeatureWithMetadata<Feature<LineString | MultiLineString>>;

const subjectFeature: Feature<Polygon> = {
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

const differenceSquare: Geom = [
  [
    [0.4, 0.4],
    [0.6, 0.4],
    [0.6, 0.6],
    [0.4, 0.6],
    [0.4, 0.4],
  ],
];

function createLineFeature(
  coordinates: LineString["coordinates"]
): LineFeature {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates,
    },
    properties: {
      __byteLength: 0,
      __offset: 0,
    },
  };
}

describe("calculatedClippedOverlapSize - linear features", () => {
  it("clips line strings to the subject feature when intersection is required", () => {
    const features = [
      {
        feature: createLineFeature([
          [-0.5, 0.5],
          [1.5, 0.5],
        ]),
        requiresIntersection: true,
        requiresDifference: false,
      },
    ];

    const result = calculatedClippedOverlapSize(features, [], subjectFeature);

    const expected = turfLength({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0.5],
          [1, 0.5],
        ],
      },
      properties: {},
    });

    expect(result).toBeCloseTo(expected, 6);
  });

  it("subtracts overlap with difference polygons", () => {
    const features = [
      {
        feature: createLineFeature([
          [-0.5, 0.5],
          [1.5, 0.5],
        ]),
        requiresIntersection: true,
        requiresDifference: true,
      },
    ];

    const result = calculatedClippedOverlapSize(
      features,
      [differenceSquare],
      subjectFeature
    );

    const expected = turfLength({
      type: "Feature",
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [0, 0.5],
            [0.4, 0.5],
          ],
          [
            [0.6, 0.5],
            [1, 0.5],
          ],
        ],
      },
      properties: {},
    });

    expect(result).toBeCloseTo(expected, 6);
  });

  it("applies difference-only masking when intersection is not required", () => {
    const features = [
      {
        feature: createLineFeature([
          [0, 0.5],
          [1, 0.5],
        ]),
        requiresIntersection: false,
        requiresDifference: true,
      },
    ];

    const result = calculatedClippedOverlapSize(
      features,
      [differenceSquare],
      subjectFeature
    );

    const expected = turfLength({
      type: "Feature",
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [0, 0.5],
            [0.4, 0.5],
          ],
          [
            [0.6, 0.5],
            [1, 0.5],
          ],
        ],
      },
      properties: {},
    });

    expect(result).toBeCloseTo(expected, 6);
  });

  it("handles diagonal segments that touch boundaries without losing length", () => {
    const features = [
      {
        feature: createLineFeature([
          [-0.5, -0.5],
          [1.5, 1.5],
        ]),
        requiresIntersection: true,
        requiresDifference: false,
      },
    ];

    const result = calculatedClippedOverlapSize(features, [], subjectFeature);

    const expected = turfLength({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    });

    expect(result).toBeCloseTo(expected, 6);
  });
});
