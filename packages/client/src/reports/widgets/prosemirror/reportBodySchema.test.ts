jest.mock("../../../editor/config", () => {
  const { schema } = require("prosemirror-schema-basic");
  return {
    baseSchema: schema,
  };
});

// eslint-disable-next-line import/first -- jest.mock above must precede imports that use the mocked module path
import { reportBodySchema } from "./reportBodySchema";

describe("reportBodySchema widget parsing", () => {
  test("metric nodes fall back safely when JSON attributes are malformed", () => {
    const rule = reportBodySchema.nodes.metric.spec.parseDOM?.[0] as {
      getAttrs: (node: HTMLElement) => Record<string, unknown>;
    };
    const node = document.createElement("span");
    node.setAttribute("data-report-react-node", "metric");
    node.setAttribute("data-component-type", "FeatureCountTable");
    node.setAttribute("data-metrics", "{not-json");
    node.setAttribute("data-component-settings", "{also-not-json");

    expect(rule.getAttrs(node)).toEqual({
      metrics: [],
      type: "FeatureCountTable",
      componentSettings: {},
    });
  });

  test("block metric nodes still parse valid JSON attributes", () => {
    const rule = reportBodySchema.nodes.blockMetric.spec.parseDOM?.[0] as {
      getAttrs: (node: HTMLElement) => Record<string, unknown>;
    };
    const node = document.createElement("div");
    node.setAttribute("data-report-react-node", "blockMetric");
    node.setAttribute("data-component-type", "RasterProportionTable");
    node.setAttribute(
      "data-metrics",
      JSON.stringify([{ type: "raster_stats", subjectType: "fragments" }])
    );
    node.setAttribute(
      "data-component-settings",
      JSON.stringify({ rowsPerPage: 15 })
    );

    expect(rule.getAttrs(node)).toEqual({
      metrics: [{ type: "raster_stats", subjectType: "fragments" }],
      type: "RasterProportionTable",
      componentSettings: { rowsPerPage: 15 },
    });
  });

  test("parses a card body with a tabContainer", () => {
    const doc = reportBodySchema.nodeFromJSON({
      type: "doc",
      content: [
        { type: "reportTitle", content: [{ type: "text", text: "Title" }] },
        {
          type: "tabContainer",
          content: [
            {
              type: "tabPanel",
              attrs: { id: "a", label: "Emau" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
            },
            {
              type: "tabPanel",
              attrs: { id: "b", label: "Torba" },
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    });
    expect(doc.childCount).toBe(2);
    expect(doc.child(1).type.name).toBe("tabContainer");
    expect(doc.child(1).childCount).toBe(2);
    expect(doc.child(1).child(0).attrs.label).toBe("Emau");
  });
});
