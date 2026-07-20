/**
 * Authorize classified overlay requests, then forward to a backend with
 * credentials stripped from the URL and headers.
 */
import { applyCorsHeaders, corsPreflightResponse } from "./auth/cors";
import type { AuthDecision } from "./auth/types";
import { authorizeResource } from "./auth/resourceAuth";
import { maybeNotifyAuthDeny } from "./auth/slackAuthDeny";
import {
  isPublishedPreviewPath,
  type ResourceDescriptor,
} from "./resource";
import { renderTokenPrompt } from "./tokenPrompt";

type GatewayEnv = Env & {
  TILES_BUCKET: R2Bucket;
  JWKS_URL?: string;
  SLACK_WEBHOOK_URL?: string;
  AUTH_DENY_SLACK_ENABLED?: string;
};

type BackendFetcher = {
  fetch(
    request: Request,
    options?: { cf?: { cacheKey?: string } },
  ): Promise<Response>;
};

/**
 * Authorize a classified request and forward to a backend on allow.
 *
 * Credentials (`access_token`, `Authorization`, `ns`) are stripped before the
 * backend fetch so they never enter Workers cache keys.
 */
export async function handleClassifiedRequest(
  request: Request,
  env: GatewayEnv,
  backend: BackendFetcher,
  resource: ResourceDescriptor,
  options: {
    ns: string;
    enforce: boolean;
    backendPath?: string;
    includeQueryInCacheKey?: boolean;
    waitUntil?: (promise: Promise<unknown>) => void;
  },
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request);
  }

  const auth = await authorizeResource({
    request,
    env,
    ns: options.ns,
    resource,
    enforce: options.enforce,
  });
  const tokenType = auth.claims?.type ?? null;
  logAuthDecision({
    ns: options.ns,
    storageSlug: "slug" in resource ? resource.slug : "",
    aclSlug: auth.aclSlug ?? "",
    uuid: resource.kind === "published" ? resource.uuid : null,
    decision: auth.decision,
    fromCache: false,
    path: new URL(request.url).pathname,
    tokenMode: auth.tokenMode,
    tokenType,
  });
  if (!auth.decision.allowed) {
    maybeNotifyAuthDeny({
      env,
      request,
      resource,
      ns: options.ns,
      decision: auth.decision,
      tokenType,
      waitUntil: options.waitUntil,
    });
    return authDenyResponse(request, auth.decision);
  }
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
  backend: BackendFetcher,
  backendPath: string,
  decision: AuthDecision,
  includeQueryInCacheKey = false,
): Promise<Response> {
  const forwardUrl = new URL(request.url);
  forwardUrl.pathname = backendPath;
  forwardUrl.searchParams.delete("access_token");
  forwardUrl.searchParams.delete("ns");

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
      ? `${backendPath}?download=${download}`
      : `${backendPath}${includeQueryInCacheKey ? forwardUrl.search : ""}`;

  const backendResponse = await backend.fetch(forwardReq, {
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
    }),
  );
}

function authDenyResponse(
  request: Request,
  decision: AuthDecision,
): Response {
  const url = new URL(request.url);
  const wantsHtmlPreview =
    isPublishedPreviewPath(url.pathname) &&
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
        error: decision.reason.startsWith("invalid_token:")
          ? decision.reason.replace(/^invalid_token:/, "")
          : null,
      }),
      { status: decision.status, headers },
    );
  }

  const headers = new Headers({
    "Content-Type": "text/plain",
    "Cache-Control": "no-store",
    "X-SS-Tile-Auth": `deny:${decision.reason}`,
  });
  applyCorsHeaders(headers, request, { allowAuthorization: true });
  const body = decision.status === 401 ? "Unauthorized" : "Forbidden";
  return new Response(body, { status: decision.status, headers });
}

function acceptsHtml(request: Request): boolean {
  const accept = request.headers.get("Accept") || "";
  // Browser navigations typically include text/html; tile clients usually don't.
  if (!accept || accept === "*/*") return true;
  return /text\/html/i.test(accept);
}

function decorateGatewayResponse(
  request: Request,
  backendResponse: Response,
  decision: AuthDecision,
): Response {
  const headers = new Headers(backendResponse.headers);
  applyCorsHeaders(headers, request, { allowAuthorization: true });
  headers.set(
    "X-SS-Tile-Auth",
    `allow:${decision.reason}:${decision.aclClass}`,
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
