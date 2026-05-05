import {
  combineMetricsForFragments,
  subjectIsFragment,
  subjectIsGeography,
  type Metric,
  type TotalAreaMetric,
} from "overlay-engine";
import { SpatialMetricState } from "../../../../generated/graphql";
import { sketchContributionsGeographyTotalArea } from "../../collection/sketchContributions";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

export const exportGeographySizeTable: WidgetExporter = (input) => {
  const { metrics, geographies, componentSettings, subject, t } = input;
  const excludeSet = new Set(
    (componentSettings.excludeGeographies as number[] | undefined) ?? [],
  );
  const isCollection = subject.isCollection;
  const childSketchIds = subject.childSketches.map((c) => c.id);
  const sketchNameById = new Map(
    subject.childSketches.map((c) => [c.id, c.name] as const),
  );
  sketchNameById.set(subject.sketchId, subject.sketchName);

  const completeMetrics = metrics.filter(
    (m) => m.state === SpatialMetricState.Complete,
  );

  const rows: WidgetExportSection["rows"] = [];

  for (const geography of geographies.filter((g) => !excludeSet.has(g.id))) {
    const sketchMetrics = completeMetrics.filter(
      (m) =>
        subjectIsFragment(m.subject) &&
        m.subject.geographies.includes(geography.id),
    ) as Pick<Metric, "type" | "value">[];

    const geographyMetrics = completeMetrics.filter(
      (m) => subjectIsGeography(m.subject) && m.subject.id === geography.id,
    ) as Pick<Metric, "type" | "value">[];

    const geographyTotalSqKm =
      geographyMetrics.length > 0
        ? combineMetricsForFragments<TotalAreaMetric>(geographyMetrics).value ??
          0
        : 0;

    const sketchContributions = isCollection
      ? sketchContributionsGeographyTotalArea(
          completeMetrics as any,
          geography.id,
          geographyTotalSqKm,
          childSketchIds,
          sketchNameById,
          t,
        )
      : undefined;

    if (sketchMetrics.length === 0 || geographyMetrics.length === 0) {
      rows.push({
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        geographyId: geography.id,
        geographyName: geography.name,
        areaSqKm: 0,
        geographyTotalAreaSqKm: geographyTotalSqKm,
        fractionOfGeography: 0,
      });
      if (sketchContributions) {
        for (const c of sketchContributions) {
          rows.push({
            ...baseRow("sketch", c.sketchId, c.sketchName),
            geographyId: geography.id,
            geographyName: geography.name,
            areaSqKm: c.areaSqKm,
            geographyTotalAreaSqKm: geographyTotalSqKm,
            fractionOfGeography: c.fractionOfTotal,
            hasOverlap: c.hasOverlap,
            overlapPartnerSketchNames: c.overlapPartnerSketchNames.join("; "),
          });
        }
      }
      continue;
    }

    const areaSqKmMetric =
      combineMetricsForFragments<TotalAreaMetric>(sketchMetrics);
    const areaSqKm = areaSqKmMetric.value ?? 0;
    const fractionOfTotal =
      geographyTotalSqKm > 0 ? areaSqKm / geographyTotalSqKm : 0;

    rows.push({
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      geographyId: geography.id,
      geographyName: geography.name,
      areaSqKm,
      geographyTotalAreaSqKm: geographyTotalSqKm,
      fractionOfGeography: fractionOfTotal,
    });

    if (sketchContributions) {
      for (const c of sketchContributions) {
        rows.push({
          ...baseRow("sketch", c.sketchId, c.sketchName),
          geographyId: geography.id,
          geographyName: geography.name,
          areaSqKm: c.areaSqKm,
          geographyTotalAreaSqKm: geographyTotalSqKm,
          fractionOfGeography: c.fractionOfTotal,
          hasOverlap: c.hasOverlap,
          overlapPartnerSketchNames: c.overlapPartnerSketchNames.join("; "),
        });
      }
    }
  }

  const section: WidgetExportSection = {
    id: "geography-size",
    title: "Geography size",
    columns: [
      { key: "scope", label: "scope", type: "string" },
      { key: "sketchId", label: "sketchId" },
      { key: "sketchName", label: "sketchName", type: "string" },
      { key: "geographyId", label: "geographyId", type: "number" },
      { key: "geographyName", label: "geographyName", type: "string" },
      { key: "areaSqKm", label: "areaSqKm", type: "number" },
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
    ],
    rows,
  };

  return [section];
};
