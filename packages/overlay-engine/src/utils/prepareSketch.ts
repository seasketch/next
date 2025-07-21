import { BBox, MultiPolygon } from "geojson";
import { bboxToEnvelope, cleanBBox, splitBBoxAntimeridian } from "./bboxUtils";
import { cleanCoords } from "./cleanCoords";
import { Feature } from "geojson";
import { makeMultipolygon } from "./utils";
import turfBBox from "@turf/bbox";
import splitGeoJSON from "geojson-antimeridian-cut";

export type PreparedSketch = {
  feature: Feature<MultiPolygon>;
  envelopes: ReturnType<typeof bboxToEnvelope>[];
};

/**
 * Prepares a sketch for processing by:
 * 1. Validating geometry type
 * 2. Converting to MultiPolygon if needed
 * 3. Cleaning coordinates
 * 4. Handling antimeridian crossing (splitting into multiple polygon parts if needed)
 * 5. Calculating envelopes for feature fetching
 *
 * @throws {Error} If feature has no geometry or geometry is not a polygon/multipolygon
 */
export function prepareSketch(feature: Feature<any>): PreparedSketch {
  if (!feature.geometry) {
    throw new Error("feature has no geometry");
  }
  if (
    feature.geometry.type !== "Polygon" &&
    feature.geometry.type !== "MultiPolygon"
  ) {
    throw new Error("feature geometry is not a polygon or multipolygon");
  }

  let sketch = makeMultipolygon(feature);
  const bbox = cleanBBox(turfBBox(sketch));
  const split = splitBBoxAntimeridian(bbox as BBox);
  const envelopes = split.map((box) => bboxToEnvelope(box));
  sketch = splitGeoJSON(cleanCoords(sketch));
  if (sketch.geometry.coordinates.length > 1) {
    sketch = cleanCoords(sketch);
  }
  if ((sketch as any).type === "FeatureCollection") {
    throw new Error("sketch is a FeatureCollection");
  }
  return { feature: sketch, envelopes };
}
