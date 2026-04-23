import {
  sketchContributionsForClassTableRow,
  sketchContributionsGeographyTotalArea,
} from "./sketchContributions";
import { getSamoaSource, samoaDependencies } from "../testData/samoaFixture";

const t = ((key: string) => key) as any;

describe("sketchContributions overlap reporting with Samoa fixture data", () => {
  const childSketchIds = [323, 324, 325, 333];
  const sketchNameById = new Map<number, string>([
    [323, "Sketch 323"],
    [324, "Sketch 324"],
    [325, "Sketch 325"],
    [333, "Sketch 333"],
  ]);

  test("surfaces overlapping collection members in class table sketch rows", () => {
    const rows = sketchContributionsForClassTableRow({
      metrics: samoaDependencies.metrics as any,
      source: getSamoaSource("HoFoG86np") as any,
      geographyId: 272,
      metricType: "overlay_area",
      groupByKey: "*",
      childSketchIds,
      geographyDenominator: 129712.23502159296,
      sketchNameById,
      t,
    });

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.sketchId)).toEqual([323, 325, 333, 324]);

    expect(rows).toEqual([
      expect.objectContaining({
        sketchId: 323,
        sketchName: "Sketch 323",
        hasOverlap: true,
        overlapPartnerSketchNames: ["Sketch 333"],
      }),
      expect.objectContaining({
        sketchId: 325,
        sketchName: "Sketch 325",
        hasOverlap: true,
        overlapPartnerSketchNames: ["Sketch 333"],
      }),
      expect.objectContaining({
        sketchId: 333,
        sketchName: "Sketch 333",
        hasOverlap: true,
        overlapPartnerSketchNames: ["Sketch 323", "Sketch 325"],
      }),
      expect.objectContaining({
        sketchId: 324,
        sketchName: "Sketch 324",
        hasOverlap: false,
        overlapPartnerSketchNames: [],
      }),
    ]);

    expect(rows[0].primaryValue).toBeCloseTo(21015.60249396884, 10);
    expect(rows[1].primaryValue).toBeCloseTo(6360.785252389159, 10);
    expect(rows[2].primaryValue).toBeCloseTo(4954.349229545827, 10);
    expect(rows[3].primaryValue).toBeCloseTo(3296.829314819977, 10);
  });

  test("surfaces the same overlap network in geography total sketch rows", () => {
    const rows = sketchContributionsGeographyTotalArea(
      samoaDependencies.metrics as any,
      272,
      1216.9516774839417,
      childSketchIds,
      sketchNameById,
      t
    );

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.sketchId)).toEqual([323, 325, 333, 324]);

    const overlappingRows = rows.filter((row) => row.hasOverlap);
    expect(overlappingRows.map((row) => row.sketchId)).toEqual([323, 325, 333]);
    expect(overlappingRows.map((row) => row.overlapPartnerSketchNames)).toEqual([
      ["Sketch 333"],
      ["Sketch 333"],
      ["Sketch 323", "Sketch 325"],
    ]);

    expect(rows[3]).toEqual(
      expect.objectContaining({
        sketchId: 324,
        hasOverlap: false,
        overlapPartnerSketchNames: [],
      })
    );
  });
});
