import { Schema, NodeSpec, Node } from "prosemirror-model";
import { formElements } from "../../editor/config";
import { MetricResolver } from "./resolveMetric";

/**
 * Creates a report card schema with metric node support.
 * The metric node is always added to the schema.
 * If a metricResolver is provided, the toDOM function will resolve and display actual metric values.
 * Otherwise, it displays the type and geography attributes.
 */
export function createReportCardSchema(
  isFooter: boolean,
  metricResolver?: MetricResolver
): Schema {
  const baseSchema = isFooter
    ? formElements.reportCardFooter.schema
    : formElements.reportCardBody.schema;

  // Define the metric node spec
  const metricSpec: NodeSpec = {
    attrs: {
      type: { default: "total_area" },
      geography: { default: null },
      style: { default: "decimal" },
      unit: { default: undefined },
      // ignored for now
      minimumFractionDigits: { default: 0 },
      maximumFractionDigits: { default: 2 },
    },
    inline: true,
    group: "inline",
    draggable: true,
    // selectable: true, // Explicitly mark as selectable
    parseDOM: [
      {
        tag: "span[metric-type]",
        getAttrs: (dom: string | HTMLElement) => {
          if (typeof dom === "string") {
            return {
              type: null,
              geography: null,
              style: "decimal",
              unit: undefined,
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            };
          }
          const type = dom.getAttribute("metric-type");
          const geography = dom.getAttribute("metric-geography");
          const style = dom.getAttribute("metric-style") || "decimal";
          const unit = dom.getAttribute("metric-unit") || undefined;
          const minFrac = dom.getAttribute("metric-min-frac");
          const maxFrac = dom.getAttribute("metric-max-frac");
          return {
            type,
            geography,
            style,
            unit: unit || undefined,
            minimumFractionDigits: minFrac ? parseInt(minFrac, 10) : 0,
            maximumFractionDigits: maxFrac ? parseInt(maxFrac, 10) : 2,
          };
        },
      },
    ],
    toDOM: (node: Node) => {
      const {
        type,
        geography,
        style,
        unit,
        minimumFractionDigits,
        maximumFractionDigits,
      } = node.attrs;

      if (metricResolver) {
        // Resolve the metric value using the resolver with formatting options
        const value = metricResolver.resolve(
          type,
          geography,
          style,
          unit,
          minimumFractionDigits,
          maximumFractionDigits
        );

        return [
          "span",
          {
            "metric-type": type,
            "metric-geography": geography || "",
            "metric-style": style || "decimal",
            "metric-unit": unit || "",
            "metric-min-frac": minimumFractionDigits?.toString() || "0",
            "metric-max-frac": maximumFractionDigits?.toString() || "2",
            class:
              "metric font-semibold hover:bg-blue-300/20 rounded-sm cursor-pointer",
          },
          value === null ? "N/A" : value,
        ];
      } else {
        // Basic display showing the attributes
        return [
          "span",
          {
            "metric-type": type,
            "metric-geography": geography,
            "metric-style": style || "decimal",
            "metric-unit": unit || "",
            "metric-min-frac": minimumFractionDigits?.toString() || "0",
            "metric-max-frac": maximumFractionDigits?.toString() || "2",
          },
          `{${type}}`,
        ];
      }
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
