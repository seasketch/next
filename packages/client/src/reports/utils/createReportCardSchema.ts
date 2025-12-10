import { Schema, NodeSpec, Node } from "prosemirror-model";
import { formElements } from "../../editor/config";

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

  // Get the base nodes and add/update metric
  // Check if metric already exists in the schema
  const nodes = baseSchema.spec.nodes;
  const metricExists = baseSchema.nodes.metric !== undefined;

  const updatedNodes = metricExists
    ? nodes.update("metric", metricSpec)
    : nodes.append({ metric: metricSpec });

  // Create new schema with updated nodes
  return new Schema({
    nodes: updatedNodes,
    marks: baseSchema.spec.marks,
  });
}
