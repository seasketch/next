import { WorkerEntrypoint } from "cloudflare:workers";
import { getR2Range } from "./rangeCache";
import { normalizeObjectKey } from "./resource";
import { RequestTiming, withTiming } from "./timing";

const IMMUTABLE = "public, immutable, max-age=31536000";

function safeFilename(value: string): string {
  return value.replace(/[\r\n"]/g, "_");
}

export class ObjectBackend extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return handleObjectRequest(request, this.env, (promise) =>
      this.ctx.waitUntil(promise),
    );
  }
}

export async function handleObjectRequest(
  request: Request,
  env: Env,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const timing = new RequestTiming();
  return withTiming(timing, async () => {
    const url = new URL(request.url);
    const key = normalizeObjectKey(url.pathname);
    if (!key) {
      return new Response("Invalid object path", { status: 400 });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const baseHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Accept-Ranges": "bytes",
      "Cache-Control": IMMUTABLE,
      "Timing-Allow-Origin": "*",
    });
    const download = url.searchParams.get("download");

    if (request.method === "HEAD") {
      const object = await env.TILES_BUCKET.head(key);
      if (!object) {
        return new Response("Object not found", {
          status: 404,
          headers: baseHeaders,
        });
      }
      object.writeHttpMetadata(baseHeaders);
      baseHeaders.set("etag", object.httpEtag);
      baseHeaders.set("Content-Length", String(object.size));
      if (download) {
        baseHeaders.set(
          "Content-Disposition",
          `attachment; filename="${safeFilename(download)}"`,
        );
      }
      return new Response(null, { headers: baseHeaders });
    }

    const range = request.headers.get("Range");
    if (range) {
      const response = await getR2Range(
        env.TILES_BUCKET,
        key,
        range,
        timing,
        waitUntil,
      );
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Timing-Allow-Origin", "*");
      if (download) {
        headers.set(
          "Content-Disposition",
          `attachment; filename="${safeFilename(download)}"`,
        );
      }
      const serverTiming = timing.toHeader();
      if (serverTiming) headers.set("Server-Timing", serverTiming);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const object = await env.TILES_BUCKET.get(key, {
      onlyIf: request.headers,
    });
    if (!object) {
      return new Response("Object not found", {
        status: 404,
        headers: baseHeaders,
      });
    }
    object.writeHttpMetadata(baseHeaders);
    baseHeaders.set("etag", object.httpEtag);
    baseHeaders.set("Content-Length", String(object.size));
    if (download) {
      baseHeaders.set(
        "Content-Disposition",
        `attachment; filename="${safeFilename(download)}"`,
      );
    }
    if (!("body" in object) || !object.body) {
      const conditional =
        request.headers.has("If-None-Match") ||
        request.headers.has("If-Modified-Since");
      return new Response(null, {
        status: conditional ? 304 : 412,
        headers: baseHeaders,
      });
    }
    return new Response(object.body, { headers: baseHeaders });
  });
}
