/* eslint-disable import/first */
jest.mock(
  "jszip",
  () => ({
    __esModule: true,
    default: function MockJSZip(this: {
      file: (name: string, data: string) => void;
      generateAsync: (opts: { type: string }) => Promise<Blob>;
    }) {
      this.file = () => {};
      this.generateAsync = async () =>
        new Blob(["PK\u0003\u0004"], { type: "application/zip" });
    },
  }),
  { virtual: true },
);

import { hashMetricDependency, type MetricDependency } from "overlay-engine";
import { SpatialMetricState, SketchGeometryType } from "../../../../generated/graphql";
import { sectionToCsv } from "../csv";
import { packageSectionsAsCsvBlob } from "../package";
import { buildRawExportPayload } from "../raw";
import { buildInlineMetricsSection } from "../exporters/inlineMetrics.export";
import type { CardExportInput, WidgetExportSection } from "../types";

const urlMap = { layerA: "https://example.com/a.geojson" };

function tStub(key: string) {
  return key;
}

function minimalCardInput(
  overrides: Partial<CardExportInput> = {},
): CardExportInput {
  return {
    reportId: 9,
    cardId: 3,
    cardTitle: "Test / Card",
    body: null,
    metrics: [],
    sources: [
      {
        stableId: "layerA",
        sourceUrl: "https://example.com/a.geojson",
        tableOfContentsItem: { title: "Layer A" },
      } as CardExportInput["sources"][0],
    ],
    geographies: [{ id: 1, name: "G1", translatedProps: {}, stableIds: [] }],
    sketchClass: {
      id: 1,
      projectId: 1,
      geometryType: SketchGeometryType.Polygon,
      form: {} as CardExportInput["sketchClass"]["form"],
      clippingGeographies: [1],
      project: {} as CardExportInput["sketchClass"]["project"],
      validChildren: [],
    },
    subject: {
      sketchId: 10,
      sketchName: "Sketch",
      isCollection: false,
      childSketches: [],
    },
    relatedFragments: [],
    t: tStub as CardExportInput["t"],
    ...overrides,
  };
}

describe("widget export helpers", () => {
  test("sectionToCsv uses PapaParse quoting for commas and newlines", () => {
    const section: WidgetExportSection = {
      id: "s1",
      title: "S",
      columns: [
        { key: "a", label: "a", type: "string" },
        { key: "b", label: "b", type: "string" },
      ],
      rows: [
        { a: 'hello, "world"', b: "line1\nline2" },
        { a: "", b: null as unknown as string },
      ],
    };
    const csv = sectionToCsv(section);
    expect(csv).toContain('"hello, ""world"""');
    expect(csv).toContain('"line1\nline2"');
  });

  test("packageSectionsAsCsvBlob returns single CSV when one section", async () => {
    const section: WidgetExportSection = {
      id: "only",
      title: "Only",
      columns: [{ key: "x", label: "x", type: "string" }],
      rows: [{ x: 1 }],
    };
    const { blob, isZip, filenameBase } = await packageSectionsAsCsvBlob([section]);
    expect(isZip).toBe(true);
    expect(filenameBase).toBe("export");
    expect(blob.type).toContain("zip");
  });

  test("packageSectionsAsCsvBlob zips when multiple sections", async () => {
    const a: WidgetExportSection = {
      id: "a",
      title: "A",
      columns: [{ key: "x", label: "x" }],
      rows: [{ x: 1 }],
    };
    const b: WidgetExportSection = {
      id: "b",
      title: "B",
      columns: [{ key: "y", label: "y" }],
      rows: [{ y: 2 }],
    };
    const { blob, isZip } = await packageSectionsAsCsvBlob([a, b]);
    expect(isZip).toBe(true);
    expect(blob.type).toContain("zip");
  });

  test("buildRawExportPayload strips __typename from metrics and context", () => {
    const input = minimalCardInput({
      metrics: [
        {
          __typename: "CompatibleSpatialMetricDetails",
          id: 1,
          type: "total_area",
          state: SpatialMetricState.Complete,
          value: 99,
          dependencyHash: "h",
          sourceUrl: "https://example.com/a.geojson",
          subject: {
            __typename: "FragmentSubject",
            geographies: [1],
            sketches: [10],
            hash: "h1",
          },
        } as CardExportInput["metrics"][0],
      ],
    });
    const raw = buildRawExportPayload(input) as Record<string, unknown>;
    const fragMetrics = (raw.metrics as { fragments: unknown[] }).fragments;
    expect(JSON.stringify(fragMetrics)).not.toContain("__typename");
    expect(JSON.stringify(raw.context)).not.toContain("__typename");
    expect((fragMetrics[0] as { value: number }).value).toBe(99);
  });

  test("buildInlineMetricsSection aligns columns per inline node", () => {
    const dep: MetricDependency = {
      type: "total_area",
      subjectType: "fragments",
      stableId: "layerA",
      parameters: {},
    };
    const h = hashMetricDependency(dep, urlMap);
    const metric = {
      id: 1,
      type: "total_area",
      state: SpatialMetricState.Complete,
      value: 42,
      dependencyHash: h,
      sourceUrl: "https://example.com/a.geojson",
      subject: {
        __typename: "FragmentSubject",
        geographies: [1],
        sketches: [10],
        hash: "frag1",
      },
    } as CardExportInput["metrics"][0];

    const section = buildInlineMetricsSection({
      ...minimalCardInput({ metrics: [metric] }),
      inlineNodes: [
        {
          walkIndex: 0,
          dependencies: [dep],
          componentSettings: { presentation: "total_area" },
        },
        {
          walkIndex: 1,
          dependencies: [dep],
          componentSettings: { presentation: "total_area" },
        },
      ],
      sourceUrlMap: urlMap,
    });

    expect(section).not.toBeNull();
    expect(section!.rows).toHaveLength(1);
    const dataCols = section!.columns
      .map((c) => c.key)
      .filter((k) => !["scope", "sketchId", "sketchName"].includes(k));
    expect(dataCols).toHaveLength(2);
    expect(section!.rows[0][dataCols[0]]).toBe(42);
    expect(section!.rows[0][dataCols[1]]).toBe(42);
  });

  test("buildInlineMetricsSection adds sketch rows for collections", () => {
    const dep: MetricDependency = {
      type: "total_area",
      subjectType: "fragments",
      stableId: "layerA",
      parameters: {},
    };
    const h = hashMetricDependency(dep, urlMap);
    const mParent = {
      id: 1,
      type: "total_area",
      state: SpatialMetricState.Complete,
      value: 100,
      dependencyHash: h,
      sourceUrl: "https://example.com/a.geojson",
      subject: {
        __typename: "FragmentSubject",
        geographies: [1],
        sketches: [10],
        hash: "f1",
      },
    } as CardExportInput["metrics"][0];
    const mChild = {
      id: 2,
      type: "total_area",
      state: SpatialMetricState.Complete,
      value: 30,
      dependencyHash: h,
      sourceUrl: "https://example.com/a.geojson",
      subject: {
        __typename: "FragmentSubject",
        geographies: [1],
        sketches: [20],
        hash: "f2",
      },
    } as CardExportInput["metrics"][0];

    const section = buildInlineMetricsSection({
      ...minimalCardInput({
        metrics: [mParent, mChild],
        subject: {
          sketchId: 10,
          sketchName: "Collection",
          isCollection: true,
          childSketches: [
            { id: 20, name: "Child" },
          ],
        },
      }),
      inlineNodes: [
        {
          walkIndex: 0,
          dependencies: [dep],
          componentSettings: { presentation: "total_area" },
        },
      ],
      sourceUrlMap: urlMap,
    });

    expect(section!.rows).toHaveLength(2);
    expect(section!.rows[0].scope).toBe("collection");
    expect(section!.rows[1].scope).toBe("sketch");
    expect(section!.rows[1].sketchId).toBe(20);
    const dataCol = section!.columns
      .map((c) => c.key)
      .find((k) => !["scope", "sketchId", "sketchName"].includes(k));
    expect(dataCol).toBeTruthy();
    expect(section!.rows[0][dataCol!]).toBe(130);
    expect(section!.rows[1][dataCol!]).toBe(30);
  });

  test("buildInlineMetricsSection percent_area requires clipping geography context", () => {
    const dep: MetricDependency = {
      type: "total_area",
      subjectType: "fragments",
      stableId: "layerA",
      parameters: {},
    };
    const h = hashMetricDependency(dep, urlMap);

    const fragmentArea = {
      id: 1,
      type: "total_area",
      state: SpatialMetricState.Complete,
      value: 10,
      dependencyHash: h,
      sourceUrl: "https://example.com/a.geojson",
      subject: {
        __typename: "FragmentSubject",
        geographies: [2],
        sketches: [10],
        hash: "frag1",
      },
    } as CardExportInput["metrics"][0];

    const geographyArea = {
      id: 2,
      type: "total_area",
      state: SpatialMetricState.Complete,
      value: 100,
      dependencyHash: h,
      sourceUrl: "https://example.com/a.geojson",
      subject: {
        __typename: "GeographySubject",
        id: 2,
      },
    } as CardExportInput["metrics"][0];

    const section = buildInlineMetricsSection({
      ...minimalCardInput({
        metrics: [fragmentArea, geographyArea],
      }),
      // Simulate export context where clipping geography cannot be resolved.
      primaryGeographyId: undefined,
      sketchClass: {
        ...minimalCardInput().sketchClass,
        clippingGeographies: [],
      },
      inlineNodes: [
        {
          walkIndex: 0,
          dependencies: [dep],
          componentSettings: { presentation: "percent_area" },
        },
      ],
      sourceUrlMap: urlMap,
    });

    expect(section).not.toBeNull();
    const dataCol = section!.columns
      .map((c) => c.key)
      .find((k) => !["scope", "sketchId", "sketchName"].includes(k));
    expect(dataCol).toBeTruthy();
    expect(section!.rows[0][dataCol!]).toBeNull();
  });
});
