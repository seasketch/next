import {
  ColumnValuesMetric,
  isNumberColumnValueStats,
} from "overlay-engine";
import {
  combineMetricsBySource,
  getClassTableRows,
} from "../../ClassTableRows";
import { sketchContributionsForClassTableRow } from "../../collection/sketchContributions";
import type {
  WidgetExporter,
  WidgetExportSection,
  WidgetExporterInput,
} from "../types";
import { baseRow } from "./shared";

function buildSketchNameById(
  subject: import("../types").ExportSubjectContext
): Map<number, string> {
  const m = new Map<number, string>();
  m.set(subject.sketchId, subject.sketchName);
  for (const c of subject.childSketches) {
    m.set(c.id, c.name);
  }
  return m;
}

function columnSumFromMetric(
  metric: ColumnValuesMetric | null | undefined,
  groupByKey: string,
  column: string
): number {
  if (!metric?.value || !column) return 0;
  const cell = metric.value[groupByKey]?.[column];
  if (cell && isNumberColumnValueStats(cell)) {
    return typeof cell.sum === "number" && Number.isFinite(cell.sum)
      ? cell.sum
      : 0;
  }
  return 0;
}

export const exportColumnSumTable: WidgetExporter = (
  input: WidgetExporterInput
): WidgetExportSection[] => {
  const {
    dependencies,
    sources,
    metrics,
    geographies,
    componentSettings,
    subject,
    primaryGeographyId,
    t,
  } = input;

  const column = (componentSettings.column as string) || "";
  const percentGeographyId = componentSettings.percentGeographyId as
    | number
    | undefined;
  const showPercent =
    typeof percentGeographyId === "number" &&
    Number.isFinite(percentGeographyId);

  const fragmentGeographyId = showPercent
    ? percentGeographyId
    : primaryGeographyId;

  if (!primaryGeographyId || !fragmentGeographyId) {
    return [
      {
        id: "column-sum-table",
        title: "Column totals by class",
        columns: [{ key: "error", label: "error", type: "string" }],
        rows: [
          {
            error: "Primary geography could not be resolved for this export.",
          },
        ],
      },
    ];
  }

  const classRows = getClassTableRows({
    dependencies,
    sources,
    customLabels: componentSettings.customRowLabels as
      | { [key: string]: string }
      | undefined,
    allFeaturesLabel: "All features",
    stableIds: componentSettings.rowLinkedStableIds as
      | { [key: string]: string }
      | undefined,
    excludedRowKeys: componentSettings.excludedRowKeys as
      | string[]
      | undefined,
    includeAllFeaturesRowForGroupedSources:
      componentSettings.includeAllFeaturesRowForGroupedSources as
        | string[]
        | undefined,
  });

  const combinedMetrics = combineMetricsBySource<ColumnValuesMetric>(
    metrics,
    sources,
    fragmentGeographyId,
    "column_values"
  );

  const percentGeographyName = showPercent
    ? geographies.find((g) => g.id === percentGeographyId)?.name ?? ""
    : "";

  const isCollection = subject.childSketches.length > 0;
  const childSketchIds = subject.childSketches.map((c) => c.id);
  const sketchNameById = buildSketchNameById(subject);

  const columns: WidgetExportSection["columns"] = [
    { key: "scope", label: "scope", type: "string" },
    { key: "sketchId", label: "sketchId" },
    { key: "sketchName", label: "sketchName", type: "string" },
    { key: "sourceTitle", label: "sourceTitle", type: "string" },
    { key: "classLabel", label: "classLabel", type: "string" },
    { key: "column", label: "column", type: "string" },
    { key: "sum", label: "sum", type: "number" },
  ];
  if (showPercent) {
    columns.push(
      {
        key: "percentGeographyId",
        label: "percentGeographyId",
        type: "number",
      },
      {
        key: "percentGeographyName",
        label: "percentGeographyName",
        type: "string",
      },
      {
        key: "geographyTotalSum",
        label: "geographyTotalSum",
        type: "number",
      },
      {
        key: "fractionOfGeography",
        label: "fractionOfGeography",
        type: "number",
      }
    );
  }

  const rows: WidgetExportSection["rows"] = [];

  for (const r of classRows) {
    const combinedForSource = combinedMetrics[r.sourceId];
    const sum = columnSumFromMetric(
      combinedForSource?.fragments,
      r.groupByKey,
      column
    );
    const geographyTotal = showPercent
      ? columnSumFromMetric(
          combinedForSource?.geographies,
          r.groupByKey,
          column
        )
      : 0;
    const fraction =
      geographyTotal > 0 && Number.isFinite(geographyTotal)
        ? sum / geographyTotal
        : null;

    const row: WidgetExportSection["rows"][0] = {
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      sourceTitle:
        sources.find((s) => s.stableId === r.sourceId)?.tableOfContentsItem
          ?.title ?? "",
      classLabel: r.label,
      column,
      sum,
    };
    if (showPercent) {
      row.percentGeographyId = percentGeographyId;
      row.percentGeographyName = percentGeographyName;
      row.geographyTotalSum = geographyTotal;
      row.fractionOfGeography = fraction;
    }
    rows.push(row);

    if (isCollection) {
      const source = sources.find((s) => s.stableId === r.sourceId);
      if (!source) continue;
      const sketchLines = sketchContributionsForClassTableRow({
        metrics,
        source,
        geographyId: fragmentGeographyId,
        metricType: "column_values",
        groupByKey: r.groupByKey,
        childSketchIds,
        geographyDenominator: geographyTotal,
        sketchNameById,
        t,
        valueColumn: column,
      });
      for (const sk of sketchLines) {
        const sketchRow: WidgetExportSection["rows"][0] = {
          ...baseRow("sketch", sk.sketchId, sk.sketchName),
          sourceTitle: source.tableOfContentsItem?.title ?? "",
          classLabel: r.label,
          column,
          sum: sk.primaryValue,
        };
        if (showPercent) {
          sketchRow.percentGeographyId = percentGeographyId;
          sketchRow.percentGeographyName = percentGeographyName;
          sketchRow.geographyTotalSum = geographyTotal;
          sketchRow.fractionOfGeography = sk.fractionOfGeography;
        }
        rows.push(sketchRow);
      }
    }
  }

  return [
    {
      id: "column-sum-table",
      title: "Column totals by class",
      columns,
      rows,
      extras: {
        column,
        percentGeographyId: percentGeographyId ?? null,
      },
    },
  ];
};
