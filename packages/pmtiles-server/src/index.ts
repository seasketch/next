import { WorkerEntrypoint } from "cloudflare:workers";
import { corsPreflightResponse } from "./auth/cors";
import { DataTablesBackend } from "./dataTablesBackend";
import { handleClassifiedRequest } from "./gateway";
import { handleObjectRequest, ObjectBackend } from "./objectBackend";
import { PropertiesBackend } from "./propertiesBackend";
import {
  aclNamespaceFromRequest,
  classifyResource,
  resourceAclEnabled,
} from "./resource";
import { isTilePresentationKey } from "./presentationRoutes";
import { TilesBackend } from "./tilesBackend";
import { TaxonomyBackend } from "./taxonomyBackend";
import { authorizeTaxonomyProxy } from "./auth/taxonomyAuth";
import {
  handleOrgQuery,
  isOrgQueryPath,
  parseOrgQueryParams,
} from "./dataTables/orgQuery";
import { QueryError } from "./dataTables/params";
import { authorizeResource } from "./auth/resourceAuth";

export {
  DataTablesBackend,
  ObjectBackend,
  PropertiesBackend,
  TaxonomyBackend,
  TilesBackend,
};

/**
 * Default entrypoint: authorize (using `?ns=` / `?access_token=`), then route
 * to TilesBackend, ObjectBackend, PropertiesBackend, DataTablesBackend,
 * or TaxonomyBackend. `/orgQuery` authorizes each table prefix. `/taxonomy`
 * routes require the overlay-engine JWT.
 */
export default class extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (isTaxonomyPath(url.pathname)) {
        return new Response(null, { status: 204 });
      }
      if (
        url.pathname === "/properties" ||
        url.pathname === "/properties/" ||
        isOrgQueryPath(url.pathname) ||
        isDataTableQueryPath(url.pathname)
      ) {
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

    if (isOrgQueryPath(url.pathname)) {
      return this.routeOrgQuery(request);
    }

    if (isTaxonomyPath(url.pathname)) {
      return this.routeTaxonomy(request);
    }

    if (url.pathname === "/properties" || url.pathname === "/properties/") {
      return this.routeProperties(request);
    }

    if (isDataTableQueryPath(url.pathname)) {
      return this.routeDataTableQuery(request);
    }

    const resource = classifyResource(url.pathname);
    if (!resource) return new Response("Invalid object path", { status: 400 });
    // uploads host is always opaque R2; tiles/overlay hosts prefer PMTiles
    // presentation (including root fixture archives like crdss-cells-6).
    const uploadsHost = url.hostname === "uploads.seasketch.org";
    const useObjectBackend =
      uploadsHost || !isTilePresentationKey(resource.key);

    // ObjectBackend has Workers Caching disabled (Range must reach the Worker).
    // Call it in-process: a ctx.exports loopback adds no cache benefit and
    // intermittently never settles under concurrent eyeball requests (client
    // often fetches several column-stats.json files at once).
    const backend = useObjectBackend
      ? {
          fetch: (req: Request) =>
            handleObjectRequest(req, this.env, (p) => this.ctx.waitUntil(p)),
        }
      : {
          fetch: (
            req: Request,
            options?: { cf?: { cacheKey?: string } },
          ) => this.ctx.exports.TilesBackend.fetch(req, options),
        };

    return handleClassifiedRequest(request, this.env, backend, resource, {
      ns: aclNamespaceFromRequest(request),
      enforce: resourceAclEnabled(this.env, resource),
      waitUntil: (p) => this.ctx.waitUntil(p),
    });
  }

  /**
   * Multi-table organism search. Each `tables=` prefix is authorized the
   * same way as `/query`. Unauthorized refs are skipped; credentials are
   * stripped before the search runs so they never enter isolate cache keys.
   */
  private async routeOrgQuery(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "GET, OPTIONS",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    const url = new URL(request.url);
    let parsed;
    try {
      parsed = parseOrgQueryParams(url.searchParams);
    } catch (error) {
      const message =
        error instanceof QueryError ? error.message : "Invalid orgQuery";
      const status = error instanceof QueryError ? error.status : 400;
      return Response.json(
        { error: message },
        {
          status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const ns = aclNamespaceFromRequest(request);
    const allowed: string[] = [];
    for (const table of parsed.tables) {
      const resource = classifyResource(`${table}/organism-search.json`);
      if (!resource) continue;
      const auth = await authorizeResource({
        request,
        env: this.env,
        ns,
        resource,
        enforce: resourceAclEnabled(this.env, resource),
      });
      if (auth.decision.allowed) {
        allowed.push(table);
      }
    }
    if (allowed.length === 0) {
      return Response.json(
        { error: "Forbidden" },
        {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const forwardUrl = new URL(request.url);
    forwardUrl.searchParams.set("tables", allowed.join(","));
    forwardUrl.searchParams.delete("access_token");
    forwardUrl.searchParams.delete("ns");
    const headers = new Headers(request.headers);
    headers.delete("Authorization");
    return handleOrgQuery(
      new Request(forwardUrl.toString(), { method: "GET", headers }),
      this.env
    );
  }

  /**
   * Allowlisted WoRMS proxy. Auth is the same overlay-engine JWT the
   * other Lambdas already send to this host. Credentials are stripped before
   * TaxonomyBackend so the 1-hour Cache API key is the upstream URL only.
   */
  private async routeTaxonomy(request: Request): Promise<Response> {
    const auth = await authorizeTaxonomyProxy(request, this.env);
    if (!auth.ok) return auth.response;
    const forwardUrl = new URL(request.url);
    forwardUrl.searchParams.delete("access_token");
    forwardUrl.searchParams.delete("ns");
    const headers = new Headers(request.headers);
    headers.delete("Authorization");
    return this.ctx.exports.TaxonomyBackend.fetch(
      new Request(forwardUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
      })
    );
  }

  /**
   * Overlay data-table aggregations. Paths classify as `published` under the
   * parent layer UUID (`…/public/{uuid}/dataTables/{uploadId}/query`), so the
   * existing tiles ACL applies. Query string is part of the cache key.
   */
  private async routeDataTableQuery(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const resource = classifyResource(url.pathname);
    if (!resource) {
      return new Response(JSON.stringify({ error: "Invalid object path" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }
    return handleClassifiedRequest(
      request,
      this.env,
      {
        fetch: (req, options) =>
          this.ctx.exports.DataTablesBackend.fetch(req, options),
      },
      resource,
      {
        ns: aclNamespaceFromRequest(request),
        enforce: resourceAclEnabled(this.env, resource),
        includeQueryInCacheKey: true,
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

/** Allowlisted WoRMS proxy (TaxonomyBackend). */
function isTaxonomyPath(pathname: string): boolean {
  return pathname === "/taxonomy" || pathname.startsWith("/taxonomy/");
}

/** True for overlay data-table query / preview endpoints. */
function isDataTableQueryPath(pathname: string): boolean {
  return (
    pathname.includes("/dataTables/") &&
    (pathname.endsWith("/query") ||
      pathname.endsWith("/temporal-preview") ||
      pathname.endsWith("/nodata-preview"))
  );
}

