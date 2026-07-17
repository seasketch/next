import type { FeatureCollection, Polygon } from "geojson";

export const propertiesFixture: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Alpha", category: "one", rank: 1 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [170, 0],
          [-170, 0],
          [-170, 10],
          [170, 10],
          [170, 0],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Beta", category: "two", rank: 2 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ]],
      },
    },
  ],
};
