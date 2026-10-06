import { describe, expect, it } from "vitest";
import { extractMetricDependenciesFromReportBody } from "../src/metrics/metrics";

const fragment = {
  type: "ous_demographics",
  subjectType: "fragments" as const,
  stableId: "survey",
  parameters: { groupBy: "sector" },
};

function doc(
  componentSettings: Record<string, unknown>,
  metrics: Record<string, unknown>[]
) {
  return {
    type: "doc",
    content: [
      {
        type: "blockMetric",
        attrs: {
          type: "OusDemographicsTable",
          componentSettings,
          metrics,
        },
      },
    ],
  };
}

describe("extractMetricDependenciesFromReportBody ous demographics", () => {
  it("adds a clipping-geography metric when totalScope was never set", () => {
    expect(
      extractMetricDependenciesFromReportBody(doc({}, [fragment]))
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

  it("leaves an explicit entire-survey card on the fragment metric", () => {
    expect(
      extractMetricDependenciesFromReportBody(
        doc({ totalScope: "dataset" }, [fragment])
      )
    ).toEqual([fragment]);
  });

  it("does not duplicate a geography metric that is already stored", () => {
    const geography = {
      type: "ous_demographics",
      subjectType: "geographies" as const,
      stableId: "survey",
      parameters: { groupBy: "sector" },
    };
    expect(
      extractMetricDependenciesFromReportBody(doc({}, [fragment, geography]))
    ).toEqual([fragment, geography]);
  });
});
