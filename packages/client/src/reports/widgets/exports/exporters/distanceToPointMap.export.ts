import {
  combineMetricsForFragments,
  subjectIsFragment,
  DistanceToFeaturesOverWaterMetric,
  Metric,
} from "overlay-engine";
import { SpatialMetricState } from "../../../../generated/graphql";
import { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

export const exportDistanceToPointMap: WidgetExporter = (input) => {
  const { metrics, componentSettings, subject, t } = input;
  const fragmentMetrics = metrics.filter(
    (m) =>
      m.type === "distance_to_features_over_water" &&
      subjectIsFragment(m.subject) &&
      m.state === SpatialMetricState.Complete &&
      m.value != null
  ) as Pick<Metric, "type" | "value">[];

  const combined =
    fragmentMetrics.length > 0
      ? (combineMetricsForFragments(
          fragmentMetrics,
          "distance_to_features_over_water"
        ) as DistanceToFeaturesOverWaterMetric)
      : null;

  const labelColumn = componentSettings.labelColumn;
  const features = combined?.value?.features ?? [];
  const unit =
    componentSettings.unit === "none"
      ? "none"
      : (componentSettings.unit as string | undefined) ?? "kilometer";
  const paths = features
    .map((feature) => feature.geojsonLine)
    .filter((line) => line?.geometry?.type === "LineString");

  const section: WidgetExportSection = {
    id: "distance-to-point-map",
    title: t("Distance to Point Map"),
    columns: [
      { key: "meters", label: t("Distance (m)"), type: "number" },
      { key: "name", label: t("Feature"), type: "string" },
      { key: "unit", label: t("Display unit"), type: "string" },
    ],
    rows: (features.length > 0 ? features : [null]).map((feature) => {
      const rawLabel =
        labelColumn && feature
          ? feature.properties?.[String(labelColumn)]
          : null;
      return {
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        meters:
          feature && typeof feature.meters === "number" ? feature.meters : null,
        name: typeof rawLabel === "string" ? rawLabel : null,
        unit,
      };
    }),
    extras: paths.length
      ? {
          path: {
            type: "FeatureCollection",
            features: paths,
          },
        }
      : undefined,
  };

  return [section];
};
