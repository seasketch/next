import { AsyncBuffer, cachedAsyncBuffer } from "hyparquet";
import { ByteBudgetCache, createBlockReader } from "./blockReader";

export const PUBLIC_UPLOADS_BASE = "https://uploads.seasketch.org";

/** Raw parquet bytes, keyed by file version. Persists for the isolate lifetime. */
const BLOCK_MEMORY_BUDGET = 32 * 1024 * 1024;
const blockMemory = new ByteBudgetCache(BLOCK_MEMORY_BUDGET);

interface FileStat {
  byteLength: number;
  etag: string;
  usePublicUploads: boolean;
}

/** Avoid a repeated R2 head() within a warm isolate. Table paths are
 * versioned, so etag/byteLength never change for a given key. */
const statCache = new Map<string, FileStat>();

async function getFileStat(
  bucket: R2Bucket,
  key: string,
  dev: boolean
): Promise<FileStat | null> {
  const cached = statCache.get(key);
  if (cached) {
    return cached;
  }

  let stat: FileStat | null = null;
  if (!dev) {
    const head = await bucket.head(key);
    if (head) {
      stat = {
        byteLength: head.size,
        etag: head.httpEtag,
        usePublicUploads: false,
      };
    }
  }
  if (!stat) {
    const probe = await probePublicUploads(key);
    if (probe) {
      stat = { ...probe, usePublicUploads: true };
    }
  }
  if (stat) {
    if (statCache.size >= 500) {
      statCache.clear();
    }
    statCache.set(key, stat);
  }
  return stat;
}

async function probePublicUploads(
  key: string
): Promise<{ byteLength: number; etag: string } | null> {
  const probe = await fetch(`${PUBLIC_UPLOADS_BASE}/${key}`, {
    headers: { Range: "bytes=0-0" },
  });
  if (!probe.ok) {
    return null;
  }
  const contentRange = probe.headers.get("content-range") || "";
  const byteLength = Number(contentRange.split("/")[1] || 0);
  const etag = probe.headers.get("etag") || "";
  if (!byteLength) {
    return null;
  }
  return { byteLength, etag };
}

async function fetchPublicUploadsRange(
  key: string,
  start: number,
  rangeEnd: number
): Promise<ArrayBuffer> {
  const res = await fetch(`${PUBLIC_UPLOADS_BASE}/${key}`, {
    headers: { Range: `bytes=${start}-${rangeEnd - 1}` },
  });
  if (!res.ok) {
    throw new Error(
      `Range request for ${key} failed with status ${res.status}`
    );
  }
  return await res.arrayBuffer();
}

async function fetchPublicUploadsObject(
  key: string
): Promise<ArrayBuffer | null> {
  const res = await fetch(`${PUBLIC_UPLOADS_BASE}/${key}`);
  if (!res.ok) {
    return null;
  }
  return await res.arrayBuffer();
}

export interface R2FileSource {
  buffer: AsyncBuffer;
  byteLength: number;
  etag: string;
}

export interface OpenFileOptions {
  bucket: R2Bucket;
  key: string;
  /** When true, fetch from uploads.seasketch.org instead of the R2 binding. */
  dev: boolean;
}

/**
 * Opens a parquet file as a hyparquet AsyncBuffer. Byte-range reads are
 * block-aligned and cached in isolate memory (keyed by etag), so warm
 * isolates serve repeat queries without contacting R2.
 */
export async function openR2File(
  options: OpenFileOptions
): Promise<R2FileSource | null> {
  const { bucket, key, dev } = options;

  const stat = await getFileStat(bucket, key, dev);
  if (!stat) {
    return null;
  }
  const { byteLength, etag, usePublicUploads } = stat;

  const slice = createBlockReader({
    byteLength,
    cacheId: `${key}@${etag}`,
    memory: blockMemory,
    fetchRange: async (start, end) => {
      if (usePublicUploads) {
        return fetchPublicUploadsRange(key, start, end);
      }
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

/** Fetches a whole small object from R2, e.g. column-stats.json. */
export async function getR2Object(
  options: Pick<OpenFileOptions, "bucket" | "key" | "dev">
): Promise<ArrayBuffer | null> {
  const { bucket, key, dev } = options;
  if (dev) {
    return fetchPublicUploadsObject(key);
  }
  const body = await bucket.get(key);
  if (body) {
    return await body.arrayBuffer();
  }
  return fetchPublicUploadsObject(key);
}
