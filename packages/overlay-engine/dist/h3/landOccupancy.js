"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cellHasLand = cellHasLand;
const bboxUtils_1 = require("../utils/bboxUtils");
const bboxForCell_1 = require("./bboxForCell");
/**
 * True if the FlatGeobuf R-tree reports any land features in this cell.
 * Index-only (no feature fetch). Results are cached per cell.
 */
function cellHasLand(cell, land, cache) {
    const cached = cache.get(cell);
    if (cached !== undefined)
        return cached;
    const cellBBox = (0, bboxForCell_1.bboxForCell)(cell);
    const cleaned = (0, bboxUtils_1.cleanBBox)(cellBBox);
    const split = (0, bboxUtils_1.splitBBoxAntimeridian)(cleaned);
    let hasLand = false;
    for (const part of split) {
        const env = (0, bboxUtils_1.bboxToEnvelope)(part);
        const estimate = land.search(env);
        if (estimate.features > 0) {
            hasLand = true;
            break;
        }
    }
    cache.set(cell, hasLand);
    return hasLand;
}
//# sourceMappingURL=landOccupancy.js.map