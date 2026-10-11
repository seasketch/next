/** Cells with no row are open water. */
export declare const STATE_PARTIAL = 1;
export declare const STATE_ENTIRE = 2;
export declare const GENERATOR_VERSION = "2";
export declare const DEFAULT_RESOLUTION = 8;
/**
 * Interiors are classified here. Finer resolutions are filled only for cells
 * that are still mixed, because a fully contained parent is land all the way
 * down and an empty parent is water.
 */
export declare const BASE_RESOLUTION = 7;
/**
 * A boundary cell is promoted to entire when accumulated land coverage reaches
 * this fraction of the cell area. Subdivision boundaries leave a numerical
 * sliver; real channels are much wider than 0.1% of a resolution-8 cell.
 */
export declare const DEFAULT_COVER_EPSILON = 0.001;
/** Intersections smaller than this are treated as a touch, not coverage. */
export declare const MIN_COVER_M2 = 1;
