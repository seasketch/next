import {
  cellToChildPos,
  cellToChildren,
  cellToParent,
  getNumCells,
  getResolution,
  isPentagon,
} from "h3-js";
import { STATE_ENTIRE, STATE_PARTIAL } from "./constants";
import {
  ARCHIVE_MAGIC,
  ARCHIVE_VERSION,
  COARSE_RESOLUTION,
  FILE_STATE_NONE,
  HEADER_BYTES,
  buildRankTables,
  cellRank,
  getPackedState,
  packedBytes,
  recordSlots,
  recordStride,
} from "./format";

/**
 * About 80% of mixed resolution-4 cells that share an edge are at most this
 * many records apart in the global land archive. A block of this many records
 * is the default fetch and cache unit.
 */
export const DEFAULT_BLOCK_RECORDS = 16;

const DEFAULT_CACHE_BYTES = 32 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 6;

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

export type LandCell = { cell: string; state: LandState };

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

type Catalog = {
  fineResolution: number;
  stride: number;
  slots: number;
  mixedCount: number;
  recordsStart: number;
  planes: Uint8Array[];
  recordIndex: Int32Array;
};

const tables = buildRankTables();

export async function openLandOccupancy(
  url: string,
  options: LandOccupancyOptions = {},
): Promise<LandOccupancy> {
  const read = options.read ?? httpReader(url, options.signal);
  const header = await read(0, HEADER_BYTES);
  if (header.byteLength < HEADER_BYTES) {
    throw new Error("archive is shorter than its header");
  }
  const recordsStart = new DataView(
    header.buffer,
    header.byteOffset,
    header.byteLength,
  ).getUint32(24, true);
  if (recordsStart < HEADER_BYTES) {
    throw new Error("archive record offset is inside the header");
  }
  const rest =
    recordsStart > HEADER_BYTES ? await read(HEADER_BYTES, recordsStart) : new Uint8Array();
  const prefix = new Uint8Array(recordsStart);
  prefix.set(header.subarray(0, HEADER_BYTES), 0);
  prefix.set(rest.subarray(0, recordsStart - HEADER_BYTES), HEADER_BYTES);
  const opened = openCatalog(url, parsePrefix(prefix), read, options);
  opened.stats.requests += rest.byteLength > 0 ? 2 : 1;
  opened.stats.bytes += HEADER_BYTES + Math.min(rest.byteLength, recordsStart - HEADER_BYTES);
  return opened;
}

/** Open an archive that is already in memory. */
export function openLandOccupancyBytes(
  bytes: Uint8Array,
  options: LandOccupancyOptions = {},
): LandOccupancy {
  const read: RangeReader =
    options.read ??
    (async (start, end) => {
      if (start < 0 || end < start || end > bytes.byteLength) {
        throw new Error(`range ${start}-${end} is outside the archive`);
      }
      return bytes.subarray(start, end);
    });
  const recordsStart = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(24, true);
  return openCatalog(null, parsePrefix(bytes.subarray(0, recordsStart)), read, options);
}

function openCatalog(
  source: string | null,
  catalog: Catalog,
  read: RangeReader,
  options: LandOccupancyOptions,
): LandOccupancy {
  const blockRecords = options.blockRecords ?? DEFAULT_BLOCK_RECORDS;
  if (!Number.isInteger(blockRecords) || blockRecords < 1) {
    throw new Error("blockRecords must be a positive integer");
  }
  const coalesceGap = options.coalesceGap ?? blockRecords;
  const cache = new BlockCache(options.cacheBytes ?? DEFAULT_CACHE_BYTES, catalog.stride);
  const flights = new Map<number, Promise<void>>();
  const gate = new Gate(options.concurrency ?? DEFAULT_CONCURRENCY);
  const stats = { requests: 0, bytes: 0, records: 0, hits: 0 };
  const pinCount = new Map<number, number>();
  const pinned = {
    has(index: number) {
      return pinCount.has(index);
    },
  };

  function pin(blocks: readonly number[]): void {
    for (const block of blocks) pinCount.set(block, (pinCount.get(block) ?? 0) + 1);
  }

  function unpin(blocks: readonly number[]): void {
    for (const block of blocks) {
      const next = (pinCount.get(block) ?? 0) - 1;
      if (next <= 0) pinCount.delete(block);
      else pinCount.set(block, next);
    }
  }

  const publish = () => {
    stats.records = cache.records;
  };

  async function loadBlocks(indexes: number[]): Promise<void> {
    const missing: number[] = [];
    const mine = new Map<number, Promise<void>>();
    for (const index of indexes) {
      if (cache.get(index)) {
        stats.hits++;
        continue;
      }
      if (!flights.has(index)) missing.push(index);
    }
    const waiting: Array<Promise<void>> = [];
    for (const index of indexes) {
      const flight = flights.get(index);
      if (flight) waiting.push(flight);
    }
    for (const span of coalesceBlocks(missing, blockRecords, coalesceGap)) {
      const run = gate.run(async () => {
        const first = span[0]!;
        const last = span[span.length - 1]!;
        const startRecord = first * blockRecords;
        const endRecord = Math.min(catalog.mixedCount, (last + 1) * blockRecords);
        const start = catalog.recordsStart + startRecord * catalog.stride;
        const end = catalog.recordsStart + endRecord * catalog.stride;
        const bytes = await read(start, end);
        if (bytes.byteLength < end - start) {
          throw new Error(
            `record bytes ${start}-${end} returned ${bytes.byteLength} bytes`,
          );
        }
        stats.requests++;
        stats.bytes += end - start;
        for (const index of span) {
          const rec0 = index * blockRecords;
          const rec1 = Math.min(catalog.mixedCount, (index + 1) * blockRecords);
          cache.set(
            index,
            bytes.slice(
              (rec0 - startRecord) * catalog.stride,
              (rec1 - startRecord) * catalog.stride,
            ),
            pinned,
          );
        }
        publish();
      });
      for (const index of span) {
        flights.set(index, run);
        mine.set(index, run);
      }
      waiting.push(run);
    }
    try {
      await Promise.all(waiting);
    } finally {
      for (const [index, run] of mine) {
        if (flights.get(index) === run) flights.delete(index);
      }
    }
  }

  async function withCells<T>(cells: readonly string[], body: () => T): Promise<T> {
    const blocks = parentsOf(cells);
    pin(blocks);
    try {
      if (blocks.length > 0) await loadBlocks(blocks);
      return body();
    } finally {
      unpin(blocks);
      cache.evict(pinned);
      publish();
    }
  }

  function recordNumber(parent: string): number | null {
    const rank = cellRank(parent, COARSE_RESOLUTION, tables);
    const index = catalog.recordIndex[rank];
    return index == null || index < 0 ? null : index;
  }

  function parentsOf(cells: Iterable<string>): number[] {
    const needed = new Set<number>();
    for (const cell of cells) {
      const parent = coarseParent(cell, catalog.fineResolution);
      if (planeState(catalog, parent) !== STATE_PARTIAL) continue;
      const record = recordNumber(parent);
      if (record == null) {
        throw new Error(`partial cell ${parent} has no record`);
      }
      needed.add(Math.floor(record / blockRecords));
    }
    return [...needed];
  }

  function answer(cell: string): LandState {
    return named(numericState(catalog, cell, (record) => {
      const block = Math.floor(record / blockRecords);
      const data = cache.get(block);
      if (!data) throw new Error(`record ${record} is not loaded`);
      const local = record - block * blockRecords;
      return data.subarray(local * catalog.stride, (local + 1) * catalog.stride);
    }));
  }

  const occupancy: LandOccupancy = {
    source,
    coarseResolution: COARSE_RESOLUTION,
    fineResolution: catalog.fineResolution,
    stride: catalog.stride,
    slots: catalog.slots,
    blockRecords,
    stats,
    async state(cell) {
      return withCells([cell], () => answer(cell));
    },
    async states(input) {
      const cells = [...input];
      return withCells(cells, () => {
        const out = new Map<string, LandState>();
        for (const cell of cells) out.set(cell, answer(cell));
        return out;
      });
    },
    async split(cell) {
      const children = cellToChildren(cell, getResolution(cell) + 1);
      const states = await occupancy.states(children);
      return children.map((child) => ({ cell: child, state: states.get(child)! }));
    },
    async prefetch(input) {
      await withCells([...input], () => undefined);
    },
    clearCache() {
      cache.clear();
      publish();
    },
  };
  return occupancy;
}

/**
 * Groups of block indexes to fetch together. `indexes` need not be sorted.
 * A run continues while the records between two blocks are within `gap`.
 */
export function coalesceBlocks(
  indexes: readonly number[],
  blockRecords: number,
  gap: number,
): number[][] {
  const ordered = [...new Set(indexes)].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const index of ordered) {
    const run = runs[runs.length - 1];
    const previous = run?.[run.length - 1];
    if (previous == null) {
      runs.push([index]);
      continue;
    }
    const hole = (index - previous - 1) * blockRecords;
    if (hole <= gap) run!.push(index);
    else runs.push([index]);
  }
  return runs;
}

function coarseParent(cell: string, fineResolution: number): string {
  const resolution = getResolution(cell);
  if (resolution > fineResolution) {
    throw new Error(`cell ${cell} is finer than this archive`);
  }
  return resolution <= COARSE_RESOLUTION
    ? cell
    : cellToParent(cell, COARSE_RESOLUTION);
}

function numericState(
  catalog: Catalog,
  cell: string,
  recordAt: (record: number) => Uint8Array,
): number {
  const resolution = getResolution(cell);
  if (resolution <= COARSE_RESOLUTION) {
    return getPackedState(catalog.planes[resolution]!, cellRank(cell, resolution, tables));
  }
  if (resolution > catalog.fineResolution) {
    throw new Error(`cell ${cell} is finer than this archive`);
  }
  const parent = cellToParent(cell, COARSE_RESOLUTION);
  const parentState = getPackedState(
    catalog.planes[COARSE_RESOLUTION]!,
    cellRank(parent, COARSE_RESOLUTION, tables),
  );
  if (parentState !== STATE_PARTIAL) return parentState;
  const record = catalog.recordIndex[cellRank(parent, COARSE_RESOLUTION, tables)];
  if (record == null || record < 0) {
    throw new Error(`partial cell ${parent} has no record`);
  }
  const packed = recordAt(record);
  if (resolution === catalog.fineResolution) {
    return getPackedState(packed, cellToChildPos(cell, COARSE_RESOLUTION));
  }
  // Hex children occupy one contiguous run of fine slots inside the
  // resolution-4 record. A pentagon (or a cell under one) does not, so those
  // few cells still list their descendants.
  if (!pentagonLine(cell)) {
    const count = 7 ** (catalog.fineResolution - resolution);
    const start = cellToChildPos(cell, COARSE_RESOLUTION) * count;
    return summarizePacked(packed, start, count);
  }
  let allEntire = true;
  let allWater = true;
  for (const child of cellToChildren(cell, catalog.fineResolution)) {
    const state = getPackedState(packed, cellToChildPos(child, COARSE_RESOLUTION));
    if (state !== STATE_ENTIRE) allEntire = false;
    if (state !== FILE_STATE_NONE) allWater = false;
    if (!allEntire && !allWater) return STATE_PARTIAL;
  }
  if (allWater) return FILE_STATE_NONE;
  if (allEntire) return STATE_ENTIRE;
  return STATE_PARTIAL;
}

function summarizePacked(packed: Uint8Array, start: number, count: number): number {
  let allEntire = true;
  let allWater = true;
  for (let index = start; index < start + count; index++) {
    const state = getPackedState(packed, index);
    if (state !== STATE_ENTIRE) allEntire = false;
    if (state !== FILE_STATE_NONE) allWater = false;
    if (!allEntire && !allWater) return STATE_PARTIAL;
  }
  if (allWater) return FILE_STATE_NONE;
  if (allEntire) return STATE_ENTIRE;
  return STATE_PARTIAL;
}

const pentagonAncestor = new Map<string, boolean>();

function pentagonLine(cell: string): boolean {
  const known = pentagonAncestor.get(cell);
  if (known !== undefined) return known;
  const chain: string[] = [];
  let current = cell;
  let found = false;
  while (getResolution(current) >= COARSE_RESOLUTION) {
    chain.push(current);
    if (isPentagon(current)) {
      found = true;
      break;
    }
    if (getResolution(current) === COARSE_RESOLUTION) break;
    current = cellToParent(current, getResolution(current) - 1);
  }
  for (const item of chain) pentagonAncestor.set(item, found);
  return found;
}

function named(state: number): LandState {
  if (state === FILE_STATE_NONE) return "water";
  if (state === STATE_PARTIAL) return "mixed";
  if (state === STATE_ENTIRE) return "land";
  throw new Error(`unexpected cell state ${state}`);
}

function planeState(catalog: Catalog, cell: string): number {
  const resolution = getResolution(cell);
  return getPackedState(
    catalog.planes[resolution]!,
    cellRank(cell, resolution, tables),
  );
}

function parsePrefix(bytes: Uint8Array): Catalog {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new Error("archive is shorter than its header");
  }
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));
  if (magic !== ARCHIVE_MAGIC) throw new Error(`unexpected archive magic ${magic}`);
  if (bytes[4] !== ARCHIVE_VERSION) {
    throw new Error(`unsupported archive version ${bytes[4]}`);
  }
  const fineResolution = bytes[5]!;
  if (bytes[6] !== COARSE_RESOLUTION || fineResolution <= COARSE_RESOLUTION) {
    throw new Error("archive resolution does not match this reader");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const slots = view.getUint32(12, true);
  const stride = view.getUint32(16, true);
  const mixedCount = view.getUint32(20, true);
  const recordsStart = view.getUint32(24, true);
  if (slots !== recordSlots(fineResolution) || stride !== recordStride(fineResolution)) {
    throw new Error("archive record layout does not match this reader");
  }
  const planes: Uint8Array[] = [];
  let cursor = HEADER_BYTES;
  for (let res = 0; res <= COARSE_RESOLUTION; res++) {
    if (cursor + 4 > bytes.byteLength) throw new Error("archive planes are truncated");
    const count = view.getUint32(cursor, true);
    if (count !== getNumCells(res)) {
      throw new Error(`plane ${res} has ${count} cells, H3 has ${getNumCells(res)}`);
    }
    const size = packedBytes(count);
    planes.push(bytes.slice(cursor + 4, cursor + 4 + size));
    cursor += 4 + size;
  }
  if (cursor !== recordsStart) {
    throw new Error("record offset does not follow the coarse planes");
  }
  const recordIndex = new Int32Array(getNumCells(COARSE_RESOLUTION));
  recordIndex.fill(-1);
  let next = 0;
  const coarse = planes[COARSE_RESOLUTION]!;
  const count = getNumCells(COARSE_RESOLUTION);
  for (let rank = 0; rank < count; rank++) {
    if (getPackedState(coarse, rank) === STATE_PARTIAL) recordIndex[rank] = next++;
  }
  if (next !== mixedCount) {
    throw new Error(`header lists ${mixedCount} records, the coarse plane has ${next}`);
  }
  return { fineResolution, stride, slots, mixedCount, recordsStart, planes, recordIndex };
}

function httpReader(url: string, signal: AbortSignal | undefined): RangeReader {
  return async (start, end) => {
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${end - 1}` },
      signal,
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(`range ${start}-${end - 1} returned ${response.status}`);
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (response.status === 206 || body.byteLength === end - start) return body;
    if (response.status === 200 && body.byteLength >= end) return body.slice(start, end);
    throw new Error(
      `range ${start}-${end - 1} returned ${response.status} (${body.byteLength} bytes)`,
    );
  };
}

class BlockCache {
  private readonly blocks = new Map<number, Uint8Array>();
  private retained = 0;
  records = 0;

  constructor(
    private readonly limit: number,
    private readonly stride: number,
  ) {}

  has(index: number): boolean {
    return this.blocks.has(index);
  }

  get(index: number): Uint8Array | undefined {
    const hit = this.blocks.get(index);
    if (!hit) return undefined;
    this.blocks.delete(index);
    this.blocks.set(index, hit);
    return hit;
  }

  set(index: number, data: Uint8Array, pinned: { has(index: number): boolean }): void {
    this.forget(index);
    this.blocks.set(index, data);
    this.retained += data.byteLength;
    this.records += data.byteLength / this.stride;
    this.evict(pinned);
  }

  evict(pinned: { has(index: number): boolean }): void {
    for (const [index] of this.blocks) {
      if (this.retained <= this.limit) return;
      if (pinned.has(index)) continue;
      this.forget(index);
    }
  }

  clear(): void {
    this.blocks.clear();
    this.retained = 0;
    this.records = 0;
  }

  private forget(index: number): void {
    const previous = this.blocks.get(index);
    if (!previous) return;
    this.blocks.delete(index);
    this.retained -= previous.byteLength;
    this.records -= previous.byteLength / this.stride;
  }
}

class Gate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      const next = this.waiting.shift();
      if (next) next();
    }
  }
}
