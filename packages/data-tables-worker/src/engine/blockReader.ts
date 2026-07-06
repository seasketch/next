/**
 * Block-aligned range reader with an isolate-global in-memory cache.
 *
 * Parquet reads many small, overlapping byte ranges. Rounding reads up to
 * fixed-size blocks and caching those blocks in isolate memory means a second
 * query against the same table (even with different filters) reuses raw bytes
 * without another R2 round trip, as long as the Worker isolate is still warm.
 */

export const DEFAULT_BLOCK_SIZE = 512 * 1024;

/** Simple LRU keyed by string with a total-bytes budget. */
export class ByteBudgetCache<T = ArrayBuffer> {
  private map = new Map<string, { value: T; bytes: number }>();
  private bytes = 0;

  constructor(private maxBytes: number) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (entry !== undefined) {
      this.map.delete(key);
      this.map.set(key, entry);
    }
    return entry?.value;
  }

  set(key: string, value: T, bytes?: number): void {
    const size = bytes ?? (value as unknown as ArrayBuffer).byteLength;
    const existing = this.map.get(key);
    if (existing) {
      this.bytes -= existing.bytes;
      this.map.delete(key);
    }
    this.map.set(key, { value, bytes: size });
    this.bytes += size;
    for (const [oldKey, oldEntry] of this.map) {
      if (this.bytes <= this.maxBytes) {
        break;
      }
      this.map.delete(oldKey);
      this.bytes -= oldEntry.bytes;
    }
  }

  get totalBytes(): number {
    return this.bytes;
  }
}

/** Groups sorted block indices into contiguous [first, last] runs. */
export function coalesceRuns(indices: number[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  for (const index of indices) {
    const last = runs[runs.length - 1];
    if (last && index === last[1] + 1) {
      last[1] = index;
    } else {
      runs.push([index, index]);
    }
  }
  return runs;
}

export interface BlockReaderOptions {
  byteLength: number;
  blockSize?: number;
  /** Unique per file version (e.g. `${key}@${etag}`). */
  cacheId: string;
  memory: ByteBudgetCache;
  fetchRange(start: number, end: number): Promise<ArrayBuffer>;
}

export function createBlockReader(options: BlockReaderOptions) {
  const {
    byteLength,
    blockSize = DEFAULT_BLOCK_SIZE,
    cacheId,
    memory,
    fetchRange,
  } = options;

  const memoryKey = (index: number) => `${cacheId}#${blockSize}#${index}`;

  return async (start: number, end?: number): Promise<ArrayBuffer> => {
    const rangeEnd = Math.min(end === undefined ? byteLength : end, byteLength);
    if (rangeEnd <= start) {
      return new ArrayBuffer(0);
    }

    const firstBlock = Math.floor(start / blockSize);
    const lastBlock = Math.floor((rangeEnd - 1) / blockSize);
    const blocks = new Map<number, ArrayBuffer>();
    let missing: number[] = [];

    for (let i = firstBlock; i <= lastBlock; i++) {
      const cached = memory.get(memoryKey(i));
      if (cached) {
        blocks.set(i, cached);
      } else {
        missing.push(i);
      }
    }

    if (missing.length > 0) {
      await Promise.all(
        coalesceRuns(missing).map(async ([runFirst, runLast]) => {
          const runStart = runFirst * blockSize;
          const runEnd = Math.min((runLast + 1) * blockSize, byteLength);
          const data = await fetchRange(runStart, runEnd);
          for (let i = runFirst; i <= runLast; i++) {
            const offset = (i - runFirst) * blockSize;
            const block = data.slice(
              offset,
              Math.min(offset + blockSize, data.byteLength)
            );
            blocks.set(i, block);
            memory.set(memoryKey(i), block);
          }
        })
      );
    }

    const out = new Uint8Array(rangeEnd - start);
    for (let i = firstBlock; i <= lastBlock; i++) {
      const block = blocks.get(i)!;
      const blockStart = i * blockSize;
      const from = Math.max(start, blockStart);
      const to = Math.min(rangeEnd, blockStart + block.byteLength);
      if (to > from) {
        out.set(
          new Uint8Array(block, from - blockStart, to - from),
          from - start
        );
      }
    }
    return out.buffer;
  };
}
