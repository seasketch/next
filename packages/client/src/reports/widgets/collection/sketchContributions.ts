import type { TFunction } from "i18next";
import type { Metric, MetricSubjectFragment } from "overlay-engine";
import {
  combineMetricsForFragments,
  subjectIsFragment,
  TotalAreaMetric,
} from "overlay-engine";
import type {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
} from "../../../generated/graphql";
import { dedupeCompleteSpatialMetrics } from "./dedupeMetrics";

export type GeographySketchContribution = {
  sketchId: number;
  sketchName: string;
  areaSqKm: number;
  fractionOfTotal: number;
  hasOverlap: boolean;
  /** Other child sketches linked via shared fragment metrics (sorted names). */
  overlapPartnerSketchNames: string[];
};

export type ClassRowSketchContribution = {
  sketchId: number;
  sketchName: string;
  primaryValue: number;
  fractionOfGeography: number;
  hasOverlap: boolean;
  overlapPartnerSketchNames: string[];
};

/**
 * Unique partner sketch display names for metrics where `subject.sketches` links this sketch with others.
 */
export function overlapPartnerSketchNamesForBucket(
  sketchId: number,
  bucket: CompatibleSpatialMetricDetailsFragment[],
  sketchNameById: Map<number, string>,
  t: TFunction,
): string[] {
  const partnerIds = new Set<number>();
  for (const m of bucket) {
    const subject = m.subject as MetricSubjectFragment;
    if (subject.sketches.length <= 1) continue;
    for (const id of subject.sketches) {
      if (id !== sketchId) partnerIds.add(id);
    }
  }
  return Array.from(partnerIds)
    .map((id) => sketchNameById.get(id) ?? t("Sketch #{{id}}", { id }))
    .sort((a, b) => a.localeCompare(b));
}

function uniqueSketchIdsFromFragmentMetrics(
  metrics: CompatibleSpatialMetricDetailsFragment[],
): number[] {
  const ids = new Set<number>();
  for (const m of metrics) {
    if (!subjectIsFragment(m.subject)) continue;
    for (const id of (m.subject as MetricSubjectFragment).sketches) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

/**
 * Per-sketch total area for a geography: membership buckets + combineMetricsForFragments.
 * Sum of sketch rows may exceed parent when fragments are shared across sketches.
 */
export function sketchContributionsGeographyTotalArea(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  geographyId: number,
  geographyTotalSqKm: number,
  childSketchIds: number[],
  sketchNameById: Map<number, string>,
  t: TFunction,
): GeographySketchContribution[] {
  const complete = dedupeCompleteSpatialMetrics(metrics);
  const fragmentAreaMetrics = complete.filter(
    (m) =>
      m.type === "total_area" &&
      subjectIsFragment(m.subject) &&
      m.subject.geographies.includes(geographyId),
  );

  const sketchIdsToIterate =
    childSketchIds.length > 0
      ? childSketchIds
      : uniqueSketchIdsFromFragmentMetrics(fragmentAreaMetrics);

  const rows: GeographySketchContribution[] = [];
  for (const sketchId of sketchIdsToIterate) {
    const bucket = fragmentAreaMetrics.filter((m) =>
      (m.subject as MetricSubjectFragment).sketches.includes(sketchId),
    );
    const combined = combineMetricsForFragments<TotalAreaMetric>(
      bucket as Pick<Metric, "type" | "value">[],
      "total_area",
    );
    const areaSqKm = combined.value ?? 0;
    const hasOverlap = bucket.some(
      (m) => (m.subject as MetricSubjectFragment).sketches.length > 1,
    );
    const overlapPartnerSketchNames = overlapPartnerSketchNamesForBucket(
      sketchId,
      bucket,
      sketchNameById,
      t,
    );
    rows.push({
      sketchId,
      sketchName:
        sketchNameById.get(sketchId) ?? t("Sketch #{{id}}", { id: sketchId }),
      areaSqKm,
      fractionOfTotal:
        geographyTotalSqKm > 0 ? areaSqKm / geographyTotalSqKm : 0,
      hasOverlap,
      overlapPartnerSketchNames,
    });
  }

  rows.sort((a, b) =>
    b.areaSqKm !== a.areaSqKm
      ? b.areaSqKm - a.areaSqKm
      : a.sketchName.localeCompare(b.sketchName),
  );

  return rows;
}

function extractCombinedClassSlice(
  combined: Pick<Metric, "type" | "value">,
  metricType: "overlay_area" | "count" | "raster_stats",
  groupByKey: string,
): number {
  switch (metricType) {
    case "overlay_area":
      return (
        (combined.value as Record<string, number>)?.[groupByKey] ?? 0
      );
    case "count":
      return (
        (combined.value as Record<string, { count: number }>)?.[groupByKey]
          ?.count ?? 0
      );
    case "raster_stats":
      return (
        (combined.value as { bands?: Array<{ sum?: number }> })?.bands?.[0]
          ?.sum ?? 0
      );
    default:
      return 0;
  }
}

/**
 * Per-sketch stats for one overlay class-table row (single source + groupByKey).
 */
export function sketchContributionsForClassTableRow(opts: {
  metrics: CompatibleSpatialMetricDetailsFragment[];
  source: OverlaySourceDetailsFragment;
  geographyId: number;
  metricType: "overlay_area" | "count" | "raster_stats";
  groupByKey: string;
  childSketchIds: number[];
  geographyDenominator: number;
  sketchNameById: Map<number, string>;
  t: TFunction;
}): ClassRowSketchContribution[] {
  const {
    metrics,
    source,
    geographyId,
    metricType,
    groupByKey,
    childSketchIds,
    geographyDenominator,
    sketchNameById,
    t,
  } = opts;

  const complete = dedupeCompleteSpatialMetrics(metrics);
  const baseFiltered = complete.filter(
    (m) =>
      m.type === metricType &&
      subjectIsFragment(m.subject) &&
      m.subject.geographies.includes(geographyId) &&
      m.sourceUrl === source.sourceUrl,
  );

  const sketchIdsToIterate =
    childSketchIds.length > 0
      ? childSketchIds
      : uniqueSketchIdsFromFragmentMetrics(baseFiltered);

  const rows: ClassRowSketchContribution[] = [];

  for (const sketchId of sketchIdsToIterate) {
    const bucket = baseFiltered.filter((m) =>
      (m.subject as MetricSubjectFragment).sketches.includes(sketchId),
    );
    const combined = combineMetricsForFragments(
      bucket as Pick<Metric, "type" | "value">[],
      metricType,
    );
    const primaryValue = extractCombinedClassSlice(
      combined,
      metricType,
      groupByKey,
    );
    const hasOverlap = bucket.some(
      (m) => (m.subject as MetricSubjectFragment).sketches.length > 1,
    );
    const overlapPartnerSketchNames = overlapPartnerSketchNamesForBucket(
      sketchId,
      bucket,
      sketchNameById,
      t,
    );

    rows.push({
      sketchId,
      sketchName:
        sketchNameById.get(sketchId) ?? t("Sketch #{{id}}", { id: sketchId }),
      primaryValue,
      fractionOfGeography:
        geographyDenominator > 0 ? primaryValue / geographyDenominator : 0,
      hasOverlap,
      overlapPartnerSketchNames,
    });
  }

  rows.sort((a, b) =>
    b.primaryValue !== a.primaryValue
      ? b.primaryValue - a.primaryValue
      : a.sketchName.localeCompare(b.sketchName),
  );

  return rows;
}
