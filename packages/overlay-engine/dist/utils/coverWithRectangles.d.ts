import RBush from "rbush";
import { Polygon, MultiPolygon, BBox } from "geojson";
type Rect = [number, number, number, number];
export declare function coverWithRectangles(geojson: Polygon | MultiPolygon, { target, minWidth, // degrees
minHeight, bbox, }?: {
    target?: number;
    minWidth?: number;
    minHeight?: number;
    bbox?: BBox | null;
}): {
    inside: Rect[];
    outside: Rect[];
};
export declare function buildIndexes(inside: Rect[], outside: Rect[]): {
    inTree: RBush<any>;
    outTree: RBush<any>;
};
export declare function classifyCandidate(candidateGeoJSON: Polygon | MultiPolygon, indexes: {
    inTree: RBush<any>;
    outTree: RBush<any>;
}): "inside_fast" | "outside_fast" | "uncertain";
export {};
//# sourceMappingURL=coverWithRectangles.d.ts.map