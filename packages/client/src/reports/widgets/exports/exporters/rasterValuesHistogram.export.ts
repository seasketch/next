import type { RasterStats } from "overlay-engine";
import {
  combineMetricsForFragments,
  subjectIsFragment,
  type Metric,
} from "overlay-engine";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

export const exportRasterValuesHistogram: WidgetExporter = (input) => {
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

  const histogram = band?.histogram?.map((e: [number, number]) => e) ?? [];
  const total = histogram.reduce(
    (sum, e) => sum + (typeof e[1] === "number" ? e[1] : 0),
    0,
  );

  const rows: WidgetExportSection["rows"] = histogram.map(([value, count]) => ({
    ...baseRow("collection", subject.sketchId, subject.sketchName),
    binValue: value,
    binCount: count,
    fractionOfTotal: total > 0 ? (count as number) / total : null,
  }));

  return [
    {
      id: "raster-values-histogram",
      title: "Raster values histogram",
      columns: [
        { key: "scope", label: "scope", type: "string" },
        { key: "sketchId", label: "sketchId" },
        { key: "sketchName", label: "sketchName", type: "string" },
        { key: "binValue", label: "binValue", type: "number" },
        { key: "binCount", label: "binCount", type: "number" },
        { key: "fractionOfTotal", label: "fractionOfTotal", type: "number" },
      ],
      rows,
      extras: {
        bandSummary: band
          ? {
              count: band.count,
              min: band.min,
              max: band.max,
              mean: band.mean,
              sum: band.sum,
              invalid: band.invalid,
            }
          : null,
      },
    },
  ];
};
