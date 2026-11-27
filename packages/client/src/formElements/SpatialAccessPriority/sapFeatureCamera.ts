import bbox from "@turf/bbox";
import { Feature, FeatureCollection, Geometry } from "geojson";

const POINT_ZOOM = 14;

export type DrawnFeatureCamera =
  | {
      type: "ease";
      center: [number, number];
      zoom: number;
      padding?: number;
      duration: number;
    }
  | {
      type: "fit";
      bounds: [number, number, number, number];
      padding?: number;
      animate?: boolean;
    };

/**
 * A point has no area, so fitBounds would zoom to the map's maximum.
 * Polygons and lines keep fitBounds with the caller's padding and animation.
 */
export function drawnFeatureCamera(
  feature: Feature<Geometry> | FeatureCollection<Geometry>,
  options: { padding?: number; animate?: boolean }
): DrawnFeatureCamera {
  const bounds = bbox(feature);
  const degenerate =
    bounds.length >= 4 && bounds[0] === bounds[2] && bounds[1] === bounds[3];
  const pointCoordinates =
    feature.type === "Feature" && feature.geometry.type === "Point"
      ? feature.geometry.coordinates
      : null;
  if (degenerate || pointCoordinates) {
    const center: [number, number] = pointCoordinates
      ? [pointCoordinates[0], pointCoordinates[1]]
      : [bounds[0], bounds[1]];
    return {
      type: "ease",
      center,
      zoom: POINT_ZOOM,
      padding: options.padding,
      duration: options.animate === false ? 0 : 500,
    };
  }
  return {
    type: "fit",
    bounds: [bounds[0], bounds[1], bounds[2], bounds[3]],
    padding: options.padding,
    animate: options.animate,
  };
}
