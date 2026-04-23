import * as overlayEngine from "overlay-engine";
import { SpatialMetricState } from "../../generated/graphql";
import { combinePresenceTableMetrics } from "./IntersectingFeaturesList.utils";

describe("combinePresenceTableMetrics", () => {
  test("combines presence table metrics and preserves maxResults", () => {
    const result = combinePresenceTableMetrics(
      [
        {
          id: "1",
          type: "presence_table",
          state: SpatialMetricState.Complete,
          subject: {
            __typename: "FragmentSubject",
            hash: "fragment-1",
            sketches: [1],
            geographies: [10],
          },
          parameters: {
            maxResults: 12,
          },
          value: {
            values: [
              { __id: 1, name: "Feature 1" },
              { __id: 2, name: "Feature 2" },
            ],
            exceededLimit: false,
          },
        },
        {
          id: "2",
          type: "presence_table",
          state: SpatialMetricState.Complete,
          subject: {
            __typename: "FragmentSubject",
            hash: "fragment-2",
            sketches: [2],
            geographies: [10],
          },
          parameters: {
            maxResults: 12,
          },
          value: {
            values: [
              { __id: 2, name: "Feature 2" },
              { __id: 3, name: "Feature 3" },
            ],
            exceededLimit: true,
          },
        },
      ] as any,
      false
    );

    expect(result.maxResults).toBe(12);
    expect(result.exceededLimit).toBe(true);
    expect(result.values.map((value) => value.__id)).toEqual([1, 2, 3]);
    expect(result.combineError).toBeUndefined();
  });

  test("returns a visible error state when combination fails", () => {
    const combineSpy = jest
      .spyOn(overlayEngine, "combineMetricsForFragments")
      .mockImplementation(() => {
        throw new Error("presence table combine failed");
      });

    try {
      const result = combinePresenceTableMetrics(
        [
          {
            id: "1",
            type: "presence_table",
            state: SpatialMetricState.Complete,
            subject: {
              __typename: "FragmentSubject",
              hash: "fragment-1",
              sketches: [1],
              geographies: [10],
            },
            parameters: {
              maxResults: 7,
            },
            value: {
              values: [{ __id: 1, name: "Feature 1" }],
              exceededLimit: false,
            },
          },
        ] as any,
        false
      );

      expect(result.values).toEqual([]);
      expect(result.maxResults).toBe(7);
      expect(result.combineError).toBe("presence table combine failed");
    } finally {
      combineSpy.mockRestore();
    }
  });
});
