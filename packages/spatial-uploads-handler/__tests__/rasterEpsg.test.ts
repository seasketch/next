import * as gdal from "gdal-async";
import {
  epsgFromGdalinfoMetadataJson,
  epsgFromProjJsonText,
  parseEpsgCodeString,
  parseEpsgFromGdalsrsinfoSearchStdout,
  resolveEpsgFromSpatialReference,
  resolveRasterEpsg,
} from "../src/rasterEpsg";

describe("rasterEpsg", () => {
  test("epsgFromProjJsonText reads root EPSG id", () => {
    expect(
      epsgFromProjJsonText(
        JSON.stringify({
          type: "GeographicCRS",
          name: "WGS 84",
          id: { authority: "EPSG", code: 4326 },
        }),
      ),
    ).toBe(4326);
    expect(
      epsgFromProjJsonText(
        JSON.stringify({
          type: "ProjectedCRS",
          id: { authority: "EPSG", code: 3857 },
        }),
      ),
    ).toBe(3857);
    expect(epsgFromProjJsonText("{}")).toBeNull();
    expect(
      epsgFromProjJsonText(
        JSON.stringify({ id: { authority: "ESRI", code: 102100 } }),
      ),
    ).toBeNull();
  });

  test("parseEpsgFromGdalsrsinfoSearchStdout takes first EPSG line", () => {
    expect(
      parseEpsgFromGdalsrsinfoSearchStdout("\n\nEPSG:4326\n\nPROJ.4 : ..."),
    ).toBe(4326);
    expect(parseEpsgFromGdalsrsinfoSearchStdout("no match")).toBeNull();
    // gdalsrsinfo -e reports EPSG:-1 when no match; do not treat as a code.
    expect(parseEpsgFromGdalsrsinfoSearchStdout("EPSG:-1\n")).toBeNull();
  });

  test("parseEpsgCodeString accepts EPSG:nnnn only", () => {
    expect(parseEpsgCodeString("EPSG:4326")).toBe(4326);
    expect(parseEpsgCodeString("epsg:3857")).toBe(3857);
    expect(parseEpsgCodeString("EPSG:-1")).toBeNull();
    expect(parseEpsgCodeString("4326")).toBeNull();
  });

  test("epsgFromGdalinfoMetadataJson reads CF / ACDD epsg keys", () => {
    // Shape matches NOAA CRW NetCDF (and GeoTIFF after gdal_translate): GDAL
    // WKT is GEOGCRS["unknown", ...] but metadata still declares EPSG:4326.
    const gdalinfoJson = JSON.stringify({
      metadata: {
        "": {
          "crs#epsg_code": "EPSG:4326",
          "crs#grid_mapping_name": "latitude_longitude",
          "NC_GLOBAL#geospatial_bounds_crs": "EPSG:4326",
        },
      },
    });
    expect(epsgFromGdalinfoMetadataJson(gdalinfoJson)).toBe(4326);
    expect(epsgFromGdalinfoMetadataJson("{}")).toBeNull();
    expect(epsgFromGdalinfoMetadataJson("not-json")).toBeNull();
  });

  test("resolveEpsgFromSpatialReference on maldives.tif fixture", async () => {
    const ds = await gdal.openAsync(`${__dirname}/maldives.tif`);
    expect(resolveEpsgFromSpatialReference(ds.srs)).toBe(3857);
  });

  test("resolveRasterEpsg matches gdal CLI for fixture", async () => {
    const path = `${__dirname}/maldives.tif`;
    const ds = await gdal.openAsync(path);
    const n = await resolveRasterEpsg(path, ds.srs);
    expect(n).toBe(3857);
  });
});
