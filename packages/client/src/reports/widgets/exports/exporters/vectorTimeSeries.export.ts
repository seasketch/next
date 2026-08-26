import { combineMetricsBySource } from "../../ClassTableRows";
import { coverageForSource } from "../../temporalChart";
import {
  expectedVectorTimeSeriesMetricType,
  extractVectorTimeSeriesSample,
} from "../../vectorTimeSeriesData";
import {
  getVectorTimeSeriesMode,
  VectorTimeSeriesMode,
} from "../../vectorTimeSeriesSettings";
import { vectorGeometryFamily } from "../../temporalChart";
import { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

/**
 * One row per source layer (i.e. per time step), carrying the full statistic
 * payload for the configured mode. Sorted chronologically.
 */
export const exportVectorTimeSeries: WidgetExporter = (input) => {
  const { sources, metrics, componentSettings, subject, primaryGeographyId } =
    input;

  const geographyId =
    componentSettings.geographyId === undefined ||
    componentSettings.geographyId === "auto"
      ? primaryGeographyId
      : (componentSettings.geographyId as number | undefined);

  if (!geographyId) {
    return [];
  }

  const family = vectorGeometryFamily(sources[0]?.vectorGeometryType);
  const mode = getVectorTimeSeriesMode(
    componentSettings as { mode?: VectorTimeSeriesMode },
    family
  );
  const column =
    typeof componentSettings.column === "string"
      ? componentSettings.column
      : undefined;

  const combined = combineMetricsBySource(
    metrics,
    sources,
    geographyId,
    expectedVectorTimeSeriesMetricType(mode)
  );

  const rows: WidgetExportSection["rows"] = [];
  for (const source of sources) {
    const coverage = coverageForSource(source);
    const metricsForSource = combined[source.stableId];
    const sample = extractVectorTimeSeriesSample({
      stableId: source.stableId,
      title: source.tableOfContentsItem?.title || source.stableId,
      coverage,
      mode,
      column,
      fragments: metricsForSource?.fragments,
      geographies: metricsForSource?.geographies,
    });
    const base = {
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      sourceTitle: source.tableOfContentsItem?.title || source.stableId,
      time: coverage?.label ?? "",
      timeStart: coverage?.start ?? null,
      timeEnd: coverage?.end ?? null,
      timePosition: coverage?.start ?? null,
    };
    if (mode === "count") {
      rows.push({
        ...base,
        count: sample.count,
        geographyCount: sample.geographyCount,
        fractionOfGeography: sample.fraction,
      });
    } else if (mode === "geometry") {
      rows.push({
        ...base,
        measure: sample.geometry,
        geographyMeasure: sample.geographyGeometry,
        fractionOfGeography: sample.fraction,
      });
    } else if (mode === "stats") {
      rows.push({
        ...base,
        column: column ?? "",
        min: sample.min,
        max: sample.max,
        mean: sample.mean,
        sum: sample.sum,
      });
    } else {
      rows.push({
        ...base,
        column: column ?? "",
        sum: sample.sum,
        geographySum: sample.geographySum,
        fractionOfGeography: sample.fraction,
      });
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
    mode === "count"
      ? [
          { key: "count", label: "count", type: "number" },
          { key: "geographyCount", label: "geographyCount", type: "number" },
          {
            key: "fractionOfGeography",
            label: "fractionOfGeography",
            type: "number",
          },
        ]
      : mode === "geometry"
      ? [
          { key: "measure", label: "measure", type: "number" },
          {
            key: "geographyMeasure",
            label: "geographyMeasure",
            type: "number",
          },
          {
            key: "fractionOfGeography",
            label: "fractionOfGeography",
            type: "number",
          },
        ]
      : mode === "stats"
      ? [
          { key: "column", label: "column", type: "string" },
          { key: "min", label: "min", type: "number" },
          { key: "max", label: "max", type: "number" },
          { key: "mean", label: "mean", type: "number" },
          { key: "sum", label: "sum", type: "number" },
        ]
      : [
          { key: "column", label: "column", type: "string" },
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
      id: "vector-time-series",
      title: "Time series",
      columns: [...sharedColumns, ...modeColumns],
      rows,
    },
  ];
};
