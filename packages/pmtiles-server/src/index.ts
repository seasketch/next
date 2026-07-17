import { WorkerEntrypoint } from "cloudflare:workers";
import { corsPreflightResponse } from "./auth/cors";
import { handleClassifiedRequest } from "./gateway";
import { ObjectBackend } from "./objectBackend";
import { PropertiesBackend } from "./propertiesBackend";
import {
  aclNamespaceFromRequest,
  classifyResource,
  resourceAclEnabled,
} from "./resource";
import { TilesBackend } from "./tilesBackend";

export { ObjectBackend, PropertiesBackend, TilesBackend };

/**
 * Default entrypoint: authorize (using `?ns=` / `?access_token=`), then route
 * to TilesBackend, ObjectBackend, or PropertiesBackend.
 */
export default class extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (url.pathname === "/properties" || url.pathname === "/properties/") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Max-Age": "86400",
          },
        });
      }
      return corsPreflightResponse(request);
    }

    if (url.pathname === "/properties" || url.pathname === "/properties/") {
      return this.routeProperties(request);
    }

    const resource = classifyResource(url.pathname);
    if (!resource) return new Response("Invalid object path", { status: 400 });
    // uploads host is always opaque R2; tiles/overlay hosts prefer PMTiles
    // presentation (including root fixture archives like crdss-cells-6).
    const uploadsHost = url.hostname === "uploads.seasketch.org";
    const backend =
      uploadsHost || !isTilePresentationResource(resource)
        ? this.ctx.exports.ObjectBackend
        : this.ctx.exports.TilesBackend;

    return handleClassifiedRequest(
      request,
      this.env,
      { fetch: (req, options) => backend.fetch(req, options) },
      resource,
      {
        ns: aclNamespaceFromRequest(request),
        enforce: resourceAclEnabled(this.env, resource),
        waitUntil: (p) => this.ctx.waitUntil(p),
      },
    );
  }

  private async routeProperties(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const dataset = url.searchParams.get("dataset");
    const resource = dataset && classifyResource(dataset);
    if (!resource) {
      return new Response(JSON.stringify({ error: "A valid dataset is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }
    const response = await handleClassifiedRequest(
      request,
      this.env,
      {
        fetch: (req, options) =>
          this.ctx.exports.PropertiesBackend.fetch(req, options),
      },
      resource,
      {
        ns: aclNamespaceFromRequest(request),
        enforce: resourceAclEnabled(this.env, resource),
        backendPath: "/properties",
        includeQueryInCacheKey: true,
        waitUntil: (p) => this.ctx.waitUntil(p),
      },
    );
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.delete("Vary");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

const TILE_EXT = "(?:mvt|pbf|png|webp|jpg|jpeg)";
// Same archive-name charset as TilesBackend TILE_ROUTE.
const ARCHIVE_NAME = "[0-9a-zA-Z/!\\-_.*'()]+";
const FIXTURE_OR_PROJECT_ZXY = new RegExp(
  `^(?:${ARCHIVE_NAME})/\\d+/\\d+/\\d+\\.${TILE_EXT}$`,
  "i",
);
const PUBLISHED_TILEJSON_OR_PREVIEW = new RegExp(
  `^projects/[^/]+/public/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:$|\\.json$)`,
  "i",
);

/**
 * Paths that TilesBackend should serve as PMTiles TileJSON / ZXY / preview.
 * Includes root fixture archives (e.g. crdss-cells-6/0/0/0.pbf) and
 * published / data-library presentation URLs.
 */
function isTilePresentationResource(
  resource: ReturnType<typeof classifyResource>,
): boolean {
  if (!resource) return false;
  return (
    FIXTURE_OR_PROJECT_ZXY.test(resource.key) ||
    PUBLISHED_TILEJSON_OR_PREVIEW.test(resource.key)
  );
}
