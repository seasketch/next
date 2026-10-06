import type { MetricDependency } from "overlay-engine";
import type { ProsemirrorJsonNode } from "./types";
import { metricDependenciesForWidgetAttrs } from "../../utils/widgetMetricDependencies";

export type MetricWidgetNodeInfo = {
  nodeType: "metric" | "blockMetric";
  widgetType: string;
  dependencies: MetricDependency[];
  componentSettings: Record<string, unknown>;
  /** Path index for stable inline-metric column ids (depth-first order). */
  walkIndex: number;
};

/**
 * Depth-first walk of card body JSON; yields metric/blockMetric widget nodes.
 *
 * Dependencies include metrics the saved JSON never stored but the report
 * query still calculates, so exports see the same rows as the widget.
 */
export function* walkMetricWidgetNodes(
  root: ProsemirrorJsonNode | null | undefined,
): Generator<MetricWidgetNodeInfo> {
  let index = 0;
  function* walk(node: ProsemirrorJsonNode | null | undefined): Generator<MetricWidgetNodeInfo> {
    if (!node || typeof node !== "object") return;
    const t = node.type;
    if ((t === "metric" || t === "blockMetric") && node.attrs) {
      const attrs = node.attrs as Record<string, unknown>;
      const widgetType = typeof attrs.type === "string" ? attrs.type : "";
      if (widgetType) {
        const walkIndex = index++;
        yield {
          nodeType: t,
          widgetType,
          dependencies: metricDependenciesForWidgetAttrs(t, attrs),
          componentSettings:
            (attrs.componentSettings as Record<string, unknown>) || {},
          walkIndex,
        };
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        yield* walk(child);
      }
    }
  }
  yield* walk(root);
}
