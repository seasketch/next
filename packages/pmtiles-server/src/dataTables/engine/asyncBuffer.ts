import { AsyncBuffer, cachedAsyncBuffer } from "hyparquet";
import { ByteBudgetCache, createBlockReader } from "./blockReader";

/** Raw parquet bytes, keyed by file version. Persists for the isolate lifetime. */
const BLOCK_MEMORY_BUDGET = 32 * 1024 * 1024;
const blockMemory = new ByteBudgetCache(BLOCK_MEMORY_BUDGET);

interface FileStat {
  byteLength: number;
  etag: string;
}

/** Avoid a repeated R2 head() within a warm isolate. Table paths are
 * versioned, so etag/byteLength never change for a given key. */
const statCache = new Map<string, FileStat>();

async function getFileStat(
  bucket: R2Bucket,
  key: string
): Promise<FileStat | null> {
  const cached = statCache.get(key);
  if (cached) {
    return cached;
  }

  const head = await bucket.head(key);
  if (!head) {
    return null;
  }
  const stat: FileStat = { byteLength: head.size, etag: head.httpEtag };
  if (statCache.size >= 500) {
    statCache.clear();
  }
  statCache.set(key, stat);
  return stat;
}

export interface R2FileSource {
  buffer: AsyncBuffer;
  byteLength: number;
  etag: string;
}

export interface OpenFileOptions {
  bucket: R2Bucket;
  key: string;
}

/**
 * Opens a parquet file as a hyparquet AsyncBuffer. Byte-range reads are
 * block-aligned and cached in isolate memory (keyed by etag), so warm
 * isolates serve repeat queries without contacting R2.
 */
export async function openR2File(
  options: OpenFileOptions
): Promise<R2FileSource | null> {
  const { bucket, key } = options;

  const stat = await getFileStat(bucket, key);
  if (!stat) {
    return null;
  }
  const { byteLength, etag } = stat;

  const slice = createBlockReader({
    byteLength,
    cacheId: `${key}@${etag}`,
    memory: blockMemory,
    fetchRange: async (start, end) => {
      const body = await bucket.get(key, {
        range: { offset: start, length: end - start },
      });
      if (!body) {
        throw new Error(`Range request to R2 for ${key} returned no body`);
      }
      return await body.arrayBuffer();
    },
  });

  const buffer = cachedAsyncBuffer({ byteLength, slice });
  return { buffer, byteLength, etag };
}
