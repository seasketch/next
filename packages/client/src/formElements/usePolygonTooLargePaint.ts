import { Feature } from "geojson";
import { useEffect, useRef } from "react";
import { polygonSizeViolation } from "./maxPolygonSize";

type DrawMap = {
  on: (type: string, listener: () => void) => void;
  off: (type: string, listener: () => void) => void;
};

/**
 * Keeps the draw feature's tooLarge flag, and the live area shown to the
 * respondent, in sync while a vertex is dragged. Mapbox Draw only emits the
 * React onChange when the pointer is released, which is too late for the red
 * highlight respondents see on self-intersections.
 */
export function usePolygonTooLargePaint(options: {
  map?: DrawMap | null;
  maxSqKm?: number;
  featureId?: string | number | null;
  tooLarge: boolean;
  readSelectedFeature: () => Feature | null | undefined;
  onDraftFeature: (feature: Feature) => void;
  setPolygonTooLarge: (featureId: string, tooLarge: boolean) => void;
}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const id = options.featureId;
    if (id == null || id === "") {
      return;
    }
    optionsRef.current.setPolygonTooLarge(String(id), options.tooLarge);
    // The setter identity changes every render; the ref holds the latest one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.featureId, options.tooLarge]);

  useEffect(() => {
    const map = options.map;
    if (!map || options.maxSqKm == null) {
      return;
    }
    let frame = 0;
    const onDrag = () => {
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        const current = optionsRef.current;
        if (current.maxSqKm == null) {
          return;
        }
        const feature = current.readSelectedFeature();
        if (!feature || feature.id == null) {
          return;
        }
        const geometryType = feature.geometry?.type;
        if (geometryType !== "Polygon" && geometryType !== "MultiPolygon") {
          return;
        }
        const violation = polygonSizeViolation(feature, current.maxSqKm);
        const tooLarge = violation != null;
        current.setPolygonTooLarge(String(feature.id), tooLarge);
        // Keep the toolbar measurement live only while the shape is over the
        // limit, or on the frame it shrinks back under.
        if (tooLarge || current.tooLarge) {
          current.onDraftFeature(feature);
        }
      });
    };
    map.on("seasketch.drag_target", onDrag);
    return () => {
      map.off("seasketch.drag_target", onDrag);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [options.map, options.maxSqKm]);
}
