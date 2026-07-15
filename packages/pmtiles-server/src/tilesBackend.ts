import { WorkerEntrypoint } from "cloudflare:workers";
import { TileType } from "pmtiles";
import renderPreview from "./preview";
import { createPMTiles, KeyNotFoundError, TileJSON } from "./tileset";
import { RequestTiming, withTiming } from "./timing";

const TILE_ROUTE = new RegExp(
  /^\/([0-9a-zA-Z\/!\-_\.\*\'\(\)]+)\/(\d+)\/(\d+)\/(\d+)\.(\w+)$/
);

const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/** TileJSON is generated from the PMTiles archive — not a stored `.json` object. */
const TILEJSON_ROUTE = new RegExp(
  `^/(projects/[^/]+/public/(${UUID}))\\.json$`,
  "i"
);

/**
 * Whole-file downloads from the shared tiles/uploads R2 bucket
 * (`{uuid}.pmtiles`, `{uuid}.geojson.json`, `{uuid}/metadata.xml`, …).
 */
const OBJECT_ROUTE = new RegExp(
  `^/(projects/[^/]+/public/(${UUID})(?:(?:\\.[a-zA-Z0-9]+)+|/(?:[^/]+)+))$`,
  "i"
);

const PREVIEW_ROUTE = new RegExp(
  `^/(projects/[^/]+/public/(${UUID}))/?$`,
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

function contentTypeForTileType(tileType: TileType) {
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

function applyTiming(headers: Headers, timing: RequestTiming) {
  const value = timing.toHeader();
  if (value) {
    headers.set("Server-Timing", value);
  }
  // Expose Server-Timing to browser JS / DevTools across CORS.
  headers.set("Timing-Allow-Origin", "*");
}

/**
 * Shared PMTiles / TileJSON / preview handler. Used by both the legacy
 * `/projects/...` route and (after auth) the `/v2/{ns}/projects/...` gateway.
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
      const tile = await timing.measure("tile", () => pmtiles.getZxy(z, x, y));
      if (!tile) {
        const header = await pmtiles.getHeader();
        if (z < header.minZoom || z > header.maxZoom) {
          return respond(
            new Response("Tile not found", { status: 404, headers })
          );
        }
        return respond(new Response(null, { status: 204, headers }));
      }
      const header = await pmtiles.getHeader();
      headers.set("Content-Type", contentTypeForTileType(header.tileType));
      return respond(new Response(tile.data, { headers }));
    }

    const tilejsonMatch = url.pathname.match(TILEJSON_ROUTE);
    if (tilejsonMatch) {
      const name = tilejsonMatch[1];
      const pmtiles = createPMTiles(name, env.TILES_BUCKET);
      const tilejson = await timing.measure("tilejson", () =>
        pmtiles.getTileJson(`${publicBase}/${name}`)
      );
      headers.set("Content-Type", "application/json;charset=UTF-8");
      return respond(new Response(JSON.stringify(tilejson), { headers }));
    }

    // Whole-file downloads (GeoJSON / FGB / PMTiles / originals). Same R2
    // bucket as uploads-server; `?download=` sets Content-Disposition.
    const objectMatch = url.pathname.match(OBJECT_ROUTE);
    if (objectMatch && !TILEJSON_ROUTE.test(url.pathname)) {
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

    const previewMatch = url.pathname.match(PREVIEW_ROUTE);
    if (previewMatch) {
      if (!env.MAPBOX_ACCESS_TOKEN) {
        return respond(
          new Response("MAPBOX_ACCESS_TOKEN not set.", { status: 500 })
        );
      }
      const name = previewMatch[1];
      const pmtiles = createPMTiles(name, env.TILES_BUCKET);
      const tilejson = (await timing.measure("tilejson", () =>
        pmtiles.getTileJson(`${publicBase}/${name}`)
      )) as TileJSON;
      // Raster archives have no vector_layers; the preview template
      // expects an array.
      tilejson.vector_layers = tilejson.vector_layers || [];
      headers.set("Content-Type", "text/html");
      headers.set("Cache-Control", "no-store");
      return respond(
        new Response(renderPreview(tilejson, name, env.MAPBOX_ACCESS_TOKEN), {
          headers,
        })
      );
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
