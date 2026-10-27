import { SketchGeometryType } from "../generated/graphql";
import {
  effectiveMaxPolygonSizeSqKm,
  formatPolygonOverage,
  formatPolygonSizeLimit,
  polygonAreaUnitLabel,
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

describe("polygon size copy", () => {
  it("formats the limit with a short unit and grouping", () => {
    expect(formatPolygonSizeLimit(8000, "en")).toBe("8,000 km²");
    expect(formatPolygonSizeLimit(162273, "en")).toBe("162,273 km²");
    expect(formatPolygonSizeLimit(1, "en")).toBe("1 km²");
    expect(formatPolygonSizeLimit(Number.NaN, "en")).toBe("");
    expect(formatPolygonSizeLimit(80, "en", "hectare")).toBe("8,000 ha");
    expect(formatPolygonSizeLimit(1 / 0.386102, "en", "mile")).toBe("1 mi²");
    expect(formatPolygonSizeLimit(1 / 247.105381, "en", "acre")).toBe("1 ac");
    expect(polygonAreaUnitLabel("kilometer", "en")).toBe("km²");
    expect(polygonAreaUnitLabel("hectare", "en")).toBe("ha");
    expect(polygonAreaUnitLabel("acre", "en")).toBe("ac");
    expect(polygonAreaUnitLabel("mile", "en")).toBe("mi²");
  });

  it("keeps a fraction only when the quantity is not whole", () => {
    expect(formatPolygonSizeLimit(12.4, "en")).toBe("12.4 km²");
    expect(formatPolygonSizeLimit(12.44, "en")).toBe("12.4 km²");
    expect(formatPolygonSizeLimit(1.236, "en")).toBe("1.24 km²");
    expect(formatPolygonSizeLimit(0.1234, "en")).toBe("0.123 km²");
    expect(formatPolygonSizeLimit(8000.5, "en")).toBe("8,000.5 km²");
  });

  it("shows how far over the limit the shape is", () => {
    expect(formatPolygonOverage(33, 10, "en")).toBe("+230%");
    expect(formatPolygonOverage(12.4, 1, "en")).toBe("+1,140%");
    expect(formatPolygonOverage(162273, 8000, "en")).toBe("+1,928%");
    expect(formatPolygonOverage(10.24, 10, "en")).toBe("+2.4%");
    expect(formatPolygonOverage(10.04, 10, "en")).toBe("+0.4%");
    expect(formatPolygonOverage(10.5, 10, "en")).toBe("+5%");
    expect(formatPolygonOverage(8000.4, 8000, "en")).toBe("+<0.1%");
    expect(formatPolygonOverage(10, 10, "en")).toBe("");
  });

  it("follows the survey locale", () => {
    expect(formatPolygonSizeLimit(8000, "pt-br")).toBe("8.000 km²");
    expect(formatPolygonOverage(33, 10, "es").replace(/\s/g, "")).toBe(
      "+230%"
    );
  });
});
