import { Schema, Node, NodeSpec } from "prosemirror-model";
import { addListNodes } from "prosemirror-schema-list";
import { detailsNodes } from "./details";
import { baseSchema } from "../../../editor/config";

// Base marks: ensure links open in a new tab
const baseMarks = baseSchema.spec.marks.update("link", {
  ...baseSchema.spec.marks.get("link"),
  toDOM: (node) => {
    let { href, title } = node.attrs;
    return ["a", { href, title, target: "_blank" }, 0];
  },
});

// Metric node specs (inline and block) used by report widgets
const metricSpec: NodeSpec = {
  attrs: {
    metrics: { default: [] },
    type: { default: "InlineMetric" },
    componentSettings: { default: {} },
  },
  inline: true,
  group: "inline",
  draggable: true,
  parseDOM: [
    {
      tag: "span[data-report-react-node='metric']",
      getAttrs: (dom: string | HTMLElement) => {
        if (typeof dom === "string") {
          return {
            metrics: [],
            type: "InlineMetric",
            componentSettings: {},
          };
        }
        const metricsAttr = (dom as HTMLElement).getAttribute("data-metrics");
        const componentType =
          (dom as HTMLElement).getAttribute("data-component-type") ||
          "InlineMetric";
        const componentSettingsAttr = (dom as HTMLElement).getAttribute(
          "data-component-settings"
        );
        return {
          metrics: metricsAttr ? JSON.parse(metricsAttr) : [],
          type: componentType,
          componentSettings: componentSettingsAttr
            ? JSON.parse(componentSettingsAttr)
            : {},
        };
      },
    },
  ],
  toDOM: (node: Node) => {
    const { metrics, type, componentSettings } = node.attrs;
    return [
      "span",
      {
        "data-report-react-node": "metric",
        "data-component-type": type || "InlineMetric",
        "data-metrics": JSON.stringify(metrics || []),
        "data-component-settings": JSON.stringify(componentSettings || {}),
      },
      `{${metrics?.[0]?.type || "metric"}}`,
    ];
  },
};

const blockMetricSpec: NodeSpec = {
  ...metricSpec,
  group: "block",
  draggable: true,
  inline: false,
  parseDOM: [
    {
      tag: "div[data-report-react-node='blockMetric']",
      getAttrs: (dom: string | HTMLElement) => {
        if (typeof dom === "string") {
          return {
            metrics: [],
            type: "InlineMetric",
            componentSettings: {},
          };
        }
        const metricsAttr = (dom as HTMLElement).getAttribute("data-metrics");
        const componentType =
          (dom as HTMLElement).getAttribute("data-component-type") ||
          "InlineMetric";
        const componentSettingsAttr = (dom as HTMLElement).getAttribute(
          "data-component-settings"
        );
        return {
          metrics: metricsAttr ? JSON.parse(metricsAttr) : [],
          type: componentType,
          componentSettings: componentSettingsAttr
            ? JSON.parse(componentSettingsAttr)
            : {},
        };
      },
    },
  ],
  toDOM: (node: Node) => {
    const { metrics, type, componentSettings } = node.attrs;
    return [
      "div",
      {
        "data-report-react-node": "blockMetric",
        "data-component-type": type || "InlineMetric",
        "data-metrics": JSON.stringify(metrics || []),
        "data-component-settings": JSON.stringify(componentSettings || {}),
      },
      `{${metrics?.[0]?.type || "blockMetric"}}`,
    ];
  },
};

// Start from base schema and add report title node and heading tweaks
const reportTitleNode: NodeSpec = {
  content: "text*",
  group: "block",
  defining: true,
  marks: "em",
  parseDOM: [{ tag: "h1[data-report-title]" }],
  toDOM: function () {
    return ["h1", { "data-report-title": "yes" }, 0];
  },
};

const reportNodes = addListNodes(
  baseSchema.spec.nodes
    .append({ reportTitle: reportTitleNode })
    .update("heading", {
      attrs: { level: { default: 2 } },
      content: "inline*",
      group: "block",
      defining: true,
      isReporting: true,
      parseDOM: [
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
      ],
      toDOM: (node: Node) => {
        const level = node.attrs.level === 3 ? 3 : 2;
        return ["h" + level, 0];
      },
    })
    .update("doc", { content: "reportTitle block*" }),
  "paragraph block*",
  "block"
);

// Results paragraph - a paragraph with special styling for calculated results
const resultsParagraphSpec: NodeSpec = {
  content: "inline*",
  group: "block",
  parseDOM: [{ tag: "p.results-paragraph" }],
  toDOM() {
    return ["p", { class: "results-paragraph" }, 0];
  },
};

// Add metrics and details/summary nodes
const { details, summary } = detailsNodes();

const nodes = reportNodes.append({
  metric: metricSpec,
  blockMetric: blockMetricSpec,
  details,
  summary,
  resultsParagraph: resultsParagraphSpec,
});

export const reportBodySchema = new Schema({
  nodes,
  marks: baseMarks,
});

// Backwards compatibility helper
export function createReportCardSchema(): Schema {
  return reportBodySchema;
}

type PMJSONNode = {
  type?: string;
  attrs?: Record<string, any>;
  content?: PMJSONNode[];
};

/**
 * Walk a ProseMirror JSON document and clear the `open` attribute on details nodes.
 * Accepts the JSON form (not a ProseMirror Node instance), mutates in place for simplicity.
 */
export function setCollapsibleBlocksClosed(doc: PMJSONNode): PMJSONNode {
  if (doc.type === "details") {
    if (!doc.attrs) {
      doc.attrs = {};
    }
    doc.attrs.open = false;
  }
  if (Array.isArray(doc.content)) {
    for (const child of doc.content) {
      setCollapsibleBlocksClosed(child);
    }
  }
  return doc;
}
