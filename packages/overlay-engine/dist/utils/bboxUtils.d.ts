import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
/**
 * Creates a bounding box for the given feature, taking into account features
 * that may span the antimeridian, and adjusting the coordinates into space
 * outside of -180, 180, such that a webmap can be panned to an appropriate
 * bounds.
 *
 * @param feature - A GeoJSON Feature containing a Polygon or MultiPolygon geometry
 * @returns A bounding box as [minX, minY, maxX, maxY]
 */
export declare function bboxForFeature(feature: Feature<Polygon | MultiPolygon>): number[];
/**
 * If bounding box crosses antimeridian (and extends outside the range of -180 to 180),
 * split it into two bounding boxes at the antimeridian.
 * @param bbox the bounding box to split
 * @returns array of one or two bounding boxes
 */
export declare function splitBBoxAntimeridian(bbox: BBox): number[][];
/**
 * Normalizes bounding box longitude values to the [-180, 180] range if they cross the antimeridian
 * @param bbox the bounding box to clean
 * @returns the cleaned bounding box
 */
export declare function cleanBBox(bbox: BBox | number[]): number[];
/**
 * Converts a bounding box array to an envelope object with minX, minY, maxX, maxY properties
 * @param bbox the bounding box as [minX, minY, maxX, maxY]
 * @returns an envelope object
 */
export declare function bboxToEnvelope(bbox: BBox | number[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
/**
 * Checks if two bounding boxes intersect
 * @param bbox1 the first bounding box
 * @param bbox2 the second bounding box
 * @returns true if the bounding boxes intersect, false otherwise
 */
export declare function bboxIntersects(bbox1: BBox, bbox2: BBox): boolean;
//# sourceMappingURL=bboxUtils.d.ts.map