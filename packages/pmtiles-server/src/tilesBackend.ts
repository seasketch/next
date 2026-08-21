import { WorkerEntrypoint } from "cloudflare:workers";
import { TileType } from "pmtiles";
import { sliceByteRange } from "./byteRange";
import renderPreview from "./preview";
import renderMrtPreview from "./previewMrt";
import { PUBLIC_PREVIEW_ROUTE, PUBLIC_TILEJSON_ROUTE } from "./presentationRoutes";
import { createPMTiles, KeyNotFoundError, TileJSON } from "./tileset";
import { RequestTiming, withTiming } from "./timing";

const TILE_ROUTE = new RegExp(
  /^\/([0-9a-zA-Z\/!\-_\.\*\'\(\)]+)\/(\d+)\/(\d+)\/(\d+)\.(\w+)$/
);

const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/**
 * TileJSON is generated from the PMTiles archive — not a stored `.json` object.
 * Optional `projects/` prefix covers legacy Replace-tiles URLs.
 */
const TILEJSON_ROUTE = new RegExp(
  `^/((?:projects/)?[^/]+/public/(${UUID}))\\.json$`,
  "i"
);

/**
 * Whole-file downloads from the shared tiles/uploads R2 bucket
 * (`{uuid}.pmtiles`, `{uuid}.geojson.json`, `{uuid}/metadata.xml`, …).
 */
const OBJECT_ROUTE = new RegExp(
  `^/((?:projects/)?[^/]+/public/(${UUID})(?:(?:\\.[a-zA-Z0-9]+)+|/(?:[^/]+)+))$`,
  "i"
);

const PREVIEW_ROUTE = new RegExp(
  `^/((?:projects/)?[^/]+/public/(${UUID}))/?$`,
  "i"
);

/** Sanitize for Content-Disposition; mirrors uploads-server quoting. */
function contentDispositionFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

// Tileset urls are content-addressed (data updates publish a new filename),
// so responses can be cached forever. Workers Caching (enabled in
// wrangler.toml) serves repeat requests without invoking this worker.
const IMMUTABLE = "public, immutable, max-age=31536000";

function contentTypeForTileType(tileType: TileType, ext?: string) {
  if (ext === "mrt") return "application/octet-stream";
  switch (tileType) {
    case TileType.Png:
      return "image/png";
    case TileType.Jpeg:
      return "image/jpeg";
    case TileType.Webp:
      return "image/webp";
    case TileType.Avif:
      return "image/avif";
    default:
      return "application/x-protobuf";
  }
}

function isMrtTileJson(json: TileJSON, metadata: Record<string, unknown>): boolean {
  return (
    json.format === "mrt" ||
    metadata.format === "mrt" ||
    Array.isArray(metadata.raster_layers)
  );
}

/**
 * Build TileJSON for `{name}.pmtiles`. Nothing is read from a stored `.json`
 * object — `getTileJson` fills bounds / zooms / name from the archive header
 * and JSON metadata, then we rewrite `tiles` and layer lists for this host.
 *
 * MRT archives (`format: "mrt"` or `raster_layers` in metadata) get
 * `{z}/{x}/{y}.mrt` URLs and `raster_layers`. Vector archives keep
 * `vector_layers` (defaulting to `[]` so preview HTML can iterate).
 */
async function archiveTileJson(
  pmtiles: ReturnType<typeof createPMTiles>,
  publicBase: string,
  name: string,
): Promise<TileJSON> {
  const metadata = (await pmtiles.getMetadata()) as Record<string, unknown>;
  const json = (await pmtiles.getTileJson(`${publicBase}/${name}`)) as TileJSON;
  if (isMrtTileJson(json, metadata)) {
    json.format = "mrt";
    json.tiles = [`${publicBase}/${name}/{z}/{x}/{y}.mrt`];
    if (Array.isArray(metadata.raster_layers)) {
      json.raster_layers = metadata.raster_layers as TileJSON["raster_layers"];
    }
    // getTileJson always copies metadata.vector_layers (undefined on MRT).
    // Do not default that to [] — GL JS 3.4 treats a present list as the
    // source-layer catalog and then rejects raster-array source-layer names.
    delete json.vector_layers;
  } else {
    json.vector_layers = json.vector_layers || [];
  }
  return json;
}

function applyTiming(headers: Headers, timing: RequestTiming) {
  const value = timing.toHeader();
  if (value) {
    headers.set("Server-Timing", value);
  }
  // Expose Server-Timing to browser JS / DevTools across CORS.
  headers.set("Timing-Allow-Origin", "*");
}

/**
 * Shared PMTiles / TileJSON / preview handler for `/projects/...` paths
 * (credentials already stripped by the default gateway).
 *
 * Workers Caching is enabled for this export (`wrangler.toml`) so immutable
 * tile/TileJSON responses can be served without re-invoking the Worker.
 */
export class TilesBackend extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return handleTilesBackendRequest(request, this.env);
  }
}

/** Exported for unit tests; production entrypoint is {@link TilesBackend}. */
export async function handleTilesBackendRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const timing = new RequestTiming();
  return withTiming(timing, () => handle(request, env, timing));
}

async function handle(
  request: Request,
  env: Env,
  timing: RequestTiming
): Promise<Response> {
  const started = performance.now();
  const url = new URL(request.url);

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", IMMUTABLE);

  const respond = (response: Response) => {
    timing.addStage("total", performance.now() - started);
    const out = new Headers(response.headers);
    applyTiming(out, timing);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: out,
    });
  };

  if (/favicon\.ico/.test(url.pathname)) {
    return respond(new Response(null, { status: 404 }));
  }

  const publicBase = `https://${env.PUBLIC_HOSTNAME || url.hostname}`;

  try {
    const tileMatch = url.pathname.match(TILE_ROUTE);
    if (tileMatch) {
      const name = tileMatch[1];
      const z = +tileMatch[2];
      const x = +tileMatch[3];
      const y = +tileMatch[4];

      const pmtiles = createPMTiles(name, env.TILES_BUCKET);
      const header = await pmtiles.getHeader();
      const ext = tileMatch[5]?.toLowerCase();
      const world = 1 << z;
      if (
        z < header.minZoom ||
        z > header.maxZoom ||
        x < 0 ||
        y < 0 ||
        x >= world ||
        y >= world
      ) {
        return respond(
          new Response("Tile not found", { status: 404, headers })
        );
      }
      const tile = await timing.measure("tile", () => pmtiles.getZxy(z, x, y));
      if (!tile) {
        // Vector/image empty tiles are 204. MRT must be 404: GL JS parses a
        // 204 body as a tile and throws "File is not a valid MRT."
        // Keep the default immutable cache — a miss in this archive is
        // permanent (same content-addressed assumption as 200s). Do not
        // synthesize an all-nodata MRT: GL JS would Range-probe, parse,
        // and upload a transparent texture for every ocean tile.
        if (ext === "mrt") {
          return respond(
            new Response("Tile not found", { status: 404, headers })
          );
        }
        return respond(new Response(null, { status: 204, headers }));
      }
      headers.set("Content-Type", contentTypeForTileType(header.tileType, ext));
      headers.set("Accept-Ranges", "bytes");
      headers.set(
        "Access-Control-Expose-Headers",
        "Content-Range, Accept-Ranges, Content-Length, Server-Timing",
      );
      if (ext === "mrt") {
        const sliced = sliceByteRange(tile.data, request.headers.get("range"));
        if (sliced.status === 416) {
          headers.set("Content-Range", sliced.contentRange ?? `bytes */${tile.data.byteLength}`);
          headers.set("Cache-Control", "private, no-store");
          return respond(new Response(null, { status: 416, headers }));
        }
        if (sliced.status === 206) {
          headers.set("Content-Range", sliced.contentRange!);
          headers.set("Cache-Control", "private, no-store");
          return respond(new Response(sliced.body, { status: 206, headers }));
        }
      }
      return respond(new Response(tile.data, { headers }));
    }

    const publicTilejsonMatch = url.pathname.match(PUBLIC_TILEJSON_ROUTE);
    const tilejsonMatch =
      publicTilejsonMatch ?? url.pathname.match(TILEJSON_ROUTE);
    if (tilejsonMatch) {
      const name = tilejsonMatch[1];
      const pmtiles = createPMTiles(name, env.TILES_BUCKET);
      const tilejson = await timing.measure("tilejson", () =>
        archiveTileJson(pmtiles, publicBase, name)
      );
      headers.set("Content-Type", "application/json;charset=UTF-8");
      if (tilejson.format === "mrt") {
        // Synthesized from archive metadata; must not be year-immutable or
        // a TileJSON bug (empty vector_layers) stays cached after deploy.
        headers.set("Cache-Control", "public, max-age=300");
      }
      return respond(new Response(JSON.stringify(tilejson), { headers }));
    }

    // Whole-file downloads (GeoJSON / FGB / PMTiles / originals). Same R2
    // bucket as uploads-server; `?download=` sets Content-Disposition.
    const objectMatch = url.pathname.match(OBJECT_ROUTE);
    if (
      objectMatch &&
      !TILEJSON_ROUTE.test(url.pathname) &&
      !PUBLIC_TILEJSON_ROUTE.test(url.pathname)
    ) {
      const key = objectMatch[1];
      const downloadParam = url.searchParams.get("download");

      if (request.method === "HEAD") {
        const head = await timing.measure("object", () =>
          env.TILES_BUCKET.head(key)
        );
        if (head === null) {
          return respond(
            new Response("Object not found", { status: 404, headers })
          );
        }
        head.writeHttpMetadata(headers);
        headers.set("etag", head.httpEtag);
        headers.set("Content-Length", String(head.size));
        if (downloadParam && downloadParam.length > 0) {
          headers.set(
            "Content-Disposition",
            `attachment; filename="${contentDispositionFilename(downloadParam)}"`
          );
        }
        return respond(new Response(null, { status: 200, headers }));
      }

      const object = await timing.measure("object", () =>
        env.TILES_BUCKET.get(key, {
          range: request.headers,
        })
      );
      if (object === null) {
        return respond(
          new Response("Object not found", { status: 404, headers })
        );
      }

      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      if (downloadParam && downloadParam.length > 0) {
        headers.set(
          "Content-Disposition",
          `attachment; filename="${contentDispositionFilename(downloadParam)}"`
        );
      }
      if (object.range) {
        // R2Range is a union; uploads-server uses the same cast for offset/end.
        const range = object.range as { offset?: number; end?: number };
        if (range.offset !== undefined && range.end !== undefined) {
          headers.set(
            "content-range",
            `bytes ${range.offset}-${range.end}/${object.size}`
          );
        }
      }
      const status =
        request.headers.get("range") !== null && object.body ? 206 : 200;
      return respond(new Response(object.body, { status, headers }));
    }

    const publicPreviewMatch = url.pathname.match(PUBLIC_PREVIEW_ROUTE);
    const previewMatch = url.pathname.match(PREVIEW_ROUTE);
    if (publicPreviewMatch || previewMatch) {
      if (!env.MAPBOX_ACCESS_TOKEN) {
        return respond(
          new Response("MAPBOX_ACCESS_TOKEN not set.", { status: 500 })
        );
      }
      const name = (publicPreviewMatch ?? previewMatch)![1];
      const pmtiles = createPMTiles(name, env.TILES_BUCKET);
      const tilejson = (await timing.measure("tilejson", () =>
        archiveTileJson(pmtiles, publicBase, name)
      )) as TileJSON;
      tilejson.vector_layers = tilejson.vector_layers || [];
      headers.set("Content-Type", "text/html");
      headers.set("Cache-Control", "no-store");
      const html =
        tilejson.format === "mrt"
          ? renderMrtPreview(
              tilejson,
              env.MAPBOX_ACCESS_TOKEN,
              `${publicBase}/${name}.json`,
            )
          : renderPreview(tilejson, env.MAPBOX_ACCESS_TOKEN);
      return respond(new Response(html, { headers }));
    }
  } catch (e) {
    if (e instanceof KeyNotFoundError) {
      return respond(
        new Response("Tileset not found", { status: 404, headers })
      );
    }
    throw e;
  }

  return respond(new Response("Invalid tile URL", { status: 400 }));
}
