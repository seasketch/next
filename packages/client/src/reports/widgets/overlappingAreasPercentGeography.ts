import {
  OverlayAreaMetricValue,
  subjectIsGeography,
} from "overlay-engine";
import {
  CompatibleSpatialMetricDetailsFragment,
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

/** Class total (km²) for one overlay_area geography metric. */
export function overlayAreaGeographyClassTotal(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  sourceUrl: string | null | undefined,
  geographyId: number,
  groupByKey: string
): number {
  const matches = metrics.filter(
    (m) =>
      m.type === "overlay_area" &&
      m.state === SpatialMetricState.Complete &&
      (!sourceUrl || m.sourceUrl === sourceUrl) &&
      subjectIsGeography(m.subject) &&
      m.subject.id === geographyId
  );
  if (!matches.length) {
    return 0;
  }
  const geographyMetric = matches
    .slice()
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  const raw = (geographyMetric.value as OverlayAreaMetricValue | undefined)?.[
    groupByKey
  ];
  return typeof raw === "number" ? raw : 0;
}
