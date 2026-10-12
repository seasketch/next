import { Feature, LineString } from "geojson";
import {
  combineMetricsForFragments,
  DistanceToFeatureHit,
  DistanceToFeaturesOverWaterMetric,
  Metric,
  subjectIsFragment,
} from "overlay-engine";

export type DistanceRoute = {
  sketchId: number | null;
  sketchName: string | null;
  feature: DistanceToFeatureHit;
};

export type DistanceSketchGroup = {
  sketchId: number | null;
  sketchName: string | null;
  routes: DistanceRoute[];
};

function isPathFeature(value: unknown): value is Feature<LineString> {
  if (!value || typeof value !== "object") return false;
  const geom = (value as Feature).geometry;
  return (
    geom != null &&
    geom.type === "LineString" &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length >= 2
  );
}

function routableFeatures(
  value: DistanceToFeaturesOverWaterMetric["value"] | null | undefined
): DistanceToFeatureHit[] {
  return (value?.features ?? []).filter(
    (feature) =>
      feature != null &&
      typeof feature.meters === "number" &&
      Number.isFinite(feature.meters) &&
      isPathFeature(feature.geojsonLine)
  );
}

function sketchesOn(subject: unknown): number[] {
  if (!subjectIsFragment(subject)) return [];
  return subject.sketches.filter((id) => typeof id === "number");
}

/**
 * Routes to show for a distance-to-point map.
 *
 * A single sketch combines its fragments and keeps the closest hit per
 * feature. A collection does that per child sketch, so a nearer sibling does
 * not drop another sketch's route.
 */
export function distanceSketchGroups(args: {
  metrics: Array<{
    type: string;
    value?: unknown;
    subject?: unknown;
  }>;
  isCollection: boolean;
  childSketches: Array<{ id: number; name: string }>;
}): DistanceSketchGroup[] {
  const usable = args.metrics.filter(
    (metric) =>
      metric.type === "distance_to_features_over_water" &&
      metric.value != null &&
      subjectIsFragment(metric.subject)
  );

  const groupFor = (
    metrics: typeof usable,
    sketchId: number | null,
    sketchName: string | null
  ): DistanceSketchGroup => {
    if (metrics.length === 0) {
      return { sketchId, sketchName, routes: [] };
    }
    const combined = combineMetricsForFragments(
      metrics as Array<Pick<Metric, "type" | "value">>,
      "distance_to_features_over_water"
    ) as DistanceToFeaturesOverWaterMetric;
    return {
      sketchId,
      sketchName,
      routes: routableFeatures(combined.value).map((feature) => ({
        sketchId,
        sketchName,
        feature,
      })),
    };
  };

  if (!args.isCollection) {
    return [groupFor(usable, null, null)];
  }

  const groups: DistanceSketchGroup[] = [];
  for (const child of args.childSketches) {
    const mine = usable.filter((metric) =>
      sketchesOn(metric.subject).includes(child.id)
    );
    if (mine.length === 0) continue;
    const group = groupFor(mine, child.id, child.name);
    if (group.routes.length === 0) continue;
    groups.push(group);
  }
  return groups;
}

/** Closest and furthest routes among the groups, in iteration order on a tie. */
export function distanceExtremes(
  groups: DistanceSketchGroup[]
): { min: DistanceRoute; max: DistanceRoute } | null {
  let min: DistanceRoute | null = null;
  let max: DistanceRoute | null = null;
  for (const group of groups) {
    for (const route of group.routes) {
      if (!min || route.feature.meters < min.feature.meters) min = route;
      if (!max || route.feature.meters > max.feature.meters) max = route;
    }
  }
  if (!min || !max) return null;
  return { min, max };
}
