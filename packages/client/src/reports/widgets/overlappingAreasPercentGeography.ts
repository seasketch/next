import {
  OverlayAreaMetricValue,
  subjectIsGeography,
} from "overlay-engine";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
} from "../../generated/graphql";

/**
 * Geography used as the OverlappingAreasTable "% Within" denominator.
 * - `null` — hide the percent column (new-widget default)
 * - `"primary"` — sketch clipping geography
 * - `number` — a specific project geography id
 */
export type OverlappingAreasPercentGeographyId = number | "primary" | null;

export type OverlappingAreasPercentGeographySettings = {
  percentGeographyId?: OverlappingAreasPercentGeographyId;
  /**
   * @deprecated Prefer `percentGeographyId`. Kept for backwards compatibility
   * with saved reports.
   */
  showPercentColumn?: boolean;
};

/**
 * Resolves the geography id for the "% Within" column, or `undefined` when the
 * column should be hidden.
 *
 * Backwards compatibility: saved reports that only set `showPercentColumn`
 * (or leave settings empty, which historically defaulted the column on) keep
 * using the primary clipping geography. New widgets set
 * `percentGeographyId: null` so the column starts hidden.
 */
export function resolveOverlappingAreasPercentGeographyId(
  settings: OverlappingAreasPercentGeographySettings,
  primaryGeographyId: number | undefined
): number | undefined {
  const { percentGeographyId, showPercentColumn } = settings;
  if (percentGeographyId === null) {
    return undefined;
  }
  if (percentGeographyId === "primary") {
    return primaryGeographyId;
  }
  if (
    typeof percentGeographyId === "number" &&
    Number.isFinite(percentGeographyId)
  ) {
    return percentGeographyId;
  }
  // Legacy boolean path (percentGeographyId unset).
  if (showPercentColumn === false) {
    return undefined;
  }
  return primaryGeographyId;
}

/**
 * One linear scan of metrics → best complete `overlay_area` geography value
 * per `sourceUrl` for {@link geographyId} (highest metric id wins).
 */
export function indexOverlayAreaGeographyValuesBySourceUrl(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  geographyId: number
): Map<string, OverlayAreaMetricValue> {
  const best = new Map<
    string,
    { id: number; value: OverlayAreaMetricValue }
  >();
  for (const m of metrics) {
    if (m.type !== "overlay_area") {
      continue;
    }
    if (m.state !== SpatialMetricState.Complete) {
      continue;
    }
    if (!m.sourceUrl) {
      continue;
    }
    if (!subjectIsGeography(m.subject) || m.subject.id !== geographyId) {
      continue;
    }
    const id =
      m.id === null || m.id === undefined ? Number.NEGATIVE_INFINITY : Number(m.id);
    const prev = best.get(m.sourceUrl);
    if (!prev || id > prev.id) {
      best.set(m.sourceUrl, {
        id,
        value: m.value as OverlayAreaMetricValue,
      });
    }
  }
  const byUrl = new Map<string, OverlayAreaMetricValue>();
  for (const [url, entry] of best) {
    byUrl.set(url, entry.value);
  }
  return byUrl;
}

/**
 * Remap sourceUrl → value into stableId → value for O(1) row lookups.
 */
export function mapGeographyValuesBySourceStableId(
  bySourceUrl: Map<string, OverlayAreaMetricValue>,
  sources: OverlaySourceDetailsFragment[]
): Map<string, OverlayAreaMetricValue> {
  const byStableId = new Map<string, OverlayAreaMetricValue>();
  for (const source of sources) {
    if (!source.sourceUrl) {
      continue;
    }
    const value = bySourceUrl.get(source.sourceUrl);
    if (value) {
      byStableId.set(source.stableId, value);
    }
  }
  return byStableId;
}

/**
 * Build stableId → geography metric value for the "% Within" denominator.
 *
 * - When `percentGeographyId === clippingGeographyId` and `combinedBySource`
 *   is provided (from {@link combineMetricsBySource} on the clipping geo),
 *   reuse its `geographies` halves — no second metric scan.
 * - Otherwise one linear scan of `metrics` for the percent geography.
 */
export function buildPercentGeographyValuesBySourceId(opts: {
  percentGeographyId: number;
  clippingGeographyId: number;
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  /** Result of combineMetricsBySource(clippingGeographyId). */
  combinedBySource?: {
    [sourceId: string]: {
      geographies?: { value?: OverlayAreaMetricValue } | null;
    };
  };
}): Map<string, OverlayAreaMetricValue> {
  const {
    percentGeographyId,
    clippingGeographyId,
    metrics,
    sources,
    combinedBySource,
  } = opts;

  if (percentGeographyId === clippingGeographyId && combinedBySource) {
    const byStableId = new Map<string, OverlayAreaMetricValue>();
    for (const [sourceId, combined] of Object.entries(combinedBySource)) {
      const value = combined.geographies?.value;
      if (value && typeof value === "object") {
        byStableId.set(sourceId, value);
      }
    }
    return byStableId;
  }

  return mapGeographyValuesBySourceStableId(
    indexOverlayAreaGeographyValuesBySourceUrl(metrics, percentGeographyId),
    sources
  );
}

/** Class total (km²) from a geography metric value object. */
export function overlayAreaClassTotalFromValue(
  value: OverlayAreaMetricValue | undefined,
  groupByKey: string
): number {
  const raw = value?.[groupByKey];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

/**
 * @deprecated Prefer {@link buildPercentGeographyValuesBySourceId} +
 * {@link overlayAreaClassTotalFromValue} for O(1) per-row lookups.
 */
export function overlayAreaGeographyClassTotal(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  sourceUrl: string | null | undefined,
  geographyId: number,
  groupByKey: string
): number {
  if (!sourceUrl) {
    return 0;
  }
  const byUrl = indexOverlayAreaGeographyValuesBySourceUrl(metrics, geographyId);
  return overlayAreaClassTotalFromValue(byUrl.get(sourceUrl), groupByKey);
}
