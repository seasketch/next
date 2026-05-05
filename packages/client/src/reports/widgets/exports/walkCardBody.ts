import type { MetricDependency } from "overlay-engine";
import type { ProsemirrorJsonNode } from "./types";

export type MetricWidgetNodeInfo = {
  nodeType: "metric" | "blockMetric";
  widgetType: string;
  dependencies: MetricDependency[];
  componentSettings: Record<string, unknown>;
  /** Path index for stable inline-metric column ids (depth-first order). */
  walkIndex: number;
};

function asMetricDeps(raw: unknown): MetricDependency[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d) => d && typeof d === "object" && typeof (d as MetricDependency).type === "string",
  ) as MetricDependency[];
}

/**
 * Depth-first walk of card body JSON; yields metric/blockMetric widget nodes.
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
          dependencies: asMetricDeps(attrs.metrics),
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
