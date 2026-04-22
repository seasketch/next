import type { Metric } from "overlay-engine";
import type {
  CompatibleSpatialMetricDetailsFragment,
} from "../../../generated/graphql";

/** Scalar total_area value from one metric row. */
export function extractTotalAreaSqKmFromMetric(
  m: CompatibleSpatialMetricDetailsFragment | Pick<Metric, "type" | "value">,
): number {
  if (m.type !== "total_area") return 0;
  const v = m.value as unknown;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

/** overlay_area slice for groupByKey from one metric row. */
export function extractOverlayAreaForGroupFromMetric(
  m: CompatibleSpatialMetricDetailsFragment | Pick<Metric, "type" | "value">,
  groupByKey: string,
): number {
  if (m.type !== "overlay_area") return 0;
  const raw = (m.value as Record<string, number>)?.[groupByKey];
  return typeof raw === "number" ? raw : 0;
}

/** count metric slice for groupByKey from one metric row. */
export function extractCountForGroupFromMetric(
  m: CompatibleSpatialMetricDetailsFragment | Pick<Metric, "type" | "value">,
  groupByKey: string,
): number {
  if (m.type !== "count") return 0;
  const entry = (m.value as Record<string, { count: number }>)?.[groupByKey];
  return entry?.count ?? 0;
}

/** Raster band 0 sum from one metric row. */
export function extractRasterBand0SumFromMetric(
  m: CompatibleSpatialMetricDetailsFragment | Pick<Metric, "type" | "value">,
): number {
  if (m.type !== "raster_stats") return 0;
  const bands = (
    m.value as { bands?: Array<{ sum?: number }> }
  )?.bands;
  return bands?.[0]?.sum ?? 0;
}
