import type { RasterStats } from "overlay-engine";
import {
  combineMetricsForFragments,
  subjectIsFragment,
  type Metric,
} from "overlay-engine";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

const RASTER_STAT_KEYS = [
  "count",
  "min",
  "max",
  "mean",
  "median",
  "range",
  "sum",
  "invalid",
] as const;

export const exportRasterStatisticsTable: WidgetExporter = (input) => {
  const { metrics, subject } = input;

  const fragmentMetrics = metrics.filter(
    (m) => subjectIsFragment(m.subject) && m.type === "raster_stats" && m.value,
  ) as unknown as RasterStats[];

  const band =
    fragmentMetrics.length > 0
      ? (
          combineMetricsForFragments(
            fragmentMetrics as Pick<Metric, "type" | "value">[],
          ) as RasterStats
        ).value.bands[0]
      : undefined;

  const row: WidgetExportSection["rows"][0] = {
    ...baseRow("collection", subject.sketchId, subject.sketchName),
  };

  for (const k of RASTER_STAT_KEYS) {
    const v = band?.[k as keyof typeof band];
    row[k] =
      typeof v === "number"
        ? Number.isFinite(v)
          ? v
          : null
        : v === undefined || v === null
        ? null
        : String(v);
  }

  const columns: WidgetExportSection["columns"] = [
    { key: "scope", label: "scope", type: "string" },
    { key: "sketchId", label: "sketchId" },
    { key: "sketchName", label: "sketchName", type: "string" },
    ...RASTER_STAT_KEYS.map((k) => ({
      key: k,
      label: k,
      type: "number" as const,
    })),
  ];

  return [
    {
      id: "raster-statistics",
      title: "Raster statistics",
      columns,
      rows: [row],
      extras: {
        histogram: band?.histogram ?? [],
        band0Full: band ?? null,
      },
    },
  ];
};
