import { TileType } from "pmtiles";
import renderPreview from "./preview";
import { createPMTiles, KeyNotFoundError, TileJSON } from "./tileset";
import { RequestTiming, withTiming } from "./timing";

declare global {
  interface Env {
    MAPBOX_ACCESS_TOKEN?: string;
  }
}

const TILE_ROUTE = new RegExp(
  /^\/([0-9a-zA-Z\/!\-_\.\*\'\(\)]+)\/(\d+)\/(\d+)\/(\d+)\.(\w+)$/
);

const TILEJSON_ROUTE = new RegExp(/^\/([0-9a-zA-Z\/!\-_\.\*\'\(\)]+).json$/);
const PREVIEW_ROUTE = new RegExp(/^\/([0-9a-zA-Z\/!\-_\.\*\'\(\)]+)/);

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

export default {
  async fetch(
    request: Request,
    env: Env,
    context: ExecutionContext
  ): Promise<Response> {
    const timing = new RequestTiming();
    return withTiming(timing, () => handle(request, env, timing));
  },
};

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

    const tileMatch = url.pathname.match(TILE_ROUTE);
    if (tileMatch) {
      const name = tileMatch[1];
      const z = +tileMatch[2];
      const x = +tileMatch[3];
      const y = +tileMatch[4];

      const pmtiles = createPMTiles(name, env.TILES_BUCKET);
      const header = await timing.measure("header", () => pmtiles.getHeader());
      if (z < header.minZoom || z > header.maxZoom) {
        return respond(
          new Response("Tile not found", { status: 404, headers })
        );
      }

      const tile = await timing.measure("tile", () =>
        pmtiles.getZxy(z, x, y)
      );
      if (!tile) {
        return respond(new Response(null, { status: 204, headers }));
      }
      headers.set("Content-Type", contentTypeForTileType(header.tileType));
      return respond(new Response(tile.data, { headers }));
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
