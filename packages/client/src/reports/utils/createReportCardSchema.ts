import { Schema, NodeSpec, Node } from "prosemirror-model";
import { formElements } from "../../editor/config";
import { addListNodes } from "prosemirror-schema-list";
import { detailsNodes } from "../widgets/prosemirror-details";

/**
 * Creates a report card schema with metric node support.
 * The metric node is always added to the schema.
 * Otherwise, it displays the type and geography attributes.
 */
export function createReportCardSchema(): Schema {
  const baseSchema = formElements.reportCardBody.schema;

  // Define the metric node spec
  const metricSpec: NodeSpec = {
    attrs: {
      /**
       * A list of metric dependencies used to resolve values. Shape is defined in
       * overlay-engine MetricDependency.
       */
      metrics: { default: [] },
      /**
       * Component type to render (e.g., InlineMetric). Routing happens in React
       * land via nodeViews.
       */
      type: { default: "InlineMetric" },
      /**
       * Arbitrary component-specific configuration.
       */
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

  // Get the base nodes and add/update metric
  const nodesWithLists = addListNodes(
    baseSchema.spec.nodes,
    "paragraph block*",
    "block"
  );
  const metricExists = nodesWithLists.get("metric") !== undefined;

  const updatedNodes = metricExists
    ? nodesWithLists.update("metric", metricSpec)
    : nodesWithLists.append({ metric: metricSpec });

  const blockMetricExists = nodesWithLists.get("blockMetric") !== undefined;
  const updatedNodesWithBlocks = blockMetricExists
    ? updatedNodes.update("blockMetric", blockMetricSpec)
    : updatedNodes.append({ blockMetric: blockMetricSpec });

  const { details, summary } = detailsNodes({
    detailsGroup: "block",
    detailsContent: "block*",
    summaryContent: "inline*",
  });
  const nodesWithDetails = updatedNodesWithBlocks.append({ details, summary });

  // Create new schema with updated nodes
  const schema = new Schema({
    nodes: nodesWithDetails,
    marks: baseSchema.spec.marks,
  });
  (schema as any).isReportCardBodySchema = true;
  return schema;
}
