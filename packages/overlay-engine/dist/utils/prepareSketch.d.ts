import { MultiPolygon } from "geojson";
import { bboxToEnvelope } from "./bboxUtils";
import { Feature } from "geojson";
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
export declare function prepareSketch(feature: Feature<any>): PreparedSketch;
//# sourceMappingURL=prepareSketch.d.ts.map