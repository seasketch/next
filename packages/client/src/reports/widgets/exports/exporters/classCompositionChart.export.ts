import {
  getRasterOverlayAreaDisplayedClassValue,
  RasterOverlayAreaMetric,
} from "overlay-engine";
import {
  combineMetricsBySource,
  getClassTableRows,
} from "../../ClassTableRows";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

export const exportClassCompositionChart: WidgetExporter = (input) => {
  const {
    dependencies,
    sources,
    metrics,
    componentSettings,
    subject,
    t,
    primaryGeographyId,
  } = input;

  if (!primaryGeographyId) {
    return [];
  }

  const classRows = getClassTableRows({
    dependencies: dependencies || [],
    sources,
    customLabels: componentSettings.customRowLabels as
      | { [key: string]: string }
      | undefined,
    allFeaturesLabel: t("All features"),
    stableIds: componentSettings.rowLinkedStableIds as
      | { [key: string]: string }
      | undefined,
    excludedRowKeys: componentSettings.excludedRowKeys as string[] | undefined,
  }).filter((r) => r.groupByKey !== "*");

  const combined = combineMetricsBySource<RasterOverlayAreaMetric>(
    metrics,
    sources,
    primaryGeographyId,
    "raster_overlay_area"
  );

  const withAreas = classRows.map((row) => {
    const fragmentValue = combined[row.sourceId]?.fragments?.value;
    const areaSqKm = getRasterOverlayAreaDisplayedClassValue(
      fragmentValue,
      row.groupByKey
    );
    return {
      row,
      areaSqKm: Number.isFinite(areaSqKm) ? areaSqKm : 0,
    };
  });

  const total = withAreas.reduce((sum, r) => sum + r.areaSqKm, 0);

  const rows: WidgetExportSection["rows"] = withAreas.map(
    ({ row, areaSqKm }) => ({
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      classKey: row.groupByKey,
      classLabel: row.label,
      sourceId: row.sourceId,
      areaSqKm,
      fractionOfComposition: total > 0 ? areaSqKm / total : 0,
    })
  );

  const section: WidgetExportSection = {
    id: "class-composition",
    title: "Class composition",
    columns: [
      { key: "scope", label: "scope", type: "string" },
      { key: "sketchId", label: "sketchId" },
      { key: "sketchName", label: "sketchName", type: "string" },
      { key: "classKey", label: "classKey", type: "string" },
      { key: "classLabel", label: "classLabel", type: "string" },
      { key: "sourceId", label: "sourceId", type: "string" },
      { key: "areaSqKm", label: "areaSqKm", type: "number" },
      {
        key: "fractionOfComposition",
        label: "fractionOfComposition",
        type: "number",
      },
    ],
    rows,
  };

  return [section];
};
