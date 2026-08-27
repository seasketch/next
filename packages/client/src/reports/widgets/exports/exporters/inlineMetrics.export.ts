import type { MetricDependency } from "overlay-engine";
import {
  combineMetricsForFragments,
  getOverlayAreaClassTotals,
  getOverlayAreaOverlapCombineResult,
  isOverlayAreaClassKey,
  subjectIsFragment,
  subjectIsGeography,
  attachRasterOverlayAreaOverlapScope,
  getRasterOverlayAreaDisplayedClassValue,
  getRasterOverlayAreaOverlapCombineResult,
  type ColumnValuesMetric,
  type CountMetric,
  type DistanceToShoreMetric,
  type Metric,
  type MetricSubjectFragment,
  type OverlayAreaMetric,
  type OverlayAreaMetricValue,
  type RasterOverlayAreaMetric,
  type RasterStats,
  type TotalAreaMetric,
} from "overlay-engine";
import {
  attachOverlayAreaOverlapScope,
  fragmentMetricsTaggedWithGeography,
} from "../../ClassTableRows";
import type { CompatibleSpatialMetricDetailsFragment } from "../../../../generated/graphql";
import { filterMetricsByDependencies } from "../../../utils/metricSatisfiesDependency";
import type { CardExportInput, WidgetExportSection } from "../types";
import { resolveClippingGeographyForExport } from "../exportContextHelpers";
import {
  InlineColumnStat,
  numberColumnStatOrZero,
} from "../../inlineColumnValues";
import {
  getColumnTotalFromGeostats,
  getFeatureCountFromGeostats,
} from "../../columnTotalFromGeostats";
import { baseRow } from "./shared";

export type InlineMetricExportNode = {
  walkIndex: number;
  dependencies: MetricDependency[];
  componentSettings: Record<string, unknown>;
};

export type BuildInlineMetricsInput = CardExportInput & {
  inlineNodes: InlineMetricExportNode[];
  sourceUrlMap: Record<string, string>;
};

function filterSourcesForDeps(
  allSources: CardExportInput["sources"],
  deps: MetricDependency[],
): CardExportInput["sources"] {
  const stableIds = new Set(
    deps.filter((d) => d.stableId).map((d) => d.stableId as string),
  );
  if (stableIds.size === 0) return [];
  return allSources.filter((s) => s.stableId && stableIds.has(s.stableId));
}

function filterMetricsForGrain(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  sketchFilterId: number | null,
): CompatibleSpatialMetricDetailsFragment[] {
  if (sketchFilterId == null) return metrics;
  return metrics.filter((m) => {
    if (subjectIsGeography(m.subject)) return true;
    if (subjectIsFragment(m.subject)) {
      const sub = m.subject as MetricSubjectFragment;
      return Array.isArray(sub.sketches) && sub.sketches.includes(sketchFilterId);
    }
    return false;
  });
}

type RowGrain = {
  scope: "collection" | "sketch";
  sketchId: number;
  sketchName: string;
  sketchFilterId: number | null;
};

function rowGrains(subject: CardExportInput["subject"]): RowGrain[] {
  const grains: RowGrain[] = [
    {
      scope: "collection",
      sketchId: subject.sketchId,
      sketchName: subject.sketchName,
      sketchFilterId: null,
    },
  ];
  if (subject.isCollection) {
    for (const c of subject.childSketches) {
      grains.push({
        scope: "sketch",
        sketchId: c.id,
        sketchName: c.name,
        sketchFilterId: c.id,
      });
    }
  }
  return grains;
}

function columnLabelForInline(node: InlineMetricExportNode): string {
  const pres = (node.componentSettings.presentation as string) || "total_area";
  const stat =
    (node.componentSettings.stat as string | undefined) ||
    (node.componentSettings.rasterStat as string | undefined) ||
    "";
  const col = (node.componentSettings.column as string | undefined) || "";
  const stable = node.dependencies[0]?.stableId || "source";
  // eslint-disable-next-line i18next/no-literal-string
  return `${pres}${stat ? `:${stat}` : ""}${col ? `:${col}` : ""} (${stable})`;
}

function slugifyColumnKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function humanPresentationLabel(presentation: string): string {
  switch (presentation) {
    // eslint-disable-next-line i18next/no-literal-string
    case "total_area":
      return "Total area";
    // eslint-disable-next-line i18next/no-literal-string
    case "percent_area":
      return "% of area";
    // eslint-disable-next-line i18next/no-literal-string
    case "distance_to_shore":
      return "Distance to shore";
    // eslint-disable-next-line i18next/no-literal-string
    case "overlay_area":
      return "Overlay area";
    // eslint-disable-next-line i18next/no-literal-string
    case "geography_overlay_area":
      return "Geography overlay area";
    // eslint-disable-next-line i18next/no-literal-string
    case "count":
      return "Count";
    // eslint-disable-next-line i18next/no-literal-string
    case "percent_count":
      return "% of geography count";
    // eslint-disable-next-line i18next/no-literal-string
    case "percent_count_total":
      return "% of total count";
    // eslint-disable-next-line i18next/no-literal-string
    case "column_values":
      return "Column values";
    // eslint-disable-next-line i18next/no-literal-string
    case "percent_column_total_overlapped":
      return "% of column total";
    // eslint-disable-next-line i18next/no-literal-string
    case "raster_stats":
      return "Raster stats";
    // eslint-disable-next-line i18next/no-literal-string
    case "geography_raster_stats":
      return "Geography raster stats";
    // eslint-disable-next-line i18next/no-literal-string
    case "geography_proportion_captured":
      return "Geography proportion captured";
    // eslint-disable-next-line i18next/no-literal-string
    case "raster_overlay_area":
      return "Raster area captured";
    default:
      return presentation;
  }
}

function humanInlineLabel(
  node: InlineMetricExportNode,
  sources: CardExportInput["sources"],
): string {
  const presentation =
    (node.componentSettings.presentation as string) || "total_area";
  const stableIds = node.dependencies
    .map((d) => d.stableId)
    .filter(Boolean) as string[];
  const sourceTitles = sources
    .filter((s) => s.stableId && stableIds.includes(s.stableId))
    .map((s) => s.tableOfContentsItem?.title)
    .filter(Boolean) as string[];
  // eslint-disable-next-line i18next/no-literal-string
  const sourcePart = sourceTitles[0] || stableIds[0] || "Source";

  const extra =
    (node.componentSettings.column as string | undefined) ||
    (node.componentSettings.stat as string | undefined) ||
    (node.componentSettings.rasterStat as string | undefined) ||
    "";

  // eslint-disable-next-line i18next/no-literal-string
  return `${sourcePart} – ${humanPresentationLabel(presentation)}${
    extra ? ` (${extra})` : ""
  }`;
}

function buildInlineColumnDescriptors(input: BuildInlineMetricsInput): Array<{
  node: InlineMetricExportNode;
  key: string;
  label: string;
}> {
  const used = new Set<string>();
  return input.inlineNodes.map((node) => {
    const presentation =
      (node.componentSettings.presentation as string) || "total_area";
    const stableIds = node.dependencies
      .map((d) => d.stableId)
      .filter(Boolean) as string[];
    const stable = stableIds[0] || "source";
    const sourceTitle =
      input.sources.find((s) => s.stableId && stableIds.includes(s.stableId))
        ?.tableOfContentsItem?.title || "";
    const sourceKeyPart = sourceTitle ? sourceTitle : stable;
    const extra =
      (node.componentSettings.column as string | undefined) ||
      (node.componentSettings.stat as string | undefined) ||
      (node.componentSettings.rasterStat as string | undefined) ||
      "";

    // Prefer human-readable keys. Put presentation first since it tends to be
    // the most useful scan anchor in a CSV header.
    const keyBaseParts = [presentation, extra, sourceKeyPart]
      .filter(Boolean)
      .map((p) => slugifyColumnKeyPart(String(p)));

    const rawBase = (keyBaseParts.join("_") || "metric").slice(0, 80);
    let key = rawBase;
    let i = 2;
    while (used.has(key)) {
      const suffix = `_${i++}`;
      key = (
        rawBase.slice(0, Math.max(1, 80 - suffix.length)) + suffix
      ).slice(0, 80);
    }
    used.add(key);

    return {
      node,
      key,
      label: humanInlineLabel(node, input.sources),
    };
  });
}

function extractInlineRawValue(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  componentSettings: Record<string, unknown>,
  opts: {
    clippingGeographyId?: number;
    sources?: CardExportInput["sources"];
    dependencies?: MetricDependency[];
  },
): string | number | boolean | null {
  const presentation = (componentSettings.presentation as string) || "total_area";
  try {
    switch (presentation) {
      case "total_area": {
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[],
          "total_area",
        ) as TotalAreaMetric;
        return combined.value ?? 0;
      }
      case "percent_area": {
        const primary = opts.clippingGeographyId;
        if (!primary) return null;
        const totalArea = combineMetricsForFragments(
          metrics.filter((m) => subjectIsFragment(m.subject)) as Pick<
            Metric,
            "type" | "value"
          >[],
          "total_area",
        ) as TotalAreaMetric;
        const geographyAreaMetric = metrics.find(
          (m) => subjectIsGeography(m.subject) && m.subject.id === primary,
        ) as TotalAreaMetric | undefined;
        if (!geographyAreaMetric || !geographyAreaMetric.value) return null;
        return totalArea.value / geographyAreaMetric.value;
      }
      case "distance_to_shore": {
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[],
          "distance_to_shore",
        ) as DistanceToShoreMetric;
        return combined.value.meters;
      }
      case "overlay_area": {
        const overlayMetrics = metrics.filter(
          (m) => m.type === "overlay_area" && subjectIsFragment(m.subject),
        );
        let combined = combineMetricsForFragments(
          overlayMetrics as Pick<Metric, "type" | "value">[],
          "overlay_area",
        ) as OverlayAreaMetric;
        combined = attachOverlayAreaOverlapScope(
          combined,
          overlayMetrics,
        ) as OverlayAreaMetric;
        const totals = getOverlayAreaClassTotals(combined.value);
        return totals["*"] ?? 0;
      }
      case "geography_overlay_area": {
        const geographyId =
          componentSettings.geographyId === "auto" ||
          componentSettings.geographyId === undefined
            ? opts.clippingGeographyId
            : (componentSettings.geographyId as number);
        if (geographyId === undefined) return null;
        const geographyOverlayMetric = metrics.find(
          (m) =>
            m.type === "overlay_area" &&
            subjectIsGeography(m.subject) &&
            m.subject.id === geographyId,
        ) as OverlayAreaMetric | undefined;
        if (!geographyOverlayMetric) return null;
        const totals = getOverlayAreaClassTotals(geographyOverlayMetric.value);
        const totalArea =
          totals["*"] ??
          Object.entries(geographyOverlayMetric.value).reduce(
            (s, [key, v]) =>
              isOverlayAreaClassKey(key) && typeof v === "number" ? s + v : s,
            0,
          );
        return totalArea;
      }
      case "count": {
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[],
          "count",
        ) as CountMetric;
        return combined.value["*"]?.count ?? 0;
      }
      case "percent_count": {
        const geographyId =
          componentSettings.geographyId === "auto" ||
          componentSettings.geographyId === undefined
            ? opts.clippingGeographyId
            : (componentSettings.geographyId as number);
        if (geographyId === undefined) return null;
        const combined = combineMetricsForFragments(
          fragmentMetricsTaggedWithGeography(
            metrics,
            geographyId,
            "count",
          ) as Pick<Metric, "type" | "value">[],
          "count",
        ) as CountMetric;
        const count = combined.value["*"]?.count ?? 0;
        const geographyCountMetric = metrics.find(
          (m) =>
            m.type === "count" &&
            subjectIsGeography(m.subject) &&
            m.subject.id === geographyId,
        ) as CountMetric | undefined;
        const geographyCount = geographyCountMetric?.value["*"]?.count ?? 0;
        if (!geographyCount) return 0;
        return count / geographyCount;
      }
      case "percent_count_total": {
        const combined = combineMetricsForFragments(
          metrics.filter(
            (m) => m.type === "count" && subjectIsFragment(m.subject),
          ) as Pick<Metric, "type" | "value">[],
          "count",
        ) as CountMetric;
        const count = combined.value["*"]?.count ?? 0;
        const source =
          opts.sources && opts.dependencies
            ? filterSourcesForDeps(opts.sources, opts.dependencies)[0]
            : undefined;
        const layerTotal = getFeatureCountFromGeostats(source?.geostats);
        if (layerTotal === null || layerTotal === 0) return 0;
        return count / layerTotal;
      }
      case "percent_column_total_overlapped": {
        const columnValues = metrics.filter(
          (m) => m.type === "column_values" && subjectIsFragment(m.subject),
        );
        if (!columnValues.length) return null;
        const combined = combineMetricsForFragments(
          columnValues as Pick<Metric, "type" | "value">[],
          "column_values",
        ) as ColumnValuesMetric;
        const prop = (componentSettings.column as string) || "";
        const sum = numberColumnStatOrZero(combined.value["*"], prop, "sum");
        const source =
          opts.sources && opts.dependencies
            ? filterSourcesForDeps(opts.sources, opts.dependencies)[0]
            : undefined;
        const columnTotal = getColumnTotalFromGeostats(source?.geostats, prop);
        if (columnTotal === null || columnTotal === 0) return 0;
        return sum / columnTotal;
      }
      case "column_values": {
        const columnValues = metrics.filter(
          (m) => m.type === "column_values" && subjectIsFragment(m.subject),
        );
        if (!columnValues.length) return null;
        const combined = combineMetricsForFragments(
          columnValues as Pick<Metric, "type" | "value">[],
          "column_values",
        ) as ColumnValuesMetric;
        const prop = (componentSettings.column as string) || "";
        const statKey = (componentSettings.stat as string) || "mean";
        return numberColumnStatOrZero(
          combined.value["*"],
          prop,
          statKey as InlineColumnStat,
        );
      }
      case "raster_stats": {
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[],
          "raster_stats",
        ) as RasterStats;
        const rasterStat = (componentSettings.rasterStat as string) || "mean";
        const band0 = combined.value.bands[0] as Record<string, unknown>;
        const v = band0?.[rasterStat];
        return typeof v === "number" && Number.isFinite(v) ? v : null;
      }
      case "geography_raster_stats": {
        const geographyId =
          componentSettings.geographyId === "auto" ||
          componentSettings.geographyId === undefined
            ? opts.clippingGeographyId
            : (componentSettings.geographyId as number);
        if (geographyId === undefined) return null;
        const geographyRasterMetric = metrics.find(
          (m) =>
            m.type === "raster_stats" &&
            subjectIsGeography(m.subject) &&
            m.subject.id === geographyId,
        ) as RasterStats | undefined;
        if (!geographyRasterMetric?.value.bands?.[0]) return null;
        const rasterStat = (componentSettings.rasterStat as string) || "mean";
        const b0 = geographyRasterMetric.value.bands[0] as Record<string, unknown>;
        const v = b0[rasterStat];
        return typeof v === "number" && Number.isFinite(v) ? v : null;
      }
      case "geography_proportion_captured": {
        const geographyId =
          componentSettings.geographyId === "auto" ||
          componentSettings.geographyId === undefined
            ? opts.clippingGeographyId
            : (componentSettings.geographyId as number);
        if (geographyId === undefined) return null;
        const overlayFragmentMetrics = fragmentMetricsTaggedWithGeography(
          metrics,
          geographyId,
          "overlay_area",
        );
        const overlayGeographyMetric = metrics.find(
          (m) =>
            m.type === "overlay_area" &&
            subjectIsGeography(m.subject) &&
            m.subject.id === geographyId,
        ) as OverlayAreaMetric | undefined;
        const hasOverlayArea =
          overlayGeographyMetric != null ||
          metrics.some((m) => m.type === "overlay_area");
        if (hasOverlayArea) {
          let sketchArea = 0;
          if (overlayFragmentMetrics.length > 0) {
            let combined = combineMetricsForFragments(
              overlayFragmentMetrics as Pick<Metric, "type" | "value">[],
              "overlay_area",
            ) as OverlayAreaMetric;
            combined = attachOverlayAreaOverlapScope(
              combined,
              overlayFragmentMetrics,
            ) as OverlayAreaMetric;
            sketchArea = getOverlayAreaClassTotals(combined.value)["*"] ?? 0;
          }
          const geographyTotals = overlayGeographyMetric
            ? getOverlayAreaClassTotals(overlayGeographyMetric.value)
            : {};
          const geographyArea =
            geographyTotals["*"] ??
            Object.entries(overlayGeographyMetric?.value || {}).reduce(
              (s, [key, v]) =>
                isOverlayAreaClassKey(key) && typeof v === "number"
                  ? s + v
                  : s,
              0,
            );
          if (!geographyArea) return 0;
          return sketchArea / geographyArea;
        }
        const fragmentRasterMetrics = fragmentMetricsTaggedWithGeography(
          metrics,
          geographyId,
          "raster_stats",
        );
        const combinedSketch = combineMetricsForFragments(
          fragmentRasterMetrics as Pick<Metric, "type" | "value">[],
          "raster_stats",
        ) as RasterStats;
        const sketchSum = combinedSketch.value.bands[0]?.sum ?? 0;
        const geographyRasterMetric = metrics.find(
          (m) =>
            m.type === "raster_stats" &&
            subjectIsGeography(m.subject) &&
            m.subject.id === geographyId,
        ) as RasterStats | undefined;
        const geographySum = geographyRasterMetric?.value.bands[0]?.sum ?? 0;
        if (!geographySum) return 0;
        return sketchSum / geographySum;
      }
      case "raster_overlay_area": {
        const overlayMetrics = metrics.filter(
          (m) =>
            m.type === "raster_overlay_area" && subjectIsFragment(m.subject),
        );
        if (!overlayMetrics.length) return null;
        let combined = combineMetricsForFragments(
          overlayMetrics as Pick<Metric, "type" | "value">[],
          "raster_overlay_area",
        ) as RasterOverlayAreaMetric;
        combined = attachRasterOverlayAreaOverlapScope(
          combined,
          overlayMetrics,
        ) as RasterOverlayAreaMetric;
        return getRasterOverlayAreaDisplayedClassValue(combined.value, "*");
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function buildInlineMetricsSection(
  input: BuildInlineMetricsInput,
): WidgetExportSection | null {
  if (input.inlineNodes.length === 0) return null;

  const clippingGeographyId =
    input.primaryGeographyId ??
    resolveClippingGeographyForExport(
      input.sketchClass,
      input.geographies,
      input.relatedFragments,
    )?.id;

  const grains = rowGrains(input.subject);
  const inlineCols = buildInlineColumnDescriptors(input);

  const overlayAccuracyCols = inlineCols.flatMap((c) => {
    const presentation = c.node.componentSettings.presentation as string;
    if (
      presentation !== "overlay_area" &&
      presentation !== "raster_overlay_area"
    ) {
      return [];
    }
    return [
      {
        // eslint-disable-next-line i18next/no-literal-string
        key: `${c.key}__minSqKm`,
        // eslint-disable-next-line i18next/no-literal-string
        label: `${c.label} (min km²)`,
        type: "number" as const,
      },
      {
        // eslint-disable-next-line i18next/no-literal-string
        key: `${c.key}__maxSqKm`,
        // eslint-disable-next-line i18next/no-literal-string
        label: `${c.label} (max km²)`,
        type: "number" as const,
      },
      {
        // eslint-disable-next-line i18next/no-literal-string
        key: `${c.key}__accuracyNote`,
        // eslint-disable-next-line i18next/no-literal-string
        label: `${c.label} accuracy`,
        type: "string" as const,
      },
    ];
  });

  const columns: WidgetExportSection["columns"] = [
    // eslint-disable-next-line i18next/no-literal-string
    { key: "scope", label: "scope", type: "string" },
    // eslint-disable-next-line i18next/no-literal-string
    { key: "sketchId", label: "sketchId" },
    // eslint-disable-next-line i18next/no-literal-string
    { key: "sketchName", label: "sketchName", type: "string" },
    ...inlineCols.map((c) => ({
      // eslint-disable-next-line i18next/no-literal-string
      key: c.key,
      label: c.label,
      type: "number" as const,
    })),
    ...overlayAccuracyCols,
  ];

  const rows: WidgetExportSection["rows"] = [];

  for (const grain of grains) {
    const row: WidgetExportSection["rows"][0] = {
      ...baseRow(grain.scope, grain.sketchId, grain.sketchName),
    };
    for (const c of inlineCols) {
      const filteredMetrics = filterMetricsByDependencies(
        input.metrics,
        c.node.dependencies,
        input.sourceUrlMap as { [tableOfContentsItemId: number]: string },
      ) as CompatibleSpatialMetricDetailsFragment[];
      const forGrain = filterMetricsForGrain(filteredMetrics, grain.sketchFilterId);
      row[c.key] = extractInlineRawValue(
        forGrain,
        c.node.componentSettings,
        {
          clippingGeographyId,
          sources: input.sources,
          dependencies: c.node.dependencies,
        },
      );
      if (c.node.componentSettings.presentation === "overlay_area") {
        const overlayMetrics = forGrain.filter(
          (m) => m.type === "overlay_area" && subjectIsFragment(m.subject),
        );
        try {
          let combined = combineMetricsForFragments(
            overlayMetrics as Pick<Metric, "type" | "value">[],
            "overlay_area",
          ) as OverlayAreaMetric;
          combined = attachOverlayAreaOverlapScope(
            combined,
            overlayMetrics,
          ) as OverlayAreaMetric;
          const combine = getOverlayAreaOverlapCombineResult(
            combined.value as OverlayAreaMetricValue,
          );
          const star = combine?.perClass?.["*"];
          if (star) {
            row[`${c.key}__minSqKm`] = star.naiveSum - star.overcountMax;
            row[`${c.key}__maxSqKm`] = star.naiveSum - star.overcountMin;
            /* eslint-disable i18next/no-literal-string -- machine-readable CSV notes */
            if (
              star.overcountMax > star.overcountMin &&
              star.naiveSum > 0
            ) {
              const residual = star.overcountMax - star.overcountMin;
              const pct = Math.ceil((residual / star.naiveSum) * 100);
              row[`${c.key}__accuracyNote`] =
                `may be overestimated up to ${pct}%`;
            } else if (star.overcountMin > 0) {
              row[`${c.key}__accuracyNote`] = "deduplicated";
            } else {
              row[`${c.key}__accuracyNote`] = "";
            }
            /* eslint-enable i18next/no-literal-string */
          } else {
            row[`${c.key}__minSqKm`] = null;
            row[`${c.key}__maxSqKm`] = null;
            row[`${c.key}__accuracyNote`] = "";
          }
        } catch {
          row[`${c.key}__minSqKm`] = null;
          row[`${c.key}__maxSqKm`] = null;
          row[`${c.key}__accuracyNote`] = "";
        }
      }
      if (c.node.componentSettings.presentation === "raster_overlay_area") {
        const overlayMetrics = forGrain.filter(
          (m) =>
            m.type === "raster_overlay_area" && subjectIsFragment(m.subject),
        );
        try {
          let combined = combineMetricsForFragments(
            overlayMetrics as Pick<Metric, "type" | "value">[],
            "raster_overlay_area",
          ) as RasterOverlayAreaMetric;
          combined = attachRasterOverlayAreaOverlapScope(
            combined,
            overlayMetrics,
          ) as RasterOverlayAreaMetric;
          const combine = getRasterOverlayAreaOverlapCombineResult(
            combined.value,
          );
          const star = combine?.perClass?.["*"];
          if (star) {
            row[`${c.key}__minSqKm`] = star.naiveSum - star.overcountMax;
            row[`${c.key}__maxSqKm`] = star.naiveSum - star.overcountMin;
            /* eslint-disable i18next/no-literal-string -- machine-readable CSV notes */
            if (
              star.overcountMax > star.overcountMin &&
              star.naiveSum > 0
            ) {
              const residual = star.overcountMax - star.overcountMin;
              const pct = Math.ceil((residual / star.naiveSum) * 100);
              row[`${c.key}__accuracyNote`] =
                `may be overestimated up to ${pct}%`;
            } else if (star.overcountMin > 0) {
              row[`${c.key}__accuracyNote`] = "deduplicated";
            } else {
              row[`${c.key}__accuracyNote`] = "";
            }
            /* eslint-enable i18next/no-literal-string */
          } else {
            row[`${c.key}__minSqKm`] = null;
            row[`${c.key}__maxSqKm`] = null;
            row[`${c.key}__accuracyNote`] = "";
          }
        } catch {
          row[`${c.key}__minSqKm`] = null;
          row[`${c.key}__maxSqKm`] = null;
          row[`${c.key}__accuracyNote`] = "";
        }
      }
    }
    rows.push(row);
  }

  return {
    // eslint-disable-next-line i18next/no-literal-string
    id: "inline-metrics",
    // eslint-disable-next-line i18next/no-literal-string
    title: "Inline metrics",
    columns,
    rows,
    extras: {
      columnMeta: inlineCols.map((c) => ({
        // eslint-disable-next-line i18next/no-literal-string
        key: c.key,
        label: c.label,
        walkIndex: c.node.walkIndex,
        presentation: c.node.componentSettings.presentation,
        stat: c.node.componentSettings.stat,
        rasterStat: c.node.componentSettings.rasterStat,
        column: c.node.componentSettings.column,
        bufferDistanceKm: c.node.dependencies.find(
          (d) => d.parameters?.bufferDistanceKm !== undefined,
        )?.parameters?.bufferDistanceKm,
        stableIds: c.node.dependencies.map((d) => d.stableId).filter(Boolean),
        sources: filterSourcesForDeps(input.sources, c.node.dependencies).map((s) => ({
          stableId: s.stableId,
          title: s.tableOfContentsItem?.title,
        })),
      })),
    },
  };
}
