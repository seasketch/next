import {
  SpatialMetricState,
  SketchGeometryType,
} from "../../../../generated/graphql";
import { exportColumnSumTable } from "./columnSumTable.export";
import { WidgetExporterInput } from "../types";

function tStub(key: string) {
  return key;
}

function columnSumExportInput(
  overrides: Partial<WidgetExporterInput> = {}
): WidgetExporterInput {
  return {
    dependencies: [
      {
        type: "column_values",
        subjectType: "fragments",
        stableId: "layerA",
        parameters: { includedColumns: ["catch"] },
      },
      {
        type: "column_values",
        subjectType: "geographies",
        stableId: "layerA",
        parameters: { includedColumns: ["catch"] },
      },
    ],
    metrics: [],
    sources: [
      {
        stableId: "layerA",
        sourceUrl: "https://example.com/a.geojson",
        tableOfContentsItem: { title: "Layer A" },
      } as WidgetExporterInput["sources"][0],
    ],
    geographies: [
      { id: 1, name: "Sao Miguel", translatedProps: {}, stableIds: [] },
      { id: 2, name: "Terceira", translatedProps: {}, stableIds: [] },
    ],
    componentSettings: { column: "catch" },
    sketchClass: {
      id: 1,
      projectId: 1,
      geometryType: SketchGeometryType.Polygon,
      form: {} as WidgetExporterInput["sketchClass"]["form"],
      clippingGeographies: [{ id: 1 }],
      project: {} as WidgetExporterInput["sketchClass"]["project"],
      validChildren: [],
    },
    subject: {
      sketchId: 10,
      sketchName: "Sketch",
      isCollection: false,
      childSketches: [],
    },
    relatedFragments: [],
    primaryGeographyId: 1,
    t: tStub as WidgetExporterInput["t"],
    ...overrides,
  };
}

describe("exportColumnSumTable geography", () => {
  const fragmentInSaoMiguel = {
    id: 1,
    type: "column_values",
    state: SpatialMetricState.Complete,
    value: {
      "*": {
        catch: {
          type: "number",
          count: 1,
          min: 10,
          max: 10,
          mean: 10,
          stdDev: 0,
          sum: 10,
        },
      },
    },
    sourceUrl: "https://example.com/a.geojson",
    subject: {
      __typename: "FragmentSubject",
      geographies: [1],
      sketches: [10],
      hash: "frag1",
    },
  } as WidgetExporterInput["metrics"][0];

  const terceiraGeography = {
    id: 2,
    type: "column_values",
    state: SpatialMetricState.Complete,
    value: {
      "*": {
        catch: {
          type: "number",
          count: 1,
          min: 80,
          max: 80,
          mean: 80,
          stdDev: 0,
          sum: 80,
        },
      },
    },
    sourceUrl: "https://example.com/a.geojson",
    subject: {
      __typename: "GeographySubject",
      id: 2,
    },
  } as WidgetExporterInput["metrics"][0];

  test("Sum is 0 when the sketch is outside the selected % geography", () => {
    const sections = exportColumnSumTable(
      columnSumExportInput({
        componentSettings: { column: "catch", percentGeographyId: 2 },
        metrics: [fragmentInSaoMiguel, terceiraGeography],
      })
    );

    expect(sections[0].rows[0].sum).toBe(0);
    expect(sections[0].rows[0].geographyTotalSum).toBe(80);
    expect(sections[0].rows[0].fractionOfGeography).toBe(0);
  });
});
