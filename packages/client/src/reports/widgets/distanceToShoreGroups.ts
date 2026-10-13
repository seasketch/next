import { Feature, LineString } from "geojson";
import {
  combineMetricsForFragments,
  DistanceToShoreMetric,
  Metric,
  subjectIsFragment,
} from "overlay-engine";
import { shorelineLines } from "./isShorelineFeature";

export type ShoreSketch = {
  sketchId: number | null;
  sketchName: string | null;
  meters: number;
  /** Water route. Absent when the sketch meets the shore. */
  path: Feature<LineString> | null;
  /** Shoreline inside the sketch when it meets land. */
  shoreLines: Feature<LineString>[];
};

function isLineFeature(value: unknown): value is Feature<LineString> {
  if (value == null || typeof value !== "object") return false;
  if (!("geometry" in value)) return false;
  const geometry = value.geometry;
  if (geometry == null || typeof geometry !== "object") return false;
  if (!("type" in geometry) || !("coordinates" in geometry)) return false;
  return (
    geometry.type === "LineString" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2
  );
}

function shoreMeters(value: unknown): number | null {
  if (value == null || typeof value !== "object") return null;
  if (!("meters" in value)) return null;
  const meters = value.meters;
  return typeof meters === "number" && Number.isFinite(meters) ? meters : null;
}

function shorePath(value: unknown): Feature<LineString> | null {
  if (value == null || typeof value !== "object") return null;
  if (!("geojsonLine" in value)) return null;
  return isLineFeature(value.geojsonLine) ? value.geojsonLine : null;
}

function shoreOverlap(value: unknown): Feature<LineString>[] {
  if (value == null || typeof value !== "object") return [];
  if (!("shorelineIntersection" in value)) return [];
  return shorelineLines(value.shorelineIntersection);
}

function sketchesOn(subject: unknown): number[] {
  if (!subjectIsFragment(subject)) return [];
  return subject.sketches.filter((id) => typeof id === "number");
}

function groupFor(
  metrics: Array<{ type: string; value?: unknown; subject?: unknown }>,
  sketchId: number | null,
  sketchName: string | null
): ShoreSketch | null {
  if (metrics.length === 0) return null;
  const combined = combineMetricsForFragments(
    metrics as Array<Pick<Metric, "type" | "value">>,
    "distance_to_shore"
  ) as DistanceToShoreMetric;
  const meters = shoreMeters(combined.value);
  if (meters == null) return null;
  if (meters === 0) {
    return {
      sketchId,
      sketchName,
      meters,
      path: null,
      shoreLines: shoreOverlap(combined.value),
    };
  }
  const path = shorePath(combined.value);
  if (!path) return null;
  return { sketchId, sketchName, meters, path, shoreLines: [] };
}

/**
 * Shore results to show on the distance-to-shore map.
 *
 * A single sketch combines its fragments and keeps the closest shore. A
 * collection does that per child sketch, so a nearer sibling does not drop
 * another polygon's route or shoreline overlap.
 */
export function shoreSketchGroups(args: {
  metrics: Array<{ type: string; value?: unknown; subject?: unknown }>;
  isCollection: boolean;
  childSketches: Array<{ id: number; name: string }>;
}): ShoreSketch[] {
  const usable = args.metrics.filter(
    (metric) =>
      metric.type === "distance_to_shore" &&
      shoreMeters(metric.value) != null &&
      subjectIsFragment(metric.subject)
  );

  if (!args.isCollection) {
    const group = groupFor(usable, null, null);
    return group ? [group] : [];
  }

  const groups: ShoreSketch[] = [];
  for (const child of args.childSketches) {
    const mine = usable.filter((metric) =>
      sketchesOn(metric.subject).includes(child.id)
    );
    const group = groupFor(mine, child.id, child.name);
    if (group) groups.push(group);
  }
  return groups;
}

/** Closest and furthest sketches among the groups, in iteration order on a tie. */
export function shoreExtremes(
  groups: ShoreSketch[]
): { min: ShoreSketch; max: ShoreSketch } | null {
  let min: ShoreSketch | null = null;
  let max: ShoreSketch | null = null;
  for (const group of groups) {
    if (min == null || group.meters < min.meters) min = group;
    if (max == null || group.meters > max.meters) max = group;
  }
  return min && max ? { min, max } : null;
}
