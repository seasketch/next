/**
 * Direct R2 byte-range reads for the properties scanner.
 *
 * Unlike `rangeCache.getR2Range`, this path is not an HTTP Range response
 * builder. It returns ArrayBuffers for in-Worker parsing with minimal copying,
 * matching the old overlay-worker `fetchRangeFromBucket` approach.
 *
 * Only small windows (header / index) are written to the Cache API. Caching the
 * full feature section would double peak memory and can OOM the isolate.
 */

const inFlight = new Map<string, Promise<ArrayBuffer>>();

/** Cache header/index sized reads only — not multi‑MB feature scans. */
const MAX_CACHE_BYTES = 512 * 1024;

function cacheRequest(key: string, range: [number, number | null]): Request {
  return new Request(
    `https://overlay-properties-cache.invalid/${encodeURIComponent(key)}?bytes=${range[0]}-${range[1] ?? ""}`,
  );
}

export async function fetchPropertiesRange(
  bucket: R2Bucket,
  key: string,
  range: [number, number | null],
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<ArrayBuffer> {
  const request = cacheRequest(key, range);
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) {
    return cached.arrayBuffer();
  }

  const flightKey = `${key}:${range[0]}-${range[1] ?? ""}`;
  let pending = inFlight.get(flightKey);
  if (!pending) {
    pending = (async () => {
      const object = await bucket.get(key, {
        range:
          range[1] === null
            ? { offset: range[0] }
            : { offset: range[0], length: range[1] - range[0] + 1 },
      });
      if (!object || !("body" in object) || !object.body) {
        throw new Error("object_not_found");
      }
      const buffer = await object.arrayBuffer();
      if (buffer.byteLength <= MAX_CACHE_BYTES) {
        const put = cache.put(
          request,
          new Response(buffer.slice(0), {
            status: 200,
            headers: {
              "Content-Type": "application/octet-stream",
              "Cache-Control": "public, immutable, max-age=31536000",
            },
          }),
        );
        if (waitUntil) {
          waitUntil(put);
        }
      }
      return buffer;
    })().finally(() => inFlight.delete(flightKey));
    inFlight.set(flightKey, pending);
  }
  return pending;
}
