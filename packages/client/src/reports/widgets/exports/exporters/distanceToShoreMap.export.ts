import { subjectIsFragment } from "overlay-engine";
import { SpatialMetricState } from "../../../../generated/graphql";
import { shoreSketchGroups } from "../../distanceToShoreGroups";
import { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";

export const exportDistanceToShoreMap: WidgetExporter = (input) => {
  const { metrics, componentSettings, subject, t } = input;
  const fragmentMetrics = metrics.filter(
    (metric) =>
      metric.type === "distance_to_shore" &&
      subjectIsFragment(metric.subject) &&
      metric.state === SpatialMetricState.Complete &&
      metric.value != null
  );
  const groups = shoreSketchGroups({
    metrics: fragmentMetrics,
    isCollection: subject.isCollection,
    childSketches: subject.childSketches,
  });
  const unit =
    componentSettings.unit === "none"
      ? "none"
      : (componentSettings.unit as string | undefined) ?? "kilometer";
  const rows = subject.isCollection
    ? groups.map((group) => ({
        ...baseRow("sketch", group.sketchId, group.sketchName),
        meters: group.meters,
        unit,
      }))
    : groups.map((group) => ({
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        meters: group.meters,
        unit,
      }));
  const features = groups.flatMap((group) =>
    group.path ? [group.path] : group.shoreLines
  );

  const section: WidgetExportSection = {
    id: "distance-to-shore-map",
    title: t("Distance to Shore Map"),
    columns: [
      { key: "scope", label: t("Scope"), type: "string" },
      { key: "sketchId", label: t("Sketch id"), type: "number" },
      { key: "sketchName", label: t("Sketch"), type: "string" },
      { key: "meters", label: t("Distance (m)"), type: "number" },
      { key: "unit", label: t("Display unit"), type: "string" },
    ],
    rows:
      rows.length > 0
        ? rows
        : [
            {
              ...baseRow("collection", subject.sketchId, subject.sketchName),
              meters: null,
              unit,
            },
          ],
    extras: features.length
      ? {
          path: {
            type: "FeatureCollection",
            features,
          },
        }
      : undefined,
  };

  return [section];
};
