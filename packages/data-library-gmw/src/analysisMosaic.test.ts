import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYSIS_SRS,
  geographicWarpArgs,
  isGeographicWgs84,
} from "./analysisMosaic";

describe("analysis mosaic CRS", () => {
  it("stays on EPSG:4326 and never asks GDAL for 3857", () => {
    assert.equal(ANALYSIS_SRS, "EPSG:4326");
    const args = geographicWarpArgs(0).join(" ");
    assert.doesNotMatch(args, /3857|Pseudo-Mercator|-t_srs/i);
    assert.match(args, /SKIP_NOSOURCE=YES/);
    assert.match(args, /SPARSE_OK=YES/);
    assert.match(args, /PREDICTOR=2/);
    assert.match(args, /INTERLEAVE=PIXEL/);
  });

  it("rejects Web Mercator geotiffs", () => {
    assert.equal(
      isGeographicWgs84({
        projection: 'PROJCRS["WGS 84 / Pseudo-Mercator",ID["EPSG",3857]]',
        geoTransform: [-20037508, 30, 0, 4163881, 0, -30],
      }),
      false,
    );
    assert.equal(
      isGeographicWgs84({
        projection: null,
        geoTransform: [-20037508, 30, 0, 0, 0, -30],
      }),
      false,
    );
  });

  it("accepts geographic WGS 84", () => {
    assert.equal(
      isGeographicWgs84({
        projection: 'GEOGCRS["WGS 84",ID["EPSG",4326]]',
        geoTransform: [-81, 0.000269469145783, 0, 25, 0, -0.000269469145783],
      }),
      true,
    );
  });
});
