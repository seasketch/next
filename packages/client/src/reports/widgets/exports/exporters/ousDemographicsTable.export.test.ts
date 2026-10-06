import { OUS_DEMOGRAPHICS_ROLLUP_KEY } from "overlay-engine";
import { SpatialMetricState, SketchGeometryType } from "../../../../generated/graphql";
import { exportOusDemographicsTable } from "./ousDemographicsTable.export";
import { WidgetExporterInput } from "../types";

function tStub(key: string) {
  return key;
}

function exportInput(
  overrides: Partial<WidgetExporterInput> = {}
): WidgetExporterInput {
  return {
    dependencies: [
      {
        type: "ous_demographics",
        subjectType: "fragments",
        stableId: "survey",
        parameters: { groupBy: "sector" },
      },
      {
        type: "ous_demographics",
        subjectType: "geographies",
        stableId: "survey",
        parameters: { groupBy: "sector" },
      },
    ],
    metrics: [],
    sources: [
      {
        stableId: "survey",
        sourceUrl: "https://example.com/survey.fgb",
        tableOfContentsItem: { title: "Ocean Use Survey" },
      } as WidgetExporterInput["sources"][0],
    ],
    geographies: [
      { id: 1, name: "Planning area", translatedProps: {}, stableIds: [] },
    ],
    componentSettings: { totalScope: "geography" },
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

const sourceUrl = "https://example.com/survey.fgb";

function geographyAndFragmentMetrics(): WidgetExporterInput["metrics"] {
  return [
    {
      type: "ous_demographics",
      state: SpatialMetricState.Complete,
      sourceUrl,
      subject: {
        hash: "frag",
        sketches: [10],
        geographies: [1],
      },
      value: {
        groups: {
          Fishing: { r1: { representedInSector: 10, participants: 20 } },
        },
        totals: {
          Fishing: {
            representedInSector: 100,
            participants: 200,
            respondents: 4,
          },
        },
      },
    } as WidgetExporterInput["metrics"][0],
    {
      type: "ous_demographics",
      state: SpatialMetricState.Complete,
      sourceUrl,
      subject: { id: 1, __typename: "GeographySubject" },
      value: {
        groups: {
          Fishing: {
            r1: { representedInSector: 10, participants: 20 },
            r3: { representedInSector: 30, participants: 60 },
          },
          [OUS_DEMOGRAPHICS_ROLLUP_KEY]: {
            r1: { representedInSector: 10, participants: 20 },
            r3: { representedInSector: 30, participants: 60 },
          },
        },
        totals: {
          Fishing: {
            representedInSector: 100,
            participants: 200,
            respondents: 4,
          },
        },
      },
    } as WidgetExporterInput["metrics"][0],
  ];
}

describe("exportOusDemographicsTable geography totals", () => {
  test("uses geography overlap groups instead of dataset totals", () => {
    const sections = exportOusDemographicsTable(
      exportInput({
        metrics: [
          {
            type: "ous_demographics",
            state: SpatialMetricState.Complete,
            sourceUrl,
            subject: {
              hash: "frag",
              sketches: [10],
              geographies: [1],
            },
            value: {
              groups: {
                Fishing: { r1: { representedInSector: 10, participants: 20 } },
              },
              totals: {
                Fishing: {
                  representedInSector: 100,
                  participants: 200,
                  respondents: 4,
                },
              },
            },
          } as WidgetExporterInput["metrics"][0],
          {
            type: "ous_demographics",
            state: SpatialMetricState.Complete,
            sourceUrl,
            subject: { id: 1, __typename: "GeographySubject" },
            value: {
              groups: {
                Fishing: {
                  r1: { representedInSector: 10, participants: 20 },
                  r3: { representedInSector: 30, participants: 60 },
                },
                [OUS_DEMOGRAPHICS_ROLLUP_KEY]: {
                  r1: { representedInSector: 10, participants: 20 },
                  r3: { representedInSector: 30, participants: 60 },
                },
              },
              totals: {
                Fishing: {
                  representedInSector: 100,
                  participants: 200,
                  respondents: 4,
                },
              },
            },
          } as WidgetExporterInput["metrics"][0],
        ],
      })
    );

    const fishing = sections[0].rows.find((row) => row.group === "Fishing");
    expect(fishing).toMatchObject({
      peopleWithinPlan: 10,
      surveyTotal: 40,
      totalScope: "geography",
      fractionOfTotal: 0.25,
    });
    expect(sections[0].rows.some((row) => row.group === OUS_DEMOGRAPHICS_ROLLUP_KEY)).toBe(
      true
    );
  });

  test("uses geography overlap when totalScope was never saved and a clipping geography is known", () => {
    const sections = exportOusDemographicsTable(
      exportInput({
        componentSettings: {},
        metrics: geographyAndFragmentMetrics(),
      })
    );
    const fishing = sections[0].rows.find((row) => row.group === "Fishing");
    expect(fishing).toMatchObject({
      surveyTotal: 40,
      totalScope: "geography",
    });
  });

  test("keeps dataset totals when the card explicitly chose the entire survey", () => {
    const sections = exportOusDemographicsTable(
      exportInput({
        componentSettings: { totalScope: "dataset" },
        metrics: geographyAndFragmentMetrics(),
      })
    );
    const fishing = sections[0].rows.find((row) => row.group === "Fishing");
    expect(fishing).toMatchObject({
      surveyTotal: 100,
      totalScope: "dataset",
    });
  });

  test("uses dataset totals when totalScope was never saved and there is no clipping geography", () => {
    const sections = exportOusDemographicsTable(
      exportInput({
        componentSettings: {},
        primaryGeographyId: undefined,
        metrics: [geographyAndFragmentMetrics()[0]],
      })
    );
    const fishing = sections[0].rows.find((row) => row.group === "Fishing");
    expect(fishing).toMatchObject({
      surveyTotal: 100,
      totalScope: "dataset",
    });
    expect(sections[0].rows[0].error).toBeUndefined();
  });

  test("geography scope counts only fragments tagged with the clipping geography", () => {
    const [inside, geographyMetric] = geographyAndFragmentMetrics();
    const outside = {
      ...inside,
      subject: { hash: "outside", sketches: [10], geographies: [2] },
      value: {
        groups: {
          Fishing: { r9: { representedInSector: 50, participants: 50 } },
        },
        totals: (inside as { value: { totals: unknown } }).value.totals,
      },
    } as WidgetExporterInput["metrics"][0];
    const shared = {
      ...inside,
      subject: { hash: "shared", sketches: [10], geographies: [1, 2] },
      value: {
        groups: {
          Fishing: { r8: { representedInSector: 7, participants: 7 } },
        },
        totals: (inside as { value: { totals: unknown } }).value.totals,
      },
    } as WidgetExporterInput["metrics"][0];

    const geographySections = exportOusDemographicsTable(
      exportInput({
        metrics: [inside, outside, shared, geographyMetric],
      })
    );
    expect(
      geographySections[0].rows.find((row) => row.group === "Fishing")
    ).toMatchObject({
      peopleWithinPlan: 17,
      surveyTotal: 40,
      totalScope: "geography",
    });

    const datasetSections = exportOusDemographicsTable(
      exportInput({
        componentSettings: { totalScope: "dataset" },
        metrics: [inside, outside, shared, geographyMetric],
      })
    );
    expect(
      datasetSections[0].rows.find((row) => row.group === "Fishing")
    ).toMatchObject({
      peopleWithinPlan: 67,
      surveyTotal: 100,
      totalScope: "dataset",
    });
  });

  test("does not fall back to dataset totals when the geography metric is missing", () => {
    const sections = exportOusDemographicsTable(
      exportInput({
        metrics: [
          {
            type: "ous_demographics",
            state: SpatialMetricState.Complete,
            sourceUrl,
            subject: { hash: "frag", sketches: [10], geographies: [1] },
            value: {
              groups: {
                Fishing: { r1: { representedInSector: 10, participants: 20 } },
              },
              totals: {
                Fishing: {
                  representedInSector: 100,
                  participants: 200,
                  respondents: 4,
                },
              },
            },
          } as WidgetExporterInput["metrics"][0],
        ],
      })
    );
    expect(sections[0].rows[0].error).toBe(
      "Geography overlap metric is not available for this export."
    );
  });
});
