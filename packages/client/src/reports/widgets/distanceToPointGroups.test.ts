import { Feature, LineString } from "geojson";
import { distanceExtremes, distanceSketchGroups } from "./distanceToPointGroups";

function line(): Feature<LineString> {
  return {
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
}

function metric(
  sketchIds: number[],
  features: Array<{
    __id: number;
    meters: number;
    name: string;
    geojsonLine?: unknown;
  }>
) {
  return {
    type: "distance_to_features_over_water" as const,
    value: {
      exceededLimit: false,
      features: features.map((feature) => ({
        __id: feature.__id,
        meters: feature.meters,
        properties: { PORT_NAME: feature.name },
        geojsonLine: feature.geojsonLine ?? line(),
      })),
    },
    subject: {
      hash: sketchIds.map(String).join("-"),
      geographies: [] as number[],
      sketches: sketchIds,
    },
  };
}

describe("distanceSketchGroups", () => {
  it("keeps the closest hit per feature for a single sketch", () => {
    const groups = distanceSketchGroups({
      isCollection: false,
      childSketches: [],
      metrics: [
        metric([1], [{ __id: 1, meters: 5000, name: "Far" }]),
        metric([1], [{ __id: 1, meters: 1200, name: "Near" }]),
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sketchId).toBeNull();
    expect(groups[0]?.routes.map((route) => route.feature.meters)).toEqual([
      1200,
    ]);
    expect(groups[0]?.routes[0]?.feature.properties.PORT_NAME).toBe("Near");
  });

  it("keeps each child sketch's route on a collection", () => {
    const groups = distanceSketchGroups({
      isCollection: true,
      childSketches: [
        { id: 10, name: "BSPR Test 3" },
        { id: 11, name: "Chad's Test MPA" },
      ],
      metrics: [
        metric([10], [{ __id: 7, meters: 413600, name: "SUVA HARBOR" }]),
        metric([11], [{ __id: 7, meters: 75600, name: "SUVA HARBOR" }]),
      ],
    });
    expect(groups.map((group) => group.sketchName)).toEqual([
      "BSPR Test 3",
      "Chad's Test MPA",
    ]);
    expect(groups.map((group) => group.routes[0]?.feature.meters)).toEqual([
      413600, 75600,
    ]);
  });

  it("lists a sketch's matches nearest first", () => {
    const groups = distanceSketchGroups({
      isCollection: true,
      childSketches: [{ id: 10, name: "North" }],
      metrics: [
        metric(
          [10],
          [
            { __id: 2, meters: 8000, name: "Far port" },
            { __id: 1, meters: 2000, name: "Near port" },
          ]
        ),
      ],
    });
    expect(groups[0]?.routes.map((route) => route.feature.meters)).toEqual([
      2000, 8000,
    ]);
  });

  it("repeats a shared fragment under each sketch that owns it", () => {
    const groups = distanceSketchGroups({
      isCollection: true,
      childSketches: [
        { id: 10, name: "A" },
        { id: 11, name: "B" },
      ],
      metrics: [metric([10, 11], [{ __id: 1, meters: 3000, name: "Port" }])],
    });
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.routes[0]?.feature.meters === 3000)).toBe(
      true
    );
  });

  it("drops a sketch whose only hit is not a route line", () => {
    const groups = distanceSketchGroups({
      isCollection: true,
      childSketches: [
        { id: 10, name: "Broken" },
        { id: 11, name: "Ok" },
      ],
      metrics: [
        metric(
          [10],
          [
            {
              __id: 1,
              meters: 1000,
              name: "Port",
              geojsonLine: { type: "Feature", properties: {}, geometry: null },
            },
          ]
        ),
        metric([11], [{ __id: 1, meters: 2000, name: "Port" }]),
      ],
    });
    expect(groups.map((group) => group.sketchName)).toEqual(["Ok"]);
  });

  it("ignores null subjects, other metric types, and sketches outside the collection", () => {
    const groups = distanceSketchGroups({
      isCollection: true,
      childSketches: [{ id: 10, name: "In" }],
      metrics: [
        { type: "total_area", value: 1, subject: null },
        {
          type: "distance_to_features_over_water",
          value: null,
          subject: { hash: "empty", geographies: [], sketches: [10] },
        },
        metric([99], [{ __id: 1, meters: 500, name: "Other" }]),
        metric([10], [{ __id: 1, meters: 1500, name: "Port" }]),
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.routes[0]?.feature.meters).toBe(1500);
  });

  it("returns one empty group for a sketch and none for an empty collection", () => {
    expect(
      distanceSketchGroups({
        isCollection: false,
        childSketches: [],
        metrics: [],
      })
    ).toEqual([{ sketchId: null, sketchName: null, routes: [] }]);
    expect(
      distanceSketchGroups({
        isCollection: true,
        childSketches: [{ id: 10, name: "Empty" }],
        metrics: [],
      })
    ).toEqual([]);
  });
});

describe("distanceExtremes", () => {
  it("returns null when there are no routes", () => {
    expect(distanceExtremes([])).toBeNull();
  });

  it("picks the closest and furthest routes", () => {
    const groups = distanceSketchGroups({
      isCollection: true,
      childSketches: [
        { id: 10, name: "Far" },
        { id: 11, name: "Near" },
      ],
      metrics: [
        metric([10], [{ __id: 1, meters: 9000, name: "Port" }]),
        metric([11], [{ __id: 1, meters: 1000, name: "Port" }]),
      ],
    });
    const extremes = distanceExtremes(groups);
    expect(extremes?.min.sketchName).toBe("Near");
    expect(extremes?.min.feature.meters).toBe(1000);
    expect(extremes?.max.sketchName).toBe("Far");
    expect(extremes?.max.feature.meters).toBe(9000);
  });
});
