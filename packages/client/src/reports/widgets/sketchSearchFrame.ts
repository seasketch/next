import { useEffect, useState } from "react";
import { FeatureCollection, Polygon } from "geojson";
import { DEFAULT_WATER_PATH_DISTANCE_KM } from "overlay-engine";
import { boundsExpandedByKm, positionsInGeojson } from "./distancePathBounds";
import { searchArea } from "./searchArea";

export type SearchFrame = [[number, number], [number, number]];

export type SketchSearch = {
  frame: SearchFrame;
  /** Simplified sketch buffered by the search radius. Null if that outline cannot be drawn. */
  area: FeatureCollection<Polygon> | null;
};

export function waterPathSearchLimitKm(
  dependencies: Array<{
    type: string;
    parameters?: { maxDistanceKm?: unknown };
  }>
): number {
  for (const dependency of dependencies) {
    if (dependency.type !== "distance_to_features_over_water") continue;
    const raw = dependency.parameters?.maxDistanceKm;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  }
  return DEFAULT_WATER_PATH_DISTANCE_KM;
}

/**
 * Camera frame and buffer for an empty water-path search. The outline is the
 * simplified sketch buffered by the search radius. If that outline cannot be
 * drawn, the frame falls back to the sketch bounds grown by the same radius.
 * Null until the sketch GeoJSON loads, and when that request fails.
 */
export function useSketchSearchFrame(
  url: string | null,
  radiusKm: number,
  enabled: boolean
): SketchSearch | null {
  const [searched, setSearched] = useState<SketchSearch | null>(null);
  useEffect(() => {
    if (!enabled || !url) {
      setSearched(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    fetch(url, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (cancelled) return;
        const area = searchArea(body, radiusKm);
        const frame = boundsExpandedByKm(
          positionsInGeojson(area ?? body),
          area ? 0 : radiusKm
        );
        setSearched(frame ? { frame, area } : null);
      })
      .catch(() => {
        if (!cancelled) setSearched(null);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, radiusKm, url]);
  return searched;
}
