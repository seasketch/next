import { describe, expect, it } from "vitest";
import {
  ByteBudgetCache,
  coalesceRuns,
  createBlockReader,
} from "../../src/dataTables/engine/blockReader";

function makeFile(byteLength: number): Uint8Array {
  const data = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    data[i] = i % 251;
  }
  return data;
}

interface Harness {
  read: (start: number, end?: number) => Promise<ArrayBuffer>;
  fetches: Array<[number, number]>;
  memory: ByteBudgetCache;
}

function makeReader(
  file: Uint8Array,
  { blockSize = 16, memoryBudget = 1024 * 1024 } = {}
): Harness {
  const fetches: Array<[number, number]> = [];
  const memory = new ByteBudgetCache(memoryBudget);
  const read = createBlockReader({
    byteLength: file.byteLength,
    blockSize,
    cacheId: "test@etag",
    memory,
    fetchRange: async (start, end) => {
      fetches.push([start, end]);
      return file.slice(start, end).buffer;
    },
  });
  return { read, fetches, memory };
}

describe("coalesceRuns", () => {
  it("groups contiguous indices into runs", () => {
    expect(coalesceRuns([0, 1, 2, 5, 6, 9])).toEqual([
      [0, 2],
      [5, 6],
      [9, 9],
    ]);
    expect(coalesceRuns([])).toEqual([]);
    expect(coalesceRuns([3])).toEqual([[3, 3]]);
  });
});

describe("ByteBudgetCache", () => {
  it("evicts least recently used entries when over budget", () => {
    const cache = new ByteBudgetCache(30);
    cache.set("a", new ArrayBuffer(10));
    cache.set("b", new ArrayBuffer(10));
    cache.set("c", new ArrayBuffer(10));
    // Touch "a" so "b" becomes the eviction candidate.
    cache.get("a");
    cache.set("d", new ArrayBuffer(10));
    expect(cache.get("a")).toBeDefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBeDefined();
    expect(cache.get("d")).toBeDefined();
    expect(cache.totalBytes).toBe(30);
  });
});

describe("createBlockReader", () => {
  it("returns exact bytes for unaligned ranges", async () => {
    const file = makeFile(100);
    const { read } = makeReader(file);
    const result = new Uint8Array(await read(5, 37));
    expect(result).toEqual(file.slice(5, 37));
  });

  it("clamps to end of file and handles empty ranges", async () => {
    const file = makeFile(50);
    const { read } = makeReader(file);
    expect(new Uint8Array(await read(40))).toEqual(file.slice(40));
    expect((await read(10, 10)).byteLength).toBe(0);
    expect((await read(60, 70)).byteLength).toBe(0);
  });

  it("fetches contiguous missing blocks in a single ranged request", async () => {
    const file = makeFile(100);
    const { read, fetches } = makeReader(file);
    await read(0, 60); // blocks 0-3
    expect(fetches).toEqual([[0, 64]]);
  });

  it("serves overlapping reads from memory without refetching", async () => {
    const file = makeFile(100);
    const { read, fetches } = makeReader(file);
    await read(0, 40); // blocks 0-2
    await read(10, 30); // fully covered
    expect(fetches).toHaveLength(1);
    await read(20, 90); // needs blocks 1-5; 3-5 missing
    expect(fetches).toEqual([
      [0, 48],
      [48, 96],
    ]);
    const result = new Uint8Array(await read(20, 90));
    expect(result).toEqual(file.slice(20, 90));
  });
});
