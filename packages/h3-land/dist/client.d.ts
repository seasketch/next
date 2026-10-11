/**
 * About 80% of mixed resolution-4 cells that share an edge are at most this
 * many records apart in the global land archive. A block of this many records
 * is the default fetch and cache unit.
 */
export declare const DEFAULT_BLOCK_RECORDS = 16;
export type LandState = "water" | "mixed" | "land";
/** Read bytes [start, end). End is exclusive. */
export type RangeReader = (start: number, end: number) => Promise<Uint8Array>;
export type LandOccupancyOptions = {
    /**
     * How to read the archive. The default sends HTTP Range requests to `url`.
     * Pass a reader in tests, or when the bytes already live somewhere else.
     */
    read?: RangeReader;
    /**
     * Fine records to retain, in bytes. The resolution 0–4 planes are kept
     * separately and do not count. Default 32 MiB. Zero keeps nothing between calls.
     */
    cacheBytes?: number;
    /**
     * Records in one cached block. Blocks begin at
     * `recordsStart + blockIndex * blockRecords * stride`, so a fetch never
     * starts or ends in the middle of a record. Default 16.
     */
    blockRecords?: number;
    /**
     * When a call needs two blocks with at most this many records between them,
     * fetch the span in one request. Default is one block, so a hole the size
     * of a block is filled rather than becoming a second round trip.
     */
    coalesceGap?: number;
    /** Parallel range requests. Default 6. */
    concurrency?: number;
    signal?: AbortSignal;
};
export type LandStats = {
    requests: number;
    bytes: number;
    /** Fine records currently retained in the cache. */
    records: number;
    /** Block lookups served from memory. */
    hits: number;
};
export type LandCell = {
    cell: string;
    state: LandState;
};
export interface LandOccupancy {
    /** The URL passed to openLandOccupancy, or null for an in-memory archive. */
    readonly source: string | null;
    readonly coarseResolution: number;
    readonly fineResolution: number;
    readonly stride: number;
    readonly slots: number;
    readonly blockRecords: number;
    readonly stats: LandStats;
    /** One cell, at any resolution from 0 through fineResolution. */
    state(cell: string): Promise<LandState>;
    /**
     * Many cells. Mixed parents are grouped into record-aligned blocks, and
     * blocks that sit near each other become one range request.
     */
    states(cells: Iterable<string>): Promise<Map<string, LandState>>;
    /**
     * The children of a cell and their states. A water or land cell returns
     * copies of that state and does not download a record. A pentagon has six
     * children; every other cell has seven.
     */
    split(cell: string): Promise<LandCell[]>;
    /**
     * Download the blocks that cover these cells. Water and land parents are
     * skipped. Cells may be any resolution up to the fine resolution.
     */
    prefetch(cells: Iterable<string>): Promise<void>;
    /** Drop cached records. The planes stay. */
    clearCache(): void;
}
export declare function openLandOccupancy(url: string, options?: LandOccupancyOptions): Promise<LandOccupancy>;
/** Open an archive that is already in memory. */
export declare function openLandOccupancyBytes(bytes: Uint8Array, options?: LandOccupancyOptions): LandOccupancy;
/**
 * Groups of block indexes to fetch together. `indexes` need not be sorted.
 * A run continues while the records between two blocks are within `gap`.
 */
export declare function coalesceBlocks(indexes: readonly number[], blockRecords: number, gap: number): number[][];
