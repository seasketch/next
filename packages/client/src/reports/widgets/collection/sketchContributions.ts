import type { TFunction } from "i18next";
import type { Metric, MetricSubjectFragment } from "overlay-engine";
import {
  combineMetricsForFragments,
  getOverlayAreaOverlapCombineResult,
  OverlayAreaMetricValue,
  subjectIsFragment,
  TotalAreaMetric,
} from "overlay-engine";
import type {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
} from "../../../generated/graphql";
import { dedupeCompleteSpatialMetrics } from "./dedupeMetrics";
import { attachOverlayAreaOverlapScope } from "../ClassTableRows";

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
  /**
   * True when overlap partners come from buffered analysis regions rather
   * than shared unbuffered fragments. @see OverlayAreaOverlapInfo
   */
  hasBufferedOverlap?: boolean;
};

/**
 * Fragment metrics may list sketch IDs outside the collection under report
 * (shared fragment geometry). Only treat IDs in {@link collectionSketchIds}
 * as overlap partners when that set is non-empty.
 */
function partnerSketchIdsOnFragment(
  fragmentSketchIds: readonly number[],
  sketchId: number,
  collectionSketchIds: Set<number> | undefined
): number[] {
  return fragmentSketchIds.filter((id) => {
    if (id === sketchId) return false;
    if (collectionSketchIds && collectionSketchIds.size > 0) {
      return collectionSketchIds.has(id);
    }
    return true;
  });
}

function bucketHasIntraCollectionOverlap(
  bucket: CompatibleSpatialMetricDetailsFragment[],
  sketchId: number,
  collectionSketchIds: Set<number> | undefined
): boolean {
  return bucket.some((m) => {
    const sketches = (m.subject as MetricSubjectFragment).sketches;
    return (
      partnerSketchIdsOnFragment(sketches, sketchId, collectionSketchIds)
        .length > 0
    );
  });
}

/**
 * Unique partner sketch display names for metrics where `subject.sketches`
 * links this sketch with others (optionally restricted to collection members).
 */
export function overlapPartnerSketchNamesForBucket(
  sketchId: number,
  bucket: CompatibleSpatialMetricDetailsFragment[],
  sketchNameById: Map<number, string>,
  t: TFunction,
  collectionSketchIds?: Set<number>
): string[] {
  const partnerIds = new Set<number>();
  for (const m of bucket) {
    const subject = m.subject as MetricSubjectFragment;
    for (const id of partnerSketchIdsOnFragment(
      subject.sketches,
      sketchId,
      collectionSketchIds
    )) {
      partnerIds.add(id);
    }
  }
  return Array.from(partnerIds)
    .map((id) => sketchNameById.get(id) ?? t("Sketch #{{id}}", { id }))
    .sort((a, b) => a.localeCompare(b));
}

function uniqueSketchIdsFromFragmentMetrics(
  metrics: CompatibleSpatialMetricDetailsFragment[]
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
  t: TFunction
): GeographySketchContribution[] {
  const complete = dedupeCompleteSpatialMetrics(metrics);
  const fragmentAreaMetrics = complete.filter(
    (m) =>
      m.type === "total_area" &&
      subjectIsFragment(m.subject) &&
      m.subject.geographies.includes(geographyId)
  );

  const sketchIdsToIterate =
    childSketchIds.length > 0
      ? childSketchIds
      : uniqueSketchIdsFromFragmentMetrics(fragmentAreaMetrics);

  const collectionSketchIds =
    childSketchIds.length > 0 ? new Set(childSketchIds) : undefined;

  const rows: GeographySketchContribution[] = [];
  for (const sketchId of sketchIdsToIterate) {
    const bucket = fragmentAreaMetrics.filter((m) =>
      (m.subject as MetricSubjectFragment).sketches.includes(sketchId)
    );
    const combined = combineMetricsForFragments<TotalAreaMetric>(
      bucket as Pick<Metric, "type" | "value">[],
      "total_area"
    );
    const areaSqKm = combined.value ?? 0;
    const hasOverlap = bucketHasIntraCollectionOverlap(
      bucket,
      sketchId,
      collectionSketchIds
    );
    const overlapPartnerSketchNames = overlapPartnerSketchNamesForBucket(
      sketchId,
      bucket,
      sketchNameById,
      t,
      collectionSketchIds
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
      : a.sketchName.localeCompare(b.sketchName)
  );

  return rows;
}

function extractCombinedClassSlice(
  combined: Pick<Metric, "type" | "value">,
  metricType: "overlay_area" | "count" | "raster_stats" | "column_values",
  groupByKey: string,
  valueColumn?: string
): number {
  switch (metricType) {
    case "overlay_area": {
      const raw = (combined.value as OverlayAreaMetricValue)?.[groupByKey];
      return typeof raw === "number" ? raw : 0;
    }
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
    case "column_values": {
      if (!valueColumn) return 0;
      const cell = (
        combined.value as Record<
          string,
          Record<string, { sum?: number } | undefined>
        >
      )?.[groupByKey]?.[valueColumn];
      return typeof cell?.sum === "number" && Number.isFinite(cell.sum)
        ? cell.sum
        : 0;
    }
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
  metricType: "overlay_area" | "count" | "raster_stats" | "column_values";
  groupByKey: string;
  childSketchIds: number[];
  geographyDenominator: number;
  sketchNameById: Map<number, string>;
  t: TFunction;
  /** Required when metricType is column_values. */
  valueColumn?: string;
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
    valueColumn,
  } = opts;

  const complete = dedupeCompleteSpatialMetrics(metrics);
  const baseFiltered = complete.filter(
    (m) =>
      m.type === metricType &&
      subjectIsFragment(m.subject) &&
      m.subject.geographies.includes(geographyId) &&
      m.sourceUrl === source.sourceUrl
  );

  const sketchIdsToIterate =
    childSketchIds.length > 0
      ? childSketchIds
      : uniqueSketchIdsFromFragmentMetrics(baseFiltered);

  const collectionSketchIds =
    childSketchIds.length > 0 ? new Set(childSketchIds) : undefined;

  const rows: ClassRowSketchContribution[] = [];

  for (const sketchId of sketchIdsToIterate) {
    const bucket = baseFiltered.filter((m) =>
      (m.subject as MetricSubjectFragment).sketches.includes(sketchId)
    );
    let combined = combineMetricsForFragments(
      bucket as Pick<Metric, "type" | "value">[],
      metricType
    );
    if (metricType === "overlay_area") {
      combined = attachOverlayAreaOverlapScope(combined, bucket);
    }
    const primaryValue = extractCombinedClassSlice(
      combined,
      metricType,
      groupByKey,
      valueColumn
    );
    const fragmentOverlap = bucketHasIntraCollectionOverlap(
      bucket,
      sketchId,
      collectionSketchIds
    );
    let overlapPartnerSketchNames = overlapPartnerSketchNamesForBucket(
      sketchId,
      bucket,
      sketchNameById,
      t,
      collectionSketchIds
    );
    let hasBufferedOverlap = false;

    // Buffered overlay_area: partners from combine-time scope metadata.
    // @see OverlayAreaOverlapInfo
    if (metricType === "overlay_area") {
      const overlap = getOverlayAreaOverlapCombineResult(
        combined.value as OverlayAreaMetricValue
      );
      if (
        overlap &&
        (overlap.scope === "between-sketches" || overlap.scope === "both") &&
        overlap.partnerSketchIds?.length
      ) {
        const partnerIds = overlap.partnerSketchIds.filter((id) => {
          if (id === sketchId) return false;
          if (collectionSketchIds && collectionSketchIds.size > 0) {
            return collectionSketchIds.has(id);
          }
          return true;
        });
        if (partnerIds.length > 0) {
          hasBufferedOverlap = true;
          const names = partnerIds
            .map(
              (id) =>
                sketchNameById.get(id) ?? t("Sketch #{{id}}", { id })
            )
            .sort((a, b) => a.localeCompare(b));
          // Prefer buffer partners when present; merge with fragment partners.
          const merged = new Set([
            ...overlapPartnerSketchNames,
            ...names,
          ]);
          overlapPartnerSketchNames = Array.from(merged).sort((a, b) =>
            a.localeCompare(b)
          );
        }
      }
    }

    const hasOverlap = fragmentOverlap || hasBufferedOverlap;

    rows.push({
      sketchId,
      sketchName:
        sketchNameById.get(sketchId) ?? t("Sketch #{{id}}", { id: sketchId }),
      primaryValue,
      fractionOfGeography:
        geographyDenominator > 0 ? primaryValue / geographyDenominator : 0,
      hasOverlap,
      overlapPartnerSketchNames,
      hasBufferedOverlap,
    });
  }

  rows.sort((a, b) =>
    b.primaryValue !== a.primaryValue
      ? b.primaryValue - a.primaryValue
      : a.sketchName.localeCompare(b.sketchName)
  );

  return rows;
}
