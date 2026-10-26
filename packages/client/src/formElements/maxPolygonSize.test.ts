import { SketchGeometryType } from "../generated/graphql";
import {
  effectiveMaxPolygonSizeSqKm,
  formatSqKm,
  parseMaxPolygonSizeSqKm,
  polygonAreaSqKm,
  polygonSaveViolation,
  polygonSizeViolation,
  shouldAdvanceFromDrawingIntro,
} from "./maxPolygonSize";

const square = (size: number) => ({
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [size, 0],
        [size, size],
        [0, size],
        [0, 0],
      ],
    ],
  },
});

describe("parseMaxPolygonSizeSqKm", () => {
  it("accepts positive finite numbers", () => {
    expect(parseMaxPolygonSizeSqKm(2.5)).toBe(2.5);
  });

  it("treats empty and non-positive values as no limit", () => {
    expect(parseMaxPolygonSizeSqKm(undefined)).toBeUndefined();
    expect(parseMaxPolygonSizeSqKm(null)).toBeUndefined();
    expect(parseMaxPolygonSizeSqKm(0)).toBeUndefined();
    expect(parseMaxPolygonSizeSqKm(-4)).toBeUndefined();
    expect(parseMaxPolygonSizeSqKm(Number.NaN)).toBeUndefined();
    expect(parseMaxPolygonSizeSqKm(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(parseMaxPolygonSizeSqKm("5")).toBeUndefined();
    expect(parseMaxPolygonSizeSqKm({})).toBeUndefined();
  });
});

describe("effectiveMaxPolygonSizeSqKm", () => {
  it("keeps the limit for polygons only", () => {
    expect(
      effectiveMaxPolygonSizeSqKm(SketchGeometryType.Polygon, 12)
    ).toBe(12);
    expect(
      effectiveMaxPolygonSizeSqKm(SketchGeometryType.Point, 12)
    ).toBeUndefined();
    expect(
      effectiveMaxPolygonSizeSqKm(SketchGeometryType.Linestring, 12)
    ).toBeUndefined();
    expect(effectiveMaxPolygonSizeSqKm(null, 12)).toBeUndefined();
  });
});

describe("polygonAreaSqKm", () => {
  const small = square(0.01);

  it("rejects null, undefined, and non-polygons", () => {
    expect(polygonAreaSqKm(null)).toBeNull();
    expect(polygonAreaSqKm(undefined)).toBeNull();
    expect(polygonAreaSqKm("polygon")).toBeNull();
    expect(polygonAreaSqKm(4)).toBeNull();
    expect(
      polygonAreaSqKm({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [0, 0] },
      })
    ).toBeNull();
    expect(
      polygonAreaSqKm({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      })
    ).toBeNull();
    expect(
      polygonAreaSqKm({
        type: "Polygon",
        coordinates: [],
      })
    ).toBeNull();
  });

  it("measures polygon and multipolygon area in square kilometers", () => {
    const areaSqKm = polygonAreaSqKm(small);
    expect(areaSqKm).not.toBeNull();
    expect(areaSqKm!).toBeGreaterThan(1);
    expect(areaSqKm!).toBeLessThan(1.4);

    const larger = polygonAreaSqKm(square(0.02));
    expect(larger!).toBeGreaterThan(areaSqKm! * 3);

    const multi = polygonAreaSqKm({
      type: "MultiPolygon",
      coordinates: [small.geometry.coordinates, square(0.01).geometry.coordinates],
    });
    expect(multi!).toBeGreaterThan(areaSqKm!);
  });

  it("subtracts holes", () => {
    const withHole = polygonAreaSqKm({
      type: "Polygon",
      coordinates: [
        small.geometry.coordinates[0],
        [
          [0.002, 0.002],
          [0.008, 0.002],
          [0.008, 0.008],
          [0.002, 0.008],
          [0.002, 0.002],
        ],
      ],
    });
    expect(withHole!).toBeLessThan(polygonAreaSqKm(small)!);
  });
});

describe("polygonSizeViolation", () => {
  const feature = square(0.01);

  it("allows shapes at or under the limit and when no limit is set", () => {
    const areaSqKm = polygonAreaSqKm(feature)!;
    expect(polygonSizeViolation(feature, undefined)).toBeNull();
    expect(polygonSizeViolation(feature, null)).toBeNull();
    expect(polygonSizeViolation(feature, areaSqKm)).toBeNull();
    expect(polygonSizeViolation(feature, areaSqKm + 1)).toBeNull();
  });

  it("reports the measured area when the polygon is larger than the limit", () => {
    const areaSqKm = polygonAreaSqKm(feature)!;
    const violation = polygonSizeViolation(feature, areaSqKm - 0.01);
    expect(violation?.maxSqKm).toBeCloseTo(areaSqKm - 0.01);
    expect(violation?.areaSqKm).toBeCloseTo(areaSqKm);
  });
});

describe("polygonSaveViolation", () => {
  const feature = square(0.01);
  const limit = polygonAreaSqKm(feature)! - 0.01;

  it("blocks a new oversized polygon", () => {
    expect(
      polygonSaveViolation({
        geometryType: SketchGeometryType.Polygon,
        maxPolygonSizeSqKm: limit,
        feature,
        isNew: true,
        geometryEdited: true,
      })
    ).not.toBeNull();
  });

  it("does not block points or shapes with no limit", () => {
    expect(
      polygonSaveViolation({
        geometryType: SketchGeometryType.Point,
        maxPolygonSizeSqKm: 0.0001,
        feature,
        isNew: true,
        geometryEdited: true,
      })
    ).toBeNull();
    expect(
      polygonSaveViolation({
        geometryType: SketchGeometryType.Polygon,
        maxPolygonSizeSqKm: null,
        feature,
        isNew: true,
        geometryEdited: true,
      })
    ).toBeNull();
  });

  it("lets an already-saved oversized shape be closed until its geometry changes", () => {
    expect(
      polygonSaveViolation({
        geometryType: SketchGeometryType.Polygon,
        maxPolygonSizeSqKm: limit,
        feature,
        isNew: false,
        geometryEdited: false,
      })
    ).toBeNull();

    expect(
      polygonSaveViolation({
        geometryType: SketchGeometryType.Polygon,
        maxPolygonSizeSqKm: limit,
        feature: square(0.02),
        isNew: false,
        geometryEdited: true,
      })
    ).not.toBeNull();
  });
});

describe("shouldAdvanceFromDrawingIntro", () => {
  it("stays on the map when the polygon is over the size limit", () => {
    expect(
      shouldAdvanceFromDrawingIntro({
        isSmall: false,
        hasKinks: false,
        tooLarge: true,
      })
    ).toBe(false);
    expect(
      shouldAdvanceFromDrawingIntro({
        isSmall: true,
        hasKinks: false,
        tooLarge: true,
      })
    ).toBe(false);
  });

  it("keeps the existing self-intersection stage rules", () => {
    expect(
      shouldAdvanceFromDrawingIntro({
        isSmall: false,
        hasKinks: true,
        tooLarge: false,
      })
    ).toBe(true);
    expect(
      shouldAdvanceFromDrawingIntro({
        isSmall: true,
        hasKinks: true,
        tooLarge: false,
      })
    ).toBe(false);
    expect(
      shouldAdvanceFromDrawingIntro({
        isSmall: true,
        hasKinks: false,
        tooLarge: false,
      })
    ).toBe(true);
  });
});

describe("formatSqKm", () => {
  it("uses fewer decimals for larger areas", () => {
    expect(formatSqKm(128.4)).toBe("128");
    expect(formatSqKm(12.44)).toBe("12.4");
    expect(formatSqKm(1.236)).toBe("1.24");
    expect(formatSqKm(0.1234)).toBe("0.123");
    expect(formatSqKm(Number.NaN)).toBe("");
  });
});
