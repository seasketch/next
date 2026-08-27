import { Geometry, Position } from "geojson";
import { H3Index } from "h3-js";
/**
 * Sample vertex (and interpolated) positions from a geometry.
 */
export declare function samplePositionsFromGeometry(geometry: Geometry): Position[];
/**
 * Vertices plus interpolated points along edges, used as origin samples
 * for H3 lower bounds. Spacing should be no larger than half a fine hex
 * edge so the bound stays admissible on long line/polygon sides.
 */
export declare function densifiedPositionsFromGeometry(geometry: Geometry, spacingMeters: number): Position[];
/**
 * H3 cells that cover the origin geometry at `resolution`.
 *
 * Vertices are always included. Lines are densified at half the hex edge
 * length so long segments cannot skip cells. Polygons also use
 * `polygonToCells`.
 */
export declare function cellsCoveringGeometry(geometry: Geometry, resolution: number): H3Index[];
//# sourceMappingURL=coverGeometry.d.ts.map