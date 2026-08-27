import { SpatialMetricState, SketchGeometryType } from "../../../../generated/graphql";
import { exportOverlappingAreasTable } from "./classTableWidgets.export";
import { WidgetExporterInput } from "../types";

function tStub(key: string) {
  return key;
}

function overlappingAreasExportInput(
  overrides: Partial<WidgetExporterInput> = {}
): WidgetExporterInput {
  return {
    dependencies: [
      {
        type: "overlay_area",
        subjectType: "fragments",
        stableId: "layerA",
        parameters: {},
      },
      {
        type: "overlay_area",
        subjectType: "geographies",
        stableId: "layerA",
        parameters: {},
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
    componentSettings: {},
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

describe("exportOverlappingAreasTable geography", () => {
  const fragmentInSaoMiguel = {
    id: 1,
    type: "overlay_area",
    state: SpatialMetricState.Complete,
    value: { "*": 10 },
    sourceUrl: "https://example.com/a.geojson",
    subject: {
      __typename: "FragmentSubject",
      geographies: [1],
      sketches: [10],
      hash: "frag1",
    },
  } as WidgetExporterInput["metrics"][0];

  const saoMiguelGeography = {
    id: 2,
    type: "overlay_area",
    state: SpatialMetricState.Complete,
    value: { "*": 50 },
    sourceUrl: "https://example.com/a.geojson",
    subject: {
      __typename: "GeographySubject",
      id: 1,
    },
  } as WidgetExporterInput["metrics"][0];

  const terceiraGeography = {
    id: 3,
    type: "overlay_area",
    state: SpatialMetricState.Complete,
    value: { "*": 80 },
    sourceUrl: "https://example.com/a.geojson",
    subject: {
      __typename: "GeographySubject",
      id: 2,
    },
  } as WidgetExporterInput["metrics"][0];

  test("Area is 0 when the sketch is outside the selected % geography", () => {
    const sections = exportOverlappingAreasTable(
      overlappingAreasExportInput({
        componentSettings: { percentGeographyId: 2 },
        metrics: [fragmentInSaoMiguel, saoMiguelGeography, terceiraGeography],
      })
    );

    expect(sections[0].rows[0].overlapAreaSqKm).toBe(0);
    expect(sections[0].rows[0].geographyTotalAreaSqKm).toBe(80);
    expect(sections[0].rows[0].fractionOfGeography).toBe(0);
  });

  test("Area uses clipping-geography overlap when % geography is primary", () => {
    const sections = exportOverlappingAreasTable(
      overlappingAreasExportInput({
        componentSettings: { percentGeographyId: "primary" },
        metrics: [fragmentInSaoMiguel, saoMiguelGeography, terceiraGeography],
      })
    );

    expect(sections[0].rows[0].overlapAreaSqKm).toBe(10);
    expect(sections[0].rows[0].geographyTotalAreaSqKm).toBe(50);
    expect(sections[0].rows[0].fractionOfGeography).toBeCloseTo(0.2);
  });
});
