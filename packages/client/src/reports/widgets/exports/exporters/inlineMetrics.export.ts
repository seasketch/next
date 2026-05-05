import type { MetricDependency } from "overlay-engine";
import {
  combineMetricsForFragments,
  findPrimaryGeographyId,
  isNumberColumnValueStats,
  subjectIsFragment,
  subjectIsGeography,
  type ColumnValuesMetric,
  type CountMetric,
  type DistanceToShoreMetric,
  type Metric,
  type MetricSubjectFragment,
  type OverlayAreaMetric,
  type RasterStats,
  type TotalAreaMetric,
} from "overlay-engine";
import type { CompatibleSpatialMetricDetailsFragment } from "../../../../generated/graphql";
import { filterMetricsByDependencies } from "../../../utils/metricSatisfiesDependency";
import type { CardExportInput, WidgetExportSection } from "../types";
import { resolveClippingGeographyForExport } from "../exportContextHelpers";
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
    case "column_values":
      return "Column values";
    // eslint-disable-next-line i18next/no-literal-string
    case "raster_stats":
      return "Raster stats";
    // eslint-disable-next-line i18next/no-literal-string
    case "geography_raster_stats":
      return "Geography raster stats";
    // eslint-disable-next-line i18next/no-literal-string
    case "geography_proportion_captured":
      return "Geography proportion captured";
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
  opts: { clippingGeographyId?: number },
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
        const primary =
          opts.clippingGeographyId ??
          findPrimaryGeographyId(
            metrics as Pick<Metric, "type" | "value" | "subject">[],
          );
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
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[],
          "overlay_area",
        ) as OverlayAreaMetric;
        return combined.value["*"] ?? 0;
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
        const totalArea =
          geographyOverlayMetric.value["*"] ??
          Object.values(geographyOverlayMetric.value).reduce((s, v) => s + v, 0);
        return totalArea;
      }
      case "count": {
        const combined = combineMetricsForFragments(
          metrics as Pick<Metric, "type" | "value">[],
          "count",
        ) as CountMetric;
        return combined.value["*"]?.count ?? 0;
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
        const values = combined.value["*"];
        if (!values) return null;
        if (statKey === "countDistinct") {
          return values[prop]?.countDistinct ?? 0;
        }
        const cell = values[prop];
        if (cell && isNumberColumnValueStats(cell)) {
          if (statKey === "count") return cell.count;
          const v = cell[statKey as keyof typeof cell];
          return typeof v === "number" && Number.isFinite(v) ? v : null;
        }
        return null;
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
        const fragmentRasterMetrics = metrics.filter(
          (m) => m.type === "raster_stats" && subjectIsFragment(m.subject),
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
        { clippingGeographyId },
      );
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
        stableIds: c.node.dependencies.map((d) => d.stableId).filter(Boolean),
        sources: filterSourcesForDeps(input.sources, c.node.dependencies).map((s) => ({
          stableId: s.stableId,
          title: s.tableOfContentsItem?.title,
        })),
      })),
    },
  };
}
