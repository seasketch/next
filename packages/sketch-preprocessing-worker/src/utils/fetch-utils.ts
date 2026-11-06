import { Context } from "hono";
import type { R2Bucket, R2ObjectBody } from "@cloudflare/workers-types";
import { resolveStorageUrl } from "overlay-engine";
import { bucketHosts, isBoundBucket } from "./bucket-host";

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<ArrayBuffer>>();

function getRequestKey(key: string, range: [number, number | null]): string {
  return `${key}:${range[0]}-${range[1] ?? ""}`;
}

/**
 * Objects on this deployment's uploads host are in the bound bucket, so they
 * are read through the R2 binding and ACL does not apply. `wrangler dev`
 * sets UPLOADS_HOST to the local uploads port. A production EEZ or land URL
 * is not in that local bucket, and is fetched over HTTP.
 */
async function readRange(
  key: string,
  bucket: R2Bucket,
  range: [number, number | null],
  ctx: Context
): Promise<ArrayBuffer> {
  const target = resolveStorageUrl(key);
  const objectKey = decodeURIComponent(target.pathname.replace(/^\//, ""));
  const rangeHeader = `bytes=${range[0]}-${range[1] ? range[1] : ""}`;
  const cacheKey = `${target.href}?${rangeHeader}`;
  const request = new Request(cacheKey);
  const cached = await caches.default.match(request);
  if (cached) {
    return await cached.arrayBuffer();
  }

  let buffer: ArrayBuffer;
  const bound = isBoundBucket(target, bucketHosts(ctx.env));
  console.log(
    bound
      ? `r2 ${objectKey} ${rangeHeader}`
      : `http ${target.host} ${rangeHeader}`
  );
  if (bound) {
    const object: R2ObjectBody | null = await bucket.get(objectKey, {
      range: new Headers({ Range: rangeHeader }),
    });
    if (!object) {
      throw new Error(`Bound bucket has no object ${objectKey}`);
    }
    buffer = await object.arrayBuffer();
  } else {
    const response = await fetch(target.href, {
      headers: { Range: rangeHeader },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${target.href}`);
    }
    buffer = await response.arrayBuffer();
  }

  const stored = new Response(buffer, {
    status: 200,
    headers: new Headers({
      "Content-Type": "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Content-Range": `bytes ${range[0]}-${range[1] ? range[1] : ""}/*`,
    }),
  });
  ctx.executionCtx.waitUntil(caches.default.put(request, stored.clone()));
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
    const request = readRange(key, ctx.env.SSN_TILES, range, ctx)
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
