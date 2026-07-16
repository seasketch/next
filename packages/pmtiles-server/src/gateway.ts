import { applyCorsHeaders, corsPreflightResponse } from "./auth/cors";
import {
  parseV2Path,
  parseV2SubdividedPath,
  isV2PreviewPath,
} from "./auth/path";
import type { AuthDecision } from "./auth/types";
import { authorizeResource } from "./auth/resourceAuth";
import { classifyResource } from "./resource";
import type { ResourceDescriptor } from "./resource";
import { renderTokenPrompt } from "./tokenPrompt";

type GatewayEnv = Env & {
  TILES_BUCKET: R2Bucket;
  JWKS_URL?: string;
};

type TilesBackendFetcher = {
  fetch(request: Request, options?: { cf?: { cacheKey?: string } }): Promise<Response>;
};

/**
 * Authorize a /v2/{ns}/projects/{storageSlug}/public/{uuid}... request and
 * forward to TilesBackend on allow.
 *
 * ACL docs are keyed by the *project* slug (from the map-access JWT when
 * present, otherwise the storage path slug). Storage path slug may differ from
 * the project slug when a project was renamed or data_source URLs were copied.
 *
 * Exception: storage slug `superuser` is the shared data library — always
 * public, no ACL doc or token required.
 */
export async function handleGatewayRequest(
  request: Request,
  env: GatewayEnv,
  tilesBackend: TilesBackendFetcher
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request);
  }

  const url = new URL(request.url);
  const parts = parseV2Path(url.pathname);
  const subdivided = parseV2SubdividedPath(url.pathname);
  if (!parts && !subdivided) {
    const headers = new Headers({ "Content-Type": "text/plain" });
    applyCorsHeaders(headers, request, { allowAuthorization: true });
    return new Response("Invalid /v2 tile URL", { status: 400, headers });
  }

  const parsed = parts ?? subdivided!;
  const { ns, slug: storageSlug, legacyPath } = parsed;
  const resource = classifyResource(legacyPath);
  if (!resource) {
    return new Response("Invalid /v2 object URL", { status: 400 });
  }
  const auth = await authorizeResource({
    request,
    env,
    ns,
    resource,
    enforce: true,
  });
  const { decision, tokenMode } = auth;

  logAuthDecision({
    ns,
    storageSlug,
    aclSlug: auth.aclSlug || storageSlug,
    uuid: parts?.uuid ?? null,
    decision,
    fromCache: false,
    path: url.pathname,
    tokenMode,
    tokenType: auth.claims?.type ?? null,
  });

  if (!decision.allowed) {
    return authDenyResponse(request, decision);
  }

  return forwardToBackend(request, tilesBackend, legacyPath, decision);
}

/** Authorize a classified legacy object/properties request and forward it. */
export async function handleClassifiedRequest(
  request: Request,
  env: GatewayEnv,
  backend: TilesBackendFetcher,
  resource: ResourceDescriptor,
  options: {
    ns: string;
    enforce: boolean;
    backendPath?: string;
    includeQueryInCacheKey?: boolean;
  },
): Promise<Response> {
  const auth = await authorizeResource({
    request,
    env,
    ns: options.ns,
    resource,
    enforce: options.enforce,
  });
  logAuthDecision({
    ns: options.ns,
    storageSlug: "slug" in resource ? resource.slug : "",
    aclSlug: auth.aclSlug ?? "",
    uuid: resource.kind === "published" ? resource.uuid : null,
    decision: auth.decision,
    fromCache: false,
    path: new URL(request.url).pathname,
    tokenMode: auth.tokenMode,
    tokenType: auth.claims?.type ?? null,
  });
  if (!auth.decision.allowed) return authDenyResponse(request, auth.decision);
  return forwardToBackend(
    request,
    backend,
    options.backendPath ?? `/${resource.key}`,
    auth.decision,
    options.includeQueryInCacheKey,
  );
}

async function forwardToBackend(
  request: Request,
  tilesBackend: TilesBackendFetcher,
  legacyPath: string,
  decision: AuthDecision,
  includeQueryInCacheKey = false,
): Promise<Response> {
  const forwardUrl = new URL(request.url);
  forwardUrl.pathname = legacyPath;
  forwardUrl.searchParams.delete("access_token");

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete("Authorization");

  const forwardReq = new Request(forwardUrl.toString(), {
    method: request.method,
    headers: forwardHeaders,
  });

  // Include ?download= in the Workers cache key so Content-Disposition varies
  // by download filename without contaminating tile/TileJSON cache entries.
  const download = forwardUrl.searchParams.get("download");
  const cacheKey =
    download && download.length > 0
      ? `${legacyPath}?download=${download}`
      : `${legacyPath}${includeQueryInCacheKey ? forwardUrl.search : ""}`;

  const backendResponse = await tilesBackend.fetch(forwardReq, {
    cf: { cacheKey },
  });

  return decorateGatewayResponse(request, backendResponse, decision);
}

function logAuthDecision(args: {
  ns: string;
  storageSlug: string;
  aclSlug: string;
  uuid: string | null;
  decision: AuthDecision;
  fromCache: boolean;
  path: string;
  tokenMode?: "jwks" | "dev-trust" | null;
  tokenType?: "map-access" | "overlay-engine" | null;
}) {
  const {
    ns,
    storageSlug,
    aclSlug,
    uuid,
    decision,
    fromCache,
    path,
    tokenMode,
    tokenType,
  } = args;
  console.log(
    JSON.stringify({
      msg: "tile-auth",
      ns,
      storageSlug,
      aclSlug,
      uuid,
      path,
      allowed: decision.allowed,
      status: decision.status,
      reason: decision.reason,
      aclClass: decision.aclClass,
      hadToken: decision.hadToken,
      tokenMode: tokenMode ?? null,
      tokenType: tokenType ?? null,
      role: decision.role,
      groups: decision.groups,
      aclVersion: decision.aclVersion,
      fromCache,
    })
  );
}

export function authDenyResponse(
  request: Request,
  decision: AuthDecision,
): Response {
  const url = new URL(request.url);
  const wantsHtmlPreview =
    isV2PreviewPath(url.pathname) &&
    (request.method === "GET" || request.method === "HEAD") &&
    acceptsHtml(request);

  if (wantsHtmlPreview) {
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-SS-Tile-Auth": `deny:${decision.reason}`,
    });
    applyCorsHeaders(headers, request, { allowAuthorization: true });
    return new Response(
      renderTokenPrompt({
        hadToken: decision.hadToken,
        error:
          decision.reason.startsWith("invalid_token:")
            ? decision.reason.replace(/^invalid_token:/, "")
            : null,
      }),
      { status: decision.status, headers }
    );
  }

  const headers = new Headers({
    "Content-Type": "text/plain",
    "Cache-Control": "no-store",
    "X-SS-Tile-Auth": `deny:${decision.reason}`,
  });
  applyCorsHeaders(headers, request, { allowAuthorization: true });
  const body =
    decision.status === 401 ? "Unauthorized" : "Forbidden";
  return new Response(body, { status: decision.status, headers });
}

function acceptsHtml(request: Request): boolean {
  const accept = request.headers.get("Accept") || "";
  // Browser navigations typically include text/html; tile clients usually don't.
  if (!accept || accept === "*/*") return true;
  return /text\/html/i.test(accept);
}

export function decorateGatewayResponse(
  request: Request,
  backendResponse: Response,
  decision: AuthDecision
): Response {
  const headers = new Headers(backendResponse.headers);
  applyCorsHeaders(headers, request, { allowAuthorization: true });
  headers.set(
    "X-SS-Tile-Auth",
    `allow:${decision.reason}:${decision.aclClass}`
  );

  if (decision.aclClass !== "public") {
    headers.set("Cache-Control", "private, immutable, max-age=31536000");
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers,
  });
}
