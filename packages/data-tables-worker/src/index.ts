import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { FileMetaData, parquetMetadataAsync } from "hyparquet";
import {
  canonicalQueryString,
  parseQueryParams,
  QueryError,
} from "./params";
import { getR2Object, openR2File } from "./engine/asyncBuffer";
import { planQuery } from "./engine/plan";
import { executeQuery } from "./engine/execute";
import { queryUiHtml } from "./ui/html";

/**
 * data-tables-worker
 *
 * Serves cacheable GET queries over parquet data tables stored in R2, e.g.
 *
 *   GET /projects/{slug}/public/{sourceUuid}/dataTables/{uploadId}/query
 *     ?groupBy=site&op=mean&column=count&q.year=2018&q.classcode=PYCHEL
 *
 * Content negotiation: text/html requests receive an interactive query UI;
 * application/json (or f=json) receives query results.
 */

type Bindings = { Bindings: Env; Variables: { requestStart: number } };

const app = new Hono<Bindings>();

/** Browser cache lifetime for query responses */
const BROWSER_MAX_AGE = 86400;
/** CDN/edge cache lifetime. Table paths are versioned (a replacement gets a
 * new uploadId directory) so long edge lifetimes are safe. Workers Cache
 * (`cache.enabled` in wrangler.jsonc) serves identical GET requests from the
 * edge without invoking this Worker. */
const EDGE_MAX_AGE = 604800;

// Registered before CORS so it captures time spent in Hono's own routing and
// middleware, not just our handler logic.
app.use("*", async (c, next) => {
  c.set("requestStart", Date.now());
  await next();
});

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    maxAge: 86400,
  })
);

function isDev(env: Env): boolean {
  return !!env.DEV;
}

/** Parsed parquet footers are small (KBs) and immutable per etag, so keep
 * them in isolate memory across requests. */
const MAX_METADATA_ENTRIES = 100;
const metadataCache = new Map<string, FileMetaData>();

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

/**
 * Collects named phase durations and renders them as a `Server-Timing`
 * header so the browser's network panel can show where server time actually
 * goes -- including phases before/outside the JSON body's own `timing`
 * block (cache lookups, Hono/CORS overhead, isolate cold-start work).
 */
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
      { status: error.status }
    );
  }
  console.error(
    JSON.stringify({
      message: "query execution failed",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  );
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

app.get("*", async (c) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;

  if (pathname.endsWith("/query")) {
    const tablePath = pathname.slice(1, -"/query".length);
    if (!tablePath) {
      return Response.json({ error: "Missing table path" }, { status: 404 });
    }
    return handleQuery(c, tablePath, url);
  }

  if (pathname.endsWith("/column-stats.json")) {
    return handleColumnStats(c, pathname.slice(1));
  }

  if (pathname.endsWith("/data.parquet")) {
    return handleParquetDownload(c, pathname.slice(1));
  }

  return Response.json(
    {
      error: "Not found. Query endpoint is {tablePath}/query",
    },
    { status: 404 }
  );
});

type AppContext = Context<Bindings>;

async function handleStaticObject(
  c: AppContext,
  key: string,
  contentType: string,
  downloadFilename: string
): Promise<Response> {
  const dev = isDev(c.env);
  const data = await getR2Object({ bucket: c.env.SSN_TILES, key, dev });
  if (!data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${downloadFilename}"`,
      "Cache-Control": dev
        ? "no-store"
        : `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${EDGE_MAX_AGE}, immutable`,
    },
  });
}

async function handleColumnStats(
  c: AppContext,
  key: string
): Promise<Response> {
  return handleStaticObject(c, key, "application/json", "column-stats.json");
}

async function handleParquetDownload(
  c: AppContext,
  key: string
): Promise<Response> {
  return handleStaticObject(c, key, "application/octet-stream", "data.parquet");
}

async function handleQuery(
  c: AppContext,
  tablePath: string,
  url: URL
): Promise<Response> {
  const dev = isDev(c.env);
  const timer = new Timer(c.get("requestStart"));

  let query;
  try {
    query = parseQueryParams(url.searchParams);
  } catch (error) {
    return errorResponse(error);
  }
  timer.mark("parse");

  // Content negotiation: explicit f param wins, otherwise Accept header.
  const accept = c.req.header("accept") || "";
  const wantsHtml =
    query.format === "html" ||
    (query.format === null && accept.includes("text/html"));
  if (wantsHtml) {
    return new Response(queryUiHtml(tablePath), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": dev ? "no-store" : "public, max-age=300",
      },
    });
  }

  const canonicalQuery = canonicalQueryString(url.searchParams);
  const started = Date.now();
  try {
    const source = await openR2File({
      bucket: c.env.SSN_TILES,
      key: `${tablePath}/data.parquet`,
      dev,
    });
    timer.mark("open");
    if (!source) {
      throw new QueryError(
        `No data table found at "${tablePath}/data.parquet".`,
        404
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
    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
        "Server-Timing": timer.header(),
        Vary: "Accept",
        "Cache-Control": dev
          ? "no-store"
          : `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${EDGE_MAX_AGE}, immutable`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Wraps Hono's own fetch entirely, timing it from *outside* any of our
 * routing/middleware. Compare `X-Worker-Wall-Ms` against the browser's TTFB:
 * if they're close, the missing time is inside our JS (a hidden await);
 * if this is small while TTFB is large, the gap is in Cloudflare's edge
 * dispatch/network layer, outside anything our code controls.
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const t0 = Date.now();
    const response = await app.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("X-Worker-Wall-Ms", String(Date.now() - t0));
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};
