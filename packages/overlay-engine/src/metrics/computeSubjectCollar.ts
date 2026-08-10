import { Feature, MultiPolygon, Polygon } from "geojson";
import buffer from "@turf/buffer";
import bbox from "@turf/bbox";
import * as clipping from "polyclip-ts";

/**
 * Computes the buffered subject and its boundary **collar** used for
 * buffered fragment `overlay_area` overlap detection.
 *
 * Collar = `buffer(subject, d) − erode(subject, d)`. When erode yields an
 * empty geometry (fragment thinner than 2d), the collar is the whole buffer.
 *
 * Called only when `bufferDistanceKm > 0` on a fragment subject. Unbuffered
 * `overlay_area` never invokes this helper.
 *
 * @see OverlayAreaOverlapInfo in `./metrics` for how collar metadata is used.
 */
export function computeBufferedSubjectAndCollar(
  subject: Feature<Polygon | MultiPolygon>,
  bufferKm: number,
): {
  buffered: Feature<Polygon | MultiPolygon>;
  collar: Feature<Polygon | MultiPolygon>;
  bbox: [number, number, number, number];
} {
  const bufferedRaw = buffer(subject, bufferKm, { units: "kilometers" });
  if (
    !bufferedRaw?.geometry ||
    (bufferedRaw.geometry.type !== "Polygon" &&
      bufferedRaw.geometry.type !== "MultiPolygon")
  ) {
    throw new Error("Failed to buffer subject for overlay_area collar");
  }
  const buffered = bufferedRaw as Feature<Polygon | MultiPolygon>;

  let eroded: Feature<Polygon | MultiPolygon> | null = null;
  try {
    const erodedRaw = buffer(subject, -bufferKm, { units: "kilometers" });
    if (
      erodedRaw?.geometry &&
      (erodedRaw.geometry.type === "Polygon" ||
        erodedRaw.geometry.type === "MultiPolygon")
    ) {
      eroded = erodedRaw as Feature<Polygon | MultiPolygon>;
    }
  } catch {
    eroded = null;
  }

  let collar: Feature<Polygon | MultiPolygon>;
  if (!eroded) {
    collar = buffered;
  } else {
    const diff = clipping.difference(
      buffered.geometry.coordinates as clipping.Geom,
      eroded.geometry.coordinates as clipping.Geom,
    );
    if (!diff || (Array.isArray(diff) && diff.length === 0)) {
      collar = buffered;
    } else {
      collar = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: diff as MultiPolygon["coordinates"],
        },
      };
    }
  }

  const box = bbox(buffered) as [number, number, number, number];
  return { buffered, collar, bbox: box };
}
