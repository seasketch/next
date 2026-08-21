import { RasterOverlayAreaMetric, RasterStats } from "overlay-engine";
import { combineMetricsBySource } from "../../ClassTableRows";
import {
  getRasterTimeSeriesMode,
  RasterTimeSeriesMode,
  totalRasterOverlayArea,
} from "../../RasterTimeSeries";
import { coverageForSource } from "../../temporalChart";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

/**
 * One row per source layer (i.e. per time step), carrying the full statistic
 * payload for the configured mode. Sorted chronologically.
 */
export const exportRasterTimeSeries: WidgetExporter = (input) => {
  const {
    sources,
    metrics,
    componentSettings,
    subject,
    primaryGeographyId,
  } = input;

  if (!primaryGeographyId) {
    return [];
  }

  const mode = getRasterTimeSeriesMode(
    componentSettings as { mode?: RasterTimeSeriesMode }
  );

  const combined = combineMetricsBySource(
    metrics,
    sources,
    primaryGeographyId,
    mode === "area" ? "raster_overlay_area" : "raster_stats"
  );

  const rows: WidgetExportSection["rows"] = [];
  for (const source of sources) {
    const coverage = coverageForSource(source);
    const metricsForSource = combined[source.stableId];
    const base = {
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      sourceTitle: source.tableOfContentsItem?.title || source.stableId,
      time: coverage?.label ?? "",
      timeStart: coverage?.start ?? null,
      timeEnd: coverage?.end ?? null,
      timePosition: coverage?.start ?? null,
    };
    if (mode === "area") {
      const fragmentTotal = totalRasterOverlayArea(
        (metricsForSource?.fragments as RasterOverlayAreaMetric | undefined)
          ?.value
      );
      const geographyTotal = totalRasterOverlayArea(
        (metricsForSource?.geographies as RasterOverlayAreaMetric | undefined)
          ?.value
      );
      rows.push({
        ...base,
        areaSqKm: Number.isFinite(fragmentTotal) ? fragmentTotal : null,
        geographyAreaSqKm: Number.isFinite(geographyTotal)
          ? geographyTotal
          : null,
        fractionOfGeography:
          Number.isFinite(fragmentTotal) &&
          Number.isFinite(geographyTotal) &&
          geographyTotal > 0
            ? fragmentTotal / geographyTotal
            : null,
      });
    } else {
      const fragmentBand = (
        metricsForSource?.fragments as RasterStats | undefined
      )?.value?.bands?.[0];
      if (mode === "stats") {
        rows.push({
          ...base,
          min: fragmentBand?.min ?? null,
          max: fragmentBand?.max ?? null,
          mean: fragmentBand?.mean ?? null,
          count: fragmentBand?.count ?? null,
        });
      } else {
        const geographyBand = (
          metricsForSource?.geographies as RasterStats | undefined
        )?.value?.bands?.[0];
        rows.push({
          ...base,
          sum: fragmentBand?.sum ?? null,
          geographySum: geographyBand?.sum ?? null,
          fractionOfGeography:
            fragmentBand && geographyBand && geographyBand.sum > 0
              ? fragmentBand.sum / geographyBand.sum
              : null,
        });
      }
    }
  }

  rows.sort((a, b) => {
    const ax = typeof a.timePosition === "number" ? a.timePosition : Infinity;
    const bx = typeof b.timePosition === "number" ? b.timePosition : Infinity;
    return ax - bx;
  });

  const sharedColumns: WidgetExportSection["columns"] = [
    { key: "scope", label: "scope", type: "string" },
    { key: "sketchId", label: "sketchId" },
    { key: "sketchName", label: "sketchName", type: "string" },
    { key: "sourceTitle", label: "sourceTitle", type: "string" },
    { key: "time", label: "time", type: "string" },
    { key: "timeStart", label: "timeStart", type: "number" },
    { key: "timeEnd", label: "timeEnd", type: "number" },
    { key: "timePosition", label: "timePosition", type: "number" },
  ];

  const modeColumns: WidgetExportSection["columns"] =
    mode === "area"
      ? [
          { key: "areaSqKm", label: "areaSqKm", type: "number" },
          { key: "geographyAreaSqKm", label: "geographyAreaSqKm", type: "number" },
          {
            key: "fractionOfGeography",
            label: "fractionOfGeography",
            type: "number",
          },
        ]
      : mode === "stats"
      ? [
          { key: "min", label: "min", type: "number" },
          { key: "max", label: "max", type: "number" },
          { key: "mean", label: "mean", type: "number" },
          { key: "count", label: "count", type: "number" },
        ]
      : [
          { key: "sum", label: "sum", type: "number" },
          { key: "geographySum", label: "geographySum", type: "number" },
          {
            key: "fractionOfGeography",
            label: "fractionOfGeography",
            type: "number",
          },
        ];

  return [
    {
      id: "raster-time-series",
      title: "Time series",
      columns: [...sharedColumns, ...modeColumns],
      rows,
    },
  ];
};
