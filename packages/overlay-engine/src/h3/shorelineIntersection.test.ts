import { Feature, Polygon } from "geojson";
import { shorelineInsideSubject } from "./shorelineIntersection";

function square(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY],
        ],
      ],
    },
  };
}

describe("shorelineInsideSubject", () => {
  const land = square(0, 0, 4, 4);

  it("returns the land edge that crosses the subject", () => {
    const line = shorelineInsideSubject(square(3, 1, 6, 3), [land]);
    expect(line?.geometry.type).toBe("LineString");
    if (line?.geometry.type !== "LineString") return;
    const xs = line.geometry.coordinates.map((coord) => coord[0]);
    const ys = line.geometry.coordinates.map((coord) => coord[1]);
    expect(Math.min(...xs)).toBeCloseTo(4);
    expect(Math.max(...xs)).toBeCloseTo(4);
    expect(Math.min(...ys)).toBeCloseTo(1);
    expect(Math.max(...ys)).toBeCloseTo(3);
  });

  it("returns nothing when the subject sits inland of the shoreline", () => {
    expect(shorelineInsideSubject(square(1, 1, 2, 2), [land])).toBeNull();
  });

  it("keeps a shared boundary when the subject only touches land", () => {
    const line = shorelineInsideSubject(square(4, 1, 6, 3), [land]);
    expect(line?.geometry.type).toBe("LineString");
    if (line?.geometry.type !== "LineString") return;
    expect(line.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(line.geometry.coordinates[0]![0]).toBeCloseTo(4);
  });
});
