/**
 * Fixed-stride H3 land occupancy.
 *
 *   0  char[4]  "H3LD"
 *   4  u8       version (1)
 *   5  u8       fine resolution (8)
 *   6  u8       coarse resolution (4)
 *   7  u8       first stored plane (0)
 *   8  u8       bits per cell (2)
 *   9  u8[3]    reserved
 *  12  u32le    slots in one fine record (2401)
 *  16  u32le    record stride in bytes (601)
 *  20  u32le    number of fine records
 *  24  u32le    byte offset of the first fine record
 *
 * Planes for resolutions 0..coarse follow the header. Each plane is
 * `u32le cellCount` plus 2-bit values packed little-bit-first (four cells
 * per byte). State 0 is water, 1 is partial, 2 is entire.
 *
 * Fine records follow, one per partial coarse cell, in ascending coarse
 * rank. A record is 2,401 slots of the same 2-bit packing, indexed by
 * `cellToChildPos(cell, coarse)`. The record index is the number of
 * partial coarse cells with a smaller rank, so a client that has the
 * coarse plane can form the byte range without any other index.
 * Resolutions between coarse and fine are folded from that record.
 */
export declare const ARCHIVE_MAGIC = "H3LD";
export declare const ARCHIVE_VERSION = 1;
export declare const COARSE_RESOLUTION = 4;
export declare const FINE_RESOLUTION = 8;
export declare const HEADER_BYTES = 28;
export declare const RECORD_SLOTS: number;
export declare const RECORD_STRIDE: number;
export declare const FILE_STATE_NONE = 0;
export type RankTables = {
    pentagonBases: Set<number>;
    /** prefix[res][base] is the first rank of that base cell. prefix[res][122] is the cell count. */
    prefix: Uint32Array[];
};
export type PackStats = {
    cells: number;
    entireCells: number;
    partialCells: number;
    entireParents: number;
    mixedParents: number;
    waterParents: number;
    bytes: number;
};
export declare function buildRankTables(): RankTables;
export declare function cellRank(cell: string, res: number, tables: RankTables): number;
/**
 * Coarse parent of a fine cell. Digits finer than `coarse` are set to 7 and
 * the resolution field is rewritten, which is how H3 forms the parent index.
 */
export declare function parentAtCoarse(h3: bigint, coarse?: number): bigint;
/** Slot of a fine cell inside its coarse parent record. */
export declare function childPosition(h3: bigint, tables: RankTables, coarse?: number): number;
export declare function recordSlots(fineResolution: number, coarse?: number): number;
export declare function recordStride(fineResolution: number, coarse?: number): number;
export declare function pentagonFineChildren(fineResolution: number, coarse?: number): number;
export declare function fineChildCount(parent: bigint, fineResolution: number, tables: RankTables): number;
/**
 * Slot range of `h3` inside its resolution-4 record at `fineResolution`.
 * Hex children occupy a contiguous base-7 block. Pentagon descendants use
 * H3 child positions, which stay contiguous but are not a raw power of 7.
 */
export declare function descendantSlotBlock(h3: bigint, fineResolution: number, tables: RankTables): {
    start: number;
    count: number;
};
export declare function packedBytes(cellCount: number): number;
export declare function getPackedState(bytes: Uint8Array, index: number): number;
export declare function setPackedState(bytes: Uint8Array, index: number, state: number): void;
export declare class OccupancyAccumulator {
    readonly tables: RankTables;
    readonly fineResolution: number;
    private readonly slots;
    private readonly stride;
    private readonly hexChildren;
    private readonly pentagonChildren;
    private readonly buckets;
    private readonly uniformEntire;
    cells: number;
    entireCells: number;
    partialCells: number;
    constructor(fineResolution?: number);
    /** A coarse cell whose every fine child is land. Its children are not stored. */
    markUniformEntire(parent: bigint): void;
    add(h3: bigint, state: number): void;
    /** Mark a contiguous run of fine slots, used when a coarser cell is entirely land. */
    fillSlots(parent: bigint, start: number, count: number, state: number): void;
    private addAt;
    finish(): {
        bytes: Uint8Array;
        stats: PackStats;
    };
}
export declare class OccupancyArchive {
    readonly bytes: Uint8Array;
    readonly recordsStart: number;
    readonly mixedCount: number;
    readonly fineResolution: number;
    private readonly stride;
    private readonly planes;
    /** Record index of each partial coarse cell, or -1 when the coarse cell is uniform. */
    private readonly recordIndex;
    private constructor();
    static open(bytes: Uint8Array): OccupancyArchive;
    /** Byte offset of a partial coarse cell's record, or null when the cell is uniform. */
    recordOffset(coarseCell: string): number | null;
    state(cell: string): number;
}
