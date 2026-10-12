import { shiftLongitudesToShortArc } from "./distancePathBounds";

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
