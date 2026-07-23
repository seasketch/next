import { WorkerEntrypoint } from "cloudflare:workers";
import { FileMetaData, parquetMetadataAsync } from "hyparquet";
import { openR2File } from "./dataTables/engine/asyncBuffer";
import { executeQuery } from "./dataTables/engine/execute";
import { planQuery } from "./dataTables/engine/plan";
import {
  canonicalQueryString,
  parseQueryParams,
  QueryError,
} from "./dataTables/params";
import { queryUiHtml } from "./dataTables/ui/html";

/** Browser cache lifetime for query JSON responses. */
const BROWSER_MAX_AGE = 86400;
/** CDN/edge cache lifetime. Table paths are versioned per uploadId. */
const EDGE_MAX_AGE = 604800;
/** Default page size for raw-row queries when the client omits `limit`;
 * prevents accidentally materializing an entire table as JSON. */
const RAW_DEFAULT_LIMIT = 10000;

/** Parsed parquet footers are small and immutable per etag. */
const MAX_METADATA_ENTRIES = 100;
const metadataCache = new Map<string, FileMetaData>();

/**
 * Cached entrypoint: runs hyparquet aggregations over
 * `projects/{slug}/public/{uuid}/dataTables/{uploadId}/data.parquet`.
 *
 * Auth is enforced by the default gateway before this entrypoint is invoked;
 * data-table paths classify as `published` under the parent layer UUID.
 */
export class DataTablesBackend extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return handleDataTableQuery(request, this.env);
  }
}

export async function handleDataTableQuery(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!pathname.endsWith("/query")) {
    return jsonError("Not found. Query endpoint is {tablePath}/query", 404);
  }
  const tablePath = pathname.replace(/^\/+/, "").slice(0, -"/query".length);
  if (!tablePath) {
    return jsonError("Missing table path", 404);
  }

  const requestStart = Date.now();
  const timer = new Timer(requestStart);

  let query;
  try {
    query = parseQueryParams(url.searchParams);
  } catch (error) {
    return errorResponse(error);
  }
  if (query.ops.length === 0 && query.limit === null) {
    query = { ...query, limit: RAW_DEFAULT_LIMIT };
  }
  timer.mark("parse");

  // Format depends only on the URL (`f=html`), never the Accept header: the
  // Workers cache key is path+query, so Accept-based negotiation would let a
  // cached HTML response be served to JSON clients and vice versa.
  if (query.format === "html") {
    return new Response(queryUiHtml(tablePath), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const canonicalQuery = canonicalQueryString(url.searchParams);
  const started = Date.now();
  try {
    const source = await openR2File({
      bucket: env.TILES_BUCKET,
      key: `${tablePath}/data.parquet`,
    });
    timer.mark("open");
    if (!source) {
      throw new QueryError(
        `No data table found at "${tablePath}/data.parquet".`,
        404,
      );
    }

    const metadata = await getParquetMetadata(source);
    timer.mark("metadata");
    const planned = Date.now();
    const plan = await planQuery(metadata, query, source.buffer);
    timer.mark("plan");
    const result = await executeQuery({
      file: source.buffer,
      metadata,
      query,
      plan,
      cacheKey: `${tablePath}@${source.etag}`,
    });
    timer.mark("execute");
    const finished = Date.now();

    const body = {
      table: tablePath,
      totalRows: plan.totalRows,
      rowsScanned: result.rowsScanned,
      rowsMatched: result.rowsMatched,
      rowGroups: {
        total: plan.rowGroupsTotal,
        scanned: plan.rowGroupsScanned,
      },
      timing: {
        metadataMs: planned - started,
        executeMs: finished - planned,
        totalMs: finished - started,
      },
      ...(result.groups !== undefined
        ? { groups: result.groups }
        : { rows: result.rows }),
    };
    timer.mark("serialize");

    const etag = await makeETag(source.etag, canonicalQuery);
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
      "Server-Timing": timer.header(),
      "Access-Control-Allow-Origin": "*",
      "Timing-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${EDGE_MAX_AGE}, immutable`,
    };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(JSON.stringify(body), { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

async function getParquetMetadata(source: {
  buffer: Parameters<typeof parquetMetadataAsync>[0];
  etag: string;
}): Promise<FileMetaData> {
  const cached = metadataCache.get(source.etag);
  if (cached) {
    return cached;
  }
  const metadata = await parquetMetadataAsync(source.buffer);
  if (metadataCache.size >= MAX_METADATA_ENTRIES) {
    const oldest = metadataCache.keys().next().value;
    if (oldest !== undefined) {
      metadataCache.delete(oldest);
    }
  }
  metadataCache.set(source.etag, metadata);
  return metadata;
}

async function makeETag(objectEtag: string, canonicalQuery: string) {
  const data = new TextEncoder().encode(`${objectEtag}|${canonicalQuery}`);
  const digest = await crypto.subtle.digest("SHA-1", data);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `"${hex}"`;
}

class Timer {
  private marks: Array<[string, number]> = [];
  private last: number;

  constructor(start: number) {
    this.last = start;
  }

  mark(name: string): void {
    const now = Date.now();
    this.marks.push([name, now - this.last]);
    this.last = now;
  }

  header(): string {
    return this.marks.map(([name, dur]) => `${name};dur=${dur}`).join(", ");
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof QueryError) {
    return Response.json(
      { error: error.message, ...error.details },
      {
        status: error.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      },
    );
  }
  console.error(
    JSON.stringify({
      message: "data table query failed",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );
  return jsonError("Internal server error", 500);
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
