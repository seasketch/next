import { H3Index } from "h3-js";
/**
 * Convert a single H3 cell into a [minX, minY, maxX, maxY] bbox using the
 * GeoJSON-style [lng,lat] boundary returned by H3.
 *
 * Cells that cross the antimeridian emit a bbox where minX > maxX
 * (e.g. [170, lat, -170, lat]) so `splitBBoxAntimeridian` can split it.
 */
export declare function bboxForCell(cell: H3Index): [number, number, number, number];
//# sourceMappingURL=bboxForCell.d.ts.map