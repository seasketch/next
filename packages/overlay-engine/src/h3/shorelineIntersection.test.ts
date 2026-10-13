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

  it("rounds a cloud of clipped land edges down to a short highlight", () => {
    const lands: Feature<Polygon>[] = [];
    for (let i = 0; i < 800; i++) {
      const x = i * 0.004;
      lands.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [x, -1],
              [x + 0.002, -1],
              [x + 0.002, 0.002],
              [x, 0.002],
              [x, -1],
            ],
          ],
        },
      });
    }
    const line = shorelineInsideSubject(square(0, 0, 4, 1), lands);
    const count =
      line?.geometry.type === "LineString"
        ? line.geometry.coordinates.length
        : line?.geometry.type === "MultiLineString"
          ? line.geometry.coordinates.reduce((sum, part) => sum + part.length, 0)
          : 0;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(400);
  });

  it("simplifies a long zigzag coastline to a short line", () => {
    const coast: [number, number][] = [[0, -0.1]];
    for (let i = 0; i < 12_000; i++) {
      coast.push([i % 2 === 0 ? 1 : 1.01, -0.1 + (i * 1.2) / 12_000]);
    }
    coast.push([0, 1.1], [0, -0.1]);
    const land: Feature<Polygon> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [coast] },
    };
    const line = shorelineInsideSubject(square(0.5, 0, 3, 1), [land]);
    expect(line?.geometry.type).toBe("LineString");
    if (line?.geometry.type !== "LineString") return;
    expect(line.geometry.coordinates.length).toBeLessThan(100);
    const ys = line.geometry.coordinates.map((coord) => coord[1]!);
    expect(Math.min(...ys)).toBeCloseTo(0, 1);
    expect(Math.max(...ys)).toBeCloseTo(1, 1);
  });

  it("keeps a shared boundary when the subject only touches land", () => {
    const line = shorelineInsideSubject(square(4, 1, 6, 3), [land]);
    expect(line?.geometry.type).toBe("LineString");
    if (line?.geometry.type !== "LineString") return;
    expect(line.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(line.geometry.coordinates[0]![0]).toBeCloseTo(4);
  });
});
