"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bboxForCell = bboxForCell;
const h3_js_1 = require("h3-js");
/**
 * Convert a single H3 cell into a [minX, minY, maxX, maxY] bbox using the
 * GeoJSON-style [lng,lat] boundary returned by H3.
 *
 * Cells that cross the antimeridian emit a bbox where minX > maxX
 * (e.g. [170, lat, -170, lat]) so `splitBBoxAntimeridian` can split it.
 */
function bboxForCell(cell) {
    const boundary = (0, h3_js_1.cellToBoundary)(cell, true);
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of boundary) {
        if (lng < minLng)
            minLng = lng;
        if (lng > maxLng)
            maxLng = lng;
        if (lat < minLat)
            minLat = lat;
        if (lat > maxLat)
            maxLat = lat;
    }
    const crossesAntimeridian = minLng < -160 && maxLng > 160;
    if (crossesAntimeridian) {
        let minPositiveLng = Infinity;
        let maxNegativeLng = -Infinity;
        for (const [lng] of boundary) {
            if (lng >= 0 && lng < minPositiveLng) {
                minPositiveLng = lng;
            }
            else if (lng < 0 && lng > maxNegativeLng) {
                maxNegativeLng = lng;
            }
        }
        if (!Number.isFinite(minPositiveLng) || !Number.isFinite(maxNegativeLng)) {
            return [minLng, minLat, maxLng, maxLat];
        }
        return [minPositiveLng, minLat, maxNegativeLng, maxLat];
    }
    return [minLng, minLat, maxLng, maxLat];
}
//# sourceMappingURL=bboxForCell.js.map