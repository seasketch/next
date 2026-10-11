"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_COVER_M2 = exports.DEFAULT_COVER_EPSILON = exports.BASE_RESOLUTION = exports.DEFAULT_RESOLUTION = exports.GENERATOR_VERSION = exports.STATE_ENTIRE = exports.STATE_PARTIAL = void 0;
/** Cells with no row are open water. */
exports.STATE_PARTIAL = 1;
exports.STATE_ENTIRE = 2;
exports.GENERATOR_VERSION = "2";
exports.DEFAULT_RESOLUTION = 8;
/**
 * Interiors are classified here. Finer resolutions are filled only for cells
 * that are still mixed, because a fully contained parent is land all the way
 * down and an empty parent is water.
 */
exports.BASE_RESOLUTION = 7;
/**
 * A boundary cell is promoted to entire when accumulated land coverage reaches
 * this fraction of the cell area. Subdivision boundaries leave a numerical
 * sliver; real channels are much wider than 0.1% of a resolution-8 cell.
 */
exports.DEFAULT_COVER_EPSILON = 0.001;
/** Intersections smaller than this are treated as a touch, not coverage. */
exports.MIN_COVER_M2 = 1;
//# sourceMappingURL=constants.js.map