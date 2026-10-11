import type { Geometry, MultiPolygon, Polygon } from "geojson";
/**
 * Cut a polygon in two along the longer axis of its bounding box. Both halves
 * keep their holes. Returns the non-empty halves, or null when the polygon is
 * too thin to cut.
 */
export declare function splitRings(rings: readonly (readonly number[][])[]): number[][][][] | null;
export declare class CellSet {
    private readonly chunkSize;
    private readonly chunks;
    private tail;
    size: number;
    constructor(chunkSize?: number);
    add(value: bigint): void;
    has(value: bigint): boolean;
    [Symbol.iterator](): IterableIterator<bigint>;
}
export type GeometryContribution = {
    /** Cells fully inside this geometry. One subdivided piece is enough. */
    entire: CellSet;
    /**
     * Area of this geometry inside cells it does not fully cover.
     * The caller sums these across pieces. A cell that only straddles a
     * subdivision boundary becomes entire once the pieces add up.
     */
    cover: Map<bigint, number>;
};
export declare function emptyContribution(): GeometryContribution;
export declare function nextCover(previous: number, added: number, cellArea: number, epsilon: number): {
    kind: "unchanged";
} | {
    kind: "partial";
    cover: number;
} | {
    kind: "entire";
    cover: number;
};
/**
 * Classify one land polygon at `resolution`.
 *
 * `containmentFull` cells are entire: the piece covers them, so neighboring
 * pieces are not required. Remaining overlapping cells contribute intersection
 * area. Callers add that area across the non-overlapping subdivision and
 * promote a cell when the sum covers it.
 */
export declare function measureGeometry(geometry: Geometry, resolution: number, epsilon?: number): GeometryContribution;
export type CoarseHit = {
    /** Resolution-7 cells fully inside a single land piece. */
    sealed: CellSet;
    /** Area of land inside resolution-7 cells the pieces only overlap. */
    overlap: Map<bigint, number>;
};
/**
 * Classify one geometry at the base resolution. Fully contained cells are
 * sealed. Overlapping cells keep their area and are refined later, including
 * cells that are almost entirely covered: the 0.1% sliver can still make a
 * finer child mixed.
 */
export declare function collectCoarse(geometry: Geometry, baseResolution: number): CoarseHit;
/**
 * Area this geometry adds to each fine child of a mixed base cell.
 *
 * Descendants reach outside the base cell's outline, so the polygon is
 * clipped to the base hexagon scaled by `DESCENDANT_REACH`, and the mixed
 * neighbors of every overlapping base cell are measured as well: a piece
 * that only touches the corner of a child may not overlap the parent at all.
 * Clipping first keeps a continental ring from being re-tested against every
 * child.
 */
export declare function collectRefine(geometry: Geometry, baseResolution: number, fineResolution: number, isMixed: (h3: bigint) => boolean): Map<bigint, number>;
export declare function isPolygonGeometry(geometry: Geometry | null | undefined): geometry is Polygon | MultiPolygon;
