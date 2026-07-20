import { RequestTiming } from "./timing";

type ByteRange =
  | { kind: "offset"; start: number; end: number | null; cacheKey: string }
  | { kind: "suffix"; suffix: number; cacheKey: string };

type RangeParts = {
  buffer: ArrayBuffer;
  start: number;
  end: number;
  total: number;
  etag: string | null;
  contentType: string | null;
};

type RangeFetchResult =
  | { ok: true; parts: RangeParts }
  | { ok: false; status: number; headers: Headers; body: string };

const inFlight = new Map<string, Promise<RangeFetchResult>>();

/** Skip Cache API for huge windows — buffering multi‑MB bodies OOMs isolates. */
const MAX_RANGE_CACHE_BYTES = 2 * 1024 * 1024;
/**
 * Only buffer ranges at or under this size. Larger / open-ended ranges are
 * streamed from R2 so overlay-worker `bytes=N-` feature scans do not OOM.
 */
const MAX_RANGE_BUFFER_BYTES = 16 * 1024 * 1024;

function parseRange(value: string | null): ByteRange | null {
  if (!value) return null;
  const match = value.trim().match(/^bytes=(?:(\d+)-(\d*)|-(\d+))$/i);
  if (!match) return null;
  if (match[3]) {
    const suffix = Number(match[3]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { kind: "suffix", suffix, cacheKey: `suffix-${suffix}` };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(start) || (end !== null && end < start)) return null;
  return { kind: "offset", start, end, cacheKey: `${start}-${end ?? ""}` };
}

/** Known length from the Range header alone, or null when open-ended. */
function knownHeaderLength(range: ByteRange): number | null {
  if (range.kind === "suffix") return range.suffix;
  if (range.end === null) return null;
  return range.end - range.start + 1;
}

function cacheRequest(key: string, range: ByteRange): Request {
  const encoded = encodeURIComponent(key);
  // Bump `rv` when the stored entry shape changes so torn/old entries are ignored.
  return new Request(
    `https://overlay-range-cache.invalid/rv2/${encoded}?bytes=${range.cacheKey}`,
  );
}

function errorResult(
  status: number,
  body: string,
  headers?: HeadersInit,
): RangeFetchResult {
  return { ok: false, status, headers: new Headers(headers), body };
}

function responseFromResult(
  result: RangeFetchResult,
  cacheStatus: "hit" | "miss",
): Response {
  if (!result.ok) {
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    });
  }
  return rangeResponseFromParts({ ...result.parts, cacheStatus });
}

function r2GetRange(range: ByteRange): R2Range {
  if (range.kind === "suffix") return { suffix: range.suffix };
  return {
    offset: range.start,
    length: range.end === null ? undefined : range.end - range.start + 1,
  };
}

/**
 * R2 documents `offset`/`length` on ranged gets; some runtimes also expose `end`.
 */
function resolveBounds(
  range: ByteRange,
  object: R2Object,
): { start: number; end: number; total: number; byteLength: number } {
  const total = object.size;
  const returned = object.range as
    | { offset?: number; length?: number; end?: number }
    | undefined;

  let start: number;
  let end: number;
  if (
    returned &&
    typeof returned.offset === "number" &&
    typeof returned.length === "number"
  ) {
    start = returned.offset;
    end = returned.offset + returned.length - 1;
  } else if (
    returned &&
    typeof returned.offset === "number" &&
    typeof returned.end === "number"
  ) {
    start = returned.offset;
    end = returned.end;
  } else if (range.kind === "suffix") {
    end = total - 1;
    start = Math.max(0, total - range.suffix);
  } else {
    start = range.start;
    end = range.end ?? total - 1;
  }

  return { start, end, total, byteLength: Math.max(0, end - start + 1) };
}

function streamingRangeResponse(
  object: R2ObjectBody,
  start: number,
  end: number,
  total: number,
): Response {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Range": `bytes ${start}-${end}/${total}`,
    "Content-Length": String(end - start + 1),
    "Cache-Control": "public, immutable, max-age=31536000",
    "X-SS-Range-Cache": "bypass",
  });
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { status: 206, headers });
}

async function streamR2Range(
  bucket: R2Bucket,
  key: string,
  range: ByteRange,
  timing?: RequestTiming,
): Promise<Response> {
  timing?.addStage("range-stream", 0);
  let object: R2ObjectBody | R2Object | null;
  try {
    object = await bucket.get(key, { range: r2GetRange(range) });
  } catch {
    const metadata = await bucket.head(key);
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${metadata?.size ?? "*"}` },
    });
  }
  if (!object) return new Response("Object not found", { status: 404 });
  if (!("body" in object) || !object.body) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${object.size}` },
    });
  }
  const { start, end, total } = resolveBounds(range, object);
  return streamingRangeResponse(object as R2ObjectBody, start, end, total);
}

export async function getR2Range(
  bucket: R2Bucket,
  key: string,
  rangeHeader: string,
  timing?: RequestTiming,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const range = parseRange(rangeHeader);
  if (!range) {
    return new Response("Invalid or unsupported Range header", {
      status: 416,
      headers: { "Content-Range": "bytes */*" },
    });
  }

  const headerLength = knownHeaderLength(range);
  // Open-ended or clearly huge ranges must stream — buffering OOMs the isolate
  // (overlay-worker commonly requests `bytes={featureOffset}-`).
  if (headerLength === null || headerLength > MAX_RANGE_BUFFER_BYTES) {
    return streamR2Range(bucket, key, range, timing);
  }

  const cacheKey = `${key}:${range.cacheKey}`;
  const request = cacheRequest(key, range);
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) {
    timing?.addStage("range-cache-hit", 0);
    // Buffer the cached entry so we never hand out a locked/partial stream.
    const buffer = await cached.arrayBuffer();
    return rangeResponseFromParts({
      buffer,
      start: Number(cached.headers.get("X-Range-Start")),
      end: Number(cached.headers.get("X-Range-End")),
      total: Number(cached.headers.get("X-Range-Total")),
      etag: cached.headers.get("etag"),
      contentType: cached.headers.get("content-type"),
      cacheStatus: "hit",
    });
  }

  let pending = inFlight.get(cacheKey);
  if (!pending) {
    pending = (async (): Promise<RangeFetchResult> => {
      let object: R2ObjectBody | R2Object | null;
      try {
        object = await bucket.get(key, { range: r2GetRange(range) });
      } catch {
        const metadata = await bucket.head(key);
        return errorResult(416, "Range not satisfiable", {
          "Content-Range": `bytes */${metadata?.size ?? "*"}`,
        });
      }
      if (!object) return errorResult(404, "Object not found");
      if (!("body" in object) || !object.body) {
        return errorResult(416, "Range not satisfiable", {
          "Content-Range": `bytes */${object.size}`,
        });
      }

      const { start, end, total } = resolveBounds(range, object);
      const buffer = await object.arrayBuffer();

      const metaHeaders = new Headers();
      object.writeHttpMetadata(metaHeaders);
      const contentType = metaHeaders.get("content-type");
      const etag = object.httpEtag;

      if (buffer.byteLength <= MAX_RANGE_CACHE_BYTES) {
        const cacheHeaders = new Headers();
        if (contentType) cacheHeaders.set("content-type", contentType);
        if (etag) cacheHeaders.set("etag", etag);
        cacheHeaders.set("X-Range-Start", String(start));
        cacheHeaders.set("X-Range-End", String(end));
        cacheHeaders.set("X-Range-Total", String(total));
        cacheHeaders.set(
          "Cache-Control",
          "public, immutable, max-age=31536000",
        );
        const put = cache.put(
          request,
          new Response(buffer.slice(0), {
            status: 200,
            headers: cacheHeaders,
          }),
        );
        if (waitUntil) {
          waitUntil(put);
        } else {
          await put.catch((error) => {
            console.error("range cache write failed", {
              key,
              range: range.cacheKey,
              error,
            });
          });
        }
      }

      return {
        ok: true,
        parts: { buffer, start, end, total, etag, contentType },
      };
    })().finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, pending);
  }

  timing?.addStage("range-cache-miss", 0);
  // Always mint a fresh Response — concurrent waiters must not share one body.
  return responseFromResult(await pending, "miss");
}

function rangeResponseFromParts(parts: {
  buffer: ArrayBuffer;
  start: number;
  end: number;
  total: number;
  etag: string | null;
  contentType: string | null;
  cacheStatus: "hit" | "miss";
}): Response {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Range": `bytes ${parts.start}-${parts.end}/${parts.total}`,
    "Content-Length": String(parts.buffer.byteLength),
    "Cache-Control": "public, immutable, max-age=31536000",
    "X-SS-Range-Cache": parts.cacheStatus,
  });
  if (parts.contentType) headers.set("content-type", parts.contentType);
  if (parts.etag) headers.set("etag", parts.etag);
  // Copy so concurrent waiters sharing one ArrayBuffer each get a usable body.
  return new Response(parts.buffer.slice(0), { status: 206, headers });
}

export async function fetchRangeArrayBuffer(
  bucket: R2Bucket,
  key: string,
  range: [number, number | null],
): Promise<ArrayBuffer> {
  const response = await getR2Range(
    bucket,
    key,
    `bytes=${range[0]}-${range[1] ?? ""}`,
  );
  if (response.status === 404) throw new Error("object_not_found");
  if (response.status !== 206) {
    throw new Error(`range_fetch_failed:${response.status}`);
  }
  return response.arrayBuffer();
}
