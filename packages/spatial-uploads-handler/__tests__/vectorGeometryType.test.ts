import {
  flattenWkbGeometryType,
  ogrInfoHasMeasuredGeometry,
  parseGeomType,
} from "../src/vectorGeometryType";

// Legacy 2.5D codes are base | 0x80000000, which GDAL exposes as signed int32.
const WKB_25D_BIT = 0x80000000;
const wkb25D = (base: number) => (base | WKB_25D_BIT) | 0;

describe("parseGeomType", () => {
  test("maps 2D base types", () => {
    expect(parseGeomType(1)).toEqual({ geometryType: "Point", hasZ: false });
    expect(parseGeomType(2)).toEqual({
      geometryType: "LineString",
      hasZ: false,
    });
    expect(parseGeomType(3)).toEqual({ geometryType: "Polygon", hasZ: false });
    expect(parseGeomType(4)).toEqual({
      geometryType: "MultiPoint",
      hasZ: false,
    });
    expect(parseGeomType(5)).toEqual({
      geometryType: "MultiLineString",
      hasZ: false,
    });
    expect(parseGeomType(6)).toEqual({
      geometryType: "MultiPolygon",
      hasZ: false,
    });
    expect(parseGeomType(7)).toEqual({
      geometryType: "GeometryCollection",
      hasZ: false,
    });
  });

  test("maps legacy 2.5D Z codes, including the signed values GDAL returns", () => {
    expect(parseGeomType(wkb25D(1))).toEqual({
      geometryType: "Point",
      hasZ: true,
    });
    expect(parseGeomType(-2147483647)).toEqual({
      geometryType: "Point",
      hasZ: true,
    });
    expect(parseGeomType(-2147483644)).toEqual({
      geometryType: "MultiPoint",
      hasZ: true,
    });
    expect(parseGeomType(-2147483645)).toEqual({
      geometryType: "Polygon",
      hasZ: true,
    });
    expect(parseGeomType(-2147483642)).toEqual({
      geometryType: "MultiPolygon",
      hasZ: true,
    });
    expect(parseGeomType(wkb25D(2))).toEqual({
      geometryType: "LineString",
      hasZ: true,
    });
    expect(parseGeomType(wkb25D(5))).toEqual({
      geometryType: "MultiLineString",
      hasZ: true,
    });
  });

  test("maps ISO Z, M, and ZM codes to the same base type", () => {
    // Point Z / M / ZM. The Ocean Data Hub FlatGeobuf from issue 1009 is
    // wkbPointZM (3001): geometry type Point with has_z and has_m set.
    expect(parseGeomType(1001)).toEqual({ geometryType: "Point", hasZ: true });
    expect(parseGeomType(2001)).toEqual({
      geometryType: "Point",
      hasZ: false,
    });
    expect(parseGeomType(3001)).toEqual({ geometryType: "Point", hasZ: true });

    expect(parseGeomType(1004)).toEqual({
      geometryType: "MultiPoint",
      hasZ: true,
    });
    expect(parseGeomType(2004)).toEqual({
      geometryType: "MultiPoint",
      hasZ: false,
    });
    expect(parseGeomType(3004)).toEqual({
      geometryType: "MultiPoint",
      hasZ: true,
    });

    expect(parseGeomType(1003)).toEqual({
      geometryType: "Polygon",
      hasZ: true,
    });
    expect(parseGeomType(3003)).toEqual({
      geometryType: "Polygon",
      hasZ: true,
    });
    expect(parseGeomType(3006)).toEqual({
      geometryType: "MultiPolygon",
      hasZ: true,
    });
    expect(parseGeomType(2002)).toEqual({
      geometryType: "LineString",
      hasZ: false,
    });
    expect(parseGeomType(3005)).toEqual({
      geometryType: "MultiLineString",
      hasZ: true,
    });
    expect(parseGeomType(3007)).toEqual({
      geometryType: "GeometryCollection",
      hasZ: true,
    });
  });

  test("unknown and non-simple types stay unknown", () => {
    expect(parseGeomType(0)).toEqual({ geometryType: "Unknown", hasZ: false });
    expect(parseGeomType(8)).toEqual({ geometryType: "Unknown", hasZ: false });
    expect(parseGeomType(3008)).toEqual({
      geometryType: "Unknown",
      hasZ: false,
    });
    expect(flattenWkbGeometryType(3001)).toBe(1);
    expect(flattenWkbGeometryType(-2147483644)).toBe(4);
  });
});

describe("ogrInfoHasMeasuredGeometry", () => {
  test("matches measured geometry lines and ignores Z-only layers", () => {
    expect(
      ogrInfoHasMeasuredGeometry(
        "Layer name: turismo_recifes_artificiais\nGeometry: 3D Measured Point\nFeature Count: 228\n",
      ),
    ).toBe(true);
    expect(
      ogrInfoHasMeasuredGeometry("Geometry: Measured Multi Point\n"),
    ).toBe(true);
    expect(
      ogrInfoHasMeasuredGeometry("Geometry: 3D Multi Point\n"),
    ).toBe(false);
    expect(ogrInfoHasMeasuredGeometry("Geometry: 3D Polygon\n")).toBe(false);
    expect(ogrInfoHasMeasuredGeometry("Geometry: Point\n")).toBe(false);
    expect(
      ogrInfoHasMeasuredGeometry(
        "Geometry: Polygon\nMeasured: String (80.0)\n",
      ),
    ).toBe(false);
  });
});
