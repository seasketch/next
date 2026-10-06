import {
  Metric,
  MetricSubjectFragment,
  OusDemographicsMetric,
  OusDemographicsMetricValue,
  combineMetricsForFragments,
  subjectIsFragment,
  subjectIsGeography,
  summarizeOusDemographicsValue,
  OUS_DEMOGRAPHICS_ROLLUP_KEY,
} from "overlay-engine";
import { SpatialMetricState } from "../../../../generated/graphql";
import {
  buildOusDemographicsFigures,
  ousFragmentBelongsToGeography,
  resolveOusDemographicsTotalScope,
} from "../../ousDemographicsRows";
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

function errorSection(message: string): WidgetExportSection[] {
  return [
    {
      id: "ous-demographics-table",
      title: "OUS demographics",
      columns: [{ key: "error", label: "error", type: "string" }],
      rows: [{ error: message }],
    },
  ];
}

export const exportOusDemographicsTable: WidgetExporter = (
  input: WidgetExporterInput
): WidgetExportSection[] => {
  const {
    dependencies,
    sources,
    metrics,
    componentSettings,
    subject,
    primaryGeographyId,
  } = input;

  const totalMode =
    (componentSettings.totalMode as string) === "participants"
      ? ("participants" as const)
      : ("representedInSector" as const);
  const savedScope = componentSettings.totalScope;
  const totalScope = resolveOusDemographicsTotalScope(
    savedScope === "dataset" || savedScope === "geography"
      ? savedScope
      : undefined,
    primaryGeographyId != null
  );

  const dependency = dependencies.find((d) => d.type === "ous_demographics");
  const source = sources.find((s) => s.stableId === dependency?.stableId);
  const groupBy = (dependency?.parameters?.groupBy as string) || "sector";

  const fragmentMetrics = metrics.filter(
    (m) =>
      m.type === "ous_demographics" &&
      m.state === SpatialMetricState.Complete &&
      subjectIsFragment(m.subject) &&
      (!source?.sourceUrl || m.sourceUrl === source.sourceUrl) &&
      (totalScope !== "geography" ||
        primaryGeographyId == null ||
        ousFragmentBelongsToGeography(m.subject, primaryGeographyId))
  );

  if (totalScope === "geography" && !primaryGeographyId) {
    return errorSection(
      "Clipping geography could not be resolved for this export."
    );
  }

  const geographyMetric =
    totalScope === "geography"
      ? metrics.find(
          (m) =>
            m.type === "ous_demographics" &&
            m.state === SpatialMetricState.Complete &&
            subjectIsGeography(m.subject) &&
            m.subject.id === primaryGeographyId &&
            (!source?.sourceUrl || m.sourceUrl === source.sourceUrl)
        )
      : undefined;

  if (totalScope === "geography" && !geographyMetric) {
    return errorSection(
      "Geography overlap metric is not available for this export."
    );
  }

  const combined = combineOusMetrics(fragmentMetrics);
  const summaries = summarizeOusDemographicsValue(combined);
  const figures = buildOusDemographicsFigures({
    fragmentValue: combined,
    geographyValue: geographyMetric?.value as
      | OusDemographicsMetricValue
      | undefined,
    totalScope,
    totalMode,
  });

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
    { key: "totalScope", label: "totalScope", type: "string" },
    { key: "fractionOfTotal", label: "fractionOfTotal", type: "number" },
  ];

  const rows: WidgetExportSection["rows"] = [];
  const sourceTitle = source?.tableOfContentsItem?.title ?? "";

  const ordered = [...figures.groups].sort((a, b) =>
    a.key.localeCompare(b.key)
  );
  if (figures.rollup) {
    ordered.push(figures.rollup);
  }

  for (const figure of ordered) {
    const respondents = summaries[figure.key]?.respondents ?? 0;
    rows.push({
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      sourceTitle,
      groupBy,
      group: figure.key,
      peopleWithinPlan: figure.within,
      respondentsWithinPlan: respondents,
      surveyTotal: figure.total,
      totalMode,
      totalScope,
      // Participants-mode within-plan values are lower bounds, so a fraction
      // of the participants total would be misleading.
      fractionOfTotal:
        totalMode === "representedInSector" && figure.total > 0
          ? figure.within / figure.total
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
        const childWithin = childSummaries[figure.key]?.representedInSector ?? 0;
        rows.push({
          ...baseRow("sketch", child.id, child.name),
          sourceTitle,
          groupBy,
          group: figure.key,
          peopleWithinPlan: childWithin,
          respondentsWithinPlan: childSummaries[figure.key]?.respondents ?? 0,
          surveyTotal: figure.total,
          totalMode,
          totalScope,
          fractionOfTotal:
            totalMode === "representedInSector" && figure.total > 0
              ? childWithin / figure.total
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
        totalScope,
        rollupGroupKey: OUS_DEMOGRAPHICS_ROLLUP_KEY,
      },
    },
  ];
};
