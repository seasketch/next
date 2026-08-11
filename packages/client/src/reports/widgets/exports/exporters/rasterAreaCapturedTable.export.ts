import {
  getRasterOverlayAreaDisplayedClassValue,
  getRasterOverlayAreaOverlapCombineResult,
  RasterOverlayAreaMetric,
} from "overlay-engine";
import {
  combineMetricsBySource,
  getClassTableRows,
} from "../../ClassTableRows";
import { sketchContributionsForClassTableRow } from "../../collection/sketchContributions";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

export const exportRasterAreaCapturedTable: WidgetExporter = (input) => {
  const {
    dependencies,
    sources,
    metrics,
    geographies,
    componentSettings,
    subject,
    t,
    primaryGeographyId,
  } = input;

  // Match widget: when % is off (null) or auto/unset, still resolve against
  // the primary clipping geography for combineMetricsBySource.
  const geographyId =
    componentSettings.geographyId === null ||
    componentSettings.geographyId === "auto" ||
    componentSettings.geographyId === undefined
      ? primaryGeographyId
      : (componentSettings.geographyId as number | undefined);

  if (!geographyId) {
    return [];
  }

  const geographyName =
    geographies.find((g) => g.id === geographyId)?.name ?? String(geographyId);

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
    includeAllFeaturesRowForGroupedSources:
      componentSettings.includeAllFeaturesRowForGroupedSources as
        | string[]
        | undefined,
  });

  const combined = combineMetricsBySource<RasterOverlayAreaMetric>(
    metrics,
    sources,
    geographyId,
    "raster_overlay_area"
  );

  const isCollection = subject.isCollection;
  const childSketchIds = subject.childSketches.map((c) => c.id);
  const sketchNameById = new Map(
    subject.childSketches.map((c) => [c.id, c.name] as const)
  );
  sketchNameById.set(subject.sketchId, subject.sketchName);

  const rows: WidgetExportSection["rows"] = [];

  for (const row of classRows) {
    const forSource = combined[row.sourceId];
    const fragmentValue = forSource?.fragments?.value;
    const geographyValue = forSource?.geographies?.value;
    const areaSqKm = getRasterOverlayAreaDisplayedClassValue(
      fragmentValue,
      row.groupByKey
    );
    const geographyAreaSqKm =
      typeof geographyValue?.areas?.[row.groupByKey] === "number"
        ? geographyValue.areas[row.groupByKey]
        : 0;
    const fraction =
      geographyAreaSqKm > 0 ? areaSqKm / geographyAreaSqKm : 0;

    const combine = getRasterOverlayAreaOverlapCombineResult(fragmentValue);
    const perClass = combine?.perClass?.[row.groupByKey];

    rows.push({
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      classKey: row.groupByKey,
      classLabel: row.label,
      sourceId: row.sourceId,
      geographyId,
      geographyName,
      areaSqKm,
      geographyAreaSqKm,
      fractionOfGeography: fraction,
      overcountEstimateKm2: perClass?.overcountEstimate ?? null,
      overcountMaxKm2: perClass?.overcountMax ?? null,
      naiveSumKm2: perClass?.naiveSum ?? null,
    });

    if (isCollection) {
      const source = sources.find((s) => s.stableId === row.sourceId);
      if (!source) continue;
      const sketchLines = sketchContributionsForClassTableRow({
        metrics,
        source,
        geographyId,
        metricType: "raster_overlay_area",
        groupByKey: row.groupByKey,
        childSketchIds,
        geographyDenominator: geographyAreaSqKm,
        sketchNameById,
        t,
      });
      for (const sk of sketchLines) {
        rows.push({
          ...baseRow("sketch", sk.sketchId, sk.sketchName),
          classKey: row.groupByKey,
          classLabel: row.label,
          sourceId: row.sourceId,
          geographyId,
          geographyName,
          areaSqKm: sk.primaryValue,
          geographyAreaSqKm,
          fractionOfGeography: sk.fractionOfGeography,
          overcountEstimateKm2: null,
          overcountMaxKm2: null,
          naiveSumKm2: null,
          hasOverlap: sk.hasOverlap,
          overlapPartnerSketchNames: sk.overlapPartnerSketchNames.join("; "),
        });
      }
    }
  }

  const section: WidgetExportSection = {
    id: "raster-area-captured",
    title: "Raster area captured",
    columns: [
      { key: "scope", label: "scope", type: "string" },
      { key: "sketchId", label: "sketchId" },
      { key: "sketchName", label: "sketchName", type: "string" },
      { key: "classKey", label: "classKey", type: "string" },
      { key: "classLabel", label: "classLabel", type: "string" },
      { key: "sourceId", label: "sourceId", type: "string" },
      { key: "geographyId", label: "geographyId", type: "number" },
      { key: "geographyName", label: "geographyName", type: "string" },
      { key: "areaSqKm", label: "areaSqKm", type: "number" },
      { key: "geographyAreaSqKm", label: "geographyAreaSqKm", type: "number" },
      {
        key: "fractionOfGeography",
        label: "fractionOfGeography",
        type: "number",
      },
      {
        key: "overcountEstimateKm2",
        label: "overcountEstimateKm2",
        type: "number",
      },
      { key: "overcountMaxKm2", label: "overcountMaxKm2", type: "number" },
      { key: "naiveSumKm2", label: "naiveSumKm2", type: "number" },
      { key: "hasOverlap", label: "hasOverlap", type: "boolean" },
      {
        key: "overlapPartnerSketchNames",
        label: "overlapPartnerSketchNames",
        type: "string",
      },
    ],
    rows,
  };

  return [section];
};
