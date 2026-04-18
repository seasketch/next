import * as gdal from "gdal-async";
import {
  epsgFromProjJsonText,
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
