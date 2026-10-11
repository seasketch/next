/** Cells with no row are open water. */
export const STATE_PARTIAL = 1;
export const STATE_ENTIRE = 2;

export const GENERATOR_VERSION = "2";
export const DEFAULT_RESOLUTION = 8;

/**
 * Interiors are classified here. Finer resolutions are filled only for cells
 * that are still mixed, because a fully contained parent is land all the way
 * down and an empty parent is water.
 */
export const BASE_RESOLUTION = 7;

/**
 * A boundary cell is promoted to entire when accumulated land coverage reaches
 * this fraction of the cell area. Subdivision boundaries leave a numerical
 * sliver; real channels are much wider than 0.1% of a resolution-8 cell.
 */
export const DEFAULT_COVER_EPSILON = 0.001;

/** Intersections smaller than this are treated as a touch, not coverage. */
export const MIN_COVER_M2 = 1;
