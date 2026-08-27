import {
  combineMetricsForFragments,
  subjectIsFragment,
  type DistanceToShoreMetric,
  type Metric,
} from "overlay-engine";
import { SpatialMetricState } from "../../../../generated/graphql";
import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

export const exportDistanceToShoreMap: WidgetExporter = (input) => {
  const { metrics, componentSettings, subject, t } = input;
  const fragmentMetrics = metrics.filter(
    (m) =>
      m.type === "distance_to_shore" &&
      subjectIsFragment(m.subject) &&
      m.state === SpatialMetricState.Complete &&
      m.value != null,
  ) as Pick<Metric, "type" | "value">[];

  const combined =
    fragmentMetrics.length > 0
      ? (combineMetricsForFragments(
          fragmentMetrics,
          "distance_to_shore",
        ) as DistanceToShoreMetric)
      : null;

  const meters =
    combined && typeof combined.value?.meters === "number"
      ? combined.value.meters
      : null;
  const path = combined?.value?.geojsonLine ?? null;

  const section: WidgetExportSection = {
    id: "distance-to-shore-map",
    title: t("Distance to Shore Map"),
    columns: [
      { key: "meters", label: t("Distance (m)"), type: "number" },
      { key: "unit", label: t("Display unit"), type: "string" },
    ],
    rows: [
      {
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        meters,
        unit: (componentSettings.unit as string | undefined) ?? "kilometer",
      },
    ],
    extras: path
      ? {
          path: {
            type: "FeatureCollection",
            features: [path],
          },
        }
      : undefined,
  };

  return [section];
};
