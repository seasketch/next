import {
  Metric,
  MetricSubjectFragment,
  OusDemographicsMetric,
  OusDemographicsMetricValue,
  combineMetricsForFragments,
  subjectIsFragment,
  summarizeOusDemographicsValue,
  OUS_DEMOGRAPHICS_ROLLUP_KEY,
} from "overlay-engine";
import { SpatialMetricState } from "../../../../generated/graphql";
import type {
  WidgetExporter,
  WidgetExportSection,
  WidgetExporterInput,
} from "../types";
import { baseRow } from "./shared";

function combineOusMetrics(
  fragmentMetrics: WidgetExporterInput["metrics"]
): OusDemographicsMetricValue {
  return combineMetricsForFragments<OusDemographicsMetric>(
    fragmentMetrics as Pick<Metric, "type" | "value">[],
    "ous_demographics"
  ).value;
}

export const exportOusDemographicsTable: WidgetExporter = (
  input: WidgetExporterInput
): WidgetExportSection[] => {
  const { dependencies, sources, metrics, componentSettings, subject } = input;

  const totalMode =
    (componentSettings.totalMode as string) === "participants"
      ? ("participants" as const)
      : ("representedInSector" as const);

  const dependency = dependencies.find((d) => d.type === "ous_demographics");
  const source = sources.find((s) => s.stableId === dependency?.stableId);
  const groupBy = (dependency?.parameters?.groupBy as string) || "sector";

  const fragmentMetrics = metrics.filter(
    (m) =>
      m.type === "ous_demographics" &&
      m.state === SpatialMetricState.Complete &&
      subjectIsFragment(m.subject) &&
      (!source?.sourceUrl || m.sourceUrl === source.sourceUrl)
  );

  const combined = combineOusMetrics(fragmentMetrics);
  const summaries = summarizeOusDemographicsValue(combined);
  const totals = combined.totals || {};

  const isCollection = subject.childSketches.length > 0;

  const columns: WidgetExportSection["columns"] = [
    { key: "scope", label: "scope", type: "string" },
    { key: "sketchId", label: "sketchId" },
    { key: "sketchName", label: "sketchName", type: "string" },
    { key: "sourceTitle", label: "sourceTitle", type: "string" },
    { key: "groupBy", label: "groupBy", type: "string" },
    { key: "group", label: "group", type: "string" },
    { key: "peopleWithinPlan", label: "peopleWithinPlan", type: "number" },
    {
      key: "respondentsWithinPlan",
      label: "respondentsWithinPlan",
      type: "number",
    },
    { key: "surveyTotal", label: "surveyTotal", type: "number" },
    { key: "totalMode", label: "totalMode", type: "string" },
    { key: "fractionOfTotal", label: "fractionOfTotal", type: "number" },
  ];

  const rows: WidgetExportSection["rows"] = [];
  const sourceTitle = source?.tableOfContentsItem?.title ?? "";

  const groupKeys = Object.keys(totals).sort((a, b) => {
    // Keep the rollup ("*") row last.
    if (a === OUS_DEMOGRAPHICS_ROLLUP_KEY) return 1;
    if (b === OUS_DEMOGRAPHICS_ROLLUP_KEY) return -1;
    return a.localeCompare(b);
  });

  for (const groupKey of groupKeys) {
    const within = summaries[groupKey]?.representedInSector ?? 0;
    const respondents = summaries[groupKey]?.respondents ?? 0;
    const total = totals[groupKey]?.[totalMode] ?? 0;
    rows.push({
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      sourceTitle,
      groupBy,
      group: groupKey,
      peopleWithinPlan: within,
      respondentsWithinPlan: respondents,
      surveyTotal: total,
      totalMode,
      // Participants-mode within-plan values are lower bounds, so a fraction
      // of the participants total would be misleading.
      fractionOfTotal:
        totalMode === "representedInSector" && total > 0
          ? within / total
          : null,
    });

    if (isCollection) {
      for (const child of subject.childSketches) {
        const bucket = fragmentMetrics.filter((m) =>
          (m.subject as MetricSubjectFragment).sketches.includes(child.id)
        );
        const childSummaries = summarizeOusDemographicsValue(
          combineOusMetrics(bucket)
        );
        const childWithin = childSummaries[groupKey]?.representedInSector ?? 0;
        rows.push({
          ...baseRow("sketch", child.id, child.name),
          sourceTitle,
          groupBy,
          group: groupKey,
          peopleWithinPlan: childWithin,
          respondentsWithinPlan: childSummaries[groupKey]?.respondents ?? 0,
          surveyTotal: total,
          totalMode,
          fractionOfTotal:
            totalMode === "representedInSector" && total > 0
              ? childWithin / total
              : null,
        });
      }
    }
  }

  return [
    {
      id: "ous-demographics-table",
      title: "OUS demographics",
      columns,
      rows,
      extras: {
        groupBy,
        totalMode,
        rollupGroupKey: OUS_DEMOGRAPHICS_ROLLUP_KEY,
      },
    },
  ];
};
