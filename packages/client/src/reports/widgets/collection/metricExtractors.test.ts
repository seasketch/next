import {
  extractOverlayAreaForGroupFromMetric,
  extractRasterBand0SumFromMetric,
  extractTotalAreaSqKmFromMetric,
} from "./metricExtractors";
import { getSamoaMetric } from "../testData/samoaFixture";

describe("metricExtractors with Samoa fixture data", () => {
  test("extracts total area from a real geography metric", () => {
    expect(extractTotalAreaSqKmFromMetric(getSamoaMetric("69568"))).toBeCloseTo(
      1216.9516774839417,
      10
    );
  });

  test("extracts overlay area for the wildcard group from a real metric", () => {
    expect(
      extractOverlayAreaForGroupFromMetric(getSamoaMetric("78686"), "*")
    ).toBeCloseTo(105.48685257177064, 10);
  });

  test("extracts raster band 0 sum from a real geography metric", () => {
    expect(extractRasterBand0SumFromMetric(getSamoaMetric("78982"))).toBeCloseTo(
      2277.5529994918033,
      10
    );
  });
});
