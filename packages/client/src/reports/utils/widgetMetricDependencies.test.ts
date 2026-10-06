import { hashMetricDependency } from "overlay-engine";
import {
  listUnresolvedMetricDependencies,
  metricDependenciesForWidgetAttrs,
} from "./widgetMetricDependencies";

const fragment = {
  type: "ous_demographics",
  subjectType: "fragments" as const,
  stableId: "survey",
  parameters: { groupBy: "sector" },
};

describe("metricDependenciesForWidgetAttrs", () => {
  test("adds the clipping-geography metric an unset OUS card never stored", () => {
    expect(
      metricDependenciesForWidgetAttrs("blockMetric", {
        type: "OusDemographicsTable",
        componentSettings: {},
        metrics: [fragment],
      })
    ).toEqual([
      fragment,
      {
        type: "ous_demographics",
        subjectType: "geographies",
        stableId: "survey",
        parameters: { groupBy: "sector" },
      },
    ]);
  });

  test("leaves an explicit entire-survey card on the fragment metric", () => {
    expect(
      metricDependenciesForWidgetAttrs("blockMetric", {
        type: "OusDemographicsTable",
        componentSettings: { totalScope: "dataset" },
        metrics: [fragment],
      })
    ).toEqual([fragment]);
  });

  test("does not add dependencies for other widgets", () => {
    const overlay = {
      type: "overlay_area",
      subjectType: "fragments" as const,
      stableId: "eez",
    };
    expect(
      metricDependenciesForWidgetAttrs("blockMetric", {
        type: "OverlappingAreasTable",
        componentSettings: {},
        metrics: [overlay],
      })
    ).toEqual([overlay]);
  });

  test("returns no dependencies when the node has none", () => {
    expect(
      metricDependenciesForWidgetAttrs("blockMetric", {
        type: "OusDemographicsTable",
        componentSettings: {},
        metrics: [],
      })
    ).toEqual([]);
  });
});

describe("listUnresolvedMetricDependencies", () => {
  const body = {
    type: "doc",
    content: [
      {
        type: "blockMetric",
        attrs: {
          type: "OusDemographicsTable",
          componentSettings: {},
          metrics: [fragment],
        },
      },
    ],
  };

  test("reports the geography total when only the fragment metric exists", () => {
    const fragmentHash = hashMetricDependency(fragment, {
      survey: "https://example.test/survey",
    });
    const missing = listUnresolvedMetricDependencies({
      body,
      metricDependencyHashes: [fragmentHash],
      overlaySourceUrls: { survey: "https://example.test/survey" },
    });
    expect(missing).toEqual([
      {
        dependencyHash: hashMetricDependency(
          {
            type: "ous_demographics",
            subjectType: "geographies",
            stableId: "https://example.test/survey",
            parameters: { groupBy: "sector" },
          },
          {}
        ),
        type: "ous_demographics",
        subjectType: "geographies",
        stableId: "survey",
        message: undefined,
      },
    ]);
  });

  test("is empty when every requested metric has a row", () => {
    const urls = { survey: "https://example.test/survey" };
    const deps = metricDependenciesForWidgetAttrs("blockMetric", {
      type: "OusDemographicsTable",
      componentSettings: {},
      metrics: [fragment],
    });
    expect(
      listUnresolvedMetricDependencies({
        body,
        metricDependencyHashes: deps.map((dep) =>
          hashMetricDependency(dep, urls)
        ),
        overlaySourceUrls: urls,
      })
    ).toEqual([]);
  });
});
