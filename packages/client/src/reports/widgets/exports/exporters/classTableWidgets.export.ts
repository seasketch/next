import type {
  CountMetric,
  OverlayAreaMetric,
  OverlayAreaMetricValue,
  RasterStats,
} from "overlay-engine";
import { getOverlayAreaOverlapCombineResult } from "overlay-engine";
import {
  combineMetricsBySource,
  getClassTableRows,
} from "../../ClassTableRows";
import { sketchContributionsForClassTableRow } from "../../collection/sketchContributions";
import {
  buildPercentGeographyValuesBySourceId,
  overlayAreaClassTotalFromValue,
  resolveOverlappingAreasPercentGeographyId,
} from "../../overlappingAreasPercentGeography";
import type { WidgetExporter, WidgetExportSection, WidgetExporterInput } from "../types";
import { baseRow } from "./shared";

function overlayAccuracyNote(
  value: OverlayAreaMetricValue | undefined,
  groupByKey: string,
): {
  overlapAreaSqKm: number;
  overlapAreaMinSqKm: number | null;
  overlapAreaMaxSqKm: number | null;
  accuracyNote: string;
} {
  const raw = value?.[groupByKey];
  const displayed = typeof raw === "number" ? raw : 0;
  const combine = getOverlayAreaOverlapCombineResult(value);
  const perClass = combine?.perClass?.[groupByKey];
  if (!perClass) {
    return {
      overlapAreaSqKm: displayed,
      overlapAreaMinSqKm: null,
      overlapAreaMaxSqKm: null,
      accuracyNote: "",
    };
  }
  const { naiveSum, overcountMin, overcountMax } = perClass;
  const min = naiveSum - overcountMax;
  const max = naiveSum - overcountMin;
  if (overcountMin === overcountMax && overcountMin > 0) {
    return {
      overlapAreaSqKm: displayed,
      overlapAreaMinSqKm: min,
      overlapAreaMaxSqKm: max,
      // eslint-disable-next-line i18next/no-literal-string
      accuracyNote: "deduplicated",
    };
  }
  if (overcountMax > overcountMin && naiveSum > 0) {
    // Residual uncertainty after the displayed correction (naive − overcountMin).
    const residual = overcountMax - overcountMin;
    const pct = Math.ceil((residual / naiveSum) * 100);
    return {
      overlapAreaSqKm: displayed,
      overlapAreaMinSqKm: min,
      overlapAreaMaxSqKm: max,
      // Machine-readable CSV accuracy note (not UI copy).
      // eslint-disable-next-line i18next/no-literal-string
      accuracyNote: `may be overestimated up to ${pct}%`,
    };
  }
  return {
    overlapAreaSqKm: displayed,
    overlapAreaMinSqKm: min,
    overlapAreaMaxSqKm: max,
    // eslint-disable-next-line i18next/no-literal-string
    accuracyNote: "deduplicated",
  };
}

function buildSketchNameById(
  subject: import("../types").ExportSubjectContext,
): Map<number, string> {
  const m = new Map<number, string>();
  m.set(subject.sketchId, subject.sketchName);
  for (const c of subject.childSketches) {
    m.set(c.id, c.name);
  }
  return m;
}

type ClassMode = "overlay_area" | "count" | "presence" | "raster_stats";

function exportClassTableWidget(
  input: WidgetExporterInput,
  mode: ClassMode,
  sectionId: string,
  sectionTitle: string,
): WidgetExportSection[] {
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

  if (!primaryGeographyId) {
    return [
      {
        id: sectionId,
        title: sectionTitle,
        columns: [
          { key: "error", label: "error", type: "string" },
        ],
        rows: [
          {
            error:
              "Primary geography could not be resolved for this export.",
          },
        ],
        extras: { mode },
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

  const geo = geographies.find((g) => g.id === primaryGeographyId);
  const primaryGeographyName = geo?.name ?? "";

  const sketchNameById = buildSketchNameById(subject);
  const childSketchIds = subject.childSketches.map((c) => c.id);
  const isCollection = subject.isCollection;

  let rows: WidgetExportSection["rows"] = [];

  if (sources.length === 0 || metrics.length === 0) {
    rows = classRows.map((r) => ({
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      sourceTitle:
        sources.find((s) => s.stableId === r.sourceId)?.tableOfContentsItem
          ?.title ?? "",
      classLabel: r.label,
      primaryGeographyId,
      primaryGeographyName,
      ...(mode === "overlay_area"
        ? {
            overlapAreaSqKm: null,
            overlapAreaMinSqKm: null,
            overlapAreaMaxSqKm: null,
            accuracyNote: "",
            geographyTotalAreaSqKm: null,
            fractionOfGeography: null,
          }
        : mode === "count" || mode === "presence"
        ? {
            count: null,
            geographyTotalCount: null,
            fractionOfGeography: null,
            present: null,
          }
        : {
            rasterSketchSum: null,
            rasterGeographySum: null,
            fractionOfGeographyRasterSum: null,
          }),
    }));
    return [
      {
        id: sectionId,
        title: sectionTitle,
        columns: defaultColumns(mode, primaryGeographyId, primaryGeographyName),
        rows,
        extras: { mode, empty: true },
      },
    ];
  }

  if (mode === "overlay_area") {
    const percentGeographyId = resolveOverlappingAreasPercentGeographyId(
      componentSettings as {
        percentGeographyId?: number | "primary" | null;
        showPercentColumn?: boolean;
      },
      primaryGeographyId,
    );
    const percentGeographyName =
      percentGeographyId !== undefined
        ? geographies.find((g) => g.id === percentGeographyId)?.name ?? ""
        : "";
    const combinedMetrics = combineMetricsBySource<OverlayAreaMetric>(
      metrics,
      sources,
      primaryGeographyId,
      "overlay_area",
    );
    const geographyValuesBySourceId =
      percentGeographyId !== undefined
        ? buildPercentGeographyValuesBySourceId({
            percentGeographyId,
            clippingGeographyId: primaryGeographyId,
            metrics,
            sources,
            combinedBySource: combinedMetrics,
          })
        : null;
    const sourceByStableId = new Map(
      sources.map((s) => [s.stableId, s] as const),
    );
    for (const r of classRows) {
      const combinedForSource = combinedMetrics[r.sourceId];
      const fragmentValue = combinedForSource?.fragments
        ?.value as OverlayAreaMetricValue | undefined;
      const accuracy = overlayAccuracyNote(fragmentValue, r.groupByKey);
      const source = sourceByStableId.get(r.sourceId);
      const geographyTotal =
        geographyValuesBySourceId !== null
          ? overlayAreaClassTotalFromValue(
              geographyValuesBySourceId.get(r.sourceId),
              r.groupByKey,
            )
          : null;
      const fraction =
        typeof geographyTotal === "number" &&
        geographyTotal > 0 &&
        Number.isFinite(geographyTotal)
          ? accuracy.overlapAreaSqKm / geographyTotal
          : null;
      rows.push({
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        sourceTitle: source?.tableOfContentsItem?.title ?? "",
        classLabel: r.label,
        primaryGeographyId,
        primaryGeographyName,
        percentGeographyId: percentGeographyId ?? null,
        percentGeographyName,
        overlapAreaSqKm: accuracy.overlapAreaSqKm,
        overlapAreaMinSqKm: accuracy.overlapAreaMinSqKm,
        overlapAreaMaxSqKm: accuracy.overlapAreaMaxSqKm,
        accuracyNote: accuracy.accuracyNote,
        geographyTotalAreaSqKm: geographyTotal,
        fractionOfGeography: fraction,
        hasOverlap: null,
        overlapPartnerSketchNames: null,
      });
      if (isCollection) {
        if (!source) continue;
        const sketchLines = sketchContributionsForClassTableRow({
          metrics,
          source,
          geographyId: primaryGeographyId,
          metricType: "overlay_area",
          groupByKey: r.groupByKey,
          childSketchIds,
          geographyDenominator:
            typeof geographyTotal === "number" &&
            Number.isFinite(geographyTotal)
              ? geographyTotal
              : 0,
          sketchNameById,
          t,
        });
        for (const sk of sketchLines) {
          rows.push({
            ...baseRow("sketch", sk.sketchId, sk.sketchName),
            sourceTitle: source.tableOfContentsItem?.title ?? "",
            classLabel: r.label,
            primaryGeographyId,
            primaryGeographyName,
            percentGeographyId: percentGeographyId ?? null,
            percentGeographyName,
            overlapAreaSqKm: sk.primaryValue,
            overlapAreaMinSqKm: null,
            overlapAreaMaxSqKm: null,
            accuracyNote: "",
            geographyTotalAreaSqKm: geographyTotal,
            fractionOfGeography:
              percentGeographyId !== undefined ? sk.fractionOfGeography : null,
            hasOverlap: sk.hasOverlap,
            overlapPartnerSketchNames: sk.overlapPartnerSketchNames.join("; "),
          });
        }
      }
    }
  } else if (mode === "count" || mode === "presence") {
    const combinedMetrics = combineMetricsBySource<CountMetric>(
      metrics,
      sources,
      primaryGeographyId,
      "count",
    );
    for (const r of classRows) {
      const combinedForSource = combinedMetrics[r.sourceId];
      const count =
        combinedForSource?.fragments?.value?.[r.groupByKey]?.count || 0;
      const geographyTotal =
        combinedForSource?.geographies?.value?.[r.groupByKey]?.count || 0;
      const fraction =
        geographyTotal > 0 && Number.isFinite(geographyTotal)
          ? count / geographyTotal
          : null;
      rows.push({
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        sourceTitle:
          sources.find((s) => s.stableId === r.sourceId)?.tableOfContentsItem
            ?.title ?? "",
        classLabel: r.label,
        primaryGeographyId,
        primaryGeographyName,
        count,
        geographyTotalCount: geographyTotal,
        fractionOfGeography: fraction,
        present: mode === "presence" ? count > 0 : null,
        hasOverlap: null,
        overlapPartnerSketchNames: null,
      });
      if (isCollection) {
        const source = sources.find((s) => s.stableId === r.sourceId);
        if (!source) continue;
        const sketchLines = sketchContributionsForClassTableRow({
          metrics,
          source,
          geographyId: primaryGeographyId,
          metricType: "count",
          groupByKey: r.groupByKey,
          childSketchIds,
          geographyDenominator:
            typeof geographyTotal === "number" &&
            Number.isFinite(geographyTotal)
              ? geographyTotal
              : 0,
          sketchNameById,
          t,
        });
        for (const sk of sketchLines) {
          rows.push({
            ...baseRow("sketch", sk.sketchId, sk.sketchName),
            sourceTitle:
              sources.find((s) => s.stableId === r.sourceId)
                ?.tableOfContentsItem?.title ?? "",
            classLabel: r.label,
            primaryGeographyId,
            primaryGeographyName,
            count: sk.primaryValue,
            geographyTotalCount: geographyTotal,
            fractionOfGeography: sk.fractionOfGeography,
            hasOverlap: sk.hasOverlap,
            overlapPartnerSketchNames: sk.overlapPartnerSketchNames.join("; "),
            present: mode === "presence" ? sk.primaryValue > 0 : null,
          });
        }
      }
    }
  } else {
    const combinedMetrics = combineMetricsBySource<RasterStats>(
      metrics,
      sources,
      primaryGeographyId,
      "raster_stats",
    );
    for (const r of classRows) {
      const combinedForSource = combinedMetrics[r.sourceId];
      const sketchSum = combinedForSource?.fragments?.value?.bands?.[0]?.sum ?? 0;
      const geographySum =
        combinedForSource?.geographies?.value?.bands?.[0]?.sum ?? 0;
      const fraction =
        geographySum > 0 && Number.isFinite(geographySum)
          ? sketchSum / geographySum
          : null;
      rows.push({
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        sourceTitle:
          sources.find((s) => s.stableId === r.sourceId)?.tableOfContentsItem
            ?.title ?? "",
        classLabel: r.label,
        primaryGeographyId,
        primaryGeographyName,
        rasterSketchSum: sketchSum,
        rasterGeographySum: geographySum,
        fractionOfGeographyRasterSum: fraction,
        hasOverlap: null,
        overlapPartnerSketchNames: null,
      });
      if (isCollection) {
        const source = sources.find((s) => s.stableId === r.sourceId);
        if (!source) continue;
        const sketchLines = sketchContributionsForClassTableRow({
          metrics,
          source,
          geographyId: primaryGeographyId,
          metricType: "raster_stats",
          groupByKey: r.groupByKey,
          childSketchIds,
          geographyDenominator:
            typeof geographySum === "number" && Number.isFinite(geographySum)
              ? geographySum
              : 0,
          sketchNameById,
          t,
        });
        for (const sk of sketchLines) {
          rows.push({
            ...baseRow("sketch", sk.sketchId, sk.sketchName),
            sourceTitle:
              sources.find((s) => s.stableId === r.sourceId)
                ?.tableOfContentsItem?.title ?? "",
            classLabel: r.label,
            primaryGeographyId,
            primaryGeographyName,
            rasterSketchSum: sk.primaryValue,
            rasterGeographySum: geographySum,
            fractionOfGeographyRasterSum: sk.fractionOfGeography,
            hasOverlap: sk.hasOverlap,
            overlapPartnerSketchNames: sk.overlapPartnerSketchNames.join("; "),
          });
        }
      }
    }
  }

  return [
    {
      id: sectionId,
      title: sectionTitle,
      columns: defaultColumns(mode, primaryGeographyId, primaryGeographyName),
      rows,
      extras: { mode },
    },
  ];
}

function defaultColumns(
  mode: ClassMode,
  _primaryGeographyId: number,
  _primaryGeographyName: string,
): WidgetExportSection["columns"] {
  const base: WidgetExportSection["columns"] = [
    { key: "scope", label: "scope", type: "string" },
    { key: "sketchId", label: "sketchId" },
    { key: "sketchName", label: "sketchName", type: "string" },
    { key: "sourceTitle", label: "sourceTitle", type: "string" },
    { key: "classLabel", label: "classLabel", type: "string" },
    { key: "primaryGeographyId", label: "primaryGeographyId", type: "number" },
    {
      key: "primaryGeographyName",
      label: "primaryGeographyName",
      type: "string",
    },
  ];
  if (mode === "overlay_area") {
    return [
      ...base,
      { key: "percentGeographyId", label: "percentGeographyId", type: "number" },
      {
        key: "percentGeographyName",
        label: "percentGeographyName",
        type: "string",
      },
      { key: "overlapAreaSqKm", label: "overlapAreaSqKm", type: "number" },
      {
        key: "overlapAreaMinSqKm",
        label: "overlapAreaMinSqKm",
        type: "number",
      },
      {
        key: "overlapAreaMaxSqKm",
        label: "overlapAreaMaxSqKm",
        type: "number",
      },
      { key: "accuracyNote", label: "accuracyNote", type: "string" },
      {
        key: "geographyTotalAreaSqKm",
        label: "geographyTotalAreaSqKm",
        type: "number",
      },
      {
        key: "fractionOfGeography",
        label: "fractionOfGeography",
        type: "number",
      },
      { key: "hasOverlap", label: "hasOverlap", type: "boolean" },
      {
        key: "overlapPartnerSketchNames",
        label: "overlapPartnerSketchNames",
        type: "string",
      },
    ];
  }
  if (mode === "count" || mode === "presence") {
    return [
      ...base,
      { key: "count", label: "count", type: "number" },
      {
        key: "geographyTotalCount",
        label: "geographyTotalCount",
        type: "number",
      },
      {
        key: "fractionOfGeography",
        label: "fractionOfGeography",
        type: "number",
      },
      { key: "present", label: "present", type: "boolean" },
      { key: "hasOverlap", label: "hasOverlap", type: "boolean" },
      {
        key: "overlapPartnerSketchNames",
        label: "overlapPartnerSketchNames",
        type: "string",
      },
    ];
  }
  return [
    ...base,
    { key: "rasterSketchSum", label: "rasterSketchSum", type: "number" },
    { key: "rasterGeographySum", label: "rasterGeographySum", type: "number" },
    {
      key: "fractionOfGeographyRasterSum",
      label: "fractionOfGeographyRasterSum",
      type: "number",
    },
    { key: "hasOverlap", label: "hasOverlap", type: "boolean" },
    {
      key: "overlapPartnerSketchNames",
      label: "overlapPartnerSketchNames",
      type: "string",
    },
  ];
}

export const exportOverlappingAreasTable: WidgetExporter = (input) =>
  exportClassTableWidget(input, "overlay_area", "overlapping-areas", "Overlapping areas");

export const exportFeatureCountTable: WidgetExporter = (input) =>
  exportClassTableWidget(input, "count", "feature-count", "Feature count");

export const exportFeaturePresenceTable: WidgetExporter = (input) =>
  exportClassTableWidget(input, "presence", "feature-presence", "Feature presence");

export const exportRasterProportionTable: WidgetExporter = (input) =>
  exportClassTableWidget(
    input,
    "raster_stats",
    "raster-proportion",
    "Raster proportion captured",
  );
