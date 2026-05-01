import type { ReportConfiguration } from "../cards/cards";
import {
  extractMetricDependenciesFromReportConfiguration,
  fingerprintReportMetricDependencies,
} from "./extractMetricDependenciesFromReportConfiguration";

describe("extractMetricDependenciesFromReportConfiguration", () => {
  test("walks all card bodies and collects metric dependencies", () => {
    const report = {
      id: 1,
      tabs: [
        {
          id: 10,
          position: 0,
          title: "T",
          cards: [
            {
              id: 100,
              type: "FeatureCount",
              body: {
                type: "doc",
                content: [
                  {
                    type: "metric",
                    attrs: {
                      metrics: [
                        {
                          type: "count",
                          subjectType: "geographies",
                          stableId: "s1",
                        },
                      ],
                    },
                  },
                ],
              },
              alternateLanguageSettings: {},
              componentSettings: {},
              position: 0,
              reportingLayers: [],
            },
          ],
          alternateLanguageSettings: {},
        },
      ],
    } as unknown as ReportConfiguration;

    const deps = extractMetricDependenciesFromReportConfiguration(report);
    expect(deps).toHaveLength(1);
    expect(deps[0].type).toBe("count");
    expect(deps[0].stableId).toBe("s1");
  });

  test("fingerprint changes when card body changes", () => {
    const a = {
      id: 1,
      tabs: [
        {
          id: 1,
          position: 0,
          title: "t",
          cards: [
            {
              id: 1,
              type: "TextBlock",
              body: { type: "doc", content: [] },
              alternateLanguageSettings: {},
              componentSettings: {},
              position: 0,
              reportingLayers: [],
            },
          ],
          alternateLanguageSettings: {},
        },
      ],
    } as unknown as ReportConfiguration;
    const b = {
      ...a,
      tabs: [
        {
          ...a.tabs[0],
          cards: [
            {
              ...a.tabs[0].cards[0],
              body: { type: "doc", content: [{ type: "paragraph" }] },
            },
          ],
        },
      ],
    } as unknown as ReportConfiguration;
    expect(fingerprintReportMetricDependencies(a)).not.toBe(
      fingerprintReportMetricDependencies(b),
    );
  });
});
