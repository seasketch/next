import { Feature, LineString } from "geojson";
import { shoreExtremes, shoreSketchGroups } from "./distanceToShoreGroups";

function line(from: number): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [from, 0],
        [from + 1, 1],
      ],
    },
  };
}

function metric(
  sketchIds: number[],
  meters: number,
  options?: { path?: boolean; shore?: boolean }
) {
  return {
    type: "distance_to_shore",
    value: {
      meters,
      geojsonLine: options?.path === false ? null : line(meters),
      shorelineIntersection: options?.shore ? line(0) : null,
    },
    subject: {
      hash: sketchIds.map(String).join("-"),
      geographies: [] as number[],
      sketches: sketchIds,
    },
  };
}

describe("shoreSketchGroups", () => {
  it("keeps the closest shore for a single sketch", () => {
    const groups = shoreSketchGroups({
      isCollection: false,
      childSketches: [],
      metrics: [metric([1], 5000), metric([1], 1200), metric([1], 3000)],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sketchId).toBeNull();
    expect(groups[0]?.meters).toBe(1200);
    expect(groups[0]?.path).not.toBeNull();
  });

  it("keeps each child sketch on a collection", () => {
    const groups = shoreSketchGroups({
      isCollection: true,
      childSketches: [
        { id: 10, name: "Offshore" },
        { id: 11, name: "Nearshore" },
      ],
      metrics: [metric([10], 8000), metric([11], 400)],
    });
    expect(groups.map((group) => group.sketchName)).toEqual([
      "Offshore",
      "Nearshore",
    ]);
    expect(groups.map((group) => group.meters)).toEqual([8000, 400]);
  });

  it("keeps a shoreline overlap when that sketch meets land", () => {
    const groups = shoreSketchGroups({
      isCollection: true,
      childSketches: [
        { id: 10, name: "On shore" },
        { id: 11, name: "Offshore" },
      ],
      metrics: [
        metric([10], 0, { path: false, shore: true }),
        metric([10], 9000),
        metric([11], 2500),
      ],
    });
    expect(groups[0]?.meters).toBe(0);
    expect(groups[0]?.path).toBeNull();
    expect(groups[0]?.shoreLines).toHaveLength(1);
    expect(groups[1]?.meters).toBe(2500);
    expect(groups[1]?.path).not.toBeNull();
  });

  it("drops a route that has no line", () => {
    const groups = shoreSketchGroups({
      isCollection: false,
      childSketches: [],
      metrics: [metric([1], 1000, { path: false })],
    });
    expect(groups).toEqual([]);
  });

  it("ignores null, undefined, and other metric types", () => {
    const groups = shoreSketchGroups({
      isCollection: false,
      childSketches: [],
      metrics: [
        { type: "distance_to_shore", value: null, subject: null },
        { type: "distance_to_shore" },
        { type: "total_area", value: { meters: 10 } },
        metric([1], 1500),
      ],
    });
    expect(groups.map((group) => group.meters)).toEqual([1500]);
  });

  it("reports the closest and furthest sketches", () => {
    const groups = shoreSketchGroups({
      isCollection: true,
      childSketches: [
        { id: 1, name: "Far" },
        { id: 2, name: "Near" },
      ],
      metrics: [metric([1], 9000), metric([2], 100)],
    });
    const extremes = shoreExtremes(groups);
    expect(extremes?.min.sketchName).toBe("Near");
    expect(extremes?.max.sketchName).toBe("Far");
    expect(shoreExtremes([])).toBeNull();
  });
});
