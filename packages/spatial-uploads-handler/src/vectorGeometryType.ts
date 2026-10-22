import { GeostatsLayer } from "@seasketch/geostats-types";

/**
 * GDAL's wkb25DBit. Shifted unsigned so the high bit is well-defined in JS,
 * where GDAL's signed constants (wkbPoint25D and friends) are negative.
 */
const WKB_25D_BIT = 0x80000000;

const WKB_POINT = 1;
const WKB_LINESTRING = 2;
const WKB_POLYGON = 3;
const WKB_MULTIPOINT = 4;
const WKB_MULTILINESTRING = 5;
const WKB_MULTIPOLYGON = 6;
const WKB_GEOMETRYCOLLECTION = 7;

const GEOMETRY_BY_FLAT_TYPE: Record<number, GeostatsLayer["geometry"]> = {
  [WKB_POINT]: "Point",
  [WKB_LINESTRING]: "LineString",
  [WKB_POLYGON]: "Polygon",
  [WKB_MULTIPOINT]: "MultiPoint",
  [WKB_MULTILINESTRING]: "MultiLineString",
  [WKB_MULTIPOLYGON]: "MultiPolygon",
  [WKB_GEOMETRYCOLLECTION]: "GeometryCollection",
};

/**
 * Strip Z/M dimensionality from an OGRwkbGeometryType.
 *
 * GDAL reports Z-only geometries with the legacy 2.5D bit (wkbPoint25D =
 * wkbPoint | 0x80000000). Measured geometries use the ISO codes instead:
 * +1000 Z, +2000 M, +3000 ZM (wkbPointZM = 3001). Both encodings describe the
 * same base type. Points and polygons use the same codes; a PointZM layer is
 * not a different family from a PolygonZ layer.
 */
export function flattenWkbGeometryType(geomType: number): number {
  const without25D = (geomType >>> 0) & ~WKB_25D_BIT;
  if (without25D >= 3000 && without25D < 4000) {
    return without25D - 3000;
  }
  if (without25D >= 2000 && without25D < 3000) {
    return without25D - 2000;
  }
  if (without25D >= 1000 && without25D < 2000) {
    return without25D - 1000;
  }
  return without25D;
}

/** True for 2.5D, ISO Z, and ISO ZM. M-only geometries do not have Z. */
export function wkbHasZ(geomType: number): boolean {
  const type = geomType >>> 0;
  if ((type & WKB_25D_BIT) !== 0) {
    return true;
  }
  const without25D = type & ~WKB_25D_BIT;
  return (
    (without25D >= 1000 && without25D < 2000) ||
    (without25D >= 3000 && without25D < 4000)
  );
}

/**
 * Convert a GDAL geometry type to a GeoJSON geometry type.
 * Z, M, and ZM variants map to the same GeoJSON type as their 2D base.
 * @param geomType OGRwkbGeometryType, including 25D and ISO Z/M/ZM codes
 */
export function parseGeomType(geomType: number): {
  geometryType: GeostatsLayer["geometry"];
  hasZ: boolean;
} {
  const geometryType =
    GEOMETRY_BY_FLAT_TYPE[flattenWkbGeometryType(geomType)] ?? "Unknown";
  return {
    geometryType,
    hasZ: geometryType === "Unknown" ? false : wkbHasZ(geomType),
  };
}

/**
 * ogrinfo labels measured layers "Measured Point", "3D Measured Polygon", and
 * so on. Z-only layers are "3D Point" / "3D Polygon" and do not match.
 */
export function ogrInfoHasMeasuredGeometry(ogrInfo: string): boolean {
  return /^Geometry:.*\bMeasured\b/m.test(ogrInfo);
}
