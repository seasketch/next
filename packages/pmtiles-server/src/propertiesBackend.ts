import { WorkerEntrypoint } from "cloudflare:workers";
import { normalizeObjectKey } from "./resource";
import { bboxForFeature } from "./properties/bbox";
import { evaluateCql2JSONQuery } from "./properties/cql2";
import { readFgbRecords } from "./properties/source";

export class PropertiesBackend extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return handlePropertiesRequest(request, this.env, (promise) =>
      this.ctx.waitUntil(promise),
    );
  }
}

export async function handlePropertiesRequest(
  request: Request,
  env: Env,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }
  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset");
  const key = dataset && normalizeObjectKey(dataset);
  if (!key) return jsonError("A valid dataset is required", 400);

  let cql2: unknown = null;
  const encodedQuery = url.searchParams.get("cql2JSONQuery");
  if (encodedQuery) {
    try {
      cql2 = JSON.parse(encodedQuery);
      evaluateCql2JSONQuery(cql2, {});
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Invalid CQL2 query",
        400,
      );
    }
  }

  const includeValue =
    url.searchParams.get("include") ??
    url.searchParams.get("includeProperties");
  const include = includeValue
    ? includeValue.split(",").map((value) => value.trim()).filter(Boolean)
    : null;
  const includeBbox = url.searchParams.get("bbox") === "true";

  try {
    const records = await readFgbRecords(
      env.TILES_BUCKET,
      key,
      includeBbox,
      waitUntil,
    );
    const output: Record<string, unknown>[] = [];
    for (const record of records) {
      if (cql2 && !evaluateCql2JSONQuery(cql2, record.properties)) continue;
      const properties: Record<string, unknown> = include
        ? Object.fromEntries(
            Object.entries(record.properties).filter(
              ([property]) =>
                property.startsWith("__") || include.includes(property),
            ),
          )
        : { ...record.properties };
      if (includeBbox && record.feature) {
        properties.__bbox = bboxForFeature(record.feature);
      }
      output.push(properties);
    }
    return new Response(JSON.stringify(output), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Timing-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "properties_failed";
    if (message === "object_not_found") return jsonError("Dataset not found", 404);
    if (message.startsWith("invalid_") || message.startsWith("flatgeobuf_")) {
      return jsonError(message, 400);
    }
    console.error("properties request failed", { key, error: message });
    return jsonError("Unable to read dataset properties", 500);
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
