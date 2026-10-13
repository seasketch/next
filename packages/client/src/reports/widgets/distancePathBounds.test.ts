import {
  boundsExpandedByKm,
  positionsInGeojson,
  shiftLongitudesToShortArc,
} from "./distancePathBounds";

function span(points: Array<[number, number]>): number {
  const lngs = points.map((point) => point[0]);
  return Math.max(...lngs) - Math.min(...lngs);
}

describe("shiftLongitudesToShortArc", () => {
  it("keeps a dateline cluster on the short arc, including longitudes past ±180", () => {
    const shifted = shiftLongitudesToShortArc([
      [179.54, -15.7],
      [179.37, -16.35],
      [-179.97, -15.71],
      [-180.67, -16.77],
      [-181.17, -17.68],
    ]);
    expect(span(shifted)).toBeLessThan(5);
    expect(Math.min(...shifted.map((point) => point[0]))).toBeGreaterThan(170);
    expect(Math.max(...shifted.map((point) => point[0]))).toBeLessThan(190);
  });

  it("shifts an east-to-west crossing into one window past 180", () => {
    const shifted = shiftLongitudesToShortArc([
      [177.5, -18],
      [183, -16],
    ]);
    expect(span(shifted)).toBeCloseTo(5.5);
    expect(Math.min(...shifted.map((point) => point[0]))).toBeCloseTo(177.5);
    expect(Math.max(...shifted.map((point) => point[0]))).toBeCloseTo(183);
  });

  it("leaves a route that does not cross the antimeridian where it is", () => {
    const east = shiftLongitudesToShortArc([
      [174, -16],
      [178, -18],
    ]);
    expect(east.map((point) => point[0])).toEqual([174, 178]);

    const west = shiftLongitudesToShortArc([
      [-175, -16],
      [-170, -18],
    ]);
    expect(west.map((point) => point[0])).toEqual([-175, -170]);
  });

  it("covers New Zealand to Fiji the short way", () => {
    const shifted = shiftLongitudesToShortArc([
      [170, -40],
      [-170, -35],
    ]);
    expect(span(shifted)).toBeCloseTo(20);
  });

  it("treats 180 and -180 as the same meridian", () => {
    const shifted = shiftLongitudesToShortArc([
      [179, -16],
      [180, -16],
      [-180, -16],
    ]);
    expect(span(shifted)).toBeCloseTo(1);
  });

  it("returns an empty list and a single point unchanged in latitude", () => {
    expect(shiftLongitudesToShortArc([])).toEqual([]);
    expect(shiftLongitudesToShortArc([[183, -16]])).toEqual([[-177, -16]]);
  });
});

describe("positionsInGeojson", () => {
  it("ignores null, undefined, and non-geometry values", () => {
    expect(positionsInGeojson(null)).toEqual([]);
    expect(positionsInGeojson(undefined)).toEqual([]);
    expect(positionsInGeojson("sketch")).toEqual([]);
    expect(positionsInGeojson(4)).toEqual([]);
  });

  it("reads a feature collection and skips a feature bbox", () => {
    expect(
      positionsInGeojson({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            bbox: [0, 0, 9, 9],
            geometry: { type: "Point", coordinates: [5, 6] },
          },
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [1, 2],
                  [3, 4],
                  [1, 2],
                ],
              ],
            },
          },
        ],
      })
    ).toEqual([
      [5, 6],
      [1, 2],
      [3, 4],
      [1, 2],
    ]);
  });
});

describe("boundsExpandedByKm", () => {
  it("grows a point by about one degree of latitude per 110.574 km", () => {
    const corners = boundsExpandedByKm([[0, 0]], 110.574);
    expect(corners).not.toBeNull();
    expect(corners![0][1]).toBeCloseTo(-1);
    expect(corners![1][1]).toBeCloseTo(1);
    expect(corners![1][0] - corners![0][0]).toBeCloseTo(
      (110.574 / 111.32) * 2
    );
  });

  it("keeps a dateline sketch on the short arc", () => {
    const corners = boundsExpandedByKm(
      [
        [179, -16],
        [-179, -16],
      ],
      11
    );
    expect(corners).not.toBeNull();
    const width = corners![1][0] - corners![0][0];
    expect(width).toBeGreaterThan(2);
    expect(width).toBeLessThan(10);
  });

  it("returns null without positions or with a negative radius", () => {
    expect(boundsExpandedByKm([], 10)).toBeNull();
    expect(boundsExpandedByKm([[0, 0]], -1)).toBeNull();
    expect(boundsExpandedByKm([[Number.NaN, 0]], 10)).toBeNull();
  });
});
