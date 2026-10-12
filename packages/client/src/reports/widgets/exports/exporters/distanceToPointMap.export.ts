import { subjectIsFragment } from "overlay-engine";
import { SpatialMetricState } from "../../../../generated/graphql";
import { distanceSketchGroups } from "../../distanceToPointGroups";
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
  );

  const groups = distanceSketchGroups({
    metrics: fragmentMetrics,
    isCollection: subject.isCollection,
    childSketches: subject.childSketches,
  });

  const labelColumn = componentSettings.labelColumn;
  const unit =
    componentSettings.unit === "none"
      ? "none"
      : (componentSettings.unit as string | undefined) ?? "kilometer";

  const featureName = (
    properties: Record<string, unknown> | undefined
  ): string | null => {
    const rawLabel =
      labelColumn && properties ? properties[String(labelColumn)] : null;
    return typeof rawLabel === "string" ? rawLabel : null;
  };

  const routeRows = subject.isCollection
    ? groups.flatMap((group) =>
        group.routes.map((route) => ({
          ...baseRow("sketch", route.sketchId, route.sketchName),
          meters: route.feature.meters,
          name: featureName(route.feature.properties),
          unit,
        }))
      )
    : (groups[0]?.routes ?? []).map((route) => ({
        ...baseRow("collection", subject.sketchId, subject.sketchName),
        meters: route.feature.meters,
        name: featureName(route.feature.properties),
        unit,
      }));

  const paths = groups
    .flatMap((group) => group.routes.map((route) => route.feature.geojsonLine))
    .filter((line) => line?.geometry?.type === "LineString");

  const section: WidgetExportSection = {
    id: "distance-to-point-map",
    title: t("Distance to Point Map"),
    columns: [
      { key: "scope", label: t("Scope"), type: "string" },
      { key: "sketchId", label: t("Sketch id"), type: "number" },
      { key: "sketchName", label: t("Sketch"), type: "string" },
      { key: "meters", label: t("Distance (m)"), type: "number" },
      { key: "name", label: t("Feature"), type: "string" },
      { key: "unit", label: t("Display unit"), type: "string" },
    ],
    rows:
      routeRows.length > 0
        ? routeRows
        : [
            {
              ...baseRow(
                "collection",
                subject.sketchId,
                subject.sketchName
              ),
              meters: null,
              name: null,
              unit,
            },
          ],
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
