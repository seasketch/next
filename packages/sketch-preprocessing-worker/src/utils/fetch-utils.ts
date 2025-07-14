import { Context } from "hono";
import type { R2Bucket, R2ObjectBody } from "@cloudflare/workers-types";

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<ArrayBuffer>>();

function getRequestKey(key: string, range: [number, number | null]): string {
  return `${key}:${range[0]}-${range[1] ?? ""}`;
}

async function fetchRangeFromBucket(
  key: string,
  bucket: R2Bucket,
  range: [number, number | null],
  ctx: Context,
  skipCache: boolean = false
): Promise<ArrayBuffer> {
  const cacheKey =
    "https://uploads.seasketch.org/" +
    key +
    `?bytes=${range[0]}-${range[1] ? range[1] : ""}`;
  const request = new Request(cacheKey);

  if (!skipCache) {
    const cached = await caches.default.match(request);
    if (cached) {
      return await cached.arrayBuffer();
    }
  }

  let body: Response | R2ObjectBody | null;
  if (ctx.env.DEV) {
    console.warn("dev mode,fetching via https");
    const res = await fetch("https://uploads.seasketch.org/" + key, {
      headers: {
        Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
      },
    });
    body = res;
  } else {
    body = await bucket.get(key, {
      range: new Headers({
        Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
      }),
    });
  }

  if (!body) {
    throw new Error("Range request to R2 bucket did not return a body");
  }

  const buffer = await body.arrayBuffer();
  const response = new Response(buffer, {
    status: 200,
    headers: new Headers({
      "Content-Type": "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Content-Range": `bytes ${range[0]}-${range[1] ? range[1] : ""}/*`,
    }),
  });

  if (!skipCache) {
    ctx.executionCtx.waitUntil(caches.default.put(request, response.clone()));
  }
  return buffer;
}

export function makeFetchRangeFn(ctx: Context) {
  return async (
    key: string,
    range: [number, number | null]
  ): Promise<ArrayBuffer> => {
    const requestKey = getRequestKey(key, range);
    const existingRequest = inFlightRequests.get(requestKey);
    if (existingRequest) {
      return existingRequest;
    }

    console.log(`fetching ${range[1] ? range[1] - range[0] : "unknown"} bytes`);
    const request = fetchRangeFromBucket(key, ctx.env.SSN_TILES, range, ctx)
      .then((buffer) => {
        inFlightRequests.delete(requestKey);
        return buffer;
      })
      .catch((error) => {
        inFlightRequests.delete(requestKey);
        throw error;
      });

    inFlightRequests.set(requestKey, request);
    return request;
  };
}
