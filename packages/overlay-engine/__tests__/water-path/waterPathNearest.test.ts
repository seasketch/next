import { combineMetricsForFragments } from "../../src/metrics/metrics";

describe("combine distance_to_features_over_water", () => {
  it("keeps the closest hit for each feature id", () => {
    const line = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
    };
    const combined = combineMetricsForFragments(
      [
        {
          type: "distance_to_features_over_water",
          value: {
            features: [
              {
                __id: 1,
                meters: 5000,
                properties: { PORT_NAME: "Far" },
                geojsonLine: line,
              },
            ],
            exceededLimit: false,
          },
        },
        {
          type: "distance_to_features_over_water",
          value: {
            features: [
              {
                __id: 1,
                meters: 1200,
                properties: { PORT_NAME: "Near" },
                geojsonLine: line,
              },
            ],
            exceededLimit: true,
          },
        },
      ],
      "distance_to_features_over_water",
    );
    expect(combined.value.features).toHaveLength(1);
    expect(combined.value.features[0]?.meters).toBe(1200);
    expect(combined.value.features[0]?.properties.PORT_NAME).toBe("Near");
    expect(combined.value.exceededLimit).toBe(true);
  });
});
