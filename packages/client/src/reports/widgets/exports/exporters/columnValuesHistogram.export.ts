import type { ColumnValuesMetric, NumberColumnValueStats } from "overlay-engine";
import {
  combineMetricsForFragments,
  isNumberColumnValueStats,
  subjectIsFragment,
  type Metric,
} from "overlay-engine";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

export const exportColumnValuesHistogram: WidgetExporter = (input) => {
  const { metrics, componentSettings, subject } = input;
  const column = (componentSettings.column as string | undefined) || "";

  const fragmentMetrics = metrics.filter(
    (m) => subjectIsFragment(m.subject) && m.type === "column_values" && m.value,
  );

  let stats: NumberColumnValueStats | null = null;
  if (fragmentMetrics.length && column) {
    const combined = combineMetricsForFragments(
      fragmentMetrics as Pick<Metric, "type" | "value">[],
    ) as ColumnValuesMetric;
    const v = combined.value["*"]?.[column];
    if (v && isNumberColumnValueStats(v)) {
      stats = v;
    }
  }

  const histogram = stats?.histogram?.map((e) => e) ?? [];
  const total = histogram.reduce(
    (sum, e) => sum + (typeof e[1] === "number" ? e[1] : 0),
    0,
  );

  const rows: WidgetExportSection["rows"] = histogram.map(([value, count]) => ({
    ...baseRow("collection", subject.sketchId, subject.sketchName),
    column,
    binValue: value,
    binCount: count,
    fractionOfTotal: total > 0 ? (count as number) / total : null,
  }));

  return [
    {
      id: "column-values-histogram",
      title: column
        ? // eslint-disable-next-line i18next/no-literal-string
          `Column values histogram (${column})`
        : // eslint-disable-next-line i18next/no-literal-string
          "Column values histogram",
      columns: [
        { key: "scope", label: "scope", type: "string" },
        { key: "sketchId", label: "sketchId" },
        { key: "sketchName", label: "sketchName", type: "string" },
        { key: "column", label: "column", type: "string" },
        { key: "binValue", label: "binValue", type: "number" },
        { key: "binCount", label: "binCount", type: "number" },
        { key: "fractionOfTotal", label: "fractionOfTotal", type: "number" },
      ],
      rows,
      extras: {
        column,
        summary: stats
          ? {
              count: stats.count,
              min: stats.min,
              max: stats.max,
              mean: stats.mean,
              stdDev: stats.stdDev,
              sum: stats.sum,
              countDistinct: stats.countDistinct,
            }
          : null,
      },
    },
  ];
};
