import type { RangeResponse } from "pmtiles";
import { KeyNotFoundError } from "./errors";
import type { RequestTiming } from "./timing";

/** Bytes read by pmtiles getHeaderAndRoot() — fixed archive prefix size. */
export const PMTILES_PREFIX_LENGTH = 16384;

const PREFIX_CACHE_ORIGIN = "https://pmtiles-prefix.internal";

const prefixInflight = new Map<string, Promise<RangeResponse>>();

/** Build the synthetic Request used as the PoP Cache API key for an archive prefix. */
export function buildPrefixCacheRequest(archiveName: string): Request {
  return new Request(`${PREFIX_CACHE_ORIGIN}/${archiveName}.pmtiles`);
}

async function prefixFromCacheResponse(
  response: Response
): Promise<RangeResponse> {
  const etag = response.headers.get("X-R2-ETag");
  return {
    data: await response.arrayBuffer(),
    etag: etag && etag.length > 0 ? etag : undefined,
  };
}

async function readPrefixFromR2(
  bucket: R2Bucket,
  archiveName: string,
  timing?: RequestTiming
): Promise<RangeResponse> {
  const start = performance.now();
  try {
    const resp = await bucket.get(`${archiveName}.pmtiles`, {
      range: { offset: 0, length: PMTILES_PREFIX_LENGTH },
    });
    if (!resp) {
      throw new KeyNotFoundError("Archive not found");
    }

    const body = resp as R2ObjectBody;
    if (!body.body) {
      throw new KeyNotFoundError("Archive not found");
    }

    const data = await body.arrayBuffer();
    return {
      data,
      etag: body.etag,
      cacheControl: body.httpMetadata?.cacheControl,
      expires: body.httpMetadata?.cacheExpiry?.toISOString(),
    };
  } finally {
    timing?.recordR2(performance.now() - start);
  }
}

async function loadPrefixIntoCache(
  bucket: R2Bucket,
  archiveName: string,
  cacheKey: Request,
  timing?: RequestTiming
): Promise<RangeResponse> {
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    timing?.recordPrefixCacheHit();
    return prefixFromCacheResponse(cached);
  }

  const prefix = await readPrefixFromR2(bucket, archiveName, timing);
  const cacheHeaders: Record<string, string> = {
    "Cache-Control": "public, immutable, max-age=31536000",
    "Content-Type": "application/octet-stream",
  };
  if (prefix.etag) {
    cacheHeaders["X-R2-ETag"] = prefix.etag;
  }

  await caches.default.put(
    cacheKey,
    new Response(prefix.data, { headers: cacheHeaders })
  );
  return prefix;
}

/**
 * Fetch the immutable PMTiles archive prefix (header + root directory bytes).
 * Uses the PoP Cache API so all isolates share one copy per archive; a brief
 * in-flight dedupe avoids duplicate R2 reads while the first miss populates cache.
 */
export async function fetchArchivePrefix(
  bucket: R2Bucket,
  archiveName: string,
  timing?: RequestTiming
): Promise<RangeResponse> {
  const cacheKey = buildPrefixCacheRequest(archiveName);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    timing?.recordPrefixCacheHit();
    return prefixFromCacheResponse(cached);
  }

  let pending = prefixInflight.get(archiveName);
  if (!pending) {
    pending = loadPrefixIntoCache(bucket, archiveName, cacheKey, timing);
    prefixInflight.set(archiveName, pending);
  }

  try {
    return await pending;
  } finally {
    if (prefixInflight.get(archiveName) === pending) {
      prefixInflight.delete(archiveName);
    }
  }
}
