import { hashMetricDependency, type MetricDependency } from "overlay-engine";
import { filterMetricsByDependencies } from "../../utils/metricSatisfiesDependency";
import type {
  CardExportFormat,
  CardExportInput,
  CardExportResult,
  WidgetExporterInput,
  WidgetExportSection,
} from "./types";
import { buildJsonExportDocument } from "./json";
import { packageSectionsAsCsvBlob } from "./package";
import { walkMetricWidgetNodes } from "./walkCardBody";
import { getWidgetExporter } from "./registry";
import { buildInlineMetricsSection } from "./exporters/inlineMetrics.export";
import { resolveClippingGeographyForExport } from "./exportContextHelpers";

function buildStableIdToSourceUrl(
  sources: CardExportInput["sources"],
): Record<string, string> {
  const m: Record<string, string> = {};
  for (const s of sources) {
    if (s.stableId && s.sourceUrl) {
      m[s.stableId] = s.sourceUrl;
    }
  }
  return m;
}

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

/**
 * Collects flattened export sections for a report card body + card-scoped metrics.
 */
export function collectCardExportSections(input: CardExportInput): WidgetExportSection[] {
  const primaryGeo =
    input.primaryGeographyId ??
    resolveClippingGeographyForExport(
      input.sketchClass,
      input.geographies,
      input.relatedFragments,
    )?.id;

  const inputWithPrimary: CardExportInput = {
    ...input,
    primaryGeographyId: primaryGeo,
  };

  const sourceUrlMap = buildStableIdToSourceUrl(inputWithPrimary.sources);
  const sections: WidgetExportSection[] = [];
  const inlineNodes: {
    walkIndex: number;
    dependencies: MetricDependency[];
    componentSettings: Record<string, unknown>;
  }[] = [];

  for (const node of walkMetricWidgetNodes(inputWithPrimary.body)) {
    if (node.widgetType === "InlineMetric") {
      inlineNodes.push({
        walkIndex: node.walkIndex,
        dependencies: node.dependencies,
        componentSettings: node.componentSettings,
      });
      continue;
    }
    const exporter = getWidgetExporter(node.widgetType);
    if (!exporter) continue;

    const filteredMetrics = filterMetricsByDependencies(
      inputWithPrimary.metrics,
      node.dependencies,
      sourceUrlMap,
    ) as CardExportInput["metrics"];
    const filteredSources = filterSourcesForDeps(
      inputWithPrimary.sources,
      node.dependencies,
    );

    const exporterInput: WidgetExporterInput = {
      dependencies: node.dependencies,
      metrics: filteredMetrics,
      sources: filteredSources,
      geographies: inputWithPrimary.geographies,
      componentSettings: node.componentSettings,
      sketchClass: inputWithPrimary.sketchClass,
      subject: inputWithPrimary.subject,
      relatedFragments: inputWithPrimary.relatedFragments,
      primaryGeographyId: primaryGeo,
      t: inputWithPrimary.t,
    };
    sections.push(...exporter(exporterInput));
  }

  if (inlineNodes.length > 0) {
    const inlineSection = buildInlineMetricsSection({
      ...inputWithPrimary,
      inlineNodes,
      sourceUrlMap,
    });
    if (inlineSection) sections.push(inlineSection);
  }

  return sections;
}

function slugifyFilenamePart(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function defaultReportFilenameBase(input: CardExportInput): string {
  const sketchSlug = slugifyFilenamePart(input.subject.sketchName);
  // eslint-disable-next-line i18next/no-literal-string
  return (
    String(input.subject.sketchId) +
    "-" +
    (sketchSlug || String(input.subject.sketchId)) +
    "-report-" +
    String(input.reportId)
  );
}

export function defaultCardFilenameBase(input: CardExportInput): string {
  const sketchSlug = slugifyFilenamePart(input.subject.sketchName);
  const cardSlug = slugifyFilenamePart(input.cardTitle || "");
  // eslint-disable-next-line i18next/no-literal-string
  return (
    String(input.subject.sketchId) +
    "-" +
    (sketchSlug || String(input.subject.sketchId)) +
    "-" +
    (cardSlug || "card") +
    "-" +
    String(input.cardId)
  );
}

/**
 * Export a single report card to JSON or CSV (single CSV or zip of CSVs).
 */
export async function exportReportCard(
  input: CardExportInput,
  format: CardExportFormat,
): Promise<CardExportResult> {
  const sections = collectCardExportSections(input);
  const primaryGeo =
    input.primaryGeographyId ??
    resolveClippingGeographyForExport(
      input.sketchClass,
      input.geographies,
      input.relatedFragments,
    )?.id;
  const inputWithPrimary: CardExportInput = { ...input, primaryGeographyId: primaryGeo };
  const base = defaultCardFilenameBase(inputWithPrimary);

  if (format === "json") {
    const body = buildJsonExportDocument(inputWithPrimary, sections);
    return {
      format: "json",
      body,
      // eslint-disable-next-line i18next/no-literal-string
      mimeType: "application/json",
      // eslint-disable-next-line i18next/no-literal-string
      filename: base + ".json",
    };
  }

  // Always zip CSV exports (even single section) so the report-style filename
  // can be used consistently.
  const { blob } = await packageSectionsAsCsvBlob(sections);
  return {
    format: "zip",
    blob,
    // eslint-disable-next-line i18next/no-literal-string
    mimeType: "application/zip",
    // eslint-disable-next-line i18next/no-literal-string
    filename: base + ".zip",
  };
}

export { hashMetricDependency };
