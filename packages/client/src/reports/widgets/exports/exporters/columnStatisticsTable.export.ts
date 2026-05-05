import type {
  ColumnValuesMetric,
  NumberColumnValueStats,
  StringOrBooleanColumnValueStats,
} from "overlay-engine";
import {
  combineMetricsForFragments,
  subjectIsFragment,
  type Metric,
} from "overlay-engine";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

function serializeStats(
  stats: NumberColumnValueStats | StringOrBooleanColumnValueStats,
): Record<string, string | number | boolean | null> {
  if (stats.type === "number") {
    const n = stats as NumberColumnValueStats;
    return {
      statsType: "number",
      count: n.count ?? null,
      countDistinct: n.countDistinct ?? null,
      min: Number.isFinite(n.min) ? n.min : null,
      max: Number.isFinite(n.max) ? n.max : null,
      mean: Number.isFinite(n.mean) ? n.mean : null,
      stdDev: Number.isFinite(n.stdDev) ? n.stdDev : null,
      sum: Number.isFinite(n.sum) ? n.sum : null,
      present: !Number.isNaN(n.max) && n.max > 0,
    };
  }
  const distinctTotal = stats.distinctValues.reduce((acc, [, c]) => acc + c, 0);
  return {
    statsType: stats.type,
    count: null,
    countDistinct: stats.countDistinct ?? distinctTotal,
    min: null,
    max: null,
    mean: null,
    stdDev: null,
    sum: null,
    present: distinctTotal > 0,
  };
}

export const exportColumnStatisticsTable: WidgetExporter = (input) => {
  const { metrics, componentSettings, subject } = input;
  const selectedColumns =
    (componentSettings.columns as string[] | undefined) ?? [];

  const fragmentMetrics = metrics.filter(
    (m) => subjectIsFragment(m.subject) && m.type === "column_values" && m.value,
  );

  const rows: WidgetExportSection["rows"] = [];

  if (!fragmentMetrics.length) {
    for (const col of selectedColumns) {
      rows.push({
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        column: col,
        statsType: "number",
        count: 0,
        countDistinct: 0,
        min: null,
        max: null,
        mean: null,
        stdDev: null,
        sum: null,
        present: false,
      });
    }
  } else {
    const combined = combineMetricsForFragments(
      fragmentMetrics as Pick<Metric, "type" | "value">[],
    ) as ColumnValuesMetric;

    for (const col of selectedColumns) {
      const stats =
        combined.value["*"]?.[col] ||
        ({
          type: "number",
          count: 0,
          min: NaN,
          max: NaN,
          mean: NaN,
          stdDev: NaN,
          sum: NaN,
          histogram: [],
          countDistinct: 0,
        } as NumberColumnValueStats);
      rows.push({
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        column: col,
        ...serializeStats(stats),
      });
    }
  }

  rows.sort((a, b) => String(a.column).localeCompare(String(b.column)));

  return [
    {
      id: "column-statistics",
      title: "Column statistics",
      columns: [
        { key: "scope", label: "scope", type: "string" },
        { key: "sketchId", label: "sketchId" },
        { key: "sketchName", label: "sketchName", type: "string" },
        { key: "column", label: "column", type: "string" },
        { key: "statsType", label: "statsType", type: "string" },
        { key: "count", label: "count", type: "number" },
        { key: "countDistinct", label: "countDistinct", type: "number" },
        { key: "min", label: "min", type: "number" },
        { key: "max", label: "max", type: "number" },
        { key: "mean", label: "mean", type: "number" },
        { key: "stdDev", label: "stdDev", type: "number" },
        { key: "sum", label: "sum", type: "number" },
        { key: "present", label: "present", type: "boolean" },
      ],
      rows,
    },
  ];
};
