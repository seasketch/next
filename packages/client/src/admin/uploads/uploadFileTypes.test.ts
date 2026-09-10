/* eslint-disable i18next/no-literal-string */
import { describe, expect, it } from "@jest/globals";
import {
  DATA_TABLE_FILE_ACCEPT,
  describeUnsupportedSpatialFile,
  detectSupportedFormat,
  isDataTableFileName,
  isDelimitedSpatialFile,
  pickDataTableDrop,
  spatialReplaceAllowsMultiple,
  SPATIAL_FILE_ACCEPT,
} from "./uploadFileTypes";

function file(name: string) {
  return new File(["col\n1"], name, { type: "text/plain" });
}

describe("spatial and data-table file helpers", () => {
  it("detects supported spatial formats including netcdf and delimited text", () => {
    expect(detectSupportedFormat("sites.geojson")).toBe("geojson");
    expect(detectSupportedFormat("layer.JSON")).toBe("geojson");
    expect(detectSupportedFormat("shapes.zip")).toBe("shapefileZip");
    expect(detectSupportedFormat("dem.tif")).toBe("geotiff");
    expect(detectSupportedFormat("sst.nc4")).toBe("netcdf");
    expect(detectSupportedFormat("points.fgb")).toBe("flatgeobuf");
    expect(detectSupportedFormat("table.csv")).toBe("delimited");
    expect(detectSupportedFormat("notes.docx")).toBeNull();
    expect(detectSupportedFormat(null)).toBeNull();
  });

  it("includes netcdf extensions in the spatial browse accept list", () => {
    expect(SPATIAL_FILE_ACCEPT).toContain(".nc");
    expect(SPATIAL_FILE_ACCEPT).toContain(".nc4");
    expect(DATA_TABLE_FILE_ACCEPT).toBe(".csv,.tsv,.txt");
  });

  it("treats csv/tsv/txt as both delimited spatial and data-table files", () => {
    expect(isDelimitedSpatialFile("a.csv")).toBe(true);
    expect(isDelimitedSpatialFile("a.tsv")).toBe(true);
    expect(isDataTableFileName("a.txt")).toBe(true);
    expect(isDataTableFileName("a.zip")).toBe(false);
  });

  it("classifies common unsupported spatial uploads", () => {
    expect(describeUnsupportedSpatialFile("notes.docx")?.kind).toBe("docx");
    expect(describeUnsupportedSpatialFile("parcels.shp")?.isPartOfShapefile).toBe(
      true
    );
    expect(describeUnsupportedSpatialFile("photo.png")?.descriptionKind).toBe(
      "unsupportedRaster"
    );
    expect(describeUnsupportedSpatialFile("sites.csv")).toBeNull();
  });

  it("enforces a single file for spatial replacement", () => {
    expect(spatialReplaceAllowsMultiple(1)).toBe(true);
    expect(spatialReplaceAllowsMultiple(2)).toBe(false);
  });

  it("picks a single data-table file and rejects other drops", () => {
    expect(pickDataTableDrop([])).toEqual({ ok: false, reason: "empty" });
    expect(pickDataTableDrop([file("a.csv"), file("b.csv")])).toEqual({
      ok: false,
      reason: "multiple",
    });
    expect(pickDataTableDrop([file("layer.zip")])).toEqual({
      ok: false,
      reason: "unsupported",
    });
    const csv = file("effort.csv");
    expect(pickDataTableDrop([csv])).toEqual({ ok: true, file: csv });
  });

  it("uses the same extension rules for browse and drop", () => {
    const accepted = DATA_TABLE_FILE_ACCEPT.split(",");
    expect(accepted.every((ext) => isDataTableFileName(`table${ext}`))).toBe(
      true
    );
  });
});
