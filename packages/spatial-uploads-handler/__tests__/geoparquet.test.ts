import {
  extentLooksGeographic,
  geoparquetSrsDecision,
  ogrInfoExtent,
  ogrInfoHasNoGeometry,
  ogrInfoSrsUnknown,
  vectorTypeFromOgrInfo,
} from "../src/formats/geoparquet";

const WGS84 = `
INFO: Open of \`sites.parquet'
      using driver \`Parquet' successful.

Layer name: sites
Geometry: Point
Feature Count: 65
Extent: (-49.364162, -28.946069) - (-32.408277, -3.719039)
Layer SRS WKT:
(unknown)
`;

const UTM = `
INFO: Open of \`sites.parquet'
      using driver \`Parquet' successful.
Geometry: Multi Polygon
Extent: (500000.000000, 4000000.000000) - (600000.000000, 4100000.000000)
Layer SRS WKT:
PROJCRS["WGS 84 / UTM zone 10N",
    DATUM["World Geodetic System 1984",
        ELLIPSOID["WGS 84",6378137,298.257223563]]]
`;

describe("vectorTypeFromOgrInfo", () => {
  test("recognizes the drivers the upload pipeline accepts", () => {
    expect(vectorTypeFromOgrInfo("using driver `GeoJSON' successful.")).toBe(
      "GeoJSON",
    );
    expect(vectorTypeFromOgrInfo("using driver `FlatGeobuf' successful.")).toBe(
      "FlatGeobuf",
    );
    expect(
      vectorTypeFromOgrInfo("using driver `ESRI Shapefile' successful."),
    ).toBe("ZippedShapefile");
    expect(vectorTypeFromOgrInfo(WGS84)).toBe("GeoParquet");
    expect(vectorTypeFromOgrInfo("using driver `GPKG' successful.")).toBeNull();
  });

  test("does not treat a field named parquet as the Parquet driver", () => {
    expect(
      vectorTypeFromOgrInfo("using driver `GeoJSON' successful.\nparquet: String"),
    ).toBe("GeoJSON");
  });
});

describe("geoparquet geometry and crs", () => {
  test("detects a table with no geometry column", () => {
    expect(ogrInfoHasNoGeometry("Geometry: None")).toBe(true);
    expect(ogrInfoHasNoGeometry("Geometry: Point")).toBe(false);
    expect(ogrInfoHasNoGeometry("Geometry: Unknown (any)")).toBe(false);
  });

  test("reads an unknown srs and a geographic extent", () => {
    expect(ogrInfoSrsUnknown(WGS84)).toBe(true);
    expect(ogrInfoSrsUnknown(UTM)).toBe(false);
    expect(ogrInfoExtent(WGS84)).toEqual([
      -49.364162, -28.946069, -32.408277, -3.719039,
    ]);
    expect(extentLooksGeographic(ogrInfoExtent(WGS84)!)).toBe(true);
    expect(extentLooksGeographic(ogrInfoExtent(UTM)!)).toBe(false);
  });

  test("assumes WGS 84 only for geographic coordinates with no crs", () => {
    expect(geoparquetSrsDecision(WGS84, false)).toEqual({ assumeWgs84: true });
    expect(geoparquetSrsDecision(UTM, true)).toEqual({ assumeWgs84: false });
    expect(geoparquetSrsDecision(UTM, false)).toEqual({ assumeWgs84: false });
    const projectedWithoutCrs = WGS84.replace(
      "Extent: (-49.364162, -28.946069) - (-32.408277, -3.719039)",
      "Extent: (500000.000000, 4000000.000000) - (600000.000000, 4100000.000000)",
    );
    expect(geoparquetSrsDecision(projectedWithoutCrs, false)).toEqual({
      error:
        "This GeoParquet file does not declare a coordinate reference system, and its coordinates are not longitude and latitude. Export it as WGS 84 (EPSG:4326) and upload it again.",
    });
  });

  test("rejects a missing extent when the crs is unknown", () => {
    const noExtent = WGS84.replace(/Extent:.*\n/, "");
    expect(ogrInfoExtent(noExtent)).toBeNull();
    expect("error" in geoparquetSrsDecision(noExtent, false)).toBe(true);
  });
});
